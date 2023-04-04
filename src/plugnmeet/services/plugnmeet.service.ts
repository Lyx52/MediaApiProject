import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MongoRepository } from "typeorm";
import { ConferenceRoomSession } from "../entities/ConferenceRoomSession";
import { PlugNmeet } from 'plugnmeet-sdk-js';
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import { PLUGNMEET_RECORDER_INFO_KEY } from "../../app.constants";
import { Recorder } from "../entities/Recorder";
import { v1 as uuid1 } from 'uuid';
import { PlugNMeetTaskService } from "./plugnmeet.task.service";
import { PlugNMeetRecorderInfo } from "../dto/PlugNMeetRecorderInfo";
import { PlugNMeetToRecorder } from "../../proto/plugnmeet_recorder_pb";
@Injectable()
export class PlugNMeetService {
  private readonly logger = new Logger(PlugNMeetService.name);
  private readonly PNMController: PlugNmeet;

  constructor(
    @InjectRepository(ConferenceRoomSession) private readonly roomRepository: MongoRepository<ConferenceRoomSession>,
    @InjectRepository(ConferenceRoomSession) private readonly recorderRepository: MongoRepository<Recorder>,
    @InjectRedis() private readonly redisClient: Redis,
    private readonly taskService: PlugNMeetTaskService
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
    await this.recorderRepository.deleteMany({});
    const recorders = await this.recorderRepository.find();

    for (const recorder of recorders) {
      if (!recorder.isRecording) continue;

      // Recorder is not recording but not added as available
      if (!this.redisClient.hexists(PLUGNMEET_RECORDER_INFO_KEY, recorder.recorderId)) {
        await this.addAvailableRecorder(recorder.recorderId);
      }
    }

    // Add missing recorders if count has increased
    for (let i = 0; i < (recorderCount - recorders.length); i++) {
      const recorder = this.recorderRepository.create();
      recorder.isRecording = false;
      recorder.recorderId = `RECORDER_${uuid1()}`
      await this.addAvailableRecorder(recorder.recorderId);
      await this.recorderRepository.insert(recorder);
    }
    return recorderCount;
  }

  async addAvailableRecorder(recorderId: string) {
    try {
      const now = Math.floor(new Date().getTime() / 1000);
      const recorderInfo: any = {};
      recorderInfo[recorderId] = JSON.stringify(<PlugNMeetRecorderInfo>{
        maxLimit: 1,
        currentProgress: 0,
        lastPing: now,
        created: now,
      });

      await this.redisClient.hset(PLUGNMEET_RECORDER_INFO_KEY, recorderInfo);
      this.logger.debug('Added recorder with id ', recorderId);
    } catch (e) {
      this.logger.error(e);
    }
    // Add recorder pinging cronjob
    this.taskService.addRecorderPing(recorderId);
  }

  async startRecording(payload: PlugNMeetToRecorder) {
    const recorder = await this.recorderRepository.findOne({ where: { isRecording: false } })
    if (recorder) {
      await this.recorderRepository.updateOne({ _id: recorder.id }, {
        $set: { roomId: payload.roomId, isRecording: true }
      })
      // TODO: Send response
      
      this.taskService.deleteRecorderPing(recorder.recorderId);
    }
  }
  async stopRecording(payload: PlugNMeetToRecorder) {
    const recorder = await this.recorderRepository.findOne({ where: { roomId: payload.roomId } })
    if (recorder) {
      await this.recorderRepository.updateOne({ _id: recorder.id }, {
        $set: { isRecording: false }
      })
      // TODO: Send response

      this.taskService.addRecorderPing(recorder.recorderId);
    }
  }
  async addConferenceSession(roomId: string, roomSid: string) {
    const roomEntity = this.roomRepository.create()
    roomEntity.roomSid = roomSid;
    roomEntity.roomId = roomId;
    roomEntity.started = new Date().getTime();
    roomEntity.ended = -1;
    roomEntity.isActive = true;
    roomEntity.isRecording = true;
    await this.roomRepository.insertOne(roomEntity);
  }
}