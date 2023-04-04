import { Column, Entity, JoinColumn, ManyToOne, ObjectID, ObjectIdColumn } from "typeorm";
import { Recorder } from "./Recorder";

@Entity()
export class ConferenceRoom {
  @ObjectIdColumn()
  id: ObjectID;
  @Column()
  sid: string;
  @Column()
  started: bigint;
  @Column()
  ended: bigint;
}
