import { Column, Entity, ObjectID, ObjectIdColumn } from "typeorm";

@Entity()
export class Conference {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  title: string;

  @Column()
  roomSid: string;

  @Column()
  courseName: string;

  @Column()
  location: string;
}