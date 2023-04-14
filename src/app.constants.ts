export const EPIPHAN_SERVICE = 'EPIPHAN_SERVICE';
export const PLUGNMEET_SERVICE = 'PLUGNMEET_SERVICE';
export const OPENCAST_SERVICE = 'OPENCAST_SERVICE';
export const LIVEKIT_INGRESS_SERVICE = 'LIVEKIT_INGRESS_SERVICE';
export const LIVEKIT_EGRESS_SERVICE = 'LIVEKIT_EGRESS_SERVICE';

// Redis keys
export const PLUGNMEET_RECORDER_INFO_KEY = 'pnm:recorders';

// Microservice command patterns
export const START_LIVEKIT_EGRESS_RECORDING = { cmd: "startLivekitEgressRecording" }
export const START_EPIPHAN_RECORDING = { cmd: "startEpiphanRecording" }
export const STOP_LIVEKIT_EGRESS_RECORDING = { cmd: "stopLivekitEgressRecording" }
export const STOP_EPIPHAN_RECORDING = { cmd: "stopEpiphanRecording" }
export const CREATE_OPENCAST_EVENT = { cmd: "createOpencastEvent" }
export const START_OPENCAST_INGEST = { cmd: "startOpencastIngest" }
export const OPENCAST_ADD_MEDIA = { cmd: "addToOpencastQueue" }

export const YAML_CONFIG_LOCATION = '../../../config.yaml';

export const MAX_INGEST_WAIT_ATTEMPTS = 100;