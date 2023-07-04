import {IsNotEmpty, IsNumber, IsString} from "class-validator";
import {ActiveRoomInfo} from "plugnmeet-sdk-js";

export class RoomMetadataDto {
    @IsNotEmpty()
    info: ActiveRoomInfo;
    @IsNotEmpty()
    @IsString()
    courseName: string;
    @IsString()
    @IsNotEmpty()
    title: string;
    @IsString()
    @IsNotEmpty()
    organizer: string;
    @IsNumber()
    @IsNotEmpty()
    recordingCount: number;
}

