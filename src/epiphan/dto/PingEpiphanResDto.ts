import { IsBoolean, IsEnum, isNotEmpty, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class PingEpiphanResDto {
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
  @IsBoolean()
  @IsNotEmpty()
  readonly active: boolean;
  @IsNotEmpty()
  @IsNumber()
  readonly lastPinged: number;
}

