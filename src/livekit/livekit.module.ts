import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from "@nestjs/microservices";
import { LIVEKIT_EGRESS_SERVICE, LIVEKIT_INGRESS_SERVICE } from "../app.constants";
import { LivekitController } from "./livekit.controller";
import { IngressService } from "./services/ingress.service";
import { EgressService } from "./services/egress.service";

@Module({
  imports: [
    ClientsModule.register([{ name: LIVEKIT_EGRESS_SERVICE, transport: Transport.TCP }]),
    ClientsModule.register([{ name: LIVEKIT_INGRESS_SERVICE, transport: Transport.TCP }])
  ],
  providers: [IngressService, EgressService],
  controllers: [LivekitController],
})
export class LivekitModule {}
