import { Body, Controller, Get, Inject, Logger } from "@nestjs/common";
import { EpiphanService } from "./services/epiphan.service";
import { ClientProxy, EventPattern, MessagePattern } from "@nestjs/microservices";
import { StartEpiphanRecordingDto } from "./dto/StartEpiphanRecordingDto";
import {
  START_OPENCAST_EVENT,
  DOWNLOAD_VIDEO_JOB,
  EPIPHAN_SERVICE,
  START_EPIPHAN_RECORDING,
  STOP_EPIPHAN_RECORDING, STOP_OPENCAST_EVENT
} from "../app.constants";
import { StopEpiphanRecordingDto } from "./dto/StopEpiphanRecordingDto";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { DownloadJobDto } from "./dto/DownloadJobDto";
import { RecordingDeviceDto } from "./dto/RecordingDeviceDto";
import { StartOpencastEventDto } from "../opencast/dto/StartOpencastEventDto";
import { OpencastIngestType } from "../opencast/dto/enums/OpencastIngestType";
import { firstValueFrom } from "rxjs";
import { StopOpencastEventDto } from "../opencast/dto/StopOpencastEventDto";

@Controller('epiphan')
export class EpiphanController {
  private readonly logger: Logger = new Logger(EpiphanController.name);
  constructor(
    private readonly epiphanService: EpiphanService,
    @InjectQueue('download') private downloadQueue: Queue,
    @Inject(EPIPHAN_SERVICE) private readonly client: ClientProxy
  ) {
  }

  @Get()
  async getAllDeviceLocations(): Promise<RecordingDeviceDto[]> {
    return this.epiphanService.getAllDeviceLocations();
  }

  @MessagePattern(START_EPIPHAN_RECORDING)
  async startEpiphanRecording(@Body() data: StartEpiphanRecordingDto) {
    this.logger.debug("START_EPIPHAN_RECORDING");
    let success = true;
    success &&= await this.epiphanService.startEpiphanRecording(data);
    success &&= await this.epiphanService.startEpiphanLivestream(data);

    // We have failed to start, stop everything...
    if (!success) {
      await this.epiphanService.stopEpiphanLivestream(<StopEpiphanRecordingDto>{
        epiphanId: data.epiphanId,
        roomMetadata: data.roomMetadata,
        ingestRecording: false
      });
      await this.epiphanService.stopEpiphanRecording(<StopEpiphanRecordingDto>{
        epiphanId: data.epiphanId,
        roomMetadata: data.roomMetadata,
        ingestRecording: false
      });
    } else {
      await this.client.emit(START_OPENCAST_EVENT, <StartOpencastEventDto>{
        roomMetadata: data.roomMetadata,
        recorderId: data.recorderId,
        type: OpencastIngestType.PRESENTER
      });
    }
    return success;
  }

  @EventPattern(STOP_EPIPHAN_RECORDING)
  async stopEpiphanRecording(@Body() data: StopEpiphanRecordingDto) {
    this.logger.debug("STOP_EPIPHAN_RECORDING");
    await this.epiphanService.stopEpiphanLivestream(data);
    if (await this.epiphanService.stopEpiphanRecording(data) && data.ingestRecording) {
      // We send stop event message, wait for answer then start ingesting.
      if (await firstValueFrom(this.client.send(STOP_OPENCAST_EVENT, <StopOpencastEventDto> {
        roomSid: data.roomMetadata.info.sid,
        recorderId: data.recorderId,
      }))) {
        await this.downloadQueue.add(DOWNLOAD_VIDEO_JOB, <DownloadJobDto>data);
      }
    }
  }
}
