import { IsNotEmpty, IsString } from "class-validator";

export class StopOpencastEventDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}
