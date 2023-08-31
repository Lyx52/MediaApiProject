export enum RecorderType {
  PLUGNMEET_RECORDING = "PlugNMeet",
  EPIPHAN_RECORDING = "Epiphan",
}
export function getSeriesName(type: RecorderType)
{
  switch (type) {
    case RecorderType.EPIPHAN_RECORDING: return "Epiphan recordings";
    case RecorderType.PLUGNMEET_RECORDING: return "PlugNMeet recordings";
  }
  throw Error(`Unknown recorder type ${type}`);
}
export function getRecorderId(type: RecorderType)
{
  switch (type) {
    case RecorderType.EPIPHAN_RECORDING: return "EpiphanRecorder";
    case RecorderType.PLUGNMEET_RECORDING: return "PlugNMeetRecorder";
  }
  throw Error(`Unknown recorder type ${type}`);
}
