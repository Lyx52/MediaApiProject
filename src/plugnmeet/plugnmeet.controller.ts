import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Logger,
  Param,
  Post, Query, Render,
  UnauthorizedException
} from "@nestjs/common";
import {
  GET_CONFERENCE_SESSION, GET_PLUGNMEET_ACCESS_TOKEN,
  LIVEKIT_WEBHOOK_EVENT, PING_EPIPHAN_DEVICE,
  PLUGNMEET_SERVICE, VERIFY_LIVEKIT_TOKEN
} from "../app.constants";
import {ClientProxy, Ctx, EventPattern, MessagePattern, Payload} from "@nestjs/microservices";
import { PlugNMeetService } from "./services/plugnmeet.service";
import { PlugNMeetHttpService } from "./services/plugnmeet.http.service";
import { CreateConferenceRoomDto } from "./dto/CreateConferenceRoomDto";
import {CreateRoomResponse, CreateRoomResponseRoomInfo} from "plugnmeet-sdk-js";
import {WebhookEvent} from "livekit-server-sdk/dist/proto/livekit_webhook";
import { PlugNMeetToRecorder, RecordingTasks } from "src/proto/plugnmeet_recorder_pb";
import { PingEpiphanDto } from "../epiphan/dto/PingEpiphanDto";
import { ConferenceSession } from "./entities/ConferenceSession";
import { GetConferenceSessionDto } from "./dto/GetConferenceSessionDto";
import { firstValueFrom } from "rxjs";
import { VerifyLivekitTokenDto } from "./dto/VerifyLivekitTokenDto";
import {GetAccessTokenDto} from "./dto/GetAccessTokenDto";
import {Public} from "../common/utils/decorators/public.decorator";

@Controller('conference')
export class PlugNMeetController {

  private readonly logger: Logger = new Logger(PlugNMeetController.name);
  constructor(
    private readonly pnmService: PlugNMeetService,
    private readonly httpService: PlugNMeetHttpService,
    @Inject(PLUGNMEET_SERVICE) private readonly client: ClientProxy
  ) {}
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'none')
  async createConferenceRoom(@Body() payload: CreateConferenceRoomDto): Promise<CreateRoomResponse> {
    return await this.pnmService.createConferenceRoom(payload);
  }
  @Get('rooms')
  async getActiveConferenceRooms() {
    return await this.pnmService.getActiveConferenceRooms();
  }

  @Get(':roomId')
  async getActiveConferenceRoom(@Param('roomId') id: string) {
    return await this.pnmService.getActiveConferenceRoom(id)
  }

  @Get(':roomId/status')
  async getActiveConferenceRoomStatus(@Param('roomId') id: string) {
    return await this.pnmService.getConferenceRoomStatus(id)
  }

  @Post(':roomId/livestream/:epiphanId/start')
  async startEpiphanLivestream(@Param('roomId') roomId: string, @Param('epiphanId') epiphanId: string) {
    return await this.pnmService.startLivestream(roomId, epiphanId);
  }

  @Post(':roomId/livestream/:epiphanId/stop')
  async stopEpiphanLivestream(@Param('roomId') roomId: string, @Param('epiphanId') epiphanId: string) {
    return await this.pnmService.stopLivestream(roomId, epiphanId);
  }

  @MessagePattern(GET_PLUGNMEET_ACCESS_TOKEN)
  async getAccessToken(@Payload() payload: GetAccessTokenDto) {
    return this.pnmService.generateToken(payload.roomId)
  }
  @MessagePattern(GET_CONFERENCE_SESSION)
  async getConferenceInfo(@Payload() payload: GetConferenceSessionDto): Promise<ConferenceSession> {
    return await this.pnmService.getConferenceSession(payload.roomSid);
  }
  @EventPattern(LIVEKIT_WEBHOOK_EVENT)
  async handleLivekitWebhookEvents(@Body() data: WebhookEvent) {
    try {
      switch(data.event) {
        case "room_finished":
          await this.pnmService.handleRoomEnded(data);
          break;
      }
    } catch (e) {
      this.logger.error(`Caught unhandled exception!\n${e}`);
    }
  }

  @MessagePattern('plug-n-meet-recorder')
  async handlePlugNMeetMessage(@Payload() payload: PlugNMeetToRecorder) {
    if (payload.from !== 'plugnmeet') return;
    try {
      switch (payload.task) {
        case RecordingTasks.START_RECORDING: {
          this.logger.debug(`START_RECORDING for ${payload.roomSid} roomSid!`);
          await this.pnmService.startRecording(payload);
        }
          break;
        case RecordingTasks.STOP_RECORDING:
          this.logger.debug(`${payload.task.toString()} for ${payload.roomSid} roomSid!`);
          await this.pnmService.stopRecording(payload);
          break;
      }
    } catch (e) {
      this.logger.error(`Caught unhandled exception!\n${e}`);
      await this.httpService.sendErrorMessage(payload);
    }
  }
}
