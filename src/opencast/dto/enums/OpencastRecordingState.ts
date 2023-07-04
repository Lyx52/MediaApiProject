export enum OpencastRecordingState {
  UNKNOWN = "unknown",
  CAPTURING = "capturing",
  CAPTURE_FINISHED = "capture_finished",
  CAPTURE_ERROR = "capture_error",
  MANIFEST = "manifest",
  MANIFEST_ERROR = "manifest_error",
  MANIFEST_FINISHED = "manifest_finished",
  COMPRESSING = "compressing",
  COMPRESSING_ERROR = "compressing_error",
  UPLOADING = "uploading",
  UPLOAD_FINISHED = "upload_finished",
  UPLOAD_ERROR = "upload_error"
}