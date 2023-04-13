import { Body, Controller, Get, Logger, Post } from "@nestjs/common";
import { EpiphanService } from "./services/epiphan.service";
import { Epiphan } from "./epiphan.entity";
import { CreateEpiphanDto } from "./dto/CreateEpiphanDto";
import { EventPattern, MessagePattern } from "@nestjs/microservices";
import { StartEpiphanRecordingDto } from "./dto/StartEpiphanRecordingDto";
import { START_EPIPHAN_RECORDING, STOP_EPIPHAN_RECORDING } from "../app.constants";
import { Observable, of } from "rxjs";
import { StopEpiphanRecordingDto } from "./dto/StopEpiphanRecordingDto";
@Controller('epiphan')
export class EpiphanController {
  private readonly logger: Logger = new Logger(EpiphanController.name);
  constructor(private readonly epiphanService: EpiphanService) {}

  @Get()
  async findAll(): Promise<Epiphan[]> {
    return await this.epiphanService.findAll();
  }
  @Post('create')
  async add(@Body() createEpiphanDto: CreateEpiphanDto) {
    return await this.epiphanService.addConfig(createEpiphanDto);
  }
  @MessagePattern(START_EPIPHAN_RECORDING)
  async startEpiphanRecording(@Body() data: StartEpiphanRecordingDto) {
    this.logger.debug("START_EPIPHAN_RECORDING");
    return this.epiphanService.startEpiphanRecording(<StartEpiphanRecordingDto>{
      channel: 1,
      roomSid: "",
      id: "643804a61caa577b141bfe2f"
    });
  }

  @EventPattern(STOP_EPIPHAN_RECORDING)
  async stopEpiphanRecording(@Body() data: StopEpiphanRecordingDto) {
    this.logger.debug("STOP_EPIPHAN_RECORDING");
    return this.epiphanService.stopEpiphanRecording(<StopEpiphanRecordingDto>{
      channel: 1,
      roomSid: "",
      id: "643804a61caa577b141bfe2f"
    });
  }
}
