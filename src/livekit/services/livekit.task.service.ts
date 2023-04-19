import { Injectable, Logger } from "@nestjs/common";
import { Cron, SchedulerRegistry } from "@nestjs/schedule";
import Redis from "ioredis";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import { EgressClient } from "livekit-server-sdk";
import { ConfigService } from "@nestjs/config";
import { EgressStatus } from "livekit-server-sdk/dist/proto/livekit_egress";
import { InjectRepository } from "@nestjs/typeorm";
import { EgressSession } from "../entities/EgressSession";
import { MongoRepository } from "typeorm";

@Injectable()
export class LivekitTaskService {
  private readonly logger = new Logger(LivekitTaskService.name);
  private readonly egressClient: EgressClient;
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    @InjectRedis() private readonly redisClient: Redis,
    @InjectRepository(EgressSession) private readonly egressSessionRepository: MongoRepository<EgressSession>,
    private readonly config: ConfigService,
  ) {
    this.egressClient = new EgressClient(
      this.config.getOrThrow<string>("livekit.host"),
      this.config.getOrThrow<string>("livekit.key"),
      this.config.getOrThrow<string>("livekit.secret"),
    );
    // TODO: This Sync task should run at startup...
  }
  @Cron('30 * * * * *')
  async syncEgressSessions() {
    const livekitSessions = await this.egressClient.listEgress();
    const sessions = await this.egressSessionRepository.find({ where: { filesUploaded: false }});
    for (const session of sessions) {
      const livekitSession = livekitSessions.find((el) => el.egressId == session.egressId);
      // Synchronize egress status
      session.status = livekitSession?.status || EgressStatus.EGRESS_COMPLETE;

      await this.egressSessionRepository.save(session);
    }
    // TODO: Implement a way to delete entries out of redis egress:room:room* -> egressId
  }
}