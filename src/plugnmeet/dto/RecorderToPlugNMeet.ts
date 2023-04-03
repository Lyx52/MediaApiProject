import { IsBoolean, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { RecordingTasks } from "./enums/RecordingTasks";

export class RecorderToPlugNMeet {
  @IsNotEmpty()
  @IsString()
  readonly from: string;
  @IsNotEmpty()
  readonly task: RecordingTasks;
  @IsNotEmpty()
  @IsBoolean()
  readonly status: boolean;
  @IsNotEmpty()
  @IsString()
  readonly msg: string;
  @IsNotEmpty()
  @IsString()
  readonly recordingId: string;
  @IsString()
  readonly roomId: string;
  @IsNotEmpty()
  @IsString()
  readonly roomSid: string;
  @IsNotEmpty()
  @IsString()
  readonly recorderId: string;
  @IsString()
  readonly filePath: string;
  @IsNumber()
  readonly fileSize: number;
}