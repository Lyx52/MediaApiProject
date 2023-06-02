import { IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";

export class StartEgressRecordingDto {
  @IsNotEmpty()
  readonly roomMetadata: ActiveRoomInfo;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}
