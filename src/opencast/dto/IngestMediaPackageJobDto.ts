import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";
import {RoomMetadataDto} from "../../plugnmeet/dto/RoomMetadataDto";

export class IngestMediaPackageJobDto {
  @IsNotEmpty()
  readonly roomMetadata: RoomMetadataDto;
}

