import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from "@nestjs/microservices";
import { LIVEKIT_EGRESS_SERVICE, LIVEKIT_INGRESS_SERVICE } from "../app.constants";
import { LivekitController } from "./livekit.controller";
import { LivekitIngressService } from "./services/livekit.ingress.service";
import { LivekitEgressService } from "./services/livekit.egress.service";
import { ConfigModule } from "@nestjs/config";
import config from "../common/utils/config.yaml";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { HttpModule } from "@nestjs/axios";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ClientsModule.register([{ name: LIVEKIT_EGRESS_SERVICE, transport: Transport.TCP }]),
    ClientsModule.register([{ name: LIVEKIT_INGRESS_SERVICE, transport: Transport.TCP }]),
    ConfigModule.forRoot({ load: [config] }),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),

  ],
  providers: [LivekitIngressService, LivekitEgressService],
  controllers: [LivekitController],
})
export class LivekitModule {}
