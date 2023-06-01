import { IsEnum, isNotEmpty, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class RecordingDeviceDto {
  @IsString()
  @IsNotEmpty()
  readonly deviceName: string;

  @IsString()
  @IsNotEmpty()
  readonly deviceIdentifier: string;
}

