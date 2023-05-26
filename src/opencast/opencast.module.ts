import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from "@nestjs/microservices";
import { OPENCAST_SERVICE } from "../app.constants";
import { OpencastController } from "./opencast.controller";
import { BullModule } from "@nestjs/bull";
import { HttpModule } from "@nestjs/axios";
import { OpencastEventService } from "./services/opencast.event.service";
import { ConfigModule } from "@nestjs/config";
import config from "../common/utils/config.yaml";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OpencastEvent } from "./entities/opencast.event";
import { OpencastVideoIngestConsumer } from "./processors/opencast.ingest.processor";
import { RedisModule } from "@liaoliaots/nestjs-redis";
@Module({
  imports: [
    ClientsModule.register([{ name: OPENCAST_SERVICE, transport: Transport.TCP }]),
    BullModule.registerQueue({
      name: 'video',
      defaultJobOptions: {
        attempts: 50,
        removeOnComplete: true,
      },
    }),
    TypeOrmModule.forFeature([OpencastEvent]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
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
    ConfigModule.forRoot({ load: [config] }),
  ],
  providers: [OpencastVideoIngestConsumer, OpencastEventService],
  controllers: [OpencastController],
})
export class OpencastModule {}
