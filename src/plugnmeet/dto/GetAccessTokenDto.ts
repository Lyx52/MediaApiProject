import { IsNotEmpty, IsString } from "class-validator";
export class GetAccessTokenDto {
    @IsString()
    @IsNotEmpty()
    readonly roomId: string;
}

