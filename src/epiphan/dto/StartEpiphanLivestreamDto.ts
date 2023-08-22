import { IsIn, IsInt, IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";
import {RoomMetadataDto} from "../../plugnmeet/dto/RoomMetadataDto";

export class StartEpiphanLivestreamDto {
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
  @IsNotEmpty()
  readonly roomMetadata: RoomMetadataDto;
}
