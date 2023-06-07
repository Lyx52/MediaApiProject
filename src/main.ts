import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { PlugNMeetToRecorderDeserializer } from "./common/deserializers/PlugNMeetToRecorderDeserializer";
import { RedisOptions } from "@nestjs/microservices/interfaces/microservice-configuration.interface";
import { BullModule } from "@nestjs/bull";
import { ConfigModule, ConfigService } from "@nestjs/config";
import config from './common/utils/config.yaml';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { retryAttempts: 3, retryDelay: 1000 },
  });
  const cfg = config();
  if (!cfg.redis || !cfg.redis.host || !cfg.redis.port)
    throw new Error("Invalid redis configuration provided to microservice!");
  app.connectMicroservice<RedisOptions>({
    transport: Transport.REDIS,
    options: {
      ...cfg.redis,
      deserializer: new PlugNMeetToRecorderDeserializer()
    },
  });

  if (!cfg.appconfig || !cfg.appconfig.port)
    throw new Error("Invalid redis configuration provided! No application port specified!");

  await app.startAllMicroservices();
  await app.listen(cfg.appconfig.port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();