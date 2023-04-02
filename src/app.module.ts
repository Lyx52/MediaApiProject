import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotoModule } from './photo/photo.module';
import { Photo } from './photo/photo.entity';
import { Epiphan } from "./epiphan/epiphan.entity";
import { EpiphanModule } from "./epiphan/epiphan.module";
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mongodb',
      host: 'localhost',
      database: 'LbtuMediaDb',
      entities: [Photo, Epiphan],
      synchronize: true,
      useUnifiedTopology: true,
    }),
    PhotoModule, EpiphanModule
  ],
  providers: [

  ]
})
export class AppModule {}
