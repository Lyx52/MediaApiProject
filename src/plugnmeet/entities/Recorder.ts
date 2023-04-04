import { Column, Entity, JoinColumn, ManyToOne, ObjectID, ObjectIdColumn } from "typeorm";
import { ConferenceRoomSession } from "./ConferenceRoomSession";

@Entity()
export class Recorder {
  @ObjectIdColumn()
  id: ObjectID;
  @Column()
  recorderId: string;
  @Column()
  isRecording: boolean;

  @Column()
  roomId: string;

  @ManyToOne(() => ConferenceRoomSession, (entity: ConferenceRoomSession) => entity.id)
  @JoinColumn({ name: 'roomId' })
  conferenceRoom: ConferenceRoomSession;
}
