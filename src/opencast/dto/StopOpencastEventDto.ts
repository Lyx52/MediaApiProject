import { IsNotEmpty, IsString } from "class-validator";
import { OpencastIngestType } from "./enums/OpencastIngestType";

export class StopOpencastEventDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
  readonly type: OpencastIngestType;
}
