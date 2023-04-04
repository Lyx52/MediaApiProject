import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from "@nestjs/microservices";
import { EPIPHAN_SERVICE, PLUGNMEET_SERVICE } from "../app.constants";
import { PlugNMeetController } from "./plugnmeet.controller";
import { PlugNMeetService } from "./services/plugnmeet.service";
import { PlugNMeetTaskService } from "./services/plugnmeet.task.service";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Recorder } from "./entities/Recorder";
import { RedisModule } from "@liaoliaots/nestjs-redis";

@Module({
  imports: [
    TypeOrmModule.forFeature([Recorder]),
    ClientsModule.register([{ name: PLUGNMEET_SERVICE, transport: Transport.TCP }]),
    ScheduleModule.forRoot(),
    RedisModule.forRoot({
      readyLog: true,
      config: {
        host: '85.254.205.116',
        port: 6379,
        username: '',
        password: '',
        db: 0,
      },
    }),
  ],
  providers: [PlugNMeetService, PlugNMeetTaskService],
  controllers: [PlugNMeetController],
})
export class PlugNMeetModule {}
