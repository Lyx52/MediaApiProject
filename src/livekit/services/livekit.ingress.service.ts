import { Inject, Injectable, Logger } from "@nestjs/common";
import { LIVEKIT_INGRESS_SERVICE } from "../../app.constants";
import { ClientProxy } from "@nestjs/microservices";
import { CreateOrGetIngressStreamKeyDto } from "../dto/CreateOrGetIngressStreamKeyDto";
import {
  CreateIngressOptions,
  IngressAudioOptions,
  IngressClient,
  IngressInfo,
  IngressInput,
  IngressVideoOptions
} from "livekit-server-sdk";
import { ConfigService } from "@nestjs/config";
import {
  IngressAudioEncodingPreset,
  IngressState_Status,
  IngressVideoEncodingPreset
} from "livekit-server-sdk/dist/proto/livekit_ingress";
import { TrackSource } from "livekit-server-sdk/dist/proto/livekit_models";
import { PlugNMeetRoomEndedDto } from "../../plugnmeet/dto/PlugNMeetRoomEndedDto";

@Injectable()
export class LivekitIngressService {
  private readonly logger = new Logger(LivekitIngressService.name);
  private readonly ingressClient: IngressClient;
  constructor(
    @Inject(LIVEKIT_INGRESS_SERVICE) private readonly client: ClientProxy,
    private readonly config: ConfigService
  ) {
    this.ingressClient = new IngressClient(
      this.config.getOrThrow<string>("livekit.host"),
      this.config.getOrThrow<string>("livekit.key"),
      this.config.getOrThrow<string>("livekit.secret"),
    );
  }
  async deleteAllIngressSessionsOrRetry(data: PlugNMeetRoomEndedDto, retries = 0) {
    try {
      const ingressSessions = await this.ingressClient.listIngress(data.roomMetadata.room_id);
      for (const session of ingressSessions)
      {
        await this.ingressClient.deleteIngress(session.ingressId);
      }
    } catch (e) {
      this.logger.error(`Failed to stop ingress for room ${data.roomMetadata.room_id}!`);
      if (retries <= 3) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.deleteAllIngressSessionsOrRetry(data, retries + 1);
      }
    }
  }

  async createOrGetIngress(data: CreateOrGetIngressStreamKeyDto): Promise<ServiceMessageResponse<IngressInfo>> {
    // Find ingress sessions and filter out publishing/buffering ones
    const ingressSessions = (await this.ingressClient.listIngress(data.roomMetadata.room_id))
      .filter(info => info.state.status !== IngressState_Status.ENDPOINT_PUBLISHING &&
                      info.state.status !== IngressState_Status.ENDPOINT_BUFFERING);

    // Return free ingress session
    if (ingressSessions.length > 0) {
      return <ServiceMessageResponse<IngressInfo>>{
        success: true,
        data: ingressSessions[0]
      }
    }

    try {
      const options: CreateIngressOptions = {
        name: `RTMP_INGRESS_${data.roomMetadata.room_id}_${data.epiphanId}`,
        roomName: data.roomMetadata.room_id,
        participantIdentity: `RTMP_BOT_${data.epiphanId}`,
        participantName: ''
      };
      const result = await this.ingressClient.createIngress(IngressInput.RTMP_INPUT, options);
      return <ServiceMessageResponse<IngressInfo>>{
        success: result !== undefined && result !== null,
        data: result
      };
    } catch (e) {
      this.logger.error(`Caught exception while starting ${data.roomMetadata.room_id} room egress!\n${e}`);
    }
    return <ServiceMessageResponse<IngressInfo>>{
      success: false,
      data: {}
    }
  }

}
