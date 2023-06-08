import { OnQueueActive, Process, Processor } from "@nestjs/bull";
import { Job, JobStatus } from "bull";
import { Logger } from "@nestjs/common";
import {
  INGEST_MEDIAPACKAGE_JOB
} from "../../app.constants";
import { OpencastService } from "../services/opencast.service";
import { InjectRepository } from "@nestjs/typeorm";
import { OpencastEvent } from "../entities/opencast.event";
import { MongoRepository } from "typeorm";
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
      where: { roomSid: job.data.roomMetadata.info.sid }
    });
    if (events.length <= 0)
    {
      this.logger.error(`INGEST_MEDIAPACKAGE_JOB failed because there are not recording events associated with conference!`);
      await job.moveToFailed({ message: `INGEST_MEDIAPACKAGE_JOB failed because there are not recording events associated with conference!` });
      return;
    }
    try {
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