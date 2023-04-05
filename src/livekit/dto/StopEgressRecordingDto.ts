import { IsNotEmpty, IsString } from "class-validator";

export class StopEgressRecordingDto {
  @IsString()
  @IsNotEmpty()
  readonly name: string;
  @IsString()
  @IsNotEmpty()
  readonly host: string;
  @IsString()
  @IsNotEmpty()
  readonly username: string;
  @IsString()
  @IsNotEmpty()
  readonly password: string;
}
