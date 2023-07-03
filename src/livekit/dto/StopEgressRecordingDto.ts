import { IsBoolean, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";
import {RoomMetadataDto} from "../../plugnmeet/dto/RoomMetadataDto";

export class StopEgressRecordingDto {
  @IsNotEmpty()
  readonly roomMetadata: RoomMetadataDto;
  @IsBoolean()
  readonly ingestRecording: boolean;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
  @IsNumber()
  @IsNotEmpty()
  readonly firstRecordingStarted: number;
  @IsNumber()
  @IsNotEmpty()
  readonly recordingStarted: number;
  @IsNumber()
  @IsNotEmpty()
  readonly recordingEnded: number;
}
