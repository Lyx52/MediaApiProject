import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Epiphan } from "./epiphan.entity";
import { EpiphanService } from "./services/epiphan.service";
import { EpiphanController } from "./epiphan.controller";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import config from "../common/utils/config.yaml";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { EPIPHAN_SERVICE } from "../app.constants";
import { BullModule } from "@nestjs/bull";
import { EpiphanDownloadConsumer } from "./processors/epiphan.download.processor";

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'download',
      defaultJobOptions: {
        attempts: 50,
        removeOnComplete: true
      }
    }),
    TypeOrmModule.forFeature([Epiphan]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    ClientsModule.register([{ name: EPIPHAN_SERVICE, transport: Transport.TCP }]),
    ConfigModule.forRoot({ load: [config] }),
  ],
  providers: [
    EpiphanService, EpiphanDownloadConsumer
  ],
  controllers: [EpiphanController]
})
export class EpiphanModule {}
