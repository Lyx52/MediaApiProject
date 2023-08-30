import { IsEnum, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class IngestJobDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
  @IsString()
  @IsNotEmpty()
  readonly uri: string;
  @IsNotEmpty()
  readonly ingested: number;
}

