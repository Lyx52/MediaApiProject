import { Inject, Injectable, Logger } from "@nestjs/common";
import { ADD_OPENCAST_INGEST_JOB, LIVEKIT_EGRESS_SERVICE } from "../../app.constants";
import { ClientProxy } from "@nestjs/microservices";
import { EgressClient, EgressInfo, EncodedFileType, EncodingOptionsPreset } from "livekit-server-sdk";
import { ConfigService } from "@nestjs/config";
import { StartEgressRecordingDto } from "../dto/StartEgressRecordingDto";
import { EgressStatus } from "livekit-server-sdk/dist/proto/livekit_egress";
import { StopEgressRecordingDto } from "../dto/StopEgressRecordingDto";
import { IngestJobDto } from "../../opencast/dto/IngestJobDto";
import { OpencastIngestType } from "../../opencast/dto/enums/OpencastIngestType";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";

@Injectable()
export class LivekitEgressService {
  private readonly logger = new Logger(LivekitEgressService.name);
  private readonly egressClient: EgressClient;
  private readonly recordingLocation: string;
  constructor(
    @Inject(LIVEKIT_EGRESS_SERVICE) private readonly client: ClientProxy,
    @InjectRedis() private readonly redisClient: Redis,
    private readonly config: ConfigService,
  ) {
    this.egressClient = new EgressClient(
      this.config.getOrThrow<string>("livekit.host"),
      this.config.getOrThrow<string>("livekit.key"),
      this.config.getOrThrow<string>("livekit.secret"),
    );
    this.recordingLocation = this.config.getOrThrow<string>("appconfig.recording_location");
  }
  async stopEgressOrRetry(data: StopEgressRecordingDto, session: EgressInfo, retries= 0) {
    try {
      const info = await this.egressClient.stopEgress(session.egressId);
      const files = info.fileResults;
      // Ingest only from active sessions, ignore starting sessions
      if (files && data.ingestRecording && session.status == EgressStatus.EGRESS_ACTIVE) {
        // Add each file to opencast queue
        for (const file of files) {
          // if (!existsSync(`${this.recordingLocation}/${file.filename}`)) continue;
          await this.client.emit(ADD_OPENCAST_INGEST_JOB, <IngestJobDto>{
            roomSid: data.roomSid,
            //uri: `${this.recordingLocation}/${file.filename}`,
            uri: './sample-10s.mp4',
            type: OpencastIngestType.ROOM_COMPOSITE,
            part: data.recordingPart
          });
        }
      }
    } catch (e) {
      this.logger.error(`Failed to stop egress ${session.egressId}!`);
      if (retries <= 3) {
        // Await 1 second, maybe we are trying to stop the egress before its been initialized.
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.stopEgressOrRetry(data, session, retries + 1);
      }
    }
  }
  async stopEgressRecording(data: StopEgressRecordingDto) {
    const sessions = await this.egressClient.listEgress(data.roomId);
    const activeSessions = sessions.filter(es =>
      es.status == EgressStatus.EGRESS_ACTIVE ||
      es.status == EgressStatus.EGRESS_STARTING)
    for (const session of activeSessions) {
      await this.stopEgressOrRetry(data, session);
    }
  }
  async startEgressRecording(data: StartEgressRecordingDto): Promise<boolean> {
    const sessions = await this.egressClient.listEgress(data.roomId);

    const activeSessions = sessions.filter(es => es.status == EgressStatus.EGRESS_ACTIVE);
    if (activeSessions.length > 0)
    {
      this.logger.error(`Room ${data.roomId} has ${activeSessions.length} active egress sessions!`);
      return false;
    }
    try {
      const result = await this.egressClient.startRoomCompositeEgress(
        data.roomId,
        {
          fileType: EncodedFileType.MP4,
          filepath: `${this.recordingLocation}/{room_id}_{room_name}-{time}.mp4`,
        },
        {
          encodingOptions: EncodingOptionsPreset.H264_1080P_60,
          layout: 'grid-dark',
        },
      );
      if (result.error) {
        this.logger.error(`Failed to start egress session for room ${data.roomId}!`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.error(`Caught exception while starting ${data.roomId} room egress!\n${e}`);
      return false;
    }
    return false;
  }
}
