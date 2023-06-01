import { IsEnum, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { MediaType } from "../../livekit/dto/enums/MediaType";
import { OpencastIngestType } from "./enums/OpencastIngestType";

export class IngestJobDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly uri: string;
  @IsNotEmpty()
  readonly type: OpencastIngestType;
  @IsNotEmpty()
  @IsNumber()
  readonly part: number;
}

