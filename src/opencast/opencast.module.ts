import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from "@nestjs/microservices";
import { OPENCAST_SERVICE } from "../app.constants";
import { OpencastController } from "./opencast.controller";
import { BullModule } from "@nestjs/bull";
import { HttpModule } from "@nestjs/axios";
import { OpencastService } from "./services/opencast.service";
import { ConfigModule } from "@nestjs/config";
import config from "../common/utils/config.yaml";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OpencastEvent } from "./entities/OpencastEvent";
import { OpencastVideoIngestConsumer } from "./processors/opencast.ingest.processor";
import { OpencastTaskService } from "./services/opencast.task.service";
import {Conference} from "./entities/Conference";
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'video',
      defaultJobOptions: {
        attempts: 50,
        removeOnComplete: true,
      },
    }),
    TypeOrmModule.forFeature([Conference]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    ConfigModule.forRoot({ load: [config] }),
  ],
  providers: [OpencastVideoIngestConsumer, OpencastService, OpencastTaskService],
  controllers: [OpencastController],
})
export class OpencastModule {}
