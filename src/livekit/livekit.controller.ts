import { Body, Controller, Inject, Logger, Post } from "@nestjs/common";
import {
  CREATE_OR_GET_INGRESS_STREAM_KEY, INGEST_MEDIAPACKAGE_JOB, PLUGNMEET_ROOM_ENDED,
  START_LIVEKIT_EGRESS_RECORDING,
  STOP_LIVEKIT_EGRESS_RECORDING
} from "../app.constants";
import { ClientProxy, Ctx, EventPattern, MessagePattern, Payload, RedisContext } from "@nestjs/microservices";
import { StopEgressRecordingDto } from "./dto/StopEgressRecordingDto";
import { StartEgressRecordingDto } from "./dto/StartEgressRecordingDto";
import { LivekitEgressService } from "./services/livekit.egress.service";
import { LivekitIngressService } from "./services/livekit.ingress.service";
import { CreateOrGetIngressStreamKeyDto } from "./dto/CreateOrGetIngressStreamKeyDto";
import { PlugNMeetRoomEndedDto } from "../plugnmeet/dto/PlugNMeetRoomEndedDto";
import { IngestMediaPackageDto } from "../opencast/dto/IngestMediaPackageDto";

@Controller('livekit')
export class LivekitController {
  private readonly logger: Logger = new Logger(LivekitController.name);
  constructor(
    private readonly egressService: LivekitEgressService,
    private readonly ingressService: LivekitIngressService,
  ) {}

  @MessagePattern(START_LIVEKIT_EGRESS_RECORDING)
  async startEgressRecording(@Body() data: StartEgressRecordingDto) {
    this.logger.debug("START_LIVEKIT_EGRESS_RECORDING");
    return await this.egressService.startEgressRecording(data);
  }

  @MessagePattern(CREATE_OR_GET_INGRESS_STREAM_KEY)
  async createOrGetIngressStreamKey(@Body() data: CreateOrGetIngressStreamKeyDto) {
    this.logger.debug("CREATE_OR_GET_INGRESS_STREAM_KEY");
    return await this.ingressService.createOrGetIngress(data);
  }
  @EventPattern(PLUGNMEET_ROOM_ENDED)
  async roomEndedHandle(@Body() data: PlugNMeetRoomEndedDto) {
    this.logger.debug("PLUGNMEET_ROOM_ENDED");
    await this.ingressService.deleteAllIngressSessionsOrRetry(data);
  }
  @EventPattern(STOP_LIVEKIT_EGRESS_RECORDING)
  async stopEgressRecording(@Body() data: StopEgressRecordingDto) {
    this.logger.debug("STOP_LIVEKIT_EGRESS_RECORDING");
    await this.egressService.stopEgressRecording(data);
  }
}
