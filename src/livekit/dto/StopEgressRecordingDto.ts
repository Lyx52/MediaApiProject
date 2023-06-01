import { IsBoolean, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class StopEgressRecordingDto {
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
  @IsString()
  @IsNotEmpty()
  readonly roomId: string;
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsNumber()
  @IsNotEmpty()
  readonly recordingPart: number;
  @IsBoolean()
  readonly ingestRecording: boolean;
}
