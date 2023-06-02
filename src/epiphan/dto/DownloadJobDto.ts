import { IsEnum, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";

export class DownloadJobDto {
  @IsNotEmpty()
  readonly roomMetadata: ActiveRoomInfo;
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}

