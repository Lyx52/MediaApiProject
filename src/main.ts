import {NestFactory, Reflector} from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { PlugNMeetToRecorderDeserializer } from "./common/deserializers/PlugNMeetToRecorderDeserializer";
import { RedisOptions } from "@nestjs/microservices/interfaces/microservice-configuration.interface";
import config from './common/utils/config.yaml';
import {HmacAuthGuard} from "./common/middleware/hmac.authguard";
import {NestExpressApplication} from "@nestjs/platform-express";
import { join } from 'path';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'client'));
  app.setViewEngine('hbs');

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
  if (!cfg.appconfig || !cfg.appconfig.secret || !cfg.appconfig.key)
    throw new Error("Invalid or no api key and secret provided!");
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new HmacAuthGuard(cfg.appconfig.secret, cfg.appconfig.key, reflector));

  await app.startAllMicroservices();
  await app.listen(cfg.appconfig.port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();