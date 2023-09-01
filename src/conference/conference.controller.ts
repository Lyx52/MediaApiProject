import { Body, Controller, Get, Header, HttpCode, Inject, Logger, Param, Post } from "@nestjs/common";
import { CreateRoomResponse } from "plugnmeet-sdk-js";
import {CreateConferenceDto} from "./dto/CreateConferenceDto";
import {ConferenceService} from "./services/conference.service";

@Controller('conference')
export class ConferenceController {

    private readonly logger: Logger = new Logger(ConferenceController.name);
    constructor(
        private readonly conferenceService: ConferenceService
    ) {
    }
    @Post()
    @HttpCode(200)
    @Header('Cache-Control', 'none')
    async createConferenceRoom(@Body() payload: CreateConferenceDto): Promise<CreateRoomResponse> {
        return await this.conferenceService.createConferenceRoom(payload);
    }
    @Get('locations')
    async getLocations() {
        return this.conferenceService.getLocations();
    }
}
