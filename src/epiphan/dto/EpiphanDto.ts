import { IsEnum, isNotEmpty, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class EpiphanDto {
  @IsString()
  @IsNotEmpty()
  readonly name: string;
  @IsString()
  @IsNotEmpty()
  readonly identifier: string;
  @IsString()
  @IsNotEmpty()
  readonly host: string;
  @IsString()
  @IsNotEmpty()
  readonly username: string;
  @IsString()
  @IsNotEmpty()
  readonly password: string;
  @IsNumber()
  readonly default_channel: number;
  @IsNumber()
  readonly default_publisher: number;
}

