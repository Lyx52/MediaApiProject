import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from "@nestjs/microservices";
import { EPIPHAN_SERVICE, PLUGNMEET_SERVICE } from "../app.constants";
import { PlugNMeetController } from "./plugnmeet.controller";
import { PlugNMeetService } from "./plugnmeet.service";

@Module({
  imports: [
    ClientsModule.register([{ name: PLUGNMEET_SERVICE, transport: Transport.TCP }])
  ],
  providers: [PlugNMeetService],
  controllers: [PlugNMeetController],
})
export class PlugNMeetModule {}
