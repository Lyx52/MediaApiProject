// Microservice client names
export const OPENCAST_SERVICE = 'OPENCAST_SERVICE';

// Microservice command patterns
export const START_OPENCAST_EVENT = { cmd: "createOpencastEvent" }
export const STOP_OPENCAST_EVENT = { cmd: "startOpencastIngest" }
export const ADD_OPENCAST_INGEST_JOB = { cmd: "addOpencastIngestJob" }
export const PLUGNMEET_ROOM_ENDED = { cmd: 'pnmRoomEnded' }
export const GET_CONFERENCE_SESSION = { cmd: 'getConferenceSession' }
export const START_INGESTING_VIDEOS = { cmd: 'startIngestingVideos' }

// Job patterns
export const INGEST_MEDIAPACKAGE_JOB = 'INGEST_MEDIAPACKAGE_JOB';

// Other constants
export const YAML_CONFIG_LOCATION = '../../../config.yaml';
export const MP4_EXTENSION = '.mp4'