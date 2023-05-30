import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { DefaultValuePipe } from "@nestjs/common";

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
  @Column({ default: 1 })
  defaultChannel: number;
  @Column({ default: 0 })
  defaultPublisher: number;
  @Column({ default: false })
  isRecording: boolean;
  @Column({ default: false })
  isLivestreaming: boolean;
}
