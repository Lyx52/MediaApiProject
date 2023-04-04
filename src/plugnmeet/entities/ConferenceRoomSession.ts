import { Column, Entity, JoinColumn, ManyToOne, ObjectID, ObjectIdColumn } from "typeorm";
import { Recorder } from "./Recorder";

@Entity()
export class ConferenceRoomSession {
  @ObjectIdColumn()
  id: ObjectID;
  @Column()
  roomSid: string;
  @Column()
  roomId: string;
  @Column()
  started: number;
  @Column()
  ended: number;
  @Column()
  isActive: boolean;
  @Column()
  isRecording: boolean;
}
