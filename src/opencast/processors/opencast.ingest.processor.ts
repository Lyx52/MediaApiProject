import {Process, Processor} from "@nestjs/bull";
import {Logger, OnModuleInit} from "@nestjs/common";
import {OpencastService} from "../services/opencast.service";
import {OpencastEvent} from "../entities/OpencastEvent";
import {INGEST_RECORDINGS} from "../../app.constants";
import {OpencastUploadJobDto} from "../dto/OpencastUploadJobDto";
import {Job} from "bull";
import {getSeriesName, RecorderType} from "../dto/enums/RecorderType";
import {CaptureAgentState} from "../dto/enums/CaptureAgentState";
import {OpencastRecordingState} from "../dto/enums/OpencastRecordingState";
import * as path from 'path'
import {ConfigService} from "@nestjs/config";
import {FsUtils} from "../../common/utils/fs.utils";
import * as fs from "fs/promises";

@Processor('video')
export class OpencastVideoIngestConsumer implements OnModuleInit {
  private readonly logger: Logger = new Logger(OpencastVideoIngestConsumer.name);
  private readonly pnmArchiveLocation: string;
  private readonly epiphanArchiveLocation: string;
  constructor(
    private readonly opencastService: OpencastService,
    private readonly config: ConfigService,
  ) {
    const archiveLocation = path.resolve(this.config.getOrThrow<string>('appconfig.archive_location'));
    this.pnmArchiveLocation = path.resolve(archiveLocation, 'plugnmeet');
    this.epiphanArchiveLocation = path.resolve(archiveLocation, 'epiphan');
  }

  async onModuleInit() {
    if (!await FsUtils.exists(this.pnmArchiveLocation)) {
      await fs.mkdir(this.pnmArchiveLocation);
    }
    if (!await FsUtils.exists(this.epiphanArchiveLocation)) {
      await fs.mkdir(this.epiphanArchiveLocation);
    }
  }

  @Process(INGEST_RECORDINGS)
  async ingestMediaPackage(job: Job<OpencastUploadJobDto>) {
    this.logger.debug("Started INGEST_MEDIAPACKAGE_JOB");
    if (job.data.recordings.length <= 0)
    {
      this.logger.error(`INGEST_MEDIAPACKAGE_JOB failed because there are not recordings to upload!`);
      await job.moveToFailed({ message: `INGEST_MEDIAPACKAGE_JOB failed because there are not recordings to upload!` });
      return;
    }

    try {
      let basePath = job.data.basePath;
      const recorder = `${job.data.recorder}_${Date.now()}`;
      if (job.data.recorder === RecorderType.PLUGNMEET_RECORDING) {
        const fpath = path.parse(job.data.basePath);
        await fs.rename(job.data.basePath, path.resolve(fpath.dir, `${fpath.name}_processing`));
        basePath = path.resolve(fpath.dir, `${fpath.name}_processing`);
      }
      let event = <OpencastEvent>{
        roomSid: job.data.conference?.roomSid,
        start: new Date(job.data.started),
        end: new Date(job.data.ended),
        recorder: job.data.recorder
      }
      event.title = `${job.data.conference?.title || job.data.recorder} Recording (${event.start.toLocaleDateString('lv-LV')})`;
      const series: any = await this.opencastService.createOrGetSeriesByTitle(job.data.conference?.courseName || getSeriesName(job.data.recorder), job.data.recorder);
      event.seriesId = series.identifier;
      let mediaPackage: string = job.data.conference?.roomSid ?
          await this.opencastService.createMediaPackageWithId(job.data.conference.roomSid) :
          await this.opencastService.createMediaPackage();
      mediaPackage = await this.opencastService.addDublinCore(event, <string>mediaPackage);
      event = await this.opencastService.createRecordingEvent(event, <string>mediaPackage, recorder);
      await this.opencastService.setAccessListTemplate(event, 'public');
      await this.opencastService.setWorkflow(event, 'lbtu-wf-schedule-and-upload');
      await this.opencastService.setCaptureAgentState(recorder, CaptureAgentState.IDLE);
      await this.opencastService.setRecordingEventState(event.eventId, OpencastRecordingState.UPLOADING);

      let videoPart = 0;
      let processedFiles = 0;
      mediaPackage = <string>await this.opencastService.getMediaPackageByEventId(event.eventId);
      for (const recording of job.data.recordings) {
        const filePath = path.resolve(basePath, recording.fileName);
        if (!await FsUtils.exists(filePath)) {
          this.logger.warn(`File ${filePath} does not exist! Wont be ingesting!`);
          continue;
        }
        mediaPackage = <string>await this.opencastService.addTrackFileFromFs(mediaPackage, filePath, `presenter-${videoPart++}`);
        processedFiles++;
      }
      if (processedFiles > 0) {
        await this.opencastService.ingestRecordings(mediaPackage, event.eventId);
        await this.opencastService.setRecordingEventState(event.eventId, OpencastRecordingState.UPLOAD_FINISHED);
      } else {
        this.logger.warn("No media files were added to event, skipping ingestion");
        await this.opencastService.setRecordingEventState(event.eventId, OpencastRecordingState.UPLOAD_ERROR);
      }
      switch (job.data.recorder) {
        case RecorderType.EPIPHAN_RECORDING:
          await fs.rename(basePath, path.resolve(this.epiphanArchiveLocation, path.parse(basePath).name.replace('_processing', '')));
        break;
        case RecorderType.PLUGNMEET_RECORDING:
          await fs.rename(basePath, path.resolve(this.pnmArchiveLocation, path.parse(basePath).name.replace('_processing', '')));
        break;
      }
      await this.opencastService.deleteRecorder(recorder);
      await job.moveToCompleted();
    } catch (e)
    {
      this.logger.error(`Caught exception while processing a job ${e}`);
      await job.moveToFailed({ message: `Caught exception while processing a job ${e}` });
    }
  }
}