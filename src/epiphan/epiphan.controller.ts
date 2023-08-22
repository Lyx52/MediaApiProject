import { Body, Controller, Get, Inject, Logger } from "@nestjs/common";
import { EpiphanService } from "./services/epiphan.service";
import { ClientProxy, EventPattern, MessagePattern } from "@nestjs/microservices";
import { StartEpiphanRecordingDto } from "./dto/StartEpiphanRecordingDto";
import {
  DOWNLOAD_VIDEO_JOB,
  EPIPHAN_SERVICE,
  PING_EPIPHAN_DEVICE, START_EPIPHAN_LIVESTREAM,
  START_EPIPHAN_RECORDING,
  START_OPENCAST_EVENT, STOP_EPIPHAN_LIVESTREAM,
  STOP_EPIPHAN_RECORDING,
  STOP_OPENCAST_EVENT
} from "../app.constants";
import { StopEpiphanRecordingDto } from "./dto/StopEpiphanRecordingDto";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { DownloadJobDto } from "./dto/DownloadJobDto";
import { StartOpencastEventDto } from "../opencast/dto/StartOpencastEventDto";
import { OpencastIngestType } from "../opencast/dto/enums/OpencastIngestType";
import { firstValueFrom } from "rxjs";
import { StopOpencastEventDto } from "../opencast/dto/StopOpencastEventDto";
import { GetRecordingDevicesDto } from "./dto/GetRecordingDevicesDto";
import { PingEpiphanDto } from "./dto/PingEpiphanDto";
import { StartEpiphanLivestreamDto } from "./dto/StartEpiphanLivestreamDto";
import { StopEpiphanLivestreamDto } from "./dto/StopEpiphanLivestreamDto";

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
  async getAllDeviceLocations(): Promise<GetRecordingDevicesDto> {
    return <GetRecordingDevicesDto>{
      devices: await this.epiphanService.getAllActiveDeviceLocations()
    };
  }
  @MessagePattern(PING_EPIPHAN_DEVICE)
  async pingEpiphan(@Body() data: PingEpiphanDto) {
    return await this.epiphanService.pingEpiphanDevice(data);
  }
  @MessagePattern(START_EPIPHAN_LIVESTREAM)
  async startEpiphanLivestream(@Body() data: StartEpiphanLivestreamDto) {
    return await this.epiphanService.startEpiphanLivestream(data);
  }
  @MessagePattern(STOP_EPIPHAN_LIVESTREAM)
  async stopEpiphanLivestream(@Body() data: StopEpiphanLivestreamDto) {
    return await this.epiphanService.stopEpiphanLivestream(data);
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
        roomSid: data.roomMetadata.info.sid,
        recorderId: data.recorderId
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
        recorderId: data.recorderId,
        roomSid: data.roomMetadata.info.sid,
        type: OpencastIngestType.PRESENTER
      }))) {
        await this.downloadQueue.add(DOWNLOAD_VIDEO_JOB, <DownloadJobDto>data);
      }
    }
  }
}
