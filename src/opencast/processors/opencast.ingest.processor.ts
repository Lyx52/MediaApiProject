import {Process, Processor} from "@nestjs/bull";
import {Job} from "bull";
import {Logger} from "@nestjs/common";
import {INGEST_MEDIAPACKAGE_JOB} from "../../app.constants";
import {OpencastService} from "../services/opencast.service";
import {InjectRepository} from "@nestjs/typeorm";
import {OpencastEvent} from "../entities/opencast.event";
import {MongoRepository} from "typeorm";
import {IngestMediaPackageJobDto} from "../dto/IngestMediaPackageJobDto";
import {existsSync} from "fs";
import {OpencastRecordingState} from "../dto/enums/OpencastRecordingState";

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
      for (let event of events)
      {
        event = await this.eventService.setRecordingEventState(event, OpencastRecordingState.UPLOADING);
        let mediaPackage = <string>await this.eventService.getMediaPackageByEventId(event.eventId);
        if (event.jobs) {
          const jobs = event.jobs.sort((a, b) => a.ingested - b.ingested);
          let videoPart = 0;
          let processedFiles = 0;
          for (const job of jobs) {
            if (!existsSync(job.uri)) {
              this.logger.warn(`File ${job.uri} does not exist! Wont be ingesting!`);
              continue;
            }
            mediaPackage = <string>await this.
            eventService.addTrackFileFromFs(mediaPackage, job.uri, `presenter-${videoPart++}`);
            processedFiles++;
          }
          if (processedFiles > 0) {
            await this.eventService.ingestRecordings(mediaPackage, event.eventId);
            event = await this.eventService.setRecordingEventState(event, OpencastRecordingState.UPLOAD_FINISHED);
          } else {
            this.logger.warn("No media files were added to event, skipping ingestion");
            event = await this.eventService.setRecordingEventState(event, OpencastRecordingState.UPLOAD_ERROR);
          }
          await this.eventService.deleteRecorder(event.recorderId);
          await this.eventRepository.save(event);
        }

      }
      await job.moveToCompleted();
    } catch (e)
    {
      this.logger.error(`Caught exception while processing a job ${e}`);
      await job.retry();
    }
  }
}