export enum OpencastRecordingState {
  UNKNOWN,
  CAPTURING,
  CAPTURE_FINISHED,
  CAPTURE_ERROR,
  MANIFEST,
  MANIFEST_ERROR,
  MANIFEST_FINISHED,
  COMPRESSING,
  COMPRESSING_ERROR,
  UPLOADING,
  UPLOAD_FINISHED,
  UPLOAD_ERROR,
}