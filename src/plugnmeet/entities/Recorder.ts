import { Column, Entity, JoinColumn, ManyToOne, ObjectID, ObjectIdColumn } from "typeorm";
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
