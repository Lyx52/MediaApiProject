import { IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";
import {RoomMetadataDto} from "../../plugnmeet/dto/RoomMetadataDto";

export class CreateOrGetIngressStreamKeyDto {
  readonly roomMetadata: RoomMetadataDto;
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
}
