import { IsBoolean, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class EgressSessionInfoDto {
  @IsString()
  @IsNotEmpty()
  readonly egressId: string;
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsNumber()
  @IsNotEmpty()
  readonly recordingPart: number;
  @IsNumber()
  @IsNotEmpty()
  readonly lastUpdated: number;
  @IsBoolean()
  @IsNotEmpty()
  readonly isRecording: boolean;
}
