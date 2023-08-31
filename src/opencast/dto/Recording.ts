import * as path from "path";

export class Recording {
  roomSid: string;
  started: number;
  fileName: string;
  constructor(filename: string) {
    const parts = path.parse(filename).name.split('-');
    this.roomSid = parts[0];
    this.started = parseInt(parts[1], 10);
    this.fileName = filename;
  }
}
