import { IsNotEmpty, IsString } from "class-validator";

export class StartOpencastIngestDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}
