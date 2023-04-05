import { Body, Controller, Inject, Logger } from "@nestjs/common";
import {
  START_LIVEKIT_EGRESS_RECORDING,
  STOP_LIVEKIT_EGRESS_RECORDING
} from "../app.constants";
import { ClientProxy, Ctx, EventPattern, MessagePattern, Payload, RedisContext } from "@nestjs/microservices";
import { of } from "rxjs";
import { StopEgressRecordingDto } from "./dto/StopEgressRecordingDto";
import { StartEgressRecordingDto } from "./dto/StartEgressRecordingDto";

@Controller('livekit')
export class LivekitController {
  private readonly logger: Logger = new Logger(LivekitController.name);
  constructor() {}

  @MessagePattern(START_LIVEKIT_EGRESS_RECORDING)
  async startEgressRecording(@Body() data: StartEgressRecordingDto) {
    this.logger.debug("START_LIVEKIT_EGRESS_RECORDING");
    return true;
  }

  @EventPattern(STOP_LIVEKIT_EGRESS_RECORDING)
  async stopEgressRecording(@Body() data: StopEgressRecordingDto) {
    this.logger.debug("STOP_LIVEKIT_EGRESS_RECORDING");
  }
}
