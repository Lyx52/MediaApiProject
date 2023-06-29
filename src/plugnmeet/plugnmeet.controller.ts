import {Body, Controller, Header, HttpCode, Inject, Logger, Post} from "@nestjs/common";
import {
  LIVEKIT_WEBHOOK_EVENT, PING_EPIPHAN_DEVICE,
  PLUGNMEET_SERVICE
} from "../app.constants";
import {ClientProxy, Ctx, EventPattern, MessagePattern, Payload} from "@nestjs/microservices";
import { PlugNMeetService } from "./services/plugnmeet.service";
import { PlugNMeetHttpService } from "./services/plugnmeet.http.service";
import { CreateConferenceRoom } from "./dto/CreateConferenceRoom";
import {CreateRoomResponse, CreateRoomResponseRoomInfo} from "plugnmeet-sdk-js";
import {WebhookEvent} from "livekit-server-sdk/dist/proto/livekit_webhook";
import { PlugNMeetToRecorder, RecordingTasks } from "src/proto/plugnmeet_recorder_pb";
import { PingEpiphanDto } from "../epiphan/dto/PingEpiphanDto";

@Controller('plugnmeet')
export class PlugNMeetController {

  private readonly logger: Logger = new Logger(PlugNMeetController.name);
  constructor(
    private readonly pnmService: PlugNMeetService,
    private readonly httpService: PlugNMeetHttpService,
    @Inject(PLUGNMEET_SERVICE) private readonly client: ClientProxy
  ) {}
  private PingEpiphanDevice = (epiphanId: string) =>
    this.client.send<boolean, PingEpiphanDto>(PING_EPIPHAN_DEVICE, <PingEpiphanDto>{
      epiphanId: epiphanId
    });
  private PingAllEpiphanDevices(epiphanIds: string[]) {
    const epiphanDevicePings = epiphanIds.map(epiphanId => this.PingEpiphanDevice(epiphanId));
    return Promise.all(epiphanDevicePings)
      .then(results => {
        return epiphanIds.map((device, index) => ({
          device,
          active: results[index]
        }));
      });
  }
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'none')
  async createConferenceRoom(@Body() payload: CreateConferenceRoom): Promise<CreateRoomResponse> {
    // Promise await all then check if all result in success
    const pingResults = await this.PingAllEpiphanDevices(payload.epiphanDevices);
    const inactiveDevices = pingResults.filter(d => !d.active);
    if (inactiveDevices.length > 0) {
      return <CreateRoomResponse>{
        status: false,
        msg: "Some epiphan devices are not reachable!",
        devices: inactiveDevices.map(d => d.device)
      };
    }

    return await this.pnmService.createConferenceRoom(payload);
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
