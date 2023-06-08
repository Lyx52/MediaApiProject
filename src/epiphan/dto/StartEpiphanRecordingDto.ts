import { IsIn, IsInt, IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";
import {RoomMetadataDto} from "../../plugnmeet/dto/RoomMetadataDto";

export class StartEpiphanRecordingDto {
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
  @IsNotEmpty()
  readonly roomMetadata: RoomMetadataDto;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}
