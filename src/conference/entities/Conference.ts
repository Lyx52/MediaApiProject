import { Column, Entity, ObjectID, ObjectIdColumn } from "typeorm";
import {RooMetadata} from "plugnmeet-sdk-js";

@Entity()
export class Conference {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  title: string;

  @Column()
  roomSid: string;

  @Column()
  roomId: string;

  @Column()
  courseName: string;

  @Column()
  location: string;

  @Column()
  metadata: string;
}