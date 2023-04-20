import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MongoRepository } from "typeorm";
import { PlugNmeet } from 'plugnmeet-sdk-js';
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import {
  CREATE_OPENCAST_EVENT,
  PLUGNMEET_RECORDER_INFO_KEY,
  PLUGNMEET_SERVICE,
  START_EPIPHAN_RECORDING,
  START_LIVEKIT_EGRESS_RECORDING, START_OPENCAST_INGEST, STOP_EPIPHAN_RECORDING, STOP_LIVEKIT_EGRESS_RECORDING
} from "../../app.constants";
import { Recorder } from "../entities/Recorder";
import { PlugNMeetTaskService } from "./plugnmeet.task.service";
import { PlugNMeetRecorderInfoDto } from "../dto/PlugNMeetRecorderInfoDto";
import { PlugNMeetToRecorder, RecorderToPlugNMeet, RecordingTasks } from "../../proto/plugnmeet_recorder_pb";
import { ConfigService } from "@nestjs/config";
import { ClientProxy } from "@nestjs/microservices";
import { StartEgressRecordingDto } from "../../livekit/dto/StartEgressRecordingDto";
import { firstValueFrom } from "rxjs";
import { StartEpiphanRecordingDto } from "../../epiphan/dto/StartEpiphanRecordingDto";
import { StopEgressRecordingDto } from "../../livekit/dto/StopEgressRecordingDto";
import { CreateOpencastEventDto } from "../../opencast/dto/CreateOpencastEventDto";
import { PlugNMeetHttpService } from "./plugnmeet.http.service";
import { StartOpencastIngestDto } from "../../opencast/dto/StartOpencastIngestDto";
import { randomStringGenerator } from "@nestjs/common/utils/random-string-generator.util";
import { StopEpiphanRecordingDto } from "../../epiphan/dto/StopEpiphanRecordingDto";
@Injectable()
export class PlugNMeetService {
  private readonly logger = new Logger(PlugNMeetService.name);
  private readonly PNMController: PlugNmeet;

  constructor(
    @InjectRepository(Recorder) private readonly recorderRepository: MongoRepository<Recorder>,
    @InjectRedis() private readonly redisClient: Redis,
    private readonly taskService: PlugNMeetTaskService,
    private readonly httpService: PlugNMeetHttpService,
    private readonly config: ConfigService,
    @Inject(PLUGNMEET_SERVICE) private readonly client: ClientProxy
  ) {
    this.PNMController = new PlugNmeet(
      config.getOrThrow<string>('plugnmeet.host'),
      config.getOrThrow<string>('plugnmeet.key'),
      config.getOrThrow<string>('plugnmeet.secret'),
    );
    this.addRecorders(config.getOrThrow<number>('appconfig.max_recorders'))
      .then(r => this.logger.debug(`Added ${r} recorders...`));
  }
  makeRecorderId(length) {
    let result = 'RECORDER_';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
  }
  async addRecorders(recorderCount: number) {
    const recorders = await this.recorderRepository.find();

    for (const recorder of recorders) {
      // Recorder is recording
      if (recorder.isRecording) {
        // Check if the room exists/is recording
        const roomInfo = await this.PNMController.getActiveRoomInfo({ room_id: recorder.roomId });
        // TODO: Possible fix to stupid logic?
        if (roomInfo.status && roomInfo.room) {
          if (roomInfo.room.room_info.is_recording) continue;
        }
      }

      // Assume not recording...
      recorder.isRecording = false;
      await this.recorderRepository.save(recorder);
      await this.addAvailableRecorder(recorder.recorderId);
    }

    // Add missing recorders if count has increased
    for (let i = 0; i < (recorderCount - recorders.length); i++) {
      const recorder = this.recorderRepository.create();
      recorder.isRecording = false;
      recorder.recorderId = this.makeRecorderId(16);
      await this.addAvailableRecorder(recorder.recorderId);
      await this.recorderRepository.insert(recorder);
    }
    return recorderCount;
  }

  async addAvailableRecorder(recorderId: string) {

    try {
      const now = Math.floor(new Date().getTime() / 1000);
      const recorderInfo: any = {};
      recorderInfo[recorderId] = JSON.stringify(<PlugNMeetRecorderInfoDto>{
        maxLimit: 1,
        currentProgress: 0,
        lastPing: now,
        created: now,
      });

      await this.redisClient.hset(PLUGNMEET_RECORDER_INFO_KEY, recorderInfo);
      this.logger.debug('Added recorder with id ', recorderId);
    } catch (e) {
      this.logger.error(e);
    }
    // Add recorder pinging cronjob
    this.taskService.addRecorderPing(recorderId);
  }

  async startRecording(payload: PlugNMeetToRecorder) {
    const recorder = await this.recorderRepository.findOne({ where: { isRecording: false } })
    if (recorder) {
      // Start livekit egress recording
      if (!await firstValueFrom(this.client.send<boolean>(START_LIVEKIT_EGRESS_RECORDING, <StartEgressRecordingDto>{
        recorderId: recorder.recorderId,
        roomId: payload.roomId,
      })))
      {
        // Cannot start livekit egress recording
        this.logger.error('Failed to start livekit egress recording!');
        await this.httpService.sendErrorMessage(payload, recorder.recorderId);
        return;
      }

      // Start epiphan recording
      if (!await firstValueFrom(this.client.send<boolean>(START_EPIPHAN_RECORDING, <StartEpiphanRecordingDto>{
        recorderId: recorder.recorderId,
        roomSid:  recorder.roomSid,
        epiphanId: "LBTUEpiphanTest1"
      })))
      {
        // Cannot start epiphan recording
        this.logger.error('Failed to start epiphan recording!');
        await this.client.emit(STOP_LIVEKIT_EGRESS_RECORDING, <StopEgressRecordingDto>{
          recorderId: recorder.recorderId,
          roomSid:  recorder.roomSid,
        });
        await this.httpService.sendErrorMessage(payload, recorder.recorderId);
        return;
      }

      // Set recorder as currently recording
      recorder.isRecording = true;
      recorder.roomSid = payload.roomSid;
      recorder.roomId = payload.roomId;
      await this.recorderRepository.save(recorder, );
      this.taskService.deleteRecorderPing(recorder.recorderId);

      await this.client.emit(CREATE_OPENCAST_EVENT, <CreateOpencastEventDto>{
        name: `RoomTest-${payload.roomSid}_${new Date().getMilliseconds()}`,
        roomSid: payload.roomSid,
        recorderId: recorder.recorderId
      });
      await this.httpService.sendStartedMessage(payload, recorder.recorderId);
      return;
    }
    this.logger.error('No recorder is available!');
    await this.httpService.sendErrorMessage(payload);
  }
  async stopRecording(payload: PlugNMeetToRecorder) {
    const recorder = await this.recorderRepository.findOne({ where: { roomSid: payload.roomSid } })
    if (recorder) {
      // Dont need to stop recording, its already been stopped
      if (!recorder.isRecording) return;
      // Emit events to stop recordings...
      await this.client.emit(STOP_LIVEKIT_EGRESS_RECORDING, <StopEgressRecordingDto>{
        recorderId: recorder.recorderId,
        roomSid:  recorder.roomSid,
      });
      await this.client.emit(STOP_EPIPHAN_RECORDING, <StopEpiphanRecordingDto>{
        recorderId: recorder.recorderId,
        roomSid:  recorder.roomSid,
        epiphanId: "LBTUEpiphanTest1"
      });

      recorder.isRecording = false;
      await this.recorderRepository.save(recorder);

      this.taskService.addRecorderPing(recorder.recorderId);
      await this.httpService.sendEndedMessage(payload, recorder.recorderId);
      await this.httpService.sendCompletedMessage(payload, recorder.recorderId);

      // Notify opencast that event is finished and can start ingesting
      await this.client.emit(START_OPENCAST_INGEST, <StartOpencastIngestDto>{
        recorderId: recorder.recorderId,
        roomSid: recorder.roomSid
      });
      return;
    }
    this.logger.error(`Recorder dosn't exist for room ${payload.roomSid}!`);
    await this.httpService.sendErrorMessage(payload);
  }
}