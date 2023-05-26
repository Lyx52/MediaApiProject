import { Process, Processor } from "@nestjs/bull";
import { Job, JobStatus } from "bull";
import { Inject, Logger } from "@nestjs/common";
import {
  ADD_OPENCAST_INGEST_JOB,
  DOWNLOAD_VIDEO_JOB, EPIPHAN_SERVICE
} from "../../app.constants";
import { DownloadJobDto } from "../dto/DownloadJobDto";
import { ClientProxy } from "@nestjs/microservices";
import { EpiphanService } from "../services/epiphan.service";
import { GetEpiphanRecordingsDto } from "../dto/GetEpiphanRecordingsDto";
import {
  handleAxiosExceptions,
  makeBasicAuthHeader,
  retryPolicy,
} from "../../common/utils/axios.utils";
import { createWriteStream, existsSync, mkdirSync, renameSync } from "fs";
import { firstValueFrom, map, mergeMap, tap } from "rxjs";
import { IngestJobDto } from "../../opencast/dto/IngestJobDto";
import { OpencastIngestType } from "../../opencast/dto/enums/OpencastIngestType";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import * as path from "path";
@Processor('download')
export class EpiphanDownloadConsumer {
  private readonly logger: Logger = new Logger(EpiphanDownloadConsumer.name);
  private readonly recordingLocation: string;
  constructor(
    private readonly epiphanService: EpiphanService,
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    @Inject(EPIPHAN_SERVICE) private readonly client: ClientProxy
  ) {
    this.recordingLocation = this.config.getOrThrow<string>("appconfig.recording_location");
  }
  @Process(DOWNLOAD_VIDEO_JOB)
  async downloadVideo(job: Job<DownloadJobDto>) {
    this.logger.debug("Started DOWNLOAD_VIDEO_JOB");
    const epiphanConfig = await this.epiphanService.findConfig(job.data.epiphanId);

    if (!epiphanConfig) {
      await job.moveToFailed({ message: `DOWNLOAD_VIDEO_JOB failed because epiphan configuration ${job.data.epiphanId} does not exist or is not created!` });
      return;
    }

    const recording: any = await this.epiphanService.getLastEpiphanRecording(<GetEpiphanRecordingsDto>job.data);
    if (recording.id) {
      const downloadLocation = path.join(this.recordingLocation, recording.id);
      const uploadLocation = path.join(this.recordingLocation, `${recording.name}.mp4`);

      try {
        const headers = makeBasicAuthHeader(epiphanConfig.username, epiphanConfig.password);
        await new Promise<void>(async (resolve) => {
          if (!existsSync(this.recordingLocation)) {
            mkdirSync(this.recordingLocation);
          }
          resolve();
        });

        const success = await firstValueFrom(
        this.httpService.get(`${epiphanConfig.host}/api/recorders/${epiphanConfig.defaultChannel || 1}/archive/files/${recording.id}`, {
          headers: headers,
          responseType: "stream"
        }).pipe(
          tap(response => {
            const writer = createWriteStream(downloadLocation);
            response.data.pipe(writer);
          }),
          mergeMap(response => {
            return new Promise<boolean>((resolve) => {
              response.data.on('end', () => {
                renameSync(downloadLocation, uploadLocation);
                resolve(true);
              });
              response.data.on('error', err => {
                this.logger.debug(`Error while downloading file!\n${err}`);
                resolve(false);
              });
            })
          }),
          retryPolicy(),
          handleAxiosExceptions(),
        ));

        if (success) {
          this.logger.log(`File downloaded successfully to ${uploadLocation}`);
          await this.client.emit(ADD_OPENCAST_INGEST_JOB, <IngestJobDto>{
            recorderId: job.data.recorderId,
            roomSid: job.data.roomSid,
            uri: uploadLocation,
            type: OpencastIngestType.PRESENTER,
            part: job.data.recordingPart
          });
          await job.moveToCompleted();
          return;
        }
        await job.moveToFailed({
          message: `DOWNLOAD_VIDEO_JOB failed because there was an error while downloading the video file!`
        });
        return;
      } catch (e) {
        await job.moveToFailed({
          message: `DOWNLOAD_VIDEO_JOB failed because epiphan device could not be reached!\n${e}`
        });
        return;
      }
    }

    await job.moveToFailed({
      message: `DOWNLOAD_VIDEO_JOB failed because epiphan device doesn't contain any recordings!`
    });
  }
}