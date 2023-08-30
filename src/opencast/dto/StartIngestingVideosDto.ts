import {IsEnum, IsNotEmpty, IsNumber, IsString} from "class-validator";
export class StartIngestingVideosDto {
    @IsNotEmpty()
    @IsString()
    readonly roomSid: string;
}

