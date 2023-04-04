import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Epiphan } from "./epiphan/epiphan.entity";
import { EpiphanModule } from "./epiphan/epiphan.module";
import { PlugNMeetModule } from "./plugnmeet/plugnmeet.module";
import { LivekitModule } from "./livekit/livekit.module";
import { ConferenceRoomSession } from "./plugnmeet/entities/ConferenceRoomSession";
import { Recorder } from "./plugnmeet/entities/Recorder";
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mongodb',
      host: 'localhost',
      database: 'LbtuMediaDb',
      entities: [Epiphan, ConferenceRoomSession, Recorder],
      synchronize: true,
      useUnifiedTopology: true,
    }),
    EpiphanModule, PlugNMeetModule, LivekitModule
  ],
  providers: [

  ]
})
export class AppModule {}
