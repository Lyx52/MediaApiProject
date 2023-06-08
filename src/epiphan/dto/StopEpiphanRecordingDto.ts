import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";
import {RoomMetadataDto} from "../../plugnmeet/dto/RoomMetadataDto";

export class StopEpiphanRecordingDto {
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
  @IsNotEmpty()
  readonly roomMetadata: RoomMetadataDto;
  @IsBoolean()
  readonly ingestRecording: boolean;
}
