import { Controller, Inject, Logger } from "@nestjs/common";
import { PLUGNMEET_SERVICE } from "../app.constants";
import { ClientProxy, Ctx, MessagePattern, Payload, RedisContext } from "@nestjs/microservices";
import { PlugNMeetService } from "./plugnmeet.service";
import { PlugNMeetToRecorder } from "./dto/PlugNMeetToRecorder";
import { RecordingTasks } from "./dto/enums/RecordingTasks";

@Controller('plugnmeet')
export class PlugNMeetController {

  private readonly logger: Logger = new Logger(PlugNMeetService.name);
  constructor(private readonly pnmService: PlugNMeetService, @Inject(PLUGNMEET_SERVICE) private readonly client: ClientProxy) {}
  @MessagePattern('plug-n-meet-recorder')
  handlePlugNMeetMessage(@Payload() payload: PlugNMeetToRecorder, @Ctx() context: RedisContext) {
    if (payload.from !== 'plugnmeet') return;
    // Default task is start recording, for some reason PNM doesn't set it...

    payload.task = payload.task === undefined ? RecordingTasks.START_RECORDING : <RecordingTasks>payload.task;
    switch (payload.task) {
      case RecordingTasks.START_RECORDING: {
        this.logger.debug(`START_RECORDING for ${payload.roomSid} roomSid!`);
      } break;
      case RecordingTasks.STOP:
      case RecordingTasks.STOP_RECORDING: {
        this.logger.debug(`STOP_RECORDING for ${payload.roomSid} roomSid!`);
      } break;
    }

  }
}
