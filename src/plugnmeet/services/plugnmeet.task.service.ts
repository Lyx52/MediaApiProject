import { Injectable, Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import Redis from "ioredis";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import { MongoRepository } from "typeorm";
import { PLUGNMEET_RECORDER_INFO_KEY } from "src/app.constants";
import { PlugNMeetRecorderInfoDto } from "../dto/PlugNMeetRecorderInfoDto";

@Injectable()
export class PlugNMeetTaskService {
  private readonly logger = new Logger(PlugNMeetTaskService.name);

  constructor(
    private schedulerRegistry: SchedulerRegistry,
    @InjectRedis() private readonly redisClient: Redis,
  ) {
  }
  addRecorderPing(recorderId: string) {
    this.schedulerRegistry.addInterval(`${recorderId}_PING`, setInterval(async () => await this.sendPing(recorderId), 5000));
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