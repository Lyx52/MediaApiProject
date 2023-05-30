// Microservice client names
export const EPIPHAN_SERVICE = 'EPIPHAN_SERVICE';
export const PLUGNMEET_SERVICE = 'PLUGNMEET_SERVICE';
export const OPENCAST_SERVICE = 'OPENCAST_SERVICE';
export const LIVEKIT_INGRESS_SERVICE = 'LIVEKIT_INGRESS_SERVICE';
export const LIVEKIT_EGRESS_SERVICE = 'LIVEKIT_EGRESS_SERVICE';

// Redis keys
export const PLUGNMEET_RECORDER_INFO_KEY = 'pnm:recorders';
export const EVENT_MEDIAPACKAGE_RESOURCE_KEY = "event:mediapackages";

// Microservice command patterns
export const START_LIVEKIT_EGRESS_RECORDING = { cmd: "startLivekitEgressRecording" }
export const START_EPIPHAN_RECORDING = { cmd: "startEpiphanRecording" }
export const STOP_LIVEKIT_EGRESS_RECORDING = { cmd: "stopLivekitEgressRecording" }
export const STOP_EPIPHAN_RECORDING = { cmd: "stopEpiphanRecording" }
export const CREATE_OPENCAST_EVENT = { cmd: "createOpencastEvent" }
export const START_OPENCAST_INGEST = { cmd: "startOpencastIngest" }
export const ADD_OPENCAST_INGEST_JOB = { cmd: "addOpencastIngestJob" }
export const PLUGNMEET_ROOM_ENDED = { cmd: 'pnmRoomEnded' }
export const CREATE_OR_GET_INGRESS_STREAM_KEY = { cmd: 'createOrGetIngressStreamKey' }


// Job patterns
export const INGEST_VIDEO_JOB = 'INGEST_VIDEO_JOB';
export const INGEST_MEDIAPACKAGE_JOB = 'INGEST_MEDIAPACKAGE_JOB';
export const DOWNLOAD_VIDEO_JOB = 'DOWNLOAD_VIDEO_JOB';

// Other constants
export const YAML_CONFIG_LOCATION = '../../../config.yaml';
export const INGEST_JOB_RETRY = 3000;
export const MEDIAPACKAGE_LOCK_TTL = 30_000;