import { IsNotEmpty, IsString } from "class-validator";
export class GetConferenceSessionDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
}

