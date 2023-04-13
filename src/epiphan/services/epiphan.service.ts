import { Injectable, Logger, NotFoundException, UseInterceptors } from "@nestjs/common";
import { handleRetry, InjectRepository } from "@nestjs/typeorm";
import { AxiosResponse, AxiosError } from 'axios';
import { FindOptionsSelect, MongoRepository } from "typeorm";
import { ObjectID } from "mongodb";
import { Epiphan } from "../epiphan.entity";
import { CreateEpiphanDto } from "../dto/CreateEpiphanDto";
import { HttpService } from "@nestjs/axios";
import { StartEpiphanRecordingDto } from "../dto/StartEpiphanRecordingDto";
import {
  catchError,
  delay,
  delayWhen,
  map,
  Observable,
  throwError,
  timer,
  firstValueFrom,
  retry, filter, of, mergeWith, pipe
} from "rxjs";
import { handleAxiosExceptions, makeBasicAuthHeader, retryPolicy } from "../../common/utils/axios.utils";
import { StopEpiphanRecordingDto } from "../dto/StopEpiphanRecordingDto";

@Injectable()
export class EpiphanService {
  private readonly logger: Logger = new Logger(EpiphanService.name);
  constructor(
    @InjectRepository(Epiphan)
    private readonly epiphanRepository: MongoRepository<Epiphan>,
    private readonly httpService: HttpService
  ) {}

  async findAll(): Promise<Epiphan[]> {
    return this.findAllSelectFields(['id', 'name', 'host']);
  }
  async findAllSelectFields(fields): Promise<Epiphan[]> {
    return this.epiphanRepository.find({select: fields});
  }
  async findConfig(id: string): Promise<Epiphan> {
    return await this.epiphanRepository.findOne({
      where: {
        _id: new ObjectID(id),
      },
      select: ['id', 'name', 'host', 'password', 'username'],
    });
  }
  async addConfig(entity: CreateEpiphanDto): Promise<ObjectID> {
    const result = await this.epiphanRepository.insertOne(entity);
    return result.insertedId;
  }
  async stopEpiphanRecording(data: StopEpiphanRecordingDto): Promise<boolean> {
    const epiphanConfig = await this.findConfig(data.id);

    if (!epiphanConfig) {
      this.logger.error(`Epiphan configuration with id ${data.id} not found!`)
      return false;
    }
    try {
      const headers = makeBasicAuthHeader(epiphanConfig.username, epiphanConfig.password);
      const response: any = await firstValueFrom(this.httpService.post(`${epiphanConfig.host}api/recorders/${data.channel}/control/stop`, {}, {
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
  async startEpiphanRecording(data: StartEpiphanRecordingDto): Promise<boolean> {
    const epiphanConfig = await this.findConfig(data.id);

    if (!epiphanConfig) {
      this.logger.error(`Epiphan configuration with id ${data.id} not found!`)
      return false;
    }
    try {
      const headers = makeBasicAuthHeader(epiphanConfig.username, epiphanConfig.password);
      const response: any = await firstValueFrom(this.httpService.post(`${epiphanConfig.host}api/recorders/${data.channel}/control/start`, {}, {
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
}
