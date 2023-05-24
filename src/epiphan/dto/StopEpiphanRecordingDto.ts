import { IsIn, IsInt, IsNotEmpty, IsNumber, IsString } from "class-validator";

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
  @IsNumber()
  @IsNotEmpty()
  readonly recordingPart: number;
}
