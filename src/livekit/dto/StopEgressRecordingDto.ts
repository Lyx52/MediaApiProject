import { IsBoolean, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";

export class StopEgressRecordingDto {
  @IsNotEmpty()
  readonly roomMetadata: ActiveRoomInfo;
  @IsBoolean()
  readonly ingestRecording: boolean;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}
