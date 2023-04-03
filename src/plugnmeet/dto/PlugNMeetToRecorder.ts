import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { RecordingTasks } from "./enums/RecordingTasks";

export class  PlugNMeetToRecorder {
  @IsString()
  @IsNotEmpty()
  readonly from: string;
  task: RecordingTasks;
  @IsString()
  readonly roomId: string;
  @IsString()
  readonly roomSid: string;
  @IsString()
  readonly recordingId: string;
  @IsString()
  readonly recorderId?: string;
  @IsString()
  readonly accessToken: string;
  @IsString()
  readonly rtmpUrl?: string;
}
