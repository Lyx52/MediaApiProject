import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";

export class PlugNMeetRoomEndedDto {
  @IsNotEmpty()
  readonly roomMetadata: ActiveRoomInfo;
}

