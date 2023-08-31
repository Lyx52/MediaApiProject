import {Injectable, Logger, OnModuleInit} from "@nestjs/common";
import {PlugNmeet} from "plugnmeet-sdk-js";
import {Cron, CronExpression, SchedulerRegistry} from "@nestjs/schedule";
import {ConfigService} from "@nestjs/config";
import * as fs from 'fs/promises'
import * as path from 'path'
import {OpencastService} from "./opencast.service";
import {INGEST_RECORDINGS, MP4_EXTENSION} from "../../app.constants";
import {Recording} from "../dto/Recording";
import {InjectRepository} from "@nestjs/typeorm";
import {MongoRepository} from "typeorm";
import {Conference} from "../entities/Conference";
import {OpencastUploadJobDto} from "../dto/OpencastUploadJobDto";
import {InjectQueue} from "@nestjs/bull";
import {Queue} from "bull";
import {RecorderType} from "../dto/enums/RecorderType";
import * as util from "util";
import {FsUtils} from "../../common/utils/fs.utils";

@Injectable()
export class OpencastTaskService implements OnModuleInit {
  private readonly logger = new Logger(OpencastTaskService.name);
  private readonly PNMController: PlugNmeet;
  private readonly pnmRecordingLocation: string;
  private readonly epiphanRecordingLocation: string;
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly config: ConfigService,
    private readonly opencastService: OpencastService,
    @InjectQueue('video') private ingestQueue: Queue,
    @InjectRepository(Conference) private readonly conferenceRepository: MongoRepository<Conference>,
  ) {
    this.PNMController = new PlugNmeet(
      this.config.getOrThrow<string>('plugnmeet.host'),
      this.config.getOrThrow<string>('plugnmeet.key'),
      this.config.getOrThrow<string>('plugnmeet.secret'),
    );
    this.pnmRecordingLocation = path.resolve(this.config.getOrThrow<string>('appconfig.pnm_recording_location'));
    this.epiphanRecordingLocation = path.resolve(this.config.getOrThrow<string>('appconfig.epiphan_recording_location'));
  }

  async onModuleInit() {
    await this.uploadPlugNMeetRecordings()
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async uploadPlugNMeetRecordings() {
    const uploadJobs = []
    const rooms = await fs.readdir(this.pnmRecordingLocation);
    for (const roomSid of rooms) {
      if (roomSid.endsWith('_processing')) continue;
      try {
        const response = await this.PNMController.isRoomActive({room_id: roomSid});
        if (response.msg !== 'room is not active') continue;
        const videoFiles = await fs.readdir(path.resolve(this.pnmRecordingLocation, roomSid));
        const videos = videoFiles
            .filter(vf => vf.endsWith(MP4_EXTENSION))
            .map(vf => new Recording(vf))
            .sort((a, b) => a.started - b.started);
        if (videos.length <= 0) continue;

        const conference = await this.conferenceRepository.findOne({ where: { roomSid: roomSid } });
        uploadJobs.push({
          name: INGEST_RECORDINGS,
          data: <OpencastUploadJobDto>{
            recordings: videos,
            conference: conference,
            recorder: RecorderType.PLUGNMEET_RECORDING,
            started: videos[0].started,
            ended: Date.now(),
            basePath: path.resolve(this.pnmRecordingLocation, roomSid)
          }
        });
      } catch (e) {
        this.logger.error("Could not check if room is active!", e);
      }
    }

    /**
     *  TODO: Implement epiphan upload jobs
     */
    await this.ingestQueue.addBulk(uploadJobs);
  }
}