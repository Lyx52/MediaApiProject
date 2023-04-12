import { IsNotEmpty, IsString } from "class-validator";

export class StopEgressRecordingDto {
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
}
