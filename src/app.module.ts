import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Epiphan } from "./epiphan/epiphan.entity";
import { EpiphanModule } from "./epiphan/epiphan.module";
import { PlugNMeetModule } from "./plugnmeet/plugnmeet.module";
import { LivekitModule } from "./livekit/livekit.module";
import { Recorder } from "./plugnmeet/entities/Recorder";
import { OpencastModule } from "./opencast/opencast.module";
import { EgressSession } from "./livekit/entities/EgressSession";
import { BullModule } from "@nestjs/bull";
import { OpencastEvent } from "./opencast/entities/opencast.event";
import { ConferenceSession } from "./plugnmeet/entities/ConferenceSession";
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mongodb',
      host: 'localhost',
      database: 'LbtuMediaDb',
      port: 27017,
      entities: [Epiphan, Recorder, EgressSession, OpencastEvent, ConferenceSession],
      synchronize: true,
      useUnifiedTopology: true
    }),

    BullModule.forRoot({
      redis: {
        host: '85.254.205.116',
        port: 6379,
      },
    }),
    EpiphanModule, PlugNMeetModule, LivekitModule, OpencastModule
  ],
  providers: [

  ]
})
export class AppModule {}
