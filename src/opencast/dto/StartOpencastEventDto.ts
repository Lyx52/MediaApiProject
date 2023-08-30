import { IsNotEmpty, IsString } from "class-validator";

export class StartOpencastEventDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}
