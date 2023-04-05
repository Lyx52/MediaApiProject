import { IsIn, IsInt, IsNotEmpty, IsString } from "class-validator";

export class StopEpiphanRecordingDto {
  @IsInt()
  readonly id: string;
  @IsInt()
  readonly channel: number;

  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
}
