import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from "@nestjs/microservices";
import { OPENCAST_SERVICE } from "../app.constants";
import { OpencastController } from "./opencast.controller";
@Module({
  imports: [
    ClientsModule.register([{ name: OPENCAST_SERVICE, transport: Transport.TCP }])
  ],
  providers: [],
  controllers: [OpencastController],
})
export class OpencastModule {}
