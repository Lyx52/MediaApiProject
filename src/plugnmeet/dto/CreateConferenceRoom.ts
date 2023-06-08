import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { RooMetadata } from "plugnmeet-sdk-js";

export class CreateConferenceRoom {
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
  @IsString()
  @IsNotEmpty()
  readonly title: string;
  @IsString()
  @IsNotEmpty()
  readonly organizer: string;
  @IsString()
  @IsNotEmpty()
  readonly courseName: string;
  @IsString()
  @IsNotEmpty()
  readonly roomId: string;
  @IsNotEmpty()
  readonly metadata: RooMetadata;
}

