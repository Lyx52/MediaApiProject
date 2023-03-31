import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotoService } from './photo.service';
import { PhotoController } from './photo.controller';
import { Photo } from './photo.entity';
import { ClientsModule, Transport } from "@nestjs/microservices";
import { EPIPHAN_SERVICE } from "../app.constants";

@Module({
  imports: [
    TypeOrmModule.forFeature([Photo]),
    ClientsModule.register([{ name: EPIPHAN_SERVICE, transport: Transport.TCP }])
  ],
  providers: [PhotoService],
  controllers: [PhotoController],
})
export class PhotoModule {}
