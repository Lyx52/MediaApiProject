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
import { HttpModule } from "@nestjs/axios";
import { ConfigModule, ConfigService } from "@nestjs/config";
import config from '../common/utils/config.yaml';
import { PlugNMeetHttpService } from "./services/plugnmeet.http.service";
import { ConferenceSession } from "./entities/ConferenceSession";
@Module({
  imports: [
    TypeOrmModule.forFeature([Recorder, ConferenceSession]),
    ClientsModule.register([{ name: PLUGNMEET_SERVICE, transport: Transport.TCP }]),
    ScheduleModule.forRoot(),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        readyLog: true,
        config: {
          host: config.getOrThrow<string>('redis.host'),
          port: config.getOrThrow<number>('redis.port'),
          db: config.getOrThrow<number>('redis.db'),
          username: config.getOrThrow<string>('redis.username'),
          password: config.getOrThrow<string>('redis.password')
        },
      }),
      inject: [ConfigService],
    }),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    ConfigModule.forRoot({ load: [config] }),
  ],
  providers: [PlugNMeetService, PlugNMeetTaskService, PlugNMeetHttpService],
  controllers: [PlugNMeetController],
})
export class PlugNMeetModule {}
