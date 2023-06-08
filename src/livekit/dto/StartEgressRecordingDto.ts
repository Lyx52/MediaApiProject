import { IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";
import {RoomMetadataDto} from "../../plugnmeet/dto/RoomMetadataDto";

export class StartEgressRecordingDto {
  @IsNotEmpty()
  readonly roomMetadata: RoomMetadataDto;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}
