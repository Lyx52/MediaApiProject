import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { PlugNMeetToRecorderDeserializer } from "./common/deserializers/PlugNMeetToRecorderDeserializer";
import { RedisOptions } from "@nestjs/microservices/interfaces/microservice-configuration.interface";
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { retryAttempts: 3, retryDelay: 1000 },
  });

  app.connectMicroservice<RedisOptions>({
    transport: Transport.REDIS,
    options: {
      host: '85.254.205.116',
      port: 6379,
      db: 0,
      deserializer: new PlugNMeetToRecorderDeserializer()
    },
  });
  await app.startAllMicroservices();
  await app.listen(3001);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();