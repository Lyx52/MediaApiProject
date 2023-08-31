import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { CaptureAgentState } from "../dto/enums/CaptureAgentState";
import { OpencastRecordingState } from "../dto/enums/OpencastRecordingState";
import {RecorderType} from "../dto/enums/RecorderType";

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
  start: Date;
  @Column()
  end: Date;
  @Column()
  recordingState: OpencastRecordingState;
  @Column()
  recorder: RecorderType;
  @Column()
  agentState: CaptureAgentState;
}
