import { IsNotEmpty, IsString } from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";

export class CreateOrGetIngressStreamKeyDto {
  readonly roomMetadata: ActiveRoomInfo;
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
}
