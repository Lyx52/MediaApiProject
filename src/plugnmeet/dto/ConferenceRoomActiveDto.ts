import { ConferenceRoomLivestreamDto } from "./ConferenceRoomLivestreamDto";

export class ConferenceRoomActiveDto {
  readonly id: string;
  readonly isActive: boolean;
  readonly livestreams: ConferenceRoomLivestreamDto[];
}
