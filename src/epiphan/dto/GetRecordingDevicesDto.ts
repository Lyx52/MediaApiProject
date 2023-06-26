import { IsArray, IsEnum, isNotEmpty, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { RecordingDeviceDto } from "./RecordingDeviceDto";

export class GetRecordingDevicesDto {
  @IsArray()
  readonly devices:  RecordingDeviceDto[];
}

