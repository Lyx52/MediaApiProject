import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";

export class IngestMediaPackageJobDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsNotEmpty()
  readonly roomMetadata: ActiveRoomInfo;
}

