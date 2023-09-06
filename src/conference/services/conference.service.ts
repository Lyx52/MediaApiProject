import {
    Inject,
    Injectable,
    Logger,
    OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MongoRepository } from "typeorm";
import {
    ActiveRoomInfo,
    CreateRoomResponse,
    CreateRoomResponseRoomInfo,
    PlugNmeet,
    Room, RooMetadata
} from "plugnmeet-sdk-js";
import { ConfigService } from "@nestjs/config";
import {Conference} from "../entities/Conference";
import {CreateConferenceDto} from "../dto/CreateConferenceDto";
import {LocationConfig} from "../dto/LocationConfig";

@Injectable()
export class ConferenceService {
    private readonly logger = new Logger(ConferenceService.name);
    private readonly PNMController: PlugNmeet;
    private readonly currentLocations: LocationConfig[];
    constructor(
        @InjectRepository(Conference) private readonly conferenceRepository: MongoRepository<Conference>,
        private readonly config: ConfigService,
    ) {
        this.PNMController = new PlugNmeet(
            this.config.getOrThrow<string>('plugnmeet.host'),
            this.config.getOrThrow<string>('plugnmeet.key'),
            this.config.getOrThrow<string>('plugnmeet.secret'),
        );
        this.currentLocations = this.config.getOrThrow<LocationConfig[]>('appconfig.locations');
        this.logger.log(this.currentLocations);
    }

    async createConferenceRoom(payload: CreateConferenceDto): Promise<CreateRoomResponse> {
        const response = await this.PNMController.createRoom({
            room_id: payload.roomId,
            metadata: payload.metadata,
            empty_timeout: payload.emptyTimeout || this.config.get<number>('plugnmeet.empty_room_timeout') || 900,
            max_participants:  payload.maxParticipants || this.config.get<number>('plugnmeet.max_room_participants') || 25
        });
        if (response.status) {
            const entity = this.conferenceRepository.create();
            entity.roomId = payload.roomId;
            entity.metadata = response.roomInfo?.metadata || undefined;
            entity.location = payload.location;
            entity.courseName = payload.opencastSeriesId;
            entity.title = payload.metadata.room_title;
            entity.started = new Date();
            if (!entity.metadata) {
                const roomInfo = await this.PNMController.getActiveRoomInfo({room_id: payload.roomId});
                entity.metadata = roomInfo.room?.room_info?.metadata;
                entity.roomSid = roomInfo.room?.room_info?.sid;
            }

            await this.conferenceRepository.insert(entity);
            this.logger.log(`PlugNMeet room ${entity.roomSid} created!`);
        }

        return response;
    }
    getLocations() : LocationConfig[] {
        return this.currentLocations
    }
}