import { Process, Processor } from "@nestjs/bull";
import { Job, JobStatus } from "bull";
import { Logger } from "@nestjs/common";
import {
  EVENT_MEDIAPACKAGE_RESOURCE_KEY, INGEST_JOB_RETRY, INGEST_MEDIAPACKAGE_JOB,
  INGEST_VIDEO_JOB,
  MEDIAPACKAGE_LOCK_TTL,
  PLUGNMEET_RECORDER_INFO_KEY
} from "../../app.constants";
import { OpencastEventService } from "../services/opencast.event.service";
import { InjectRepository } from "@nestjs/typeorm";
import { OpencastEvent } from "../entities/opencast.event";
import { MongoRepository } from "typeorm";
import { MediaType } from "../../livekit/dto/enums/MediaType";
import { IngestJobDto } from "../dto/IngestJobDto";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import Redlock, { Lock as RLock } from "redlock";
import { IngestMediaPackageDto } from "../dto/IngestMediaPackageDto";
import { existsSync } from "fs";

@Processor('video')
export class OpencastVideoIngestConsumer {
  private readonly logger: Logger = new Logger(OpencastVideoIngestConsumer.name);
  private redlock: Redlock;
  constructor(
    private readonly eventService: OpencastEventService,
    @InjectRedis() private readonly redisClient: Redis,
    @InjectRepository(OpencastEvent) private readonly eventRepository: MongoRepository<OpencastEvent>
  ) {
    this.redlock = new Redlock([this.redisClient], {
      retryCount: 250,
      retryDelay: 200,
      driftFactor: 0.01,
      retryJitter: 200,
    });
  }
  @Process(INGEST_MEDIAPACKAGE_JOB)
  async ingestMediaPackage(job: Job<IngestMediaPackageDto>) {
    const allJobs = await job.queue.getJobs(['active', 'paused', 'waiting', 'delayed'])
    /**
     *  Filter jobs, if any are active, we cannot ingest mediapackage!
     */
    if (allJobs.filter((j: Job<IngestJobDto>) => j.data.roomSid == job.data.roomSid && j.id != job.id).length > 0)
    {
      // Wait for 2 seconds
      await (new Promise(resolve => setTimeout(resolve, INGEST_JOB_RETRY)));
      await job.retry();
      return;
    }
    const event = await this.eventRepository.findOne({
      where: {
        roomSid: job.data.roomSid
      }
    });
    if (!event || !event.eventId)
    {
      await job.moveToFailed({ message: `INGEST_MEDIAPACKAGE_JOB failed because event does not exist or is not created!` });
      return;
    }
    let watch: string;
    try {
      watch = await this.redisClient.watch(PLUGNMEET_RECORDER_INFO_KEY);
      if (watch !== 'OK') {
        await new Promise((res) => setTimeout(res, INGEST_JOB_RETRY));
        await job.retry();
        return;
      }
      /**
       *  Get media package, it has version and xml data
       */
      let mediaPackageInfo: any = await this.redisClient.hget(EVENT_MEDIAPACKAGE_RESOURCE_KEY, event.eventId);
      if (!mediaPackageInfo)
      {
        await job.moveToFailed({ message: `INGEST_MEDIAPACKAGE_JOB failed because mediapackage does not exist!` });
        return;
      }
      /**
       * Ingest into event
       */
      mediaPackageInfo = JSON.parse(mediaPackageInfo);
      await this.eventService.ingestRecordings(mediaPackageInfo.data, event.eventId);
    } catch (e) {
      this.logger.error(`Caught exception while processing a job ${e}`);
      await job.retry();
    } finally {
      if (watch === 'OK') {
        await this.redisClient.unwatch();
      }
      await job.moveToCompleted();
    }
  }
  @Process(INGEST_VIDEO_JOB)
  async ingestVideoFile(job: Job<IngestJobDto>) {
    if (!existsSync(job.data.uri)) {
      await job.moveToFailed({ message: `INGEST_VIDEO_JOB failed because file ${job.data.uri} does not exist!` });
      return;
    }
    const event = await this.eventRepository.findOne({
      where: {
        roomSid: job.data.roomSid,
        recorderId: job.data.recorderId
      }
    });
    if (!event || !event.eventId)
    {
      await job.moveToFailed({ message: `INGEST_VIDEO_JOB failed because event does not exist or is not created!` });
      return;
    }
    const resourceKey = `${EVENT_MEDIAPACKAGE_RESOURCE_KEY}:${event.eventId}`;
    const lock: RLock = await this.redlock.acquire([resourceKey], MEDIAPACKAGE_LOCK_TTL);
    let watch: string;
    try {

      watch = await this.redisClient.watch(PLUGNMEET_RECORDER_INFO_KEY);
      if (watch !== 'OK') {
        await new Promise((res) => setTimeout(res, 1000));
        await job.retry();
        return;
      }
      /**
       *  Get media package, it has version and xml data
       */
      let mediaPackageInfo: any = await this.redisClient.hget(EVENT_MEDIAPACKAGE_RESOURCE_KEY, event.eventId);
      // Media package does not exist, create one
      if (!mediaPackageInfo)
      {
        const mediaPackage = <string>await this.eventService.createMediaPackage();
        mediaPackageInfo = {
          version: 0,
          data: mediaPackage
        }
        this.logger.debug(`Created mediapackage for event ${event.eventId}!`);
      } else {
        mediaPackageInfo = JSON.parse(mediaPackageInfo);
      }

      const redisChain = this.redisClient.multi({ pipeline: true });
      /**
       *  Determine where the file is located based on the device
       *  TODO: Might need to move downloading from epiphan to different job
       */
      /**
       *  We update the mediapackage on opencast side
       */
      mediaPackageInfo.data = <string>await this.eventService.addTrackFileFromFs(mediaPackageInfo.data, job.data.uri);
      mediaPackageInfo.version += 1;
      this.logger.debug(`Updating mediapackage for event ${event.eventId}, version ${mediaPackageInfo.version}, \nfile ${job.data.uri}!`);
      /**
       *  Then we update it from our side
       */
      const payload = {}
      payload[event.eventId] = JSON.stringify(mediaPackageInfo);
      await redisChain.hset(EVENT_MEDIAPACKAGE_RESOURCE_KEY, payload);
      await redisChain.exec();
      await this.redisClient.unwatch();
    } catch (e) {
      this.logger.error(`Caught exception while processing a job ${e}`);
      await job.retry();
    } finally {
      if (watch === 'OK') {
        await this.redisClient.unwatch();
      }
      await lock.release();
      await job.moveToCompleted();
    }
  }
}