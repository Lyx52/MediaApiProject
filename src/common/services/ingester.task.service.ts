import {Injectable, Logger, OnModuleInit} from "@nestjs/common";
import {PlugNmeet} from "plugnmeet-sdk-js";
import {Cron, CronExpression, SchedulerRegistry} from "@nestjs/schedule";
import {ConfigService} from "@nestjs/config";
import * as fs from 'fs/promises'
import * as path from 'path'
import {OpencastService} from "../../opencast/services/opencast.service";
import {INGEST_RECORDINGS, MP4_EXTENSION} from "../../app.constants";
import {Recording} from "../../opencast/dto/Recording";
import {InjectRepository} from "@nestjs/typeorm";
import {MongoRepository} from "typeorm";
import {Conference} from "../../conference/entities/Conference";
import {OpencastUploadJobDto} from "../../opencast/dto/OpencastUploadJobDto";
import {InjectQueue} from "@nestjs/bull";
import {Queue} from "bull";
import {RecorderType} from "../../opencast/dto/enums/RecorderType";

@Injectable()
export class IngesterTaskService implements OnModuleInit {
  private readonly logger = new Logger(IngesterTaskService.name);
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
    const rooms: string[] = await fs.readdir(this.pnmRecordingLocation);
    const devices: string[] = await fs.readdir(this.epiphanRecordingLocation);
    for (const roomSid of rooms) {
      if (roomSid.endsWith('_processing')) continue;
      try {
        const response = await this.PNMController.getActiveRoomsInfo();
        if (!response.rooms || response.rooms.some(rm => rm.room_info.is_running && rm.room_info.sid === roomSid)) continue;
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
        this.logger.error("Error while trying to push a new job!\n", e);
      }
    }
    for (const device of devices) {
      const deviceRecordingLocation = path.resolve(this.epiphanRecordingLocation, device)
      const videoFiles = await fs.readdir(deviceRecordingLocation);
      for (const video of videoFiles) {
        const filePath = path.resolve(deviceRecordingLocation, video);
        const fileInfo = await fs.stat(filePath);
        const parts = path.parse(filePath).name.split('_');
        const videoDateStr = `${parts[1]}-${fileInfo.atime.getFullYear()} ${parts[2].replace(/-/g, ":")}`;
        if (isNaN(Date.parse(videoDateStr))) continue;
        const videoDate = new Date(videoDateStr);

        const conference = await this.conferenceRepository.findOne({ where: { location: device, started: { $lt: videoDate }, ended: { $gt: new Date(videoDate.getTime() + 900) } } });
        uploadJobs.push({
          name: INGEST_RECORDINGS,
          data: <OpencastUploadJobDto> {
            recorder: RecorderType.EPIPHAN_RECORDING,
            basePath: deviceRecordingLocation,
            recordings: [ <Recording>{ fileName: video, started: videoDate.getTime() } ],
            conference: conference,
            started: videoDate.getTime(),
            ended: Date.now()
          }
        });
      }
    }
    await this.ingestQueue.addBulk(uploadJobs);
  }
}