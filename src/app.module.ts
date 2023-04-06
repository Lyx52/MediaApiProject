import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Epiphan } from "./epiphan/epiphan.entity";
import { EpiphanModule } from "./epiphan/epiphan.module";
import { PlugNMeetModule } from "./plugnmeet/plugnmeet.module";
import { LivekitModule } from "./livekit/livekit.module";
import { Recorder } from "./plugnmeet/entities/Recorder";
import { OpencastModule } from "./opencast/opencast.module";
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mongodb',
      host: 'localhost',
      database: 'LbtuMediaDb',
      port: 27017,
      entities: [Epiphan, Recorder],
      synchronize: true,
      useUnifiedTopology: true,
    }),
    EpiphanModule, PlugNMeetModule, LivekitModule, OpencastModule
  ],
  providers: [

  ]
})
export class AppModule {}
