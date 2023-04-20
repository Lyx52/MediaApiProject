import { IsInt, IsNotEmpty, IsString } from "class-validator";

export class GetEpiphanRecordingsDto {
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
}
