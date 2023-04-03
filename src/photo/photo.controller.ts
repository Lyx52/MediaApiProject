import { Controller, Get, Inject } from "@nestjs/common";
import { PhotoService } from './photo.service';
import { Photo } from './photo.entity';
import { EPIPHAN_SERVICE } from "../app.constants";
import { ClientProxy, Ctx, MessagePattern, Payload, RedisContext } from "@nestjs/microservices";
import { Observable } from "rxjs";
import { PlugNMeetToRecorder } from "../plugnmeet/dto/PlugNMeetToRecorder";

@Controller('photo')
export class PhotoController {
  constructor(private readonly photoService: PhotoService, @Inject(EPIPHAN_SERVICE) private readonly client: ClientProxy) {}

  @Get()
  findAll(): Promise<Photo[]> {
    return this.photoService.findAll();
  }
  @Get('add')
  async add() {
    await this.photoService.addPhoto("Tests!");
  }
  @Get('test')
  test(): Observable<number> {
    return this.client.send<number>({cmd: 'testcmd'}, { 'data': [1, 2, 3] });
  }
  @Get('start')
  start(): Observable<boolean> {
    return this.client.send<boolean>({cmd: 'startEpiphan'},{
      id: "642a7bf161bec842b04cd3d6",
      channel: 1
    });
  }
  @MessagePattern('plug-n-meet-recorder')
  getNotifications(@Payload() payload: PlugNMeetToRecorder, @Ctx() context: RedisContext) {
    console.log(`Channel: ${context.getChannel()}`);
  }
}
