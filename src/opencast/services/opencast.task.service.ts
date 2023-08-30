import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PlugNmeet } from "plugnmeet-sdk-js";
import { Cron, CronExpression, SchedulerRegistry } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import * as fs from 'fs'
import * as path from 'path'
import { OpencastService } from "./opencast.service";
import { MP4_EXTENSION } from "../../app.constants";
import { Recording } from "../dto/Recording";
@Injectable()
export class OpencastTaskService implements OnModuleInit {
  private readonly logger = new Logger(OpencastTaskService.name);
  private readonly PNMController: PlugNmeet;
  private readonly recordingLocation: string;
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly config: ConfigService,
    private readonly opencastService: OpencastService,
  ) {
    this.PNMController = new PlugNmeet(
      this.config.getOrThrow<string>('plugnmeet.host'),
      this.config.getOrThrow<string>('plugnmeet.key'),
      this.config.getOrThrow<string>('plugnmeet.secret'),
    );
    this.recordingLocation = path.resolve(this.config.getOrThrow<string>('appconfig.recording_location'));
  }

  async onModuleInit() {
    await this.checkVideoUploads()
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkVideoUploads() {
    /**
        Read directory and list files
     */
    const preparedVideos = {}
    const files = fs.readdirSync(this.recordingLocation);
    for (const filename of files) {
      const file = path.parse(filename);
      if (file.ext !== MP4_EXTENSION) continue;
      const recording = new Recording(file.name);
      preparedVideos[recording.roomSid] = preparedVideos[recording.roomSid] || [];
      preparedVideos[recording.roomSid].push(recording);
    }
    /**
     *  Check if room exists, if it does and it has ended, push to job queue
     */
    for (const roomSid of Object.keys(preparedVideos))
    {
      try {
        const response = await this.PNMController.isRoomActive({room_id: roomSid});
        this.logger.log(response.msg);
      } catch (e) {
        this.logger.error("Caught exception")
      }
    }
  }
}