import { Controller, Get, Inject } from "@nestjs/common";
import { PhotoService } from './photo.service';
import { Photo } from './photo.entity';
import { EPIPHAN_SERVICE } from "../app.constants";
import { ClientProxy } from "@nestjs/microservices";
import { Observable } from "rxjs";

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
    return this.client.send<boolean>({cmd: 'startEpiphan'}, {name: 'test', id: 'testId', channel: 1});
  }
}
