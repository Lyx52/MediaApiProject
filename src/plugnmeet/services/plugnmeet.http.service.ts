import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { catchError, firstValueFrom, map, retry, timer } from "rxjs";
import { AxiosError } from "axios";
import { StartEpiphanRecordingDto } from "../../epiphan/dto/StartEpiphanRecordingDto";
import { Epiphan } from "../../epiphan/epiphan.entity";
import { createHmac } from "crypto";
import { PlugNMeetToRecorder, RecorderToPlugNMeet, RecordingTasks } from "../../proto/plugnmeet_recorder_pb";
import { ConfigService } from "@nestjs/config";
import { handleAxiosExceptions, retryPolicy } from "../../common/utils/axios.utils";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import { PLUGNMEET_RECORDER_INFO_KEY } from "../../app.constants";
import { PlugNMeetRecorderInfo } from "../dto/PlugNMeetRecorderInfo";

@Injectable()
export class PlugNMeetHttpService {
  private readonly logger = new Logger(PlugNMeetHttpService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    @InjectRedis() private readonly redisClient: Redis,
  ) {
  }
  async sendStartedMessage(payload: PlugNMeetToRecorder) {
    const res = await this.notifyPlugNMeet(new RecorderToPlugNMeet({
      from: 'recorder',
      status: true,
      task: RecordingTasks.START_RECORDING,
      msg: 'started',
      recordingId: payload.recordingId,
      roomSid: payload.roomSid,
      roomId: payload.roomId,
      recorderId: payload.recorderId,
    }));
  }
  async sendErrorMessage(payload: PlugNMeetToRecorder, recorderId?: string) {
    const res = await this.notifyPlugNMeet(new RecorderToPlugNMeet({
      from: 'recorder',
      status: false,
      task: RecordingTasks.END_RECORDING,
      msg: 'had error',
      recordingId: payload.recordingId,
      roomSid: payload.roomSid,
      roomId: payload.roomId,
      recorderId: recorderId,
    }));
  }
  async sendEndedMessage(payload: PlugNMeetToRecorder, recorderId: string) {
    const res = await this.notifyPlugNMeet(new RecorderToPlugNMeet({
      from: 'recorder',
      status: true,
      task: RecordingTasks.END_RECORDING,
      msg: 'no error',
      recordingId: payload.recordingId,
      roomSid: payload.roomSid,
      roomId: payload.roomId,
      recorderId: recorderId,
    }));
  }
  async sendCompletedMessage(payload: PlugNMeetToRecorder, recorderId: string) {
    const res = await this.notifyPlugNMeet(new RecorderToPlugNMeet({
      from: 'recorder',
      status: true,
      task: RecordingTasks.RECORDING_PROCEEDED,
      msg: 'process completed',
      recordingId: payload.recordingId,
      roomSid: payload.roomSid,
      roomId: payload.roomId,
      recorderId: recorderId,
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


  public sendMessage = async (
    payload: RecorderToPlugNMeet,
    increment: boolean,
    recorderId?: string,
  ) => {
    this.logger.log(`Sending ${payload.task} with msg ${payload.msg}`);
    await this.notify(payload);
    if (recorderId) {
      await this.updateRecorderProgress(recorderId, increment);
    }
  };
  updateRecorderProgress = async (
    recorder_id: any,
    increment: boolean,
  ) => {
    let watch = '';
    try {
      watch = await this.redisClient.watch(PLUGNMEET_RECORDER_INFO_KEY);
      if (watch !== 'OK') {
        return;
      }
      const info = await this.redisClient.hget(PLUGNMEET_RECORDER_INFO_KEY, recorder_id);
      if (!info) {
        return;
      }

      const currentInfo: PlugNMeetRecorderInfo = JSON.parse(info);
      if (increment) {
        currentInfo.currentProgress += 1;
      } else if (currentInfo.currentProgress > 0) {
        currentInfo.currentProgress -= 1;
      }

      const r = this.redisClient.multi({ pipeline: true });
      const recorderInfo: any = {};
      recorderInfo[recorder_id] = JSON.stringify(currentInfo);
      await r.hset(PLUGNMEET_RECORDER_INFO_KEY, recorderInfo);
      await r.exec();
    } catch (e) {
      this.logger.error(e);
    } finally {
      if (watch === 'OK') {
        await this.redisClient.unwatch();
      }
    }
  };

  async notify (
    body: RecorderToPlugNMeet,
  ) {
    try {
      const b = body.toBinary();
      const signature = createHmac('sha256', this.config.getOrThrow<string>('plugnmeet.secret'))
        .update(b)
        .digest('hex');

      const url = this.config.getOrThrow<string>('plugnmeet.host') + '/auth/recorder/notify';
      const res = await this.httpService.axiosRef.post(url, b, {
        headers: {
          'API-KEY': this.config.getOrThrow<string>('plugnmeet.key'),
          'HASH-SIGNATURE': signature,
          'Content-Type': 'application/protobuf',
        },
      });
      return res.data;
    } catch (e: any) {
      this.logger.error(e);
    }
  };

}