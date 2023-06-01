import { Body, Controller, Inject, Logger, Post } from "@nestjs/common";
import { PLUGNMEET_ROOM_ENDED, PLUGNMEET_SERVICE } from "../app.constants";
import { ClientProxy, Ctx, MessagePattern, Payload } from "@nestjs/microservices";
import { PlugNMeetService } from "./services/plugnmeet.service";
import { PlugNMeetToRecorder, RecordingTasks } from "../proto/plugnmeet_recorder_pb";
import { PlugNMeetHttpService } from "./services/plugnmeet.http.service";
import { PlugNMeetRoomEndedDto } from "./dto/PlugNMeetRoomEndedDto";
import { CreateConferenceRoom } from "./dto/CreateConferenceRoom";
import { CreateRoomResponse } from "plugnmeet-sdk-js";

@Controller('plugnmeet')
export class PlugNMeetController {

  private readonly logger: Logger = new Logger(PlugNMeetController.name);
  constructor(
    private readonly pnmService: PlugNMeetService,
    private readonly httpService: PlugNMeetHttpService,
    @Inject(PLUGNMEET_SERVICE) private readonly client: ClientProxy
  ) {}

  @Post()
  async createConferenceRoom(@Body() payload: CreateConferenceRoom): Promise<CreateRoomResponse> {
    return await this.pnmService.createConferenceRoom(payload);
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
        case RecordingTasks.STOP:
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
