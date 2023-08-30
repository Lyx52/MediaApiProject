export class Recording {
  roomSid: string;
  started: number;
  fileName: string;
  constructor(filename: string) {
    const parts = filename.split('-');
    this.roomSid = parts[0];
    this.started = parseInt(parts[1], 10);
    this.fileName = filename;
  }
}
