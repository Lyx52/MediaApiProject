import { IsIn, IsInt, IsNotEmpty, IsString } from "class-validator";

export class StartEpiphanRecordingDto {
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
  @IsString()
  readonly roomId: string;
  @IsString()
  readonly roomTitle: string;
}
