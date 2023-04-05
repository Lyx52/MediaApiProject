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
import { v1 as uuid1 } from 'uuid';
import { PlugNMeetTaskService } from "./plugnmeet.task.service";
import { PlugNMeetRecorderInfo } from "../dto/PlugNMeetRecorderInfo";
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

  async addRecorders(recorderCount: number) {
    const recorders = await this.recorderRepository.find();

    for (const recorder of recorders) {
      const recorderInfo = await this.redisClient.hget(PLUGNMEET_RECORDER_INFO_KEY, recorder.recorderId);

      //TODO: Check if recorder is actually recording
      if (recorderInfo) {
        const recorderInfoObj = JSON.parse(recorderInfo);

      }

      // No recorder info available assume not recording...
      await this.recorderRepository.updateOne({ _id: recorder.id }, {
        $set: { isRecording: false }
      })
      await this.addAvailableRecorder(recorder.recorderId);
    }

    // Add missing recorders if count has increased
    for (let i = 0; i < (recorderCount - recorders.length); i++) {
      const recorder = this.recorderRepository.create();
      recorder.isRecording = false;
      recorder.recorderId = `RECORDER_${uuid1()}`
      await this.addAvailableRecorder(recorder.recorderId);
      await this.recorderRepository.insert(recorder);
    }
    return recorderCount;
  }

  async addAvailableRecorder(recorderId: string) {
    try {
      const now = Math.floor(new Date().getTime() / 1000);
      const recorderInfo: any = {};
      recorderInfo[recorderId] = JSON.stringify(<PlugNMeetRecorderInfo>{
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
    await this.httpService.sendMessage(
      new RecorderToPlugNMeet({
        from: 'recorder',
        status: true,
        task: RecordingTasks.START_RECORDING,
        msg: 'started',
        recordingId: payload.recordingId,
        roomSid: payload.roomSid,
        roomId: payload.roomId,
        recorderId: payload.recorderId,
      }),
      true,
      payload.recorderId,
    );
    return;
    const recorder = await this.recorderRepository.findOne({ where: { isRecording: false } })
    if (recorder) {
      // Start livekit egress recording
      if (!await firstValueFrom(this.client.send<boolean>(START_LIVEKIT_EGRESS_RECORDING, <StartEgressRecordingDto>{})))
      {
        // Cannot start livekit egress recording
        this.logger.error('Failed to start livekit egress recording!');
        await this.httpService.sendErrorMessage(payload, recorder.recorderId);
        return;
      }

      // Start epiphan recording
      if (!await firstValueFrom(this.client.send<boolean>(START_EPIPHAN_RECORDING, <StartEpiphanRecordingDto>{})))
      {
        // Cannot start epiphan recording
        this.logger.error('Failed to start epiphan recording!');
        this.client.emit(STOP_LIVEKIT_EGRESS_RECORDING, <StopEgressRecordingDto>{});
        await this.httpService.sendErrorMessage(payload, recorder.recorderId);
        return;
      }

      // Set recorder as currently recording
      await this.recorderRepository.updateOne({ _id: recorder.id }, {
        $set: { roomId: payload.roomId, isRecording: true }
      })
      //this.taskService.deleteRecorderPing(recorder.recorderId);

      this.client.emit(CREATE_OPENCAST_EVENT, <CreateOpencastEventDto>{});
      await this.httpService.sendStartedMessage(payload);
      return;
    }
    this.logger.error('No recorder is available!');
    await this.httpService.sendErrorMessage(payload);
  }
  async stopRecording(payload: PlugNMeetToRecorder) {
    const recorder = await this.recorderRepository.findOne({ where: { roomId: payload.roomId } })
    if (recorder) {
      // Emit events to stop recordings...
      this.client.emit(STOP_LIVEKIT_EGRESS_RECORDING, <StopEgressRecordingDto>{});
      this.client.emit(STOP_EPIPHAN_RECORDING, <StartEpiphanRecordingDto>{});

      await this.recorderRepository.updateOne({ _id: recorder.id }, {
        $set: { isRecording: false }
      })
      //this.taskService.addRecorderPing(recorder.recorderId);
      await this.httpService.sendEndedMessage(payload, recorder.recorderId);
      await this.httpService.sendCompletedMessage(payload, recorder.recorderId);

      // Notify opencast that event is finished and can start ingesting
      this.client.emit(START_OPENCAST_INGEST, <StartOpencastIngestDto>{});
      return;
    }
    this.logger.error(`Recorder dosn''t exist for room ${payload.roomSid}!`);
    await this.httpService.sendErrorMessage(payload);
  }
}