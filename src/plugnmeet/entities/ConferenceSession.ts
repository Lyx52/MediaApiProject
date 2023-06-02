import { Column, Entity, JoinColumn, ManyToOne, ObjectID, ObjectIdColumn } from "typeorm";
import { ActiveRoomInfo } from "plugnmeet-sdk-js";

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
  metadata: ActiveRoomInfo;
  @Column()
  isActive: boolean;
}
