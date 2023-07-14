import { IsEnum, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { MediaType } from "../../livekit/dto/enums/MediaType";
import { OpencastIngestType } from "./enums/OpencastIngestType";

export class ActiveConferenceSession {
  readonly id: string;
  readonly title: string;
  readonly isActive: boolean;
  readonly livestreams: any[];
}

