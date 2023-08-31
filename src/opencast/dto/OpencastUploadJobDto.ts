import {IsNotEmpty, IsString} from "class-validator";
import {Conference} from "../entities/Conference";
import {Recording} from "./Recording";
import {RecorderType} from "./enums/RecorderType";

export class OpencastUploadJobDto {
    readonly conference: Conference;
    @IsNotEmpty()
    readonly recordings: Recording[];
    @IsNotEmpty()
    readonly started: number;
    @IsNotEmpty()
    readonly ended: number;
    @IsNotEmpty()
    @IsString()
    readonly recorder: RecorderType;
    @IsNotEmpty()
    @IsString()
    readonly basePath: string;
}
