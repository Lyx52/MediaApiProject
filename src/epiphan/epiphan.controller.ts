import { Body, Controller, Get, Post } from "@nestjs/common";
import { EpiphanService } from "./epiphan.service";
import { Epiphan } from "./epiphan.entity";
import { CreateEpiphanDto } from "./dto/CreateEpiphanDto";
import { MessagePattern } from "@nestjs/microservices";
import { StartEpiphanRecordingDto } from "./dto/StartEpiphanRecordingDto";
@Controller('epiphan')
export class EpiphanController {
  constructor(private readonly epiphanService: EpiphanService) {}

  @Get()
  findAll(): Promise<Epiphan[]> {
    return this.epiphanService.findAll();
  }
  @Post('create')
  async add(@Body() createEpiphanDto: CreateEpiphanDto) {
    await this.epiphanService.addConfig(createEpiphanDto);
  }
  @MessagePattern({ cmd: 'testcmd' })
  testcmd(data: object): number {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore

    return (data.data || []).reduce((a, b) => a + b);
  }
  @MessagePattern({ cmd: 'startEpiphan'})
  async startEpiphanRecording(@Body() data: StartEpiphanRecordingDto) {
    return await this.epiphanService.startEpiphanRecording(data);
  }
}
