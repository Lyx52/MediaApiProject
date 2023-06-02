import { IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";
import { OpencastIngestType } from "./enums/OpencastIngestType";

export class StartOpencastEventDto {
  @IsNotEmpty()
  readonly roomMetadata: ActiveRoomInfo;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string; // EpiphanId or EgressId

  readonly type: OpencastIngestType;
}
