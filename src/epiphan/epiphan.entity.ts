import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';

@Entity()
export class Epiphan {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  name: string;

  @Column()
  host: string;

  @Column()
  username: string;

  @Column()
  password: string;
}
