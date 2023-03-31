import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from '@nestjs/typeorm';
import { AxiosResponse, AxiosError } from 'axios';
import { MongoRepository } from 'typeorm';
import { Epiphan } from "./epiphan.entity";
import { CreateEpiphanDto } from "./dto/CreateEpiphanDto";
import { HttpService } from "@nestjs/axios";
import { StartEpiphanRecordingDto } from "./dto/StartEpiphanRecordingDto";
import { catchError, delay, delayWhen, map, Observable, retryWhen, throwError, timer } from "rxjs";

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

  private handleError(error: AxiosError): Observable<never> {
    this.logger.error(error);
    return throwError(() => new Error('Epiphan request failed!'));
  }

  private backoffDelay(retryAttempt: number, maxRetryDelay: number): number {
    const BACKOFF_MAX_DELAY = maxRetryDelay || 10000;
    this.logger.warn('Epiphan request failed! Backing off...');
    return Math.min(BACKOFF_MAX_DELAY, Math.pow(2, retryAttempt) * 1000);
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
  async addConfig(entity: CreateEpiphanDto) {
    await this.epiphanRepository.insertOne(entity);
  }
  async startEpiphanRecording(data: StartEpiphanRecordingDto, maxRetries=3): Promise<Observable<BaseResponse>> {
    const epiphanConfig = await this.findConfig(data.id);
    if (!epiphanConfig)
      throw new NotFoundException('Epiphan configuration not found!');
    const headers = this.makeAuthHeader(epiphanConfig);
    return this.httpService.post(`${epiphanConfig}/api/recorders/${data.channel}/control/start`, {}, {
      headers: headers
    }).pipe(
        map((response) => this.handleBaseResponse(response)),
        catchError((error: AxiosError) => this.handleError(error)),
        retryWhen((errors) =>
          errors.pipe(
            delayWhen((_, index) => timer(this.backoffDelay(index, maxRetries))),
          ),
        ),
      );
  }
}
