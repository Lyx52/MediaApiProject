import { IsInt, IsNotEmpty, IsString } from "class-validator";

export class GetEpiphanRecordingsDto {
  @IsInt()
  readonly id: string;
  @IsInt()
  readonly channel: number;

  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
}
