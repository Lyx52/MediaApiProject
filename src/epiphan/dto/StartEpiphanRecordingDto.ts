import { IsIn, IsInt, IsString } from "class-validator";

export class StartEpiphanRecordingDto {
  @IsString()
  readonly name: string;
  @IsInt()
  readonly id: number;
  @IsInt()
  readonly channel: number;
}
