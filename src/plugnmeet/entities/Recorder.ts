import { Column, Entity, JoinColumn, ManyToOne, ObjectID, ObjectIdColumn } from "typeorm";

/**
 * Entity that holds one "recorder instance", recorder count is limited
 */
@Entity()
export class Recorder {
  @ObjectIdColumn()
  id: ObjectID;
  @Column()
  recorderId: string;
  @Column()
  isRecording: boolean;
  @Column()
  roomSid: string;
}
