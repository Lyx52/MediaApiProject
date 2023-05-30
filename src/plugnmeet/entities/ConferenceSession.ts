import { Column, Entity, JoinColumn, ManyToOne, ObjectID, ObjectIdColumn } from "typeorm";

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
  recordingCount: number;
  @Column()
  started: number;
  @Column()
  ended: number;
}
