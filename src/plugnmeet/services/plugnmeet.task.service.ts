import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, SchedulerRegistry } from "@nestjs/schedule";
import Redis from "ioredis";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import { MongoRepository } from "typeorm";
import { PLUGNMEET_RECORDER_INFO_KEY } from "src/app.constants";
import { PlugNMeetRecorderInfoDto } from "../dto/PlugNMeetRecorderInfoDto";
import { CronJob } from "cron";
import { PlugNmeet } from "plugnmeet-sdk-js";
import { ConfigService } from "@nestjs/config";
import { Recorder } from "../entities/Recorder";
import { ConferenceSession } from "../entities/ConferenceSession";

@Injectable()
export class PlugNMeetTaskService implements OnModuleInit {
  private readonly logger = new Logger(PlugNMeetTaskService.name);

  private readonly PNMController: PlugNmeet;
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly config: ConfigService,
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

  @Cron('30 * * * * *')
  async syncRoomState()
  {
    const activeRooms = await this.PNMController.getActiveRoomsInfo();
    const conferences = await this.conferenceRepository.find({
      where: {
        roomSid: { $in: activeRooms.rooms.map(r => r.room_info.sid) }
      }
    });
    for (const conference of conferences) {
      const room = activeRooms.rooms.find(r => r.room_info.sid);
      conference.metadata = room.room_info;
      await this.conferenceRepository.save(conference);
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