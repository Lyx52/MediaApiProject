export enum OpencastIngestType {
  PRESENTER = "presenter",
  ROOM_COMPOSITE = "room-composite"
}
export function toTitle(type: OpencastIngestType) {
  switch (type)
  {
    case OpencastIngestType.PRESENTER: return "Presenter view";
    case OpencastIngestType.ROOM_COMPOSITE: return "Conference room view"
    default: return ""
  }
}