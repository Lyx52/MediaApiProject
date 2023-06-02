import { IsIn, IsInt, IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";

export class StartEpiphanRecordingDto {
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
  @IsNotEmpty()
  readonly roomMetadata: ActiveRoomInfo;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}
