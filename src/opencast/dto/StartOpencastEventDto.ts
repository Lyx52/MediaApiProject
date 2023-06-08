import { IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";
import { OpencastIngestType } from "./enums/OpencastIngestType";
import {RoomMetadataDto} from "../../plugnmeet/dto/RoomMetadataDto";

export class StartOpencastEventDto {
  @IsNotEmpty()
  readonly roomMetadata: RoomMetadataDto;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string; // EpiphanId or EgressId
  readonly type: OpencastIngestType;
}
