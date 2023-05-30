import { IsNotEmpty, IsString } from "class-validator";

export class CreateOrGetIngressStreamKeyDto {
  @IsString()
  @IsNotEmpty()
  readonly roomId: string;
  @IsString()
  @IsNotEmpty()
  readonly epiphanId: string;
}
