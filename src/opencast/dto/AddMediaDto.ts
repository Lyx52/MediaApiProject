import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { MediaType } from "../../app.constants";

export class AddMediaDto {
  @IsString()
  @IsNotEmpty()
  readonly roomSid: string;
  @IsString()
  @IsNotEmpty()
  readonly recorderId: string;
  @IsString()
  @IsNotEmpty()
  readonly uri: string;
  @IsNotEmpty()
  readonly type: MediaType;
}

