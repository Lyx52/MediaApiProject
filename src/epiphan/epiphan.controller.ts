import { Body, Controller, Get, Logger, Post } from "@nestjs/common";
import { EpiphanService } from "./services/epiphan.service";
import { Epiphan } from "./epiphan.entity";
import { CreateEpiphanDto } from "./dto/CreateEpiphanDto";
import { EventPattern, MessagePattern } from "@nestjs/microservices";
import { StartEpiphanRecordingDto } from "./dto/StartEpiphanRecordingDto";
import { START_EPIPHAN_RECORDING, STOP_EPIPHAN_RECORDING } from "../app.constants";
import { Observable, of } from "rxjs";
import { StopEpiphanRecordingDto } from "./dto/StopEpiphanRecordingDto";
import { GetEpiphanRecordingsDto } from "./dto/GetEpiphanRecordingsDto";
@Controller('epiphan')
export class EpiphanController {
  private readonly logger: Logger = new Logger(EpiphanController.name);
  constructor(private readonly epiphanService: EpiphanService) {}

  @Get()
  async findAll(): Promise<Epiphan[]> {
    return this.epiphanService.findAll();
  }
  @Post('create')
  async add(@Body() createEpiphanDto: CreateEpiphanDto) {
    return this.epiphanService.addConfig(createEpiphanDto);
  }
  @MessagePattern(START_EPIPHAN_RECORDING)
  async startEpiphanRecording(@Body() data: StartEpiphanRecordingDto) {
    this.logger.debug("START_EPIPHAN_RECORDING");
    return this.epiphanService.startEpiphanRecording(data);
  }

  @EventPattern(STOP_EPIPHAN_RECORDING)
  async stopEpiphanRecording(@Body() data: StopEpiphanRecordingDto) {
    this.logger.debug("STOP_EPIPHAN_RECORDING");
    await this.epiphanService.stopEpiphanRecording(data);
    await this.epiphanService.downloadLastRecording(data);
  }
}
