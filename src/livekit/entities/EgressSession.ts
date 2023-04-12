import { Column, Entity, JoinColumn, ManyToOne, ObjectID, ObjectIdColumn } from "typeorm";
import { EgressStatus } from "livekit-server-sdk/dist/proto/livekit_egress";

/**
 * Entity that is used to store an egress session
 */
@Entity()
export class EgressSession {
  @ObjectIdColumn()
  id: ObjectID;
  @Column()
  recorderId: string;
  @Column()
  roomId: string;
  @Column()
  egressId: string;
  @Column()
  status: EgressStatus;
  @Column()
  filesUploaded: boolean;
}
