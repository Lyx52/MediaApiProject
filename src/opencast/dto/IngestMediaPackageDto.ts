import { IsEnum, IsNotEmpty, IsString } from "class-validator";

export class IngestMediaPackageDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}

