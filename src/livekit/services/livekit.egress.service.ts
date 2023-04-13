import { Inject, Injectable, Logger } from "@nestjs/common";
import { LIVEKIT_EGRESS_SERVICE, MediaType, OPENCAST_ADD_MEDIA } from "../../app.constants";
import { ClientProxy } from "@nestjs/microservices";
import { EgressClient, EncodedFileType, EncodingOptionsPreset } from "livekit-server-sdk";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { MongoRepository } from "typeorm";
import { EgressSession } from "../entities/EgressSession";
import { StartEgressRecordingDto } from "../dto/StartEgressRecordingDto";
import { EgressStatus } from "livekit-server-sdk/dist/proto/livekit_egress";
import { LivekitTaskService } from "./livekit.task.service";
import { StopEgressRecordingDto } from "../dto/StopEgressRecordingDto";
import { AddMediaDto } from "../../opencast/dto/AddMediaDto";

@Injectable()
export class LivekitEgressService {
  private readonly logger = new Logger(LivekitEgressService.name);
  private readonly egressClient: EgressClient;
  constructor(
    @Inject(LIVEKIT_EGRESS_SERVICE) private readonly client: ClientProxy,
    @InjectRepository(EgressSession) private readonly egressSessionRepository: MongoRepository<EgressSession>,
    private readonly taskService: LivekitTaskService,
    private readonly config: ConfigService,
  ) {
    this.egressClient = new EgressClient(
      this.config.getOrThrow<string>("livekit.host"),
      this.config.getOrThrow<string>("livekit.key"),
      this.config.getOrThrow<string>("livekit.secret"),
    );
  }
  async stopEgressOrRetry(data: StopEgressRecordingDto, session: EgressSession, retries= 0) {
    try {
      const info = await this.egressClient.stopEgress(session.egressId);
      const files = info.fileResults;
      if (files) {
        // Add each file to opencast queue
        for (const file of files) {
          this.client.emit(OPENCAST_ADD_MEDIA, <AddMediaDto>{
            recorderId: data.recorderId,
            roomSid: data.roomSid,
            uri: file.filename,
            type: MediaType.EPIPHAN_MEDIA
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
    const activeSessions = await this.egressSessionRepository.find({
      where: { recorderId: data.recorderId, status: EgressStatus.EGRESS_ACTIVE }
    });
    for (const session of activeSessions) {
      await this.stopEgressOrRetry(data, session);
      // In any case, set egress as complete
      session.status = EgressStatus.EGRESS_COMPLETE;
      await this.egressSessionRepository.save(session);
    }
  }
  async startEgressRecording(data: StartEgressRecordingDto): Promise<boolean> {
    // Recorder has sessions, that are starting, active or ending, abort!
    const activeSessions = await this.egressSessionRepository.find({
      where: { recorderId: data.recorderId, status: { $in: [ EgressStatus.EGRESS_STARTING, EgressStatus.EGRESS_ACTIVE, EgressStatus.EGRESS_ENDING ] } }
    });
    if (activeSessions.length > 0)
    {
      this.logger.error(`Recorder ${data.recorderId} has ${activeSessions.length} active sessions!`);
      return false;
    }
    try {
      const result = await this.egressClient.startRoomCompositeEgress(
        data.roomId,
        {
          fileType: EncodedFileType.MP4,
          filepath: '/app/recording_files/{room_id}_{room_name}-{time}.mp4',
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
      if (result.egressId) {
        const entity = this.egressSessionRepository.create();
        entity.status = EgressStatus.EGRESS_ACTIVE;
        entity.roomId = data.roomId;
        entity.recorderId = data.recorderId;
        entity.egressId = result.egressId;
        entity.filesUploaded = false;
        await this.egressSessionRepository.save(entity);
        return true;
      }
    } catch (e) {
      this.logger.error(`Caught exception while starting ${data.roomId} room egress!\n${e}`);
      return false;
    }
    return false;
  }
}
