import { OnQueueActive, Process, Processor } from "@nestjs/bull";
import { Job, JobStatus } from "bull";
import { Logger } from "@nestjs/common";
import {
  EVENT_MEDIAPACKAGE_RESOURCE_KEY, INGEST_JOB_RETRY, INGEST_MEDIAPACKAGE_JOB,
  INGEST_VIDEO_JOB,
  MEDIAPACKAGE_LOCK_TTL,
  PLUGNMEET_RECORDER_INFO_KEY
} from "../../app.constants";
import { OpencastService } from "../services/opencast.service";
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
    private readonly eventService: OpencastService,
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
  @OnQueueActive()
  async onQueueActive(job: Job) {
    if (job.name === INGEST_MEDIAPACKAGE_JOB) {
      const { roomSid } = job.data;
      const activeVideoJobs = await job.queue.getJobs(['active', 'paused', 'waiting', 'delayed']);
      const videoJobsToWaitFor = activeVideoJobs.filter(
        (j: Job<IngestJobDto>) => j.name === INGEST_VIDEO_JOB && j.data.roomSid === roomSid
      );
      if (videoJobsToWaitFor.length > 0) {
        job.queue.on('completed', async (eventJob) => {
          if (
            eventJob.name === INGEST_VIDEO_JOB &&
            eventJob.data.roomSid === roomSid &&
            videoJobsToWaitFor.includes(eventJob)
          ) {
            await job.retry();
          }
        });
      }
    }
  }

  @Process(INGEST_MEDIAPACKAGE_JOB)
  async ingestMediaPackage(job: Job<IngestMediaPackageDto>) {
    this.logger.debug("Started INGEST_MEDIAPACKAGE_JOB");
    await job.moveToCompleted();
    return;

    const event = await this.eventRepository.findOne({
      where: {
        roomSid: job.data.roomSid
      }
    });
    if (!event || !event.eventId)
    {
      this.logger.error(`INGEST_MEDIAPACKAGE_JOB failed because event does not exist or is not created!`);
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
        this.logger.error(`INGEST_MEDIAPACKAGE_JOB failed because mediapackage does not exist!`);
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
    this.logger.debug("Started INGEST_VIDEO_JOB");
    await job.moveToCompleted();
    return;

    if (!existsSync(job.data.uri)) {
      this.logger.error(`INGEST_VIDEO_JOB failed because file ${job.data.uri} does not exist!`);
      await job.moveToFailed({ message: `INGEST_VIDEO_JOB failed because file ${job.data.uri} does not exist!` });
      return;
    }
    const event = await this.eventRepository.findOne({
      where: { roomSid: job.data.roomSid }
    });
    if (!event || !event.eventId)
    {
      this.logger.error(`INGEST_VIDEO_JOB failed because event does not exist or is not created!`);
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
        const mediaPackage = <string>await this.eventService.getMediaPackageByEventId(event.eventId);
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
       *  We update the mediapackage on opencast side
       */
      mediaPackageInfo.data = <string>await this.eventService.addTrackFileFromFs(mediaPackageInfo.data, job.data.uri, `${job.data.type}-${job.data.part}`);
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