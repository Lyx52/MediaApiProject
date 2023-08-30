import { IsEnum, IsNotEmpty, IsString } from "class-validator";

export class CreateMediaPackageJobDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}

