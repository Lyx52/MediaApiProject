import {
  Body,
  Controller,
  Inject,
  Headers,
  Logger,
  Post,
  Req,
  Request,
  RawBodyRequest,
  Header,
  Render, Get, Query, UnauthorizedException
} from "@nestjs/common";
import {
  CREATE_OR_GET_INGRESS_STREAM_KEY, GET_EVENT_STATUS, GET_PLUGNMEET_ACCESS_TOKEN,
  LIVEKIT_SERVICE, LIVEKIT_WEBHOOK_EVENT,
  PLUGNMEET_ROOM_ENDED,
  START_LIVEKIT_EGRESS_RECORDING,
  STOP_LIVEKIT_EGRESS_RECORDING, STOP_OPENCAST_EVENT, VERIFY_LIVEKIT_TOKEN
} from "../app.constants";
import { ClientProxy, Ctx, EventPattern, MessagePattern, Payload, RedisContext } from "@nestjs/microservices";
import { StopEgressRecordingDto } from "./dto/StopEgressRecordingDto";
import { StartEgressRecordingDto } from "./dto/StartEgressRecordingDto";
import { LivekitEgressService } from "./services/livekit.egress.service";
import { LivekitIngressService } from "./services/livekit.ingress.service";
import { CreateOrGetIngressStreamKeyDto } from "./dto/CreateOrGetIngressStreamKeyDto";
import { PlugNMeetRoomEndedDto } from "../plugnmeet/dto/PlugNMeetRoomEndedDto";
import {ConfigService} from "@nestjs/config";
import { IngressInfo, WebhookReceiver } from "livekit-server-sdk";
import { WebhookEvent } from "livekit-server-sdk/dist/proto/livekit_webhook";
import {Public} from "../common/utils/decorators/public.decorator";
import { VerifyLivekitTokenDto } from "../plugnmeet/dto/VerifyLivekitTokenDto";
import * as livekitClient from "livekit-client";
import jwt_decode from "jwt-decode";
import { isJWT } from "class-validator";
import jwtDecode from "jwt-decode";
import {firstValueFrom} from "rxjs";
import {StopOpencastEventDto} from "../opencast/dto/StopOpencastEventDto";
import {OpencastIngestType} from "../opencast/dto/enums/OpencastIngestType";
import {GetAccessTokenDto} from "../plugnmeet/dto/GetAccessTokenDto";
@Controller('livekit')
export class LivekitController {
  private readonly logger: Logger = new Logger(LivekitController.name);
  private readonly webhookHandler: WebhookReceiver;
  private readonly livekitHost: string;
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
    this.livekitHost = this.config.getOrThrow<string>("livekit.host");
  }
  @EventPattern(LIVEKIT_WEBHOOK_EVENT)
  async handleLivekitWebhookEvents(@Body() data: WebhookEvent) {
    try {
      switch(data.event) {
        case "egress_ended":
          this.logger.debug("LIVEKIT:EGRESS_ENDED");
          await this.egressService.ingestEgress(data.egressInfo, data.egressInfo.roomId, `ROOM_COMPOSITE_${data.egressInfo.roomId}`);
          break;
      }
    } catch (e) {
      this.logger.error(`Caught unhandled exception!\n${e}`);
    }
  }

  @Post('webhook')
  @Public()
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
  @Public()
  @Get("layout")
  @Render('index')
  async renderLayout(@Query("token") token: string, @Query("url") url: string) {
    const connectionCheck = new livekitClient.ConnectionCheck(this.livekitHost, token);
    if (connectionCheck.isSuccess() && isJWT(token)) {
      const jwt: any = jwtDecode(token)
      const accessTokenRes: any = await firstValueFrom(this.client.send(GET_PLUGNMEET_ACCESS_TOKEN, <GetAccessTokenDto> {
        roomId: jwt?.video?.room
      }));

      return { accessToken: accessTokenRes?.token, livekitURL: url, livekitToken: token };
    }
    throw new UnauthorizedException('Invalid livekit token!');
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
    this.logger.debug("LIVEKIT:PLUGNMEET_ROOM_ENDED");
    await this.ingressService.deleteAllIngressSessionsOrRetry(data);
  }

  @EventPattern(STOP_LIVEKIT_EGRESS_RECORDING)
  async stopEgressRecording(@Body() data: StopEgressRecordingDto) {
    this.logger.debug("STOP_LIVEKIT_EGRESS_RECORDING");
    await this.egressService.stopEgressRecording(data);
  }
}
