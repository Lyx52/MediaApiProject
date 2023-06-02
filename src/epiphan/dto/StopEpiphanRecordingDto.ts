import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";

export class StopEpiphanRecordingDto {
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
  @IsNotEmpty()
  readonly roomMetadata: ActiveRoomInfo;
  @IsBoolean()
  readonly ingestRecording: boolean;
}
