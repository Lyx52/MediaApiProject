import { Body, Controller, Inject, Logger } from "@nestjs/common";
import {
  ADD_OPENCAST_INGEST_JOB,
  START_OPENCAST_EVENT, INGEST_MEDIAPACKAGE_JOB,
  INGEST_VIDEO_JOB, PLUGNMEET_ROOM_ENDED,
  STOP_OPENCAST_EVENT, START_EPIPHAN_RECORDING
} from "../app.constants";
import { ClientProxy, Ctx, EventPattern, MessagePattern, Payload, RedisContext } from "@nestjs/microservices";
import { StartOpencastEventDto } from "./dto/StartOpencastEventDto";
import { StopOpencastEventDto } from "./dto/StopOpencastEventDto";
import { OpencastService } from "./services/opencast.service";
import { IngestJobDto } from "./dto/IngestJobDto";
import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
import { PlugNMeetRoomEndedDto } from "../plugnmeet/dto/PlugNMeetRoomEndedDto";
import { IngestMediaPackageJobDto } from "./dto/IngestMediaPackageJobDto";
import { StartEpiphanRecordingDto } from "../epiphan/dto/StartEpiphanRecordingDto";
@Controller('opencast')
export class OpencastController {
  private readonly logger: Logger = new Logger(OpencastController.name);
  constructor(
    private readonly eventService: OpencastService,
    @InjectQueue('video') private ingestQueue: Queue,
  ) {
  }
  @MessagePattern(STOP_OPENCAST_EVENT)
  async stopOpencastEvent(@Body() data: StopOpencastEventDto) {
    this.logger.debug("STOP_OPENCAST_EVENT");
    return await this.eventService.stopRecordingEvent(data);
  }
  @EventPattern(START_OPENCAST_EVENT)
  async startOpencastEvent(@Body() data: StartOpencastEventDto) {
    this.logger.debug("START_OPENCAST_EVENT");
    await this.eventService.startRecordingEvent(data);
  }
  @EventPattern(ADD_OPENCAST_INGEST_JOB)
  async addIngestJob(@Body() data: IngestJobDto) {
    this.logger.debug("ADD_OPENCAST_INGEST_JOB");
    await this.ingestQueue.add(INGEST_VIDEO_JOB, data);
  }
  @EventPattern(PLUGNMEET_ROOM_ENDED)
  async roomEndedHandle(@Body() data: PlugNMeetRoomEndedDto) {
    this.logger.debug("PLUGNMEET_ROOM_ENDED");
    await this.eventService.stopAllRecordingEvents(data);
    await this.ingestQueue.add(INGEST_MEDIAPACKAGE_JOB, <IngestMediaPackageJobDto>data);
  }
}
