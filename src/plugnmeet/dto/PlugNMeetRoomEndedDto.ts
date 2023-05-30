import { IsEnum, IsNotEmpty, IsString } from "class-validator";

export class PlugNMeetRoomEndedDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
  @IsString()
  @IsNotEmpty()
  readonly roomId: string;
}

