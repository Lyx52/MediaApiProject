import {Body, Controller, Inject, Headers, Logger, Post, Req, Request, RawBodyRequest, Header} from "@nestjs/common";
import {
  CREATE_OR_GET_INGRESS_STREAM_KEY,
  LIVEKIT_SERVICE, LIVEKIT_WEBHOOK_EVENT,
  PLUGNMEET_ROOM_ENDED,
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
import {ConfigService} from "@nestjs/config";
import { EgressClient, IngressInfo, WebhookReceiver } from "livekit-server-sdk";
import { WebhookEvent } from "livekit-server-sdk/dist/proto/livekit_webhook";
@Controller('livekit')
export class LivekitController {
  private readonly logger: Logger = new Logger(LivekitController.name);
  private readonly webhookHandler: WebhookReceiver;
  constructor(
    private readonly egressService: LivekitEgressService,
    private readonly ingressService: LivekitIngressService,
    private readonly config: ConfigService,
    @Inject(LIVEKIT_SERVICE) private readonly client: ClientProxy,
  ) {
    this.webhookHandler = new WebhookReceiver(
        this.config.getOrThrow<string>("livekit.key"),
        this.config.getOrThrow<string>("livekit.secret"),
    );
  }
  @EventPattern(LIVEKIT_WEBHOOK_EVENT)
  async handleLivekitWebhookEvents(@Body() data: WebhookEvent) {
    try {
      switch(data.event) {
        case "egress_ended":
          await this.egressService.ingestEgress(data.egressInfo, data.egressInfo.roomId, `ROOM_COMPOSITE_${data.egressInfo.roomId}`);
          break;
      }
    } catch (e) {
      this.logger.error(`Caught unhandled exception!\n${e}`);
    }
  }

  @Post('webhook')
  @Header('content-type', 'application/webhook+json')
  async handleLivekitWebhook(@Body() payload: any, @Headers() headers: any) {
    try {
      const webhookEvent: WebhookEvent = await this.webhookHandler.receive(payload.toString(), headers.authorization);
      // Filter only events we want to send so there's fewer events thrown around
      switch(webhookEvent.event) {
        case "room_finished":
        case "egress_ended":
          this.client.emit(LIVEKIT_WEBHOOK_EVENT, <WebhookEvent>webhookEvent);
          break;
      }
    } catch (e) {
      this.logger.warn(`Failed to handle webhook event from livekit!\n${e}`);
    }
  }

  @MessagePattern(START_LIVEKIT_EGRESS_RECORDING)
  async startEgressRecording(@Body() data: StartEgressRecordingDto): Promise<boolean> {
    this.logger.debug("START_LIVEKIT_EGRESS_RECORDING");

    return await this.egressService.startEgressRecording(data);
  }

  @MessagePattern(CREATE_OR_GET_INGRESS_STREAM_KEY)
  async createOrGetIngressStreamKey(@Body() data: CreateOrGetIngressStreamKeyDto): Promise<ServiceMessageResponse<IngressInfo>>  {
    this.logger.debug("CREATE_OR_GET_INGRESS_STREAM_KEY");
    const ingressSession = await this.ingressService.createOrGetIngress(data);
    return <ServiceMessageResponse<IngressInfo>>{
      success: ingressSession !== undefined && ingressSession !== null,
      data: ingressSession
    }
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
