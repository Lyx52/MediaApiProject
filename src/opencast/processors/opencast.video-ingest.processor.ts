import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { Logger } from "@nestjs/common";

@Processor('video')
export class OpencastVideoIngestConsumer {
  private readonly logger: Logger = new Logger(OpencastVideoIngestConsumer.name);
  @Process('ingest')
  async ingest(job: Job) {
    this.logger.debug('Start ingesting...');
    this.logger.debug(job.data);
    this.logger.debug('Video ingest completed');
  }
}