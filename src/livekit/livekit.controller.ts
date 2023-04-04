import { Controller, Inject, Logger } from "@nestjs/common";
import { LIVEKIT_INGRESS_SERVICE, PLUGNMEET_SERVICE } from "../app.constants";
import { ClientProxy, Ctx, MessagePattern, Payload, RedisContext } from "@nestjs/microservices";

@Controller('livekit')
export class LivekitController {
  private readonly logger: Logger = new Logger(LivekitController.name);
  constructor() {}
}
