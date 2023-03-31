import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Epiphan } from "./epiphan.entity";
import { EpiphanService } from "./epiphan.service";
import { EpiphanController } from "./epiphan.controller";
import { HttpModule } from "@nestjs/axios";

@Module({
  imports: [
    TypeOrmModule.forFeature([Epiphan]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  providers: [EpiphanService],
  controllers: [EpiphanController]
})
export class EpiphanModule {}
