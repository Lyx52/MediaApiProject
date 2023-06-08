import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";
import {RoomMetadataDto} from "./RoomMetadataDto";

export class PlugNMeetRoomEndedDto {
  @IsNotEmpty()
  readonly roomMetadata: RoomMetadataDto;
}

