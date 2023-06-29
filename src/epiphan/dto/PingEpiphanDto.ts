import { IsEnum, isNotEmpty, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class PingEpiphanDto {
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
}

