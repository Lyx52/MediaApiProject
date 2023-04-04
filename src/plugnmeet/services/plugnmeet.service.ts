import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MongoRepository } from "typeorm";
import { ConferenceRoom } from "../entities/ConferenceRoom";
import { PlugNmeet } from 'plugnmeet-sdk-js';
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import { PLUGNMEET_RECORDER_INFO_KEY } from "../../app.constants";
import { Recorder } from "../entities/Recorder";
import { v1 as uuid1, stringify } from 'uuid';
@Injectable()
export class PlugNMeetService {
  private readonly logger = new Logger(PlugNMeetService.name);
  private readonly PNMController: PlugNmeet;
  constructor(
    @InjectRepository(ConferenceRoom) private readonly roomRepository: MongoRepository<ConferenceRoom>,
    @InjectRepository(ConferenceRoom) private readonly recorderRepository: MongoRepository<Recorder>,
    @InjectRedis() private readonly redisClient: Redis,
  ) {
    //TODO: Get from config...
    this.PNMController = new PlugNmeet(
      'https://test-ikars.lbtu.lv/',
      'plugnmeet',
      'kcHLrxlOmZit8wJBKoRpokehH4V1FoBXEi7F',
    );
    this.addRecorders(2)
      .then(r => this.logger.debug(`Added ${r} recorders...`));
  }

  async addRecorders(recorderCount: number) {
    const recorders = await this.recorderRepository.find();

    // Add missing recorders if count has increased
    for (let i = 0; i < (recorderCount - recorders.length); i++) {
      const recorder = this.recorderRepository.create();
      recorder.isRecording = false;
      recorder.recorderId = `RECORDER_${uuid1()}`
      await this.addAvailableRecorder(recorder.recorderId);
      await this.recorderRepository.insert(recorder);
    }
    // for (const recorder of recorders) {
    //   // If recorder is not recording add it to available recorders
    //   if (!recorder.isRecording) {
    //
    //   }
    // }
    const recorderss = await this.redisClient.hgetall(PLUGNMEET_RECORDER_INFO_KEY);
    for (const key in recorderss) {
      await this.redisClient.hdel(PLUGNMEET_RECORDER_INFO_KEY, key);
    }
    //
    // try {
    //   const now = Math.floor(new Date().getTime() / 1000);
    //   const recorderInfo: any = {};
    //   recorderInfo[recorder_id] = JSON.stringify({
    //     maxLimit: 1,
    //     currentProgress: 0,
    //     lastPing: now,
    //     created: now,
    //   });
    //
    //   await this.redisClient.hset(this.recorderKey, recorderInfo);
    //   await this.startRecorderPing(recorder_id);
    //   this.logger.debug('Added recorder with id ', recorder_id);
    // } catch (e) {
    //   this.logger.error(e);
    // }
    return recorderCount;
  }
  async addAvailableRecorder(recorderId: string) {

  }
  async addConferenceRoom(roomId: string, roomSid: string) {
    const roomInfo = await this.PNMController.getActiveRoomInfo({ room_id: roomId })
    if (roomInfo.status) {

    }
  }
}
