import {IsEnum, IsNotEmpty, IsNumber, IsString} from "class-validator";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";
import {RoomMetadataDto} from "../../plugnmeet/dto/RoomMetadataDto";

export class StartIngestingVideosDto {
    @IsNotEmpty()
    @IsString()
    readonly roomSid: string;
}

