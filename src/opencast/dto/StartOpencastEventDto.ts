import { IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";
import { OpencastIngestType } from "./enums/OpencastIngestType";
import {RoomMetadataDto} from "../../plugnmeet/dto/RoomMetadataDto";

export class StartOpencastEventDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}
