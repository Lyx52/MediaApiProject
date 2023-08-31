import { Body, Controller, Logger } from "@nestjs/common";
import { OpencastService } from "./services/opencast.service";
import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
@Controller('opencast')
export class OpencastController {
  private readonly logger: Logger = new Logger(OpencastController.name);
  constructor(
    private readonly eventService: OpencastService,
    @InjectQueue('video') private ingestQueue: Queue,
  ) {
  }

}
