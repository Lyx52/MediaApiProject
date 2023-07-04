import { Column, Entity, JoinColumn, ManyToOne, ObjectID, ObjectIdColumn } from "typeorm";
import {RoomMetadataDto} from "../dto/RoomMetadataDto";

/**
 * Entity that holds one conference session
 */
@Entity()
export class ConferenceSession {
  @ObjectIdColumn()
  id: ObjectID;
  @Column()
  roomSid: string;
  @Column()
  roomId: string;
  @Column()
  epiphanId: string;
  @Column()
  recorderId: string;
  @Column()
  metadata: RoomMetadataDto;
  @Column()
  isActive: boolean;
  @Column()
  recordingStarted: number;
  @Column()
  recordingEnded: number;
}
