import { Body, Controller, Inject, Logger } from "@nestjs/common";
import {
  CREATE_OPENCAST_EVENT, OPENCAST_ADD_MEDIA, START_OPENCAST_INGEST
} from "../app.constants";
import { ClientProxy, Ctx, EventPattern, MessagePattern, Payload, RedisContext } from "@nestjs/microservices";
import { CreateOpencastEventDto } from "./dto/CreateOpencastEventDto";
import { StartOpencastIngestDto } from "./dto/StartOpencastIngestDto";
import { AddMediaDto } from "./dto/AddMediaDto";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { OpencastEventService } from "./services/opencast.event.service";

@Controller('opencast')
export class OpencastController {
  private readonly logger: Logger = new Logger(OpencastController.name);
  constructor(
    @InjectQueue('video') private ingestQueue: Queue,
    private readonly eventService: OpencastEventService,
  ) {}
  @EventPattern(CREATE_OPENCAST_EVENT)
  async createOpencastEvent(@Body() data: CreateOpencastEventDto) {
    this.logger.debug("CREATE_OPENCAST_EVENT");
    await this.eventService.createAndStartRecordingEvent(data);
  }
  @EventPattern(START_OPENCAST_INGEST)
  async startOpencastIngest(@Body() data: StartOpencastIngestDto) {
    this.logger.debug("START_OPENCAST_INGEST");
    await this.eventService.stopEventAndStartIngesting(data);
  }
  @EventPattern(OPENCAST_ADD_MEDIA)
  async addMediaToQueue(@Body() data: AddMediaDto) {
    this.logger.debug("OPENCAST_ADD_MEDIA");
    await this.ingestQueue.add('ingest', data)
  }
}
