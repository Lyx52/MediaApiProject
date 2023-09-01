import {IsNotEmpty, IsNumber, IsString} from "class-validator";
import {RooMetadata} from "plugnmeet-sdk-js";

export class CreateConferenceDto {
    @IsString()
    @IsNotEmpty()
    readonly location: string;
    @IsString()
    @IsNotEmpty()
    readonly organizer: string;
    @IsString()
    @IsNotEmpty()
    readonly opencastSeriesId: string;
    @IsString()
    @IsNotEmpty()
    readonly roomId: string;
    @IsNumber()
    @IsNotEmpty()
    readonly maxParticipants: number;
    @IsNumber()
    @IsNotEmpty()
    readonly emptyTimeout: number;
    @IsNotEmpty()
    readonly metadata: RooMetadata;
}

