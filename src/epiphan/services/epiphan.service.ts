import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MongoRepository } from "typeorm";
import { ObjectID } from "mongodb";
import { Epiphan } from "../epiphan.entity";
import { CreateEpiphanDto } from "../dto/CreateEpiphanDto";
import { HttpService } from "@nestjs/axios";
import { StartEpiphanRecordingDto } from "../dto/StartEpiphanRecordingDto";
import { firstValueFrom, map } from "rxjs";
import { handleAxiosExceptions, makeBasicAuthHeader, retryPolicy } from "../../common/utils/axios.utils";
import { StopEpiphanRecordingDto } from "../dto/StopEpiphanRecordingDto";
import { ConfigService } from "@nestjs/config";
import { GetEpiphanRecordingsDto } from "../dto/GetEpiphanRecordingsDto";
import { createWriteStream, existsSync, mkdirSync, renameSync } from 'fs';
import { ADD_OPENCAST_INGEST_JOB, EPIPHAN_SERVICE } from "../../app.constants";
import { ClientProxy } from "@nestjs/microservices";
import { IngestJobDto } from "../../opencast/dto/IngestJobDto";
import * as path from "path";
@Injectable()
export class EpiphanService {
  private readonly logger: Logger = new Logger(EpiphanService.name);
  private readonly recordingLocation: string;
  constructor(
    @InjectRepository(Epiphan)
    private readonly epiphanRepository: MongoRepository<Epiphan>,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    @Inject(EPIPHAN_SERVICE) private readonly client: ClientProxy
  ) {
    this.recordingLocation = this.config.getOrThrow<string>("appconfig.recording_location");
  }

  async findAll(): Promise<Epiphan[]> {
    return this.findAllSelectFields(['id', 'name', 'host']);
  }
  async findAllSelectFields(fields): Promise<Epiphan[]> {
    return this.epiphanRepository.find({select: fields});
  }
  async findConfig(epiphanId: string): Promise<Epiphan> {
    return this.epiphanRepository.findOne({
      where: {
        epiphanId: epiphanId
      },
      select: ['id', 'epiphanId', 'host', 'password', 'username'],
    });
  }
  async addConfig(entity: CreateEpiphanDto): Promise<ObjectID> {
    const result = await this.epiphanRepository.insertOne(entity);
    return result.insertedId;
  }
  async stopEpiphanRecording(data: StopEpiphanRecordingDto): Promise<boolean> {
    const epiphanConfig = await this.findConfig(data.epiphanId);

    if (!epiphanConfig) {
      this.logger.error(`Epiphan configuration with epiphanId ${data.epiphanId} not found!`)
      return false;
    }
    try {
      const headers = makeBasicAuthHeader(epiphanConfig.username, epiphanConfig.password);
      const response: any = await firstValueFrom(this.httpService.post(`${epiphanConfig.host}/api/recorders/${epiphanConfig.defaultChannel || 1}/control/stop`, {}, {
        headers: headers
      }).pipe(
        map((response) => response.data),
        retryPolicy(),
        handleAxiosExceptions(),
      ));
      // TODO: Ingest into opencast...
      return response && response.status == "ok";
    } catch (e) {
      this.logger.error(`Error while starting Epiphan: ${e}`);
      return false;
    }
  }
  async getEpiphanRecordings(data: GetEpiphanRecordingsDto) {
    const epiphanConfig = await this.findConfig(data.epiphanId);

    if (!epiphanConfig) {
      this.logger.error(`Epiphan configuration with epiphanId ${data.epiphanId} not found!`)
      return false;
    }
    try {
      const headers = makeBasicAuthHeader(epiphanConfig.username, epiphanConfig.password);
      return  await firstValueFrom(this.httpService.get(`${epiphanConfig.host}/api/recorders/${epiphanConfig.defaultChannel || 1}/archive/files`, {
        headers: headers
      }).pipe(
        map((response) => response.data),
        retryPolicy(),
        handleAxiosExceptions(),
      ));
    } catch (e) {
      this.logger.error(`Error while getting Epiphan recordings: ${e}`);
      return false;
    }
  };
  async getLastEpiphanRecording(data) {
    const response: any = await this.getEpiphanRecordings(data);
    if (!response) return null;
    const files = response.result;
    return files.reduce((prev, curr) => Date.parse(curr.created) > Date.parse(prev.created) ? curr : prev);
  };
  async downloadLastRecording(data: StopEpiphanRecordingDto) {
    const epiphanConfig = await this.findConfig(data.epiphanId);

    if (!epiphanConfig) {
      this.logger.error(`Epiphan configuration with epiphanId ${data.epiphanId} not found!`)
      return false;
    }
    const recording: any = await this.getLastEpiphanRecording(<GetEpiphanRecordingsDto>data);
    // TODO: Implement download functionality
    if (recording.id) {
      try {
        const headers = makeBasicAuthHeader(epiphanConfig.username, epiphanConfig.password);
        if (!existsSync(this.recordingLocation)){
          mkdirSync(this.recordingLocation);
        }
        const downloadLocation = path.join(this.recordingLocation, recording.id);
        const uploadLocation = path.join(this.recordingLocation, `${recording.name}.mp4`)
        await firstValueFrom(this.httpService.get(`${epiphanConfig.host}/api/recorders/${epiphanConfig.defaultChannel || 1}/archive/files/${recording.id}`, {
          headers: headers,
          responseType: "stream"
        }).pipe(
          map(async(response) => {
            const writer = createWriteStream(downloadLocation);
            await response.data.pipe(writer);
            await writer.on('error', (err) => {
              this.logger.error(`Error while downloading epiphan file: ${err}`);
            });
            await writer.on('finish', async () => {
              renameSync(downloadLocation, uploadLocation);
              this.logger.log(`File downloaded successfully to ${uploadLocation}`);
              await this.client.emit(ADD_OPENCAST_INGEST_JOB, <IngestJobDto>{
                recorderId: data.recorderId,
                roomSid: data.roomSid,
                uri: uploadLocation,
              });
            });
          }),
          retryPolicy(),
          handleAxiosExceptions(),
        ));
      } catch (e) {
        this.logger.error(`Error while downloading epiphan file: ${e}`);
      }
    }
  }
  async startEpiphanRecording(data: StartEpiphanRecordingDto): Promise<boolean> {
    const epiphanConfig = await this.findConfig(data.epiphanId);

    if (!epiphanConfig) {
      this.logger.error(`Epiphan configuration with epiphanId ${data.epiphanId} not found!`)
      return false;
    }
    try {
      const headers = makeBasicAuthHeader(epiphanConfig.username, epiphanConfig.password);
      const response: any = await firstValueFrom(this.httpService.post(`${epiphanConfig.host}/api/recorders/${epiphanConfig.defaultChannel || 1}/control/start`, {}, {
        headers: headers
      }).pipe(
        map((response) => response.data),
        retryPolicy(),
        handleAxiosExceptions(),
      ));
      return response && response.status == "ok";
    } catch (e) {
      this.logger.error(`Error while starting Epiphan: ${e}`);
      return false;
    }
  }
}
