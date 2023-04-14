import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { CreateOpencastEventDto } from "../dto/CreateOpencastEventDto";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom, map } from "rxjs";
import { handleAxiosExceptions, retryPolicy } from "../../common/utils/axios.utils";
import { CaptureAgentState } from "../dto/enums/CaptureAgentState";
import { OpencastRecordingState } from "../dto/enums/OpencastRecordingState";
import { InjectRepository } from "@nestjs/typeorm";
import { MongoRepository } from "typeorm";
import { ObjectID } from "mongodb";
import { OpencastEvent } from "../entities/opencast.event";
import { StartOpencastIngestDto } from "../dto/StartOpencastIngestDto";
@Injectable()
export class OpencastEventService {
  private readonly logger: Logger = new Logger(OpencastEventService.name);
  private readonly host: string;
  private readonly password: string;
  private readonly username: string;
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    @InjectRepository(OpencastEvent) private readonly eventRepository: MongoRepository<OpencastEvent>,
  ) {
    this.host = this.config.getOrThrow<string>("opencast.host");
    this.password = this.config.getOrThrow<string>("opencast.password");
    this.username = this.config.getOrThrow<string>("opencast.username");
  }
  async findEvent(id: string): Promise<OpencastEvent> {
    return this.eventRepository.findOne({
      where: {
        _id: new ObjectID(id),
      },
      select: ['id', 'name', "agentState", "recorderId", "recordingState", "agentState", "roomSid"],
    });
  }
  async createMediaPackage() {
    const headers = this.makeAuthHeader();
    return firstValueFrom(this.httpService.get(`${this.host}/ingest/createMediaPackage`, {
      headers: headers
    }).pipe(
      map((response) => response.data.toString()),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  }
  async addDublinCore(event: OpencastEvent, mediaPackage: string) {
    const params = new URLSearchParams();
    params.set('mediaPackage', mediaPackage);
    const dublinCore =
      '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
      '<dublincore xmlns="http://www.opencastproject.org/xsd/1.0/dublincore/"\n' +
      '    xmlns:dcterms="http://purl.org/dc/terms/"\n' +
      '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n' +
      '  <dcterms:creator>{CHANGE_THIS}</dcterms:creator>\n' +
      `  <dcterms:created xsi:type="dcterms:W3CDTF">${event.start.toISOString()}</dcterms:created>\n` +
      `  <dcterms:temporal xsi:type="dcterms:Period">start=${event.start.toISOString()}; end=${event.end.toISOString()}; scheme=W3C-DTF;</dcterms:temporal>\n` +
      `  <dcterms:language>Latvian</dcterms:language>\n` +
      `  <dcterms:spatial>${event.recorderId}</dcterms:spatial>\n` +
      `  <dcterms:title>${event.start.toLocaleDateString(
        'lv-LV',
      )} ${event.name} recording</dcterms:title>\n` +
      '</dublincore>';
    params.set('dublinCore', dublinCore);
    params.set('flavor', 'dublincore/episode');

    const headers = this.makeAuthHeader(
      'application/x-www-form-urlencoded; charset=utf-8',
    );
    return firstValueFrom(this.httpService.post(`${this.host}/ingest/addDCCatalog`, {}, {
      headers: headers,
      params: params
    }).pipe(
      map((response) => response.data.toString()),
      retryPolicy(),
      handleAxiosExceptions(),
    ));

  }
  async setCaptureAgentState(
    event: OpencastEvent,
    state = CaptureAgentState.IDLE,
  ) {
    const params = new URLSearchParams();
    params.set('state', CaptureAgentState[state].toString().toLowerCase());
    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    await firstValueFrom(this.httpService.post(`${this.host}/capture-admin/agents/${event.recorderId}`, {},{
      headers: headers,
      params: params
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
    event.agentState = state;
    return event;
  };
  async setRecordingEventState(event: OpencastEvent, state: OpencastRecordingState) {
    const params = new URLSearchParams();
    params.set('state', OpencastRecordingState[state].toString().toLowerCase());
    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    await firstValueFrom(this.httpService.put(`${this.host}/recordings/${event.eventId}/recordingStatus`, {},{
      headers: headers,
      params: params
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
    event.recordingState = state;
    return event;
  };
  async createRecordingEvent(event: OpencastEvent, mediaPackage: string) {
    const params = new URLSearchParams();
    params.set('start', event.start.getTime().toString());
    params.set('end', event.end.getTime().toString());
    params.set('agent', event.recorderId);
    params.set('mediaPackage', mediaPackage);
    params.set('users', 'admin');
    params.set('source', event.name);
    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    await firstValueFrom(this.httpService.post(`${this.host}/recordings/`, {},{
      headers: headers,
      params: params
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
    const createdEvent: any = await this.getLastRecording(event.recorderId);
    event.eventId = createdEvent.id;
    return event;
  }
  async getMediaPackage(recordingId: string) {
    const headers = this.makeAuthHeader();
    return firstValueFrom(this.httpService.get(`${this.host}/recordings/${recordingId}/mediapackage.xml`,{
      headers: headers,
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  };
  async removeOldScheduledRecordings(buffer = 60) {
    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    const params = new URLSearchParams();
    params.set('buffer', buffer.toString());
    await firstValueFrom(this.httpService.post( `${this.host}/recordings/removeOldScheduledRecordings`,{}, {
      headers: headers,
      params: params
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  };
  async getLastRecording(recorderId: string) {
    const params = new URLSearchParams();
    params.set('agent', recorderId);
    const headers = this.makeAuthHeader('application/json');
    return firstValueFrom(this.httpService.get(`${this.host}/recordings/recordings.json`,{
      headers: headers,
      params: params
    }).pipe(
      map((response) => {
        const events: Array<any> = response.data['events'];
        const lastEventStart = Math.max(
          ...events.map((el) => Date.parse(el.start)),
        );
        return events.filter((el) => Date.parse(el.start) == lastEventStart)[0];
      }),
      retryPolicy(),
      handleAxiosExceptions(),
    ));

  };
  async getAccessListTemplate(aclName: string): Promise<any> {
    const headers = this.makeAuthHeader();
    return firstValueFrom(this.httpService.get( `${this.host}/acl-manager/acl/acls.json`, {
      headers: headers
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  }
  async setAccessListTemplate(event: OpencastEvent, aclName: string) {
    const acls = await this.getAccessListTemplate(aclName);
    const acl = acls.filter((e: any) => e.name === aclName)[0];
    if (!acl)
      throw `Cannot find access list template ${aclName}!`;
    const params = new URLSearchParams();
    params.set('acl', JSON.stringify(acl));
    params.set('override', 'true');
    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    return firstValueFrom(this.httpService.post( `${this.host}/admin-ng/event/${event.eventId}/access`, {}, {
      headers: headers,
      params: params,
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  };
  public setWorkflow = async (event: OpencastEvent, workflowId: string) => {
    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    const params = new URLSearchParams();
    params.set(
      'configuration',
      `{
        "id": "${workflowId}",
        "configuration": {
          "straightToPublishing": "true",
        },
      }`,
    );
    return firstValueFrom(this.httpService.put( `${this.host}/admin-ng/event/${event.eventId}/workflows`, {}, {
      headers: headers,
      params: params,
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  };
  async createAndStartRecordingEvent(data: CreateOpencastEventDto) {
    try {
      // Remove old stopped recordings
      await this.removeOldScheduledRecordings();
      let event = await this.createEvent(data);
      event = await this.setCaptureAgentState(event, CaptureAgentState.CAPTURING);
      event = await this.setRecordingEventState(event, OpencastRecordingState.CAPTURING);
      await this.eventRepository.save(event);
    } catch (e) {
      this.logger.error(`Caught exception while creating event: ${e}!`);
    }
    // TODO: Maybe add some retry policy?
  };
  async stopEventAndStartIngesting(data: StartOpencastIngestDto) {
    let event = await this.eventRepository.findOne({
      where: { roomSid: data.roomSid, recorderId: data.recorderId },
      order: { start: 'DESC' }
    })
    if (!event)
    {
      this.logger.error(`Event with recorder ${data.recorderId} dosn't exist!`);
      return;
    }
    try {
      // Set event state, indicating that ingesting queue can start ingesting videos.
      event = await this.setRecordingEventState(event, OpencastRecordingState.CAPTURE_FINISHED);
      event = await this.setCaptureAgentState(event, CaptureAgentState.IDLE);
      event = await this.setRecordingEventState(event, OpencastRecordingState.UPLOAD_FINISHED);
      // TODO: Update end time in opencast event aswell, thisway we can try to avoid scheduling conflicts
      // Set end time as now
      event.end = new Date();
      await this.eventRepository.save(event);
    } catch (e) {
      this.logger.error(`Caught exception while stopping event: ${e}!`);
    }
  }
  async createEvent(data: CreateOpencastEventDto): Promise<OpencastEvent> {
    /**
     * Create event entity
     */
    let event = this.eventRepository.create();
    event.recorderId = data.recorderId;
    event.name = data.name;
    event.roomSid = data.roomSid;
    event.start = new Date();
    event.end = new Date();

    // End of recording is in one hour
    // TODO: Change this to one hour currently 60 sec
    event.end.setTime(event.start.getTime() + 60000);
    /**
     * Add capture agent if dosnt exist, set it to idle for now
     */
    event = await this.setCaptureAgentState(event, CaptureAgentState.IDLE);

    /**
     *  Create MediaPackage and add DublinCore metadata to MediaPackage
     */
    let mediaPackage = await this.createMediaPackage();
    mediaPackage = await this.addDublinCore(event, <string>mediaPackage);
    /**
     * Create recording
     */
    event = await this.createRecordingEvent(event, <string>mediaPackage);

    /**
     *  Configure event
     */
    await this.setAccessListTemplate(event, 'public');
    await this.setWorkflow(event, 'schedule-and-upload');
    return await this.eventRepository.save(event);
  };
  private makeAuthHeader(contentType = 'application/json') {
    return {
      Authorization: `Basic ${Buffer.from(
        `${this.username}:${this.password}`,
      ).toString('base64')}`,
      'X-API-AS-USER': this.username,
      'Content-Type': contentType,
    };
  };
}
