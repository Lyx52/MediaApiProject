import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { CaptureAgentState } from "../dto/enums/CaptureAgentState";
import { OpencastRecordingState } from "../dto/enums/OpencastRecordingState";
import { IngestJobDto } from "../dto/IngestJobDto";

@Entity()
export class OpencastEvent {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  name: string;

  @Column()
  eventId: string;

  @Column()
  roomSid: string;
  @Column()
  recorderId: string;
  @Column()
  start: Date;
  @Column()
  end: Date;
  @Column()
  agentState: CaptureAgentState;
  @Column()
  recordingState: OpencastRecordingState;
}
