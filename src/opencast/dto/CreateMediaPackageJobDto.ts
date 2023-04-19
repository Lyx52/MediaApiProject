import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { MediaType } from "../../livekit/dto/enums/MediaType";

export class CreateMediaPackageJobDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
}

