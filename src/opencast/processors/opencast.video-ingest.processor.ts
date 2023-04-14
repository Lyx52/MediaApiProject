import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { Logger } from "@nestjs/common";
import { MAX_INGEST_WAIT_ATTEMPTS } from "../../app.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { OpencastEvent } from "../entities/opencast.event";
import { MongoRepository } from "typeorm";
import { AddMediaDto } from "../dto/AddMediaDto";
import { OpencastRecordingState } from "../dto/enums/OpencastRecordingState";

@Processor('video')
export class OpencastVideoIngestConsumer {
  private readonly logger: Logger = new Logger(OpencastVideoIngestConsumer.name);
  constructor(@InjectRepository(OpencastEvent) private readonly eventRepository: MongoRepository<OpencastEvent>) {
  }
  @Process('ingest')
  async ingestVideo(job: Job<AddMediaDto>) {
    await this.waitUntilEventIsIngesting(job);
    this.logger.debug('Start ingesting...');
    this.logger.debug(job.data);
    this.logger.debug('Video ingest completed');
  }
  async waitUntilEventIsIngesting(job: Job<AddMediaDto>, retries=0) {
    return new Promise<boolean>(async (resolve) => {
      // Check the condition periodically
      const intervalId = setInterval(async () => {
        // Ran out of attempts, assume event never finished...
        if (retries >= MAX_INGEST_WAIT_ATTEMPTS) {
          this.logger.error(`Video ingest job failed, recorderId: ${job.data.recorderId}!`);
          clearInterval(intervalId);
          resolve(false);
        }
        const event = await this.eventRepository.findOne({
          where: { roomSid: job.data.roomSid, recorderId: job.data.recorderId },
          order: { start: 'DESC' }
        })
        if (!event) {
          this.logger.warn(`Tried to ingest video on non existing event, job recorderId: ${job.data.recorderId}!`);
          clearInterval(intervalId);
          resolve(false);
        }
        // Check if event has started ingesting
        if (event.recordingState == OpencastRecordingState.UPLOADING) {
          clearInterval(intervalId);
          resolve(true);
        }
        retries++;
      }, 2500); // Check every 2.5 seconds
    });
  };
}