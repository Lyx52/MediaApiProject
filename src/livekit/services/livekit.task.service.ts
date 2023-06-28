import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EgressClient } from "livekit-server-sdk";
import { ConfigService } from "@nestjs/config";
import { Cron, SchedulerRegistry } from "@nestjs/schedule";
import { PlugNmeet } from "plugnmeet-sdk-js";
import { EgressStatus } from "livekit-server-sdk/dist/proto/livekit_egress";

@Injectable()
export class LivekitTaskService implements OnModuleInit{
  private readonly logger = new Logger(LivekitTaskService.name);
  private readonly PNMController: PlugNmeet;
  private readonly egressClient: EgressClient;
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly config: ConfigService
  ) {
    this.PNMController = new PlugNmeet(
      config.getOrThrow<string>('plugnmeet.host'),
      config.getOrThrow<string>('plugnmeet.key'),
      config.getOrThrow<string>('plugnmeet.secret'),
    );
    this.egressClient = new EgressClient(
      this.config.getOrThrow<string>("livekit.host"),
      this.config.getOrThrow<string>("livekit.key"),
      this.config.getOrThrow<string>("livekit.secret"),
    );
  }

  /**
   *  A cron job that every 1.5 minutes checks active/starting egress sessions and
   *  checks if they actually have conference rooms
   */
  @Cron('45 * * * * *')
  async syncEgressSessions()
  {
    try {
      const activeRooms = await this.PNMController.getActiveRoomsInfo();
      const sessions = await this.egressClient.listEgress();
      const activeSessions = sessions.filter((es) =>
        (
          es.status === EgressStatus.EGRESS_ACTIVE ||
          es.status === EgressStatus.EGRESS_STARTING
        ) &&
        (Date.now() - es.startedAt) > 300000 // 5 Minutes
      );
      for (const session of activeSessions) {
        const room = activeRooms.rooms.find(r => r.room_info.sid === session.roomId);
        if (room && room.room_info.is_recording) continue;
        this.logger.warn(`Found active egress session ${session.egressId} without a conference room!`);
        await this.egressClient.stopEgress(session.egressId);
      }
    } catch (e) {
      this.logger.warn(`SyncEgressSessions failed with ${e}`);
    }
  }

  async onModuleInit(){
    await this.syncEgressSessions();
  }
}