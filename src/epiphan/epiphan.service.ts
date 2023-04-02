import { Injectable, Logger, NotFoundException, UseInterceptors } from "@nestjs/common";
import { handleRetry, InjectRepository } from "@nestjs/typeorm";
import { AxiosResponse, AxiosError } from 'axios';
import { MongoRepository } from 'typeorm';
import { Epiphan } from "./epiphan.entity";
import { CreateEpiphanDto } from "./dto/CreateEpiphanDto";
import { HttpService } from "@nestjs/axios";
import { StartEpiphanRecordingDto } from "./dto/StartEpiphanRecordingDto";
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
@Injectable()
export class EpiphanService {
  private readonly logger: Logger = new Logger(EpiphanService.name);
  constructor(
    @InjectRepository(Epiphan)
    private readonly epiphanRepository: MongoRepository<Epiphan>,
    private readonly httpService: HttpService
  ) {}

  private handleBaseResponse(response: AxiosResponse): BaseResponse {
    const validStatus = [200, 201, 204].includes(response.status);
    return {
      success: validStatus,
      data: response.data,
    }
  }

  private makeAuthHeader(config: Epiphan): object {
    return {
      Authorization: `Basic ${Buffer.from(
        `${config.username}:${config.password}`,
      ).toString('base64')}`,
    };
  }
  async findAll(): Promise<Epiphan[]> {
    return this.epiphanRepository.find();
  }
  async findConfig(id: number): Promise<Epiphan> {
    return this.epiphanRepository.findOne({
      where: { id: id }
    })
  }
  private backoffDelay(retryAttempt: number): number {
    return Math.min(10000, Math.pow(2, retryAttempt) * 1000);
  }
  private retryPolicy() {
    return retry({ delay: (error, index) => timer(this.backoffDelay(index)), resetOnSuccess: true, count: 3 });
  }
  private handleExceptions() {
    return catchError((error: AxiosError) => {
      this.logger.error('Caught error in caller service...')
      if (error.response) {
        // Server responded with a non-2xx status code
        const { status, data } = error.response;
        throw `Request failed with status code ${status}: ${data}`;
      } else if (error.request) {
        // No response was received from the server
        throw 'Request failed: no response received from server';
      } else {
        // Request was never sent due to a client-side error
        throw `Request failed: client-side error ${error}`;
      }
      throw error
    });
  }
  async addConfig(entity: CreateEpiphanDto) {
    await this.epiphanRepository.insertOne(entity);
  }

  async startEpiphanRecording(data: StartEpiphanRecordingDto): Promise<any> {
    //const epiphanConfig = await this.findConfig(data.id);
    const epiphanConfig = <Epiphan>{
      host: "test"
    }
    if (!epiphanConfig) {
      this.logger.error(`Epiphan configuration with id ${data.id} not found!`)
      throw new NotFoundException('Epiphan configuration not found!');
    }
    const headers = this.makeAuthHeader(epiphanConfig);
    return firstValueFrom(this.httpService.post(`${epiphanConfig}/api/recorders/${data.channel}/control/start`, {}, {
      headers: headers
    }).pipe(
        map((response) => response.data),
        this.retryPolicy(),
        this.handleExceptions(),
      ));
  }
}
