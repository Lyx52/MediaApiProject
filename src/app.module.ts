import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EpiphanModule } from "./epiphan/epiphan.module";
import { PlugNMeetModule } from "./plugnmeet/plugnmeet.module";
import { LivekitModule } from "./livekit/livekit.module";
import { Recorder } from "./plugnmeet/entities/Recorder";
import { OpencastModule } from "./opencast/opencast.module";
import { BullModule } from "@nestjs/bull";
import { OpencastEvent } from "./opencast/entities/opencast.event";
import { ConferenceSession } from "./plugnmeet/entities/ConferenceSession";
import { ConfigModule, ConfigService } from "@nestjs/config";
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => (   {
        type: 'mongodb',
        host: config.getOrThrow<string>('mongodb.host'),
        database: config.getOrThrow<string>('mongodb.database'),
        port: config.getOrThrow<number>('mongodb.port'),
        entities: [Recorder, OpencastEvent, ConferenceSession],
        synchronize: true,
        useUnifiedTopology: true
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        redis: {
          host: config.getOrThrow<string>('redis.host'),
          port: config.getOrThrow<number>('redis.port'),
          db: config.getOrThrow<number>('redis.db'),
          username: config.getOrThrow<string>('redis.username'),
          password: config.getOrThrow<string>('redis.password')
        },
      }),
      inject: [ConfigService],
    }),
    EpiphanModule, PlugNMeetModule, LivekitModule, OpencastModule
  ],
  providers: [

  ]
})
export class AppModule {}
