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

@Controller('opencast')
export class OpencastController {
  private readonly logger: Logger = new Logger(OpencastController.name);
  constructor(@InjectQueue('video') private ingestQueue: Queue) {}
  @EventPattern(CREATE_OPENCAST_EVENT)
  async createOpencastEvent(@Body() data: CreateOpencastEventDto) {
    this.logger.debug("CREATE_OPENCAST_EVENT");
  }
  @EventPattern(START_OPENCAST_INGEST)
  async startOpencastIngest(@Body() data: StartOpencastIngestDto) {
    this.logger.debug("START_OPENCAST_INGEST");
  }
  @EventPattern(OPENCAST_ADD_MEDIA)
  async addMediaToQueue(@Body() data: AddMediaDto) {
    this.logger.debug("OPENCAST_ADD_MEDIA");
    await this.ingestQueue.add('ingest', data)
  }
}
