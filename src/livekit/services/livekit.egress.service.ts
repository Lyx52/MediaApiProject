import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ADD_OPENCAST_INGEST_JOB,
  LIVEKIT_EGRESS_SERVICE, START_INGESTING_VIDEOS,
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
import * as path from "path";
import { sleep } from "../../common/utils/common.utils";
import { PlugNmeet } from "plugnmeet-sdk-js";
import {StartIngestingVideosDto} from "../../opencast/dto/StartIngestingVideosDto";

@Injectable()
export class LivekitEgressService {
  private readonly logger = new Logger(LivekitEgressService.name);
  private readonly egressClient: EgressClient;
  private readonly PNMController: PlugNmeet;
  private readonly recordingLocation: string;
  private readonly mediaApiHost: string;
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
    this.PNMController = new PlugNmeet(
      config.getOrThrow<string>('plugnmeet.host'),
      config.getOrThrow<string>('plugnmeet.key'),
      config.getOrThrow<string>('plugnmeet.secret'),
    );
    this.mediaApiHost = this.config.getOrThrow<string>('appconfig.host')
    this.recordingLocation = this.config.getOrThrow<string>('appconfig.recording_location');
  }

  async ingestEgress(session: EgressInfo, roomSid: string, recorderId: string) {
    const files = session.fileResults;
    const isActive = await this.PNMController.isRoomActive({ room_id: session.roomName });
    // Ingest only from active sessions, ignore starting sessions
    if (files) {
      // We send a message and wait for answer
      if (await firstValueFrom(this.client.send(STOP_OPENCAST_EVENT, <StopOpencastEventDto> {
        roomSid: roomSid,
        recorderId: recorderId,
        type: OpencastIngestType.ROOM_COMPOSITE
      }))) {
        // Add each file to opencast queue
        for (const file of files) {
          // File is less than 5mb or less than 30 seconds long, skip.
          if (file.size < 5_000 || file.duration < 30) continue;
          await this.client.emit(ADD_OPENCAST_INGEST_JOB, <IngestJobDto>{
            recorderId: recorderId,
            roomSid: roomSid,
            uri: path.resolve(file.filename),
            type: OpencastIngestType.ROOM_COMPOSITE,
            ingested: file.endedAt
          });
        }
        if (!isActive.status)
        {
          await this.client.emit(START_INGESTING_VIDEOS, <StartIngestingVideosDto>{
            roomSid: roomSid
          });
        }
      }
    }
  }

  async stopEgressOrRetry(data: StopEgressRecordingDto, session: EgressInfo, retries= 0) {
    try {
      await this.egressClient.stopEgress(session.egressId);
    } catch (e) {
      this.logger.error(`Failed to stop egress ${session.egressId}!`);
      if (retries <= 3) {
        // Await 1 second, maybe we are trying to stop the egress before it's been initialized.
        await sleep(1000);
        return this.stopEgressOrRetry(data, session, retries + 1);
      }
    }
  }
  async stopEgressRecording(data: StopEgressRecordingDto) {
    /**
     *  We only stop first one we find if there are more
     */
    const egressSession = await this.getActiveSession(data.roomMetadata.info.room_id);
    if (!egressSession) {
      this.logger.warn(`Tried to stop non existing or already stopped egress session for room ${data.roomMetadata.info.room_id}!`);
      return;
    }
    await this.stopEgressOrRetry(data, egressSession);
  }
  async getActiveSession(roomId: string): Promise<EgressInfo> {
    const sessions = await this.egressClient.listEgress(roomId);
    return sessions.find(es =>
        es.status == EgressStatus.EGRESS_ACTIVE ||
        es.status == EgressStatus.EGRESS_STARTING);
  }
  async getSessionCounts(roomId: string){
    const sessions = await this.egressClient.listEgress(roomId);
    const sessionCounts = {}
    sessions.forEach(s => {
      sessionCounts[s.status]++;
    })
    return sessionCounts;
  }
  async startEgressRecording(data: StartEgressRecordingDto): Promise<boolean> {
    const sessions = await this.egressClient.listEgress(data.roomMetadata.info.room_id);
    // Check if any are active, starting or ending
    const activeSessions = sessions.filter(es =>
      es.status == EgressStatus.EGRESS_ACTIVE ||
      es.status == EgressStatus.EGRESS_STARTING ||
      es.status == EgressStatus.EGRESS_ENDING);
    if (activeSessions.length > 0)
    {
      this.logger.error(`Room ${data.roomMetadata.info.room_id} has ${activeSessions.length} active egress sessions!`);
      return false;
    }
    try {
      const result = await this.egressClient.startRoomCompositeEgress(
        data.roomMetadata.info.room_id,
        {
          fileType: EncodedFileType.MP4,
          filepath: `${this.recordingLocation}/{room_id}_{room_name}-{time}.mp4`,
        },
        {
          encodingOptions: EncodingOptionsPreset.H264_1080P_60,
          layout: 'grid-dark',
          customBaseUrl: `${this.mediaApiHost}livekit/layout`
        },
      );
      if (result.error || !result.egressId) {
        this.logger.error(`Failed to start egress session for room ${data.roomMetadata.info.room_id}!`);
        return false;
      }
      this.client.emit(START_OPENCAST_EVENT, <StartOpencastEventDto> {
        roomSid: data.roomMetadata.info.sid,
        recorderId: data.recorderId
      });
      return true;
    } catch (e) {
      this.logger.error(`Caught exception while starting ${data.roomMetadata.info.room_id} room egress!\n${e}`);
      return false;
    }
  }
}
