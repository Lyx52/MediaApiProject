import { Column, Entity, JoinColumn, ManyToOne, ObjectID, ObjectIdColumn } from "typeorm";
import { ConferenceRoom } from "./ConferenceRoom";

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

  @ManyToOne(() => ConferenceRoom, (entity: ConferenceRoom) => entity.id)
  @JoinColumn({ name: 'roomId' })
  conferenceRoom: ConferenceRoom;
}
