import { Deserializer, IncomingEvent, IncomingRequest } from "@nestjs/microservices";
import { PlugNMeetToRecorder } from "src/proto/plugnmeet_recorder_pb";
import { IncomingRequestDeserializer } from "@nestjs/microservices/deserializers";
import shared_utils_1, { isUndefined } from "@nestjs/common/utils/shared.utils";
export class PlugNMeetToRecorderDeserializer implements IncomingRequestDeserializer
{

  deserialize(value: any, options?: Record<string, any>): IncomingRequest | IncomingEvent {
    return this.isExternal(value) ? this.mapToSchema(value, options) : value;
  }

  isExternal(value: any): boolean {
    if (!value) {
      return true;
    }
    return !(!isUndefined(value.pattern) || !isUndefined(value.data));
  }

  mapToSchema(value: any, options?: Record<string, any>): IncomingRequest | IncomingEvent {
    if (!options) {
      return {
        pattern: undefined,
        data: undefined,
      };
    }
    return {
      pattern: options.channel,
      data: PlugNMeetToRecorder.fromJson(value),
    };
  }


}