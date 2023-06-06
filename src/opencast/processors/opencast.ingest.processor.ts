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
import { IngestMediaPackageJobDto } from "../dto/IngestMediaPackageJobDto";
import { existsSync } from "fs";

@Processor('video')
export class OpencastVideoIngestConsumer {
  private readonly logger: Logger = new Logger(OpencastVideoIngestConsumer.name);
  constructor(
    private readonly eventService: OpencastService,
    @InjectRepository(OpencastEvent) private readonly eventRepository: MongoRepository<OpencastEvent>
  ) {
  }

  @Process(INGEST_MEDIAPACKAGE_JOB)
  async ingestMediaPackage(job: Job<IngestMediaPackageJobDto>) {
    this.logger.debug("Started INGEST_MEDIAPACKAGE_JOB");

    const events = await this.eventRepository.find({
      where: { roomSid: job.data.roomMetadata.sid }
    });
    if (events.length <= 0)
    {
      this.logger.error(`INGEST_MEDIAPACKAGE_JOB failed because there are not recording events associated with conference!`);
      await job.moveToFailed({ message: `INGEST_MEDIAPACKAGE_JOB failed because there are not recording events associated with conference!` });
      return;
    }
    try {

      const series: any = await this.eventService.createSeries(`${job.data.roomMetadata.room_title} PlugNMeet Conference series`, `${job.data.roomMetadata.room_title}`);
      /**
       *  Ingest all events
       */
      for (const event of events)
      {
        let mediaPackage = <string>await this.eventService.getMediaPackageByEventId(event.eventId);
        if (event.jobs) {
          const jobs = event.jobs.sort((a, b) => a.ingested - b.ingested);
          let videoPart = 0;
          for (const job of jobs) {
            if (!existsSync(job.uri)) {
              this.logger.warn(`File ${job.uri} does not exist! Wont be ingesting!`);
              continue;
            }
            mediaPackage = <string>await this.eventService.addTrackFileFromFs(mediaPackage, job.uri, `${event.type}-${videoPart++}`);
          }
        }
        await this.eventService.ingestRecordings(mediaPackage, event.eventId);
      }
      await job.moveToCompleted();
    } catch (e)
    {
      this.logger.error(`Caught exception while processing a job ${e}`);
      await job.retry();
    }
  }
}