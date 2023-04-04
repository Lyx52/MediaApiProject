import { Injectable, Logger } from "@nestjs/common";
import { Cron, Interval, SchedulerRegistry } from "@nestjs/schedule";
import { CronCommand, CronJob } from "cron";
import { InjectRepository } from "@nestjs/typeorm";
import { ConferenceRoomSession } from "../entities/ConferenceRoomSession";
import { MongoRepository } from "typeorm";
import Redis from "ioredis";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import { PlugNMeetRecorderInfo } from "../dto/PlugNMeetRecorderInfo";
import { PLUGNMEET_RECORDER_INFO_KEY } from "../../app.constants";
@Injectable()
export class PlugNMeetTaskService {
  private readonly logger = new Logger(PlugNMeetTaskService.name);

  constructor(
    private schedulerRegistry: SchedulerRegistry,
    @InjectRedis() private readonly redisClient: Redis,
    @InjectRepository(ConferenceRoomSession) private readonly roomRepository: MongoRepository<ConferenceRoomSession>
  ) {

  }
  addCronJob(name: string, seconds: number, cmd: CronCommand) {
    const job = new CronJob(`${seconds} * * * * *`, cmd);

    this.schedulerRegistry.addCronJob(name, job);
    job.start();

    this.logger.warn(
      `job ${name} added for each minute at ${seconds} seconds!`,
    );
  }
  deleteCron(name: string) {
    this.schedulerRegistry.deleteCronJob(name);
    this.logger.warn(`job ${name} deleted!`);
  }
  getCrons() {
    const jobs = this.schedulerRegistry.getCronJobs();
    jobs.forEach((value, key, map) => {
      let next;
      try {
        next = value.nextDates().toJSDate()
      } catch (e) {
        next = 'error: next fire date is in the past!';
      }
      this.logger.log(`job: ${key} -> next: ${next}`);
    });
  }
  @Interval("UpdateConfRoomActivity", 5000)
  async conferenceRoomActivityCheck() {
    const rooms = this.roomRepository.find({
      where: {
        isActive: true,
        ended: { $gt: 0 }
      },
      select: ['id', 'roomSid']
    })
    await this.roomRepository.updateMany(
      {
        isActive: true,
        ended: { $gt: 0 }
      },
      {
        $set: { ended: Date.now() }
      }
    )
  }
  addRecorderPing(recorderId: string) {
    this.schedulerRegistry.addInterval(`RECORDER_${recorderId}_PING`, setInterval(async () => await this.sendPing(recorderId), 5000))
  }
  deleteRecorderPing(recorderId: string) {
    if (this.schedulerRegistry.doesExist("interval", `RECORDER_${recorderId}_PING`)) {
      this.schedulerRegistry.deleteInterval(`RECORDER_${recorderId}_PING`);
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

      const currentInfo: PlugNMeetRecorderInfo = JSON.parse(info);
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
