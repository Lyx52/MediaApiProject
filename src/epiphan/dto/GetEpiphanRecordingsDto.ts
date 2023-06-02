import { IsInt, IsNotEmpty, IsString } from "class-validator";

export class GetEpiphanRecordingsDto {
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
}
