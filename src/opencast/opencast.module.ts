import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from "@nestjs/microservices";
import { OPENCAST_SERVICE } from "../app.constants";
import { OpencastController } from "./opencast.controller";
import { BullModule } from "@nestjs/bull";
import { OpencastVideoIngestConsumer } from "./processors/opencast.video-ingest.processor";
@Module({
  imports: [
    ClientsModule.register([{ name: OPENCAST_SERVICE, transport: Transport.TCP }]),
    BullModule.registerQueue({
      name: 'video',
    }),
  ],
  providers: [OpencastVideoIngestConsumer],
  controllers: [OpencastController],
})
export class OpencastModule {}
