import { IsEnum, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class DownloadJobDto {
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

