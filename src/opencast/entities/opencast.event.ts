import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { CaptureAgentState } from "../dto/enums/CaptureAgentState";
import { OpencastRecordingState } from "../dto/enums/OpencastRecordingState";
import { IngestJobDto } from "../dto/IngestJobDto";
import { OpencastIngestType } from "../dto/enums/OpencastIngestType";

@Entity()
export class OpencastEvent {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  title: string;

  @Column()
  subject: string;

  @Column()
  location: string;
  @Column()
  eventId: string;
  @Column()
  seriesId: string;
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
  @Column()
  type: OpencastIngestType;
}
