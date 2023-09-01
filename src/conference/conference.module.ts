import { Module } from '@nestjs/common';
import { ConfigModule } from "@nestjs/config";
import config from "../common/utils/config.yaml";
import { TypeOrmModule } from "@nestjs/typeorm";
import {ConferenceService} from "./services/conference.service";
import {ConferenceController} from "./conference.controller";
import {Conference} from "./entities/Conference";
@Module({
    imports: [
        TypeOrmModule.forFeature([Conference]),
        ConfigModule.forRoot({ load: [config] }),
    ],
    providers: [ConferenceService],
    controllers: [ConferenceController],
})
export class ConferenceModule {}
