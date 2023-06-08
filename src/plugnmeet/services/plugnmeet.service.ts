import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MongoRepository } from "typeorm";
import {ActiveRoomInfo, CreateRoomResponse, PlugNmeet, Room} from "plugnmeet-sdk-js";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import {
  PLUGNMEET_RECORDER_INFO_KEY, PLUGNMEET_ROOM_ENDED,
  PLUGNMEET_SERVICE,
  START_EPIPHAN_RECORDING,
  START_LIVEKIT_EGRESS_RECORDING,
  STOP_EPIPHAN_RECORDING,
  STOP_LIVEKIT_EGRESS_RECORDING
} from "../../app.constants";
import { Recorder } from "../entities/Recorder";
import { PlugNMeetTaskService } from "./plugnmeet.task.service";
import { PlugNMeetRecorderInfoDto } from "../dto/PlugNMeetRecorderInfoDto";
import { PlugNMeetToRecorder, RecordingTasks } from "src/proto/plugnmeet_recorder_pb";
import { ConfigService } from "@nestjs/config";
import { ClientProxy } from "@nestjs/microservices";
import { StartEgressRecordingDto } from "../../livekit/dto/StartEgressRecordingDto";
import { firstValueFrom } from "rxjs";
import { StartEpiphanRecordingDto } from "../../epiphan/dto/StartEpiphanRecordingDto";
import { StopEgressRecordingDto } from "../../livekit/dto/StopEgressRecordingDto";
import { PlugNMeetHttpService } from "./plugnmeet.http.service";
import { StopEpiphanRecordingDto } from "../../epiphan/dto/StopEpiphanRecordingDto";
import { ConferenceSession } from "../entities/ConferenceSession";
import { CreateConferenceRoom } from "../dto/CreateConferenceRoom";
import { PlugNMeetRoomEndedDto } from "../dto/PlugNMeetRoomEndedDto";
import {RoomMetadataDto} from "../dto/RoomMetadataDto";
import {WebhookEvent} from "livekit-server-sdk/dist/proto/livekit_webhook";

@Injectable()
export class PlugNMeetService implements OnModuleInit {
  private readonly logger = new Logger(PlugNMeetService.name);
  private readonly PNMController: PlugNmeet;

  constructor(
    @InjectRepository(Recorder) private readonly recorderRepository: MongoRepository<Recorder>,
    @InjectRepository(ConferenceSession) private readonly conferenceRepository: MongoRepository<ConferenceSession>,
    @InjectRedis() private readonly redisClient: Redis,
    private readonly taskService: PlugNMeetTaskService,
    private readonly httpService: PlugNMeetHttpService,
    private readonly config: ConfigService,
    @Inject(PLUGNMEET_SERVICE) private readonly client: ClientProxy
  ) {
    this.PNMController = new PlugNmeet(
      this.config.getOrThrow<string>('plugnmeet.host'),
      this.config.getOrThrow<string>('plugnmeet.key'),
      this.config.getOrThrow<string>('plugnmeet.secret'),
    );
  }

  async onModuleInit() {
    await this.addRecorders(this.config.getOrThrow<number>('appconfig.max_recorders'))
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
  async createConferenceRoom(payload: CreateConferenceRoom): Promise<CreateRoomResponse> {
    const response = await this.PNMController.createRoom({
      room_id: payload.roomId,
      metadata: payload.metadata,
      empty_timeout: this.config.get<number>('plugnmeet.empty_room_timeout') || 900,
      max_participants: this.config.get<number>('plugnmeet.max_room_participants') || 25
    });
    if (response.status) {
      /**
       * Conference is added create it
       */
      const entity = this.conferenceRepository.create();
      entity.epiphanId = payload.epiphanId;
      entity.roomId = payload.roomId;
      entity.roomSid = response.roomInfo.sid;
      entity.recorderId = null;
      entity.metadata = <RoomMetadataDto>{
        courseName: payload.courseName,
        info: <ActiveRoomInfo>{}
      }
      await this.conferenceRepository.insert(entity);
    }
    return response;
  }
  async addRecorders(recorderCount: number) {
    const recorders = await this.recorderRepository.find();
    const conferences = await this.conferenceRepository.find({
      where: {
        recorderId: { $in: recorders.map(r => r.recorderId) }
      }
    });

    /**
     *  We need to iterate through recorders and in case of
     *  coldboot check if rooms exist and are recording
     */
    for (const recorder of recorders) {
      const conference = conferences.find(c => c.recorderId === recorder.recorderId);
      /**
       *  Conference does not exist and we are still recording
       */
      if (recorder.isRecording && !conference) {
        recorder.isRecording = false;
        await this.recorderRepository.save(recorder);
        continue;
      }
      if (recorder.isRecording) {
        /**
         *  We update recorder status based on room metadata
         */
        const roomInfo = await this.getActiveRoomInfo(conference.roomSid);
        if (roomInfo) {
          recorder.isRecording = roomInfo.room_info.is_recording;
          await this.recorderRepository.save(recorder);
          conference.metadata.info = roomInfo.room_info;
          conference.recorderId = roomInfo.room_info.is_recording ? recorder.recorderId : null;
          await this.conferenceRepository.save(conference);
        }
      }
    }
    for (let i = 0; i < recorderCount; i++) {
      /**
       *  Add missing recorders if count has increased
       */
      if ((i + 1) > recorders.length) {
        const recorder = this.recorderRepository.create();
        recorder.isRecording = false;
        recorder.recorderId = this.makeRecorderId(16);
        await this.addAvailableRecorder(recorder.recorderId);
        await this.recorderRepository.insert(recorder);
        continue;
      }
      await this.addAvailableRecorder(recorders[i].recorderId);
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
  public async getActiveRoomInfo(roomSid: string): Promise<Room | undefined> {
    const rooms = await this.PNMController.getActiveRoomsInfo();
    if (!rooms.status) return undefined;
    return rooms.rooms.find((r: Room) => r.room_info.sid === roomSid);
  }

  async startRecording(payload: PlugNMeetToRecorder) {
    const roomInfo = await this.getActiveRoomInfo(payload.roomSid);
    if (!roomInfo) {
      this.logger.error(`There was error getting room metadata`);
      await this.httpService.sendErrorMessage(payload);
      return;
    }
    let conference = await this.conferenceRepository.findOne({ where: { roomSid: payload.roomSid } });
    const recorder = await this.recorderRepository.findOne({ where: { isRecording: { $in: [ false, 0 ]} } });
    if (!recorder) {
      this.logger.error(`There are no recorders available!`);
      await this.httpService.sendErrorMessage(payload);
      return;
    }

    if (!conference) {
      /**
       *  We do not have precreated conference, this means it was created without using our api,
       *  It won't have epiphan device recordings!
       */
      conference = this.conferenceRepository.create();
      conference.epiphanId = "LBTU_EPIPHAN_112"; // TODO: Remove this!!!!
      conference.metadata = <RoomMetadataDto>{
        courseName: "Course_Series_2",
        info: <ActiveRoomInfo>roomInfo.room_info
      }
      //conference.epiphanId = null;
      conference.recorderId = recorder.recorderId;
      conference.roomId = roomInfo.room_info.room_id;
      conference.roomSid = payload.roomSid;
    } else {
      /**
       *  For sanity’s sake we check if conference dosnt have active recorder
       */
      const activeRecorders = await this.recorderRepository.count({ where: { recorderId: conference.recorderId, isRecording: true } });
      if (activeRecorders > 0) {
        this.logger.error('Failed to start livekit egress recording!');
        await this.httpService.sendErrorMessage(payload, payload.recorderId);
        return;
      }
    }
    conference.metadata.info = <ActiveRoomInfo>roomInfo.room_info;
    conference.recorderId = recorder.recorderId;
    conference.isActive = true;
    /**
     *  Start egress recording, and await response
     */
    if (!await firstValueFrom(this.client.send<boolean>(START_LIVEKIT_EGRESS_RECORDING, <StartEgressRecordingDto>{
      roomMetadata: conference.metadata,
      recorderId: `ROOM_COMPOSITE_${conference.roomSid}`
    })))
    {
      this.logger.error('Failed to start livekit egress recording!');
      await this.httpService.sendErrorMessage(payload, conference.recorderId);
      return;
    }

    /**
     *  Start epiphan recording, and await response
     */
    if (conference.epiphanId) {
      if (!await firstValueFrom(this.client.send<boolean>(START_EPIPHAN_RECORDING, <StartEpiphanRecordingDto>{
        roomMetadata: conference.metadata,
        epiphanId: conference.epiphanId,
        recorderId: `PRESENTER_${conference.roomSid}`
      }))) {
        // Cannot start epiphan recording
        this.logger.error('Failed to start epiphan recording!');
        await this.client.emit(STOP_LIVEKIT_EGRESS_RECORDING, <StopEgressRecordingDto>{
          roomMetadata: conference.metadata,
          recorderId: `ROOM_COMPOSITE_${conference.roomSid}`,
          ingestRecording: false
        });
        await this.httpService.sendErrorMessage(payload, conference.recorderId);
        return;
      }
    }

    /**
     *  Update entities
     */
    recorder.isRecording = true;
    await this.recorderRepository.save(recorder);
    await this.conferenceRepository.save(conference);

    this.taskService.deleteRecorderPing(conference.recorderId);
    await this.httpService.sendStartedMessage(payload, conference.recorderId);
  }

  async handleRoomEnded(payload: WebhookEvent): Promise<void> {
    const conference = await this.conferenceRepository.findOne({ where: { roomSid: payload.room.sid } });
    if (!conference) return;
    const recorder = await this.recorderRepository.findOne({ where: { recorderId: conference.recorderId, isRecording: true } });
    if (recorder) {
      /**
       *   Stop egress recording
       */
      await this.client.emit(STOP_LIVEKIT_EGRESS_RECORDING, <StopEgressRecordingDto>{
        roomMetadata: conference.metadata,
        ingestRecording: true,
        recorderId: `ROOM_COMPOSITE_${conference.roomSid}`
      });

      /**
       *   Stop epiphan recording if epiphanId is provided
       */
      if (conference.epiphanId) {
        await this.client.emit(STOP_EPIPHAN_RECORDING, <StopEpiphanRecordingDto>{
          roomMetadata: conference.metadata,
          epiphanId: conference.epiphanId,
          ingestRecording: true,
          recorderId: `${recorder.recorderId}_PRESENTER_${conference.roomSid}`
        });
      }

      /**
       *  Update entities
       */
      conference.recorderId = null;
      recorder.isRecording = false;
      await this.recorderRepository.save(recorder);
      await this.addAvailableRecorder(recorder.recorderId);
    }

    conference.isActive = false;
    await this.conferenceRepository.save(conference);

    await this.client.emit(PLUGNMEET_ROOM_ENDED, <PlugNMeetRoomEndedDto>{
      roomMetadata: conference.metadata
    });
  }

  async stopRecording(payload: PlugNMeetToRecorder) {
    const conference = await this.conferenceRepository.findOne({ where: { roomSid: payload.roomSid } });
    if (!conference) {
      /**
       *  Room doesn't exist, we end the recording as we don't know about the state of recording
       */
      this.logger.warn(`Conference doesn't exist for room ${payload.roomSid}!`);
      await this.httpService.sendErrorMessage(payload);
      await this.httpService.sendEndedMessage(payload, payload.recorderId || "");
      await this.httpService.sendCompletedMessage(payload, payload.recorderId || "");
      return;
    }

    const recorder = await this.recorderRepository.findOne({ where: { recorderId: conference.recorderId, isRecording: true } });
    if (recorder) {
      /**
       *   Stop egress recording
       */
      await this.client.emit(STOP_LIVEKIT_EGRESS_RECORDING, <StopEgressRecordingDto>{
        roomMetadata: conference.metadata,
        ingestRecording: true,
        recorderId: `ROOM_COMPOSITE_${conference.roomSid}`
      });

      /**
       *   Stop epiphan recording if epiphanId is provided
       */
      if (conference.epiphanId) {
        await this.client.emit(STOP_EPIPHAN_RECORDING, <StopEpiphanRecordingDto>{
          roomMetadata: conference.metadata,
          epiphanId: conference.epiphanId,
          ingestRecording: true,
          recorderId: `PRESENTER_${conference.roomSid}`
        });
      }

      /**
       *  Update entities
       */

      const roomInfo = await this.getActiveRoomInfo(payload.roomSid);
      if (roomInfo && conference) {
        conference.metadata.info = roomInfo.room_info;
      }
      conference.recorderId = null;
      recorder.isRecording = false;
      await this.recorderRepository.save(recorder);
      await this.addAvailableRecorder(recorder.recorderId);
    }

    await this.conferenceRepository.save(conference);
    await this.httpService.sendEndedMessage(payload, payload.recorderId || "");
    await this.httpService.sendCompletedMessage(payload, payload.recorderId || "");
  }
}