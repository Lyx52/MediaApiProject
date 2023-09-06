import {Injectable, Logger, OnModuleInit} from "@nestjs/common";
import {PlugNmeet} from "plugnmeet-sdk-js";
import {Cron, CronExpression, SchedulerRegistry} from "@nestjs/schedule";
import {ConfigService} from "@nestjs/config";
import {InjectRepository} from "@nestjs/typeorm";
import {MongoRepository} from "typeorm";
import {Conference} from "../entities/Conference";
@Injectable()
export class ConferenceTaskService implements OnModuleInit {
    private readonly logger = new Logger(ConferenceTaskService.name);
    private readonly PNMController: PlugNmeet;
    constructor(
        private schedulerRegistry: SchedulerRegistry,
        private readonly config: ConfigService,
        @InjectRepository(Conference) private readonly conferenceRepository: MongoRepository<Conference>,
    ) {
        this.PNMController = new PlugNmeet(
            this.config.getOrThrow<string>('plugnmeet.host'),
            this.config.getOrThrow<string>('plugnmeet.key'),
            this.config.getOrThrow<string>('plugnmeet.secret'),
        );
    }

    async onModuleInit() {
        await this.syncConferenceRooms()
    }

    @Cron(CronExpression.EVERY_30_SECONDS)
    async syncConferenceRooms() {
        this.logger.debug('Syncing conference rooms...');
        try {
            const rooms = await this.PNMController.getActiveRoomsInfo();
            if (!rooms.status && rooms.rooms === undefined) return;
            const activeIds: string[] = rooms.rooms
                .filter(rm => rm.room_info.is_running)
                .map(rm => rm.room_info.sid);
            // Filter documents by id that is not in activeIds and where ended is not set
            await this.conferenceRepository.updateMany(
                { roomSid: { $nin: activeIds }, ended: { $exists: false } },
                { $set: { ended: new Date() } }
            );
        } catch (e) {
            this.logger.debug(`Caught exception while syncing conference rooms ${e}`);
        }
    }
}