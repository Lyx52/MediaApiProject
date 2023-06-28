import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression, SchedulerRegistry } from "@nestjs/schedule";
import Redis from "ioredis";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import { MongoRepository } from "typeorm";
import {
  PLUGNMEET_RECORDER_INFO_KEY,
  PLUGNMEET_ROOM_ENDED,
  PLUGNMEET_SERVICE, STOP_EPIPHAN_RECORDING,
  STOP_LIVEKIT_EGRESS_RECORDING
} from "src/app.constants";
import { PlugNMeetRecorderInfoDto } from "../dto/PlugNMeetRecorderInfoDto";
import { CronJob } from "cron";
import { PlugNmeet } from "plugnmeet-sdk-js";
import { ConfigService } from "@nestjs/config";
import { Recorder } from "../entities/Recorder";
import { ConferenceSession } from "../entities/ConferenceSession";
import { ClientProxy } from "@nestjs/microservices";
import { PlugNMeetRoomEndedDto } from "../dto/PlugNMeetRoomEndedDto";
import { util } from "protobufjs";
import compareFieldsById = util.compareFieldsById;
import { StopEgressRecordingDto } from "../../livekit/dto/StopEgressRecordingDto";
import { StopEpiphanRecordingDto } from "../../epiphan/dto/StopEpiphanRecordingDto";

@Injectable()
export class PlugNMeetTaskService implements OnModuleInit {
  private readonly logger = new Logger(PlugNMeetTaskService.name);

  private readonly PNMController: PlugNmeet;
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly config: ConfigService,
    @Inject(PLUGNMEET_SERVICE) private readonly client: ClientProxy,
    @InjectRedis() private readonly redisClient: Redis,
    @InjectRepository(Recorder) private readonly recorderRepository: MongoRepository<Recorder>,
    @InjectRepository(ConferenceSession) private readonly conferenceRepository: MongoRepository<ConferenceSession>,
  ) {
    this.PNMController = new PlugNmeet(
      config.getOrThrow<string>('plugnmeet.host'),
      config.getOrThrow<string>('plugnmeet.key'),
      config.getOrThrow<string>('plugnmeet.secret'),
    );
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async syncRoomState()
  {
    try {
      const activeRooms = await this.PNMController.getActiveRoomsInfo();
      const activeConferences = await this.conferenceRepository.find({ where: { isActive: true } });
      for (const conference of activeConferences) {
        const room = activeRooms.rooms.find(r => r.room_info.sid === conference.roomSid);
        const isRunning = room && room.room_info && room.room_info.is_running;
        if (!isRunning) {
          // Out of sync update
          if (room?.room_info) conference.metadata.info = room.room_info;
          conference.isActive = false;
          /**
           *   Stop egress recording
           */
          await this.client.emit(STOP_LIVEKIT_EGRESS_RECORDING, <StopEgressRecordingDto>{
            roomMetadata: conference.metadata,
            ingestRecording: true,
            recorderId: `${conference.recorderId}_ROOM_COMPOSITE_${conference.roomSid}`
          });

          /**
           *   Stop epiphan recording if epiphanId is provided
           */
          if (conference.epiphanId) {
            await this.client.emit(STOP_EPIPHAN_RECORDING, <StopEpiphanRecordingDto>{
              roomMetadata: conference.metadata,
              epiphanId: conference.epiphanId,
              ingestRecording: true,
              recorderId: `${conference.recorderId}_PRESENTER_${conference.roomSid}`
            });
          }
          this.client.emit(PLUGNMEET_ROOM_ENDED, <PlugNMeetRoomEndedDto>{
            roomMetadata: conference.metadata
          });
          // Do some additional check if recorder is not "recording"
          const recorder = await this.recorderRepository.findOne({ where: { recorderId: conference.recorderId } });
          if (recorder && recorder?.isRecording) {
            const otherConferences = activeConferences.filter(r => r.recorderId === recorder.recorderId && r.id !== conference.id);
            if (otherConferences.length <= 0) {
              // Recorder is active only for this conference thus should not be running
              recorder.isRecording = false;
              await this.recorderRepository.save(recorder);
            }

          }
          conference.recorderId = null;
        }

        await this.conferenceRepository.save(conference);
      }
    } catch (e) {
      this.logger.warn(`SyncRoomState failed with ${e}`);
    }
  }

  async onModuleInit()
  {
    await this.syncRoomState();
  }
  addRecorderPing(recorderId: string) {
    if (!this.schedulerRegistry.doesExist("interval", `${recorderId}_PING`)) {
      this.schedulerRegistry.addInterval(`${recorderId}_PING`, setInterval(async () => await this.sendPing(recorderId), 5000));
    }
    this.logger.debug(`${recorderId}_PING added to scheduler`);
  }
  deleteRecorderPing(recorderId: string) {
    if (this.schedulerRegistry.doesExist("interval", `${recorderId}_PING`)) {
      this.schedulerRegistry.deleteInterval(`${recorderId}_PING`);
      this.logger.debug(`${recorderId}_PING removed from scheduler`);
    }
  }
  async sendPing(recorder_id: string) {
    let watch = '';
    try {
      watch = await this.redisClient.watch(PLUGNMEET_RECORDER_INFO_KEY);
      if (watch !== 'OK') {
        return;
      }
      const info = await this.redisClient.hget(PLUGNMEET_RECORDER_INFO_KEY, recorder_id);
      if (!info) return;

      const currentInfo: PlugNMeetRecorderInfoDto = JSON.parse(info);
      currentInfo.lastPing = Math.floor(new Date().getTime() / 1000);

      // update again
      const r = this.redisClient.multi({ pipeline: true });
      const recorderInfo: any = {};
      recorderInfo[recorder_id] = JSON.stringify(currentInfo);
      await r.hset(PLUGNMEET_RECORDER_INFO_KEY, recorderInfo);
      await r.exec();

      await this.redisClient.unwatch();
    } catch (e) {
      this.logger.error(e);
    } finally {
      if (watch === 'OK') {
        await this.redisClient.unwatch();
      }
    }
  }
}