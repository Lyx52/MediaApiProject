// Microservice client names
export const EPIPHAN_SERVICE = 'EPIPHAN_SERVICE';
export const PLUGNMEET_SERVICE = 'PLUGNMEET_SERVICE';
export const OPENCAST_SERVICE = 'OPENCAST_SERVICE';
export const LIVEKIT_INGRESS_SERVICE = 'LIVEKIT_INGRESS_SERVICE';
export const LIVEKIT_EGRESS_SERVICE = 'LIVEKIT_EGRESS_SERVICE';
export const LIVEKIT_SERVICE = 'LIVEKIT_SERVICE';

// Redis keys
export const PLUGNMEET_RECORDER_INFO_KEY = 'pnm:recorders';

// Microservice command patterns
export const START_LIVEKIT_EGRESS_RECORDING = { cmd: "startLivekitEgressRecording" }
export const START_EPIPHAN_RECORDING = { cmd: "startEpiphanRecording" }
export const START_EPIPHAN_LIVESTREAM = { cmd: "startEpiphanLivestream" }
export const STOP_EPIPHAN_LIVESTREAM = { cmd: "stopEpiphanLivestream" }
export const PING_EPIPHAN_DEVICE = { cmd: "pingEpiphan" }
export const STOP_LIVEKIT_EGRESS_RECORDING = { cmd: "stopLivekitEgressRecording" }
export const STOP_EPIPHAN_RECORDING = { cmd: "stopEpiphanRecording" }
export const START_OPENCAST_EVENT = { cmd: "createOpencastEvent" }
export const STOP_OPENCAST_EVENT = { cmd: "startOpencastIngest" }
export const ADD_OPENCAST_INGEST_JOB = { cmd: "addOpencastIngestJob" }
export const PLUGNMEET_ROOM_ENDED = { cmd: 'pnmRoomEnded' }
export const CREATE_OR_GET_INGRESS_STREAM_KEY = { cmd: 'createOrGetIngressStreamKey' }
export const GET_CONFERENCE_SESSION = { cmd: 'getConferenceSession' }
export const LIVEKIT_WEBHOOK_EVENT = { cmd: 'livekitWebhookEvent' }
export const START_INGESTING_VIDEOS = { cmd: 'startIngestingVideos' }
export const GET_EVENT_STATUS = { cmd: 'getEventStatus' }

// Job patterns
export const INGEST_VIDEO_JOB = 'INGEST_VIDEO_JOB';
export const INGEST_MEDIAPACKAGE_JOB = 'INGEST_MEDIAPACKAGE_JOB';
export const DOWNLOAD_VIDEO_JOB = 'DOWNLOAD_VIDEO_JOB';

// Other constants
export const YAML_CONFIG_LOCATION = '../../../config.yaml';
export const CONFERENCE_MIN_AWAIT = 15_000; // 15 Sec wait for everything to properly shutdown before able to start again.
export const MAX_INGEST_RETRY_COUNT = 50;