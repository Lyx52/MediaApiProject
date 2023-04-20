import { IsIn, IsInt, IsNotEmpty, IsString } from "class-validator";

export class StopEpiphanRecordingDto {
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
}
