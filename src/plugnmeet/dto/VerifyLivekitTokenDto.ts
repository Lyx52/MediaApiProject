import { IsBoolean, IsNotEmpty, IsString } from "class-validator";
export class VerifyLivekitTokenDto {
  @IsNotEmpty()
  @IsBoolean()
  readonly succcess: boolean;
  @IsString()
  @IsNotEmpty()
  readonly roomId: string;
}
