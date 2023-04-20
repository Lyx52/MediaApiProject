import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';

@Entity()
export class Epiphan {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  epiphanId: string;

  @Column()
  host: string;

  @Column()
  username: string;

  @Column()
  password: string;
  @Column()
  defaultChannel: number;
}
