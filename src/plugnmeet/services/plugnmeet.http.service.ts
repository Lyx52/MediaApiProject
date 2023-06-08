import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { catchError, firstValueFrom, map, retry, timer } from "rxjs";

import { createHmac } from "crypto";
import { PlugNMeetToRecorder, RecorderToPlugNMeet, RecordingTasks } from "src/proto/plugnmeet_recorder_pb";
import { ConfigService } from "@nestjs/config";
import { handleAxiosExceptions, retryPolicy } from "../../common/utils/axios.utils";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";

@Injectable()
export class PlugNMeetHttpService {
  private readonly logger = new Logger(PlugNMeetHttpService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    @InjectRedis() private readonly redisClient: Redis,
  ) {
  }
  async sendStartedMessage(payload: PlugNMeetToRecorder, recorderId: string) {
    await this.notifyPlugNMeet(new RecorderToPlugNMeet({
      from: 'recorder',
      status: true,
      task: RecordingTasks.START_RECORDING,
      msg: 'started',
      recordingId: payload.recordingId,
      roomSid: payload.roomSid,
      roomId: payload.roomSid,
      recorderId: recorderId,
      roomTableId: payload.roomTableId
    }));
  }
  async sendErrorMessage(payload: PlugNMeetToRecorder, recorderId?: string) {
    await this.notifyPlugNMeet(new RecorderToPlugNMeet({
      from: 'recorder',
      status: false,
      task: RecordingTasks.END_RECORDING,
      msg: 'had error',
      recordingId: payload.recordingId,
      roomSid: payload.roomSid,
      roomId: payload.roomSid,
      recorderId: recorderId,
      roomTableId: payload.roomTableId
    }));
  }
  async sendEndedMessage(payload: PlugNMeetToRecorder, recorderId: string) {
    await this.notifyPlugNMeet(new RecorderToPlugNMeet({
      from: 'recorder',
      status: true,
      task: RecordingTasks.END_RECORDING,
      msg: 'no error',
      recordingId: payload.recordingId,
      roomSid: payload.roomSid,
      roomId: payload.roomSid,
      recorderId: recorderId,
      roomTableId: payload.roomTableId
    }));
  }
  async sendCompletedMessage(payload: PlugNMeetToRecorder, recorderId: string) {
    await this.notifyPlugNMeet(new RecorderToPlugNMeet({
      from: 'recorder',
      status: true,
      task: RecordingTasks.RECORDING_PROCEEDED,
      msg: 'process completed',
      recordingId: payload.recordingId,
      roomSid: payload.roomSid,
      roomId: payload.roomSid,
      recorderId: recorderId,
      roomTableId: payload.roomTableId,
      filePath: "",
      fileSize: 1,
    }));
  }
  async notifyPlugNMeet(body: RecorderToPlugNMeet): Promise<any> {
    const data = body.toBinary();
    const signature = createHmac(
      'sha256',
      this.config.getOrThrow<string>('plugnmeet.secret'),
    ).update(data).digest('hex');

    const url = `${this.config.getOrThrow<string>(
      'plugnmeet.host',
    )}/auth/recorder/notify`;
    const headers = {
      'API-KEY': this.config.getOrThrow<string>('plugnmeet.key'),
      'HASH-SIGNATURE': signature,
      'Content-Type': 'application/protobuf',
    };
    return firstValueFrom(this.httpService.post(url, data, {
      headers: headers
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  }

}