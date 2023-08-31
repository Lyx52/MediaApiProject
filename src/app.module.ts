import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpencastModule } from "./opencast/opencast.module";
import { BullModule } from "@nestjs/bull";
import { OpencastEvent } from "./opencast/entities/OpencastEvent";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import {Conference} from "./common/entities/Conference";
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => (   {
        type: 'mongodb',
        host: config.getOrThrow<string>('mongodb.host'),
        database: config.getOrThrow<string>('mongodb.database'),
        port: config.getOrThrow<number>('mongodb.port'),
        entities: [Conference],
        synchronize: true,
        useUnifiedTopology: true,
        dropSchema: true
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
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
    OpencastModule
  ],
})
export class AppModule {}
