import { Module } from '@nestjs/common';
import { BullModule } from "@nestjs/bull";
import { HttpModule } from "@nestjs/axios";
import { OpencastService } from "./services/opencast.service";
import { ConfigModule } from "@nestjs/config";
import config from "../common/utils/config.yaml";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OpencastVideoIngestConsumer } from "./processors/opencast.ingest.processor";
import { IngesterTaskService } from "../common/services/ingester.task.service";
import {Conference} from "../common/entities/Conference";
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
  providers: [OpencastVideoIngestConsumer, OpencastService, IngesterTaskService],
  controllers: [],
})
export class OpencastModule {}
