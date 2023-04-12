import { IsNotEmpty, IsString } from "class-validator";

export class StartEgressRecordingDto {
  @IsString()
  @IsNotEmpty()
  readonly roomId: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}
