import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateEpiphanDto {
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
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
  @IsNotEmpty()
  readonly defaultChannel: number;
  @IsNumber()
  @IsNotEmpty()
  readonly defaultPublisher: number;
}
