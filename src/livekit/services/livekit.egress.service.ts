import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ADD_OPENCAST_INGEST_JOB,
  LIVEKIT_EGRESS_SERVICE,
  START_OPENCAST_EVENT,
  STOP_OPENCAST_EVENT
} from "../../app.constants";
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
import { StartOpencastEventDto } from "../../opencast/dto/StartOpencastEventDto";
import { StopOpencastEventDto } from "../../opencast/dto/StopOpencastEventDto";
import { firstValueFrom } from "rxjs";

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
      // TODO: REMOVE THIS
      session.status = EgressStatus.EGRESS_ACTIVE;
      if (files && data.ingestRecording && session.status == EgressStatus.EGRESS_ACTIVE) {

        // We send a message and wait for answer
        if (await firstValueFrom(this.client.send(STOP_OPENCAST_EVENT, <StopOpencastEventDto> {
          roomSid: data.roomMetadata.sid,
          recorderId: data.recorderId,
        }))) {
          // Add each file to opencast queue
          for (const file of files) {
            await this.client.emit(ADD_OPENCAST_INGEST_JOB, <IngestJobDto>{
              recorderId: data.recorderId,
              roomSid: data.roomMetadata.sid,
              //uri: `${this.recordingLocation}/${file.filename}`,
              uri: './sample-10s.mp4',
              type: OpencastIngestType.ROOM_COMPOSITE
            });
          }
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
    const sessions = await this.egressClient.listEgress(data.roomMetadata.room_id);
    /**
     *  We only stop first one we find if there are more
     */
    const egressSession = sessions.find(es =>
      es.status == EgressStatus.EGRESS_ACTIVE ||
      es.status == EgressStatus.EGRESS_STARTING)
    if (!egressSession) {
      this.logger.warn(`Tried to stop non existing or already stopped egress session for room ${data.roomMetadata.room_id}!`);
      return;
    }
    await this.stopEgressOrRetry(data, egressSession);
  }
  async startEgressRecording(data: StartEgressRecordingDto): Promise<boolean> {
    const sessions = await this.egressClient.listEgress(data.roomMetadata.room_id);
    // Check if any are active, starting or ending
    const activeSessions = sessions.filter(es =>
      es.status == EgressStatus.EGRESS_ACTIVE ||
      es.status == EgressStatus.EGRESS_STARTING ||
      es.status == EgressStatus.EGRESS_ENDING);
    if (activeSessions.length > 0)
    {
      this.logger.error(`Room ${data.roomMetadata.room_id} has ${activeSessions.length} active egress sessions!`);
      return false;
    }
    try {
      const result = await this.egressClient.startRoomCompositeEgress(
        data.roomMetadata.room_id,
        {
          fileType: EncodedFileType.MP4,
          filepath: `${this.recordingLocation}/{room_id}_{room_name}-{time}.mp4`,
        },
        {
          encodingOptions: EncodingOptionsPreset.H264_1080P_60,
          layout: 'grid-dark',
        },
      );
      if (result.error || !result.egressId) {
        this.logger.error(`Failed to start egress session for room ${data.roomMetadata.room_id}!`);
        return false;
      }
      this.client.emit(START_OPENCAST_EVENT, <StartOpencastEventDto> {
        roomMetadata: data.roomMetadata,
        recorderId: data.recorderId,
        type: OpencastIngestType.ROOM_COMPOSITE
      });
      return true;
    } catch (e) {
      this.logger.error(`Caught exception while starting ${data.roomMetadata.room_id} room egress!\n${e}`);
      return false;
    }
  }
}
