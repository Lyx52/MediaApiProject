import {IsNotEmpty, IsString} from "class-validator";
import {ActiveRoomInfo} from "plugnmeet-sdk-js";

export class RoomMetadataDto {
    @IsNotEmpty()
    info: ActiveRoomInfo;
    @IsNotEmpty()
    @IsString()
    courseName: string;
    @IsString()
    @IsNotEmpty()
    readonly title: string;
    @IsString()
    @IsNotEmpty()
    readonly organizer: string;
}

