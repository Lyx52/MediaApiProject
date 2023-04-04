import { Controller, Inject, Logger } from "@nestjs/common";
import { PLUGNMEET_SERVICE } from "../app.constants";
import { ClientProxy, Ctx, MessagePattern, Payload, RedisContext } from "@nestjs/microservices";
import { PlugNMeetService } from "./services/plugnmeet.service";
import { PlugNMeetToRecorder, RecordingTasks } from "../proto/plugnmeet_recorder_pb";

@Controller('plugnmeet')
export class PlugNMeetController {

  private readonly logger: Logger = new Logger(PlugNMeetService.name);
  constructor(private readonly pnmService: PlugNMeetService, @Inject(PLUGNMEET_SERVICE) private readonly client: ClientProxy) {}
  @MessagePattern('plug-n-meet-recorder')
  async handlePlugNMeetMessage(@Payload() payload: PlugNMeetToRecorder, @Ctx() context: RedisContext) {
    if (payload.from !== 'plugnmeet') return;

    switch (payload.task) {
      case RecordingTasks.START_RECORDING: {
        this.logger.debug(`START_RECORDING for ${payload.roomSid} roomSid!`);
        await this.pnmService.startRecording(payload);
      } break;
      case RecordingTasks.STOP:
      case RecordingTasks.STOP_RECORDING: {
        this.logger.debug(`STOP_RECORDING for ${payload.roomSid} roomSid!`);
      } break;
    }

  }
}
