import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";

export class IngestMediaPackageJobDto {
  @IsNotEmpty()
  readonly roomMetadata: ActiveRoomInfo;
}

