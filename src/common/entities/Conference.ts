import { Column, Entity, ObjectID, ObjectIdColumn } from "typeorm";

@Entity()
export class OpencastEvent {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  title: string;

  @Column()
  roomId: string;

  @Column()
  courseName: string;

  @Column()
  location: string;
}