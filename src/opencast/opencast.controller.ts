import { Body, Controller, Inject, Logger } from "@nestjs/common";
import {
  ADD_OPENCAST_INGEST_JOB,
  CREATE_OPENCAST_EVENT, INGEST_MEDIAPACKAGE_JOB,
  INGEST_VIDEO_JOB, PLUGNMEET_ROOM_ENDED,
  START_OPENCAST_INGEST
} from "../app.constants";
import { ClientProxy, Ctx, EventPattern, MessagePattern, Payload, RedisContext } from "@nestjs/microservices";
import { CreateOpencastEventDto } from "./dto/CreateOpencastEventDto";
import { StartOpencastIngestDto } from "./dto/StartOpencastIngestDto";
import { OpencastService } from "./services/opencast.service";
import { IngestJobDto } from "./dto/IngestJobDto";
import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
import { PlugNMeetRoomEndedDto } from "../plugnmeet/dto/PlugNMeetRoomEndedDto";
import { IngestMediaPackageDto } from "./dto/IngestMediaPackageDto";
@Controller('opencast')
export class OpencastController {
  private readonly logger: Logger = new Logger(OpencastController.name);
  constructor(
    private readonly eventService: OpencastService,
    @InjectQueue('video') private ingestQueue: Queue,
  ) {
  }
  @EventPattern(CREATE_OPENCAST_EVENT)
  async createOpencastEvent(@Body() data: CreateOpencastEventDto) {
    this.logger.debug("CREATE_OPENCAST_EVENT");
    await this.eventService.startRecordingEvent(data);
  }
  @EventPattern(START_OPENCAST_INGEST)
  async startOpencastIngest(@Body() data: StartOpencastIngestDto) {
    this.logger.debug("START_OPENCAST_INGEST");
    await this.eventService.stopRecordingEvent(data);
  }
  @EventPattern(ADD_OPENCAST_INGEST_JOB)
  async addMediaToQueue(@Body() data: IngestJobDto) {
    this.logger.debug("ADD_OPENCAST_INGEST_JOB");
    await this.ingestQueue.add(INGEST_VIDEO_JOB, data);
  }
  @EventPattern(PLUGNMEET_ROOM_ENDED)
  async roomEndedHandle(@Body() data: PlugNMeetRoomEndedDto) {
    this.logger.debug("PLUGNMEET_ROOM_ENDED");
    await this.ingestQueue.add(INGEST_MEDIAPACKAGE_JOB, <IngestMediaPackageDto>data);
  }
}
