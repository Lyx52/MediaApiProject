import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { StartOpencastEventDto } from "../dto/StartOpencastEventDto";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom, map } from "rxjs";
import { handleAxiosExceptions, retryPolicy } from "../../common/utils/axios.utils";
import { CaptureAgentState } from "../dto/enums/CaptureAgentState";
import { OpencastRecordingState } from "../dto/enums/OpencastRecordingState";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOneAndReplaceOption, MongoRepository } from "typeorm";
import { ObjectID } from "mongodb";
import { OpencastEvent } from "../entities/opencast.event";
import { StopOpencastEventDto } from "../dto/StopOpencastEventDto";
import { IngestJobDto } from "../dto/IngestJobDto";
import * as fs from 'fs/promises';
import { basename } from "path";
import { toTitle } from "../dto/enums/OpencastIngestType";
import { PlugNMeetRoomEndedDto } from "../../plugnmeet/dto/PlugNMeetRoomEndedDto";
@Injectable()
export class OpencastService implements OnModuleInit {
  private readonly logger: Logger = new Logger(OpencastService.name);
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

  async onModuleInit() {
    try {
      const acl = await this.getAccessListTemplate("public");
      if (!acl)
      {
        // Create public ACL
        await this.generateAccessListTemplate([
          {
            "allow": true,
            "role": "ROLE_ADMIN",
            "action": "read"
          },
          {
            "allow": true,
            "role": "ROLE_ANONYMOUS",
            "action": "read"
          },
          {
            "allow": true,
            "role": "ROLE_ADMIN",
            "action": "write"
          }
        ], "public");
      }
    } catch (e) {
      this.logger.error(`Error while initializing opencast service module \n  ${e}`);
    }
  }

  async findEventById(id: string) {
    return this.findEvent({ id: ObjectID(id) });
  }
  async findEvent(whereStr: object): Promise<OpencastEvent> {
    return this.eventRepository.findOne({
      where: whereStr,
      select: ['id', 'title', "agentState", "recorderId", "recordingState", "agentState", "roomSid", "eventId"],
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
  async getMediaPackageByEventId(eventId: string) {
    const headers = this.makeAuthHeader();
    return firstValueFrom(this.httpService.get(`${this.host}/recordings/${eventId}/mediapackage.xml`, {
      headers: headers
    }).pipe(
      map((response) => response.data.toString()),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  }
  async createMediaPackageWithId(mediaPackageId: string) {
    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    return firstValueFrom(this.httpService.put(`${this.host}/ingest/createMediaPackageWithID/${mediaPackageId}`, {}, {
      headers: headers
    }).pipe(
      map((response) => response.data.toString()),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  }
  async setEventSeries(eventId: string, seriesId: string) {
    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    const params = new URLSearchParams();
    params.set('eventId', eventId);
    params.set('type', 'lbtu-wf-upload');
    params.set('metadata', eventId);
    return firstValueFrom(this.httpService.post(`${this.host}/api/events/${eventId}/metadata`, {}, {
      headers: headers,
      params: params
    }).pipe(
      map((response) => response.data.toString()),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  }
  async ingestRecordings(mediaPackage: string, eventId: string) {
    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    const params = new URLSearchParams();
    params.set('mediaPackage', mediaPackage);
    params.set('workflowDefinitionId', 'lbtu-wf-upload');
    params.set('workflowInstanceId', eventId);
    return firstValueFrom(this.httpService.post(`${this.host}/ingest/ingest`, {}, {
      headers: headers,
      params: params
    }).pipe(
      map((response) => response.data.toString()),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  }
  async addTrackFileFromFs(mediaPackage: string, uri: string, sourceType: string) {
    const videoFile = await fs.readFile(uri);
    const data = new FormData();
    data.append('mediaPackage', mediaPackage);
    data.append('flavor', `${sourceType}/source`);
    data.append('BODY1', new Blob([videoFile]), basename(uri));
    const headers = this.makeAuthHeader('multipart/form-data');
    return firstValueFrom(this.httpService.post(`${this.host}/ingest/addTrack`, data, {
      headers: headers,
      maxContentLength: videoFile.length * 2,
      maxBodyLength: videoFile.length * 2
    }).pipe(
      map((response) => response.data.toString()),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  }
  async getUserData() {
    const headers = this.makeAuthHeader();
    return firstValueFrom(this.httpService.get(`${this.host}/api/info/me`, {
      headers: headers
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  }
  async createSeries(seriesName, roomName, lang = "lv", aclName = "public", seriesContributor = "PlugNMeet", seriesCreator = "LBTUMediaAPI")
  {
    const metadata = [
      {
        'flavor': 'dublincore/series',
        'title': 'Opencast Series DublinCore',
        'fields': [
          {
            'readOnly': false,
            'id': 'title',
            'label': 'EVENTS.SERIES.DETAILS.METADATA.TITLE',
            'type': 'text',
            'value': seriesName,
            'required': true
          },
          {
            'readOnly': false,
            'id': 'subjects',
            'label': 'EVENTS.SERIES.DETAILS.METADATA.SUBJECT',
            'type': 'text',
            'value': [
              `PlugNMeet-${seriesName}`
            ],
            'required': false
          },
          {
            'readOnly': false,
            'id': 'description',
            'label': 'EVENTS.SERIES.DETAILS.METADATA.DESCRIPTION',
            'type': 'text',
            'value': `PlugNMeet conference for ${roomName}`,
            'required': false
          },
          {
            'translatable': true,
            'readOnly': false,
            'id': 'language',
            'label': 'EVENTS.SERIES.DETAILS.METADATA.LANGUAGE',
            'type': 'text',
            'value': lang,
            'required': false
          },
          {
            'readOnly': false,
            'id': 'rightsHolder',
            'label': 'EVENTS.SERIES.DETAILS.METADATA.RIGHTS',
            'type': 'text',
            'value': "",
            'required': false
          },
          {
            'translatable': true,
            'readOnly': false,
            'id': 'license',
            'label': 'EVENTS.SERIES.DETAILS.METADATA.LICENSE',
            'type': 'text',
            'value': "",
            'required': false
          },
          {
            'translatable': false,
            'readOnly': false,
            'id': 'creator',
            'label': 'EVENTS.SERIES.DETAILS.METADATA.CREATED_BY',
            'type': 'mixed_text',
            'value': [
              seriesCreator, seriesContributor
            ],
            'required': false
          },
          {
            'translatable': false,
            'readOnly': false,
            'id': 'contributor',
            'label': 'EVENTS.SERIES.DETAILS.METADATA.CONTRIBUTORS',
            'type': 'mixed_text',
            'value': [seriesContributor],
            'required': false
          },
          {
            'translatable': false,
            'readOnly': false,
            'id': 'publisher',
            'label': 'EVENTS.SERIES.DETAILS.METADATA.PUBLISHERS',
            'type': 'mixed_text',
            'value': [],
            'required': false
          }
        ]
      }
    ];

    const res = await this.getAccessListTemplate(aclName);
    const data = new FormData();
    data.append("metadata", JSON.stringify(metadata));
    data.append("acl", JSON.stringify(res.acl.ace));

    const headers = this.makeAuthHeader('application/x-www-form-urlencoded')
    return firstValueFrom(this.httpService.post(`${this.host}/api/series`, data, {
      headers: headers
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  };

  private generateDublinCore(terms: any): string {
    return this.generateOCCatalog("dublincore", "http://www.opencastproject.org/xsd/1.0/dublincore/","http://purl.org/dc/terms/", terms)
  }

  /**
   * Generates Opencast catalog(Dublincast etc)
   * @param rootTag - Root tag of the catalog
   * @param rootNamespace - Root namespace
   * @param termNamespace - Term namepsace
   * @param terms -> key: value or object { key: value }
   * @private
   */
  private generateOCCatalog(rootTag: string, rootNamespace: string, termNamespace: string, terms: any): string {
    let catalog = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n";
    catalog += `<${rootTag} xmlns=\"${rootNamespace}\" xmlns:terms=\"${termNamespace}\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n`

    Object.entries(terms).forEach(([key, value]) => {
      switch(key)
      {
        case "duration":
        case "extent":
          catalog += `<terms:extent xsi:type=\"terms:ISO8601\">${value instanceof Date ? value.toISOString() : value}</terms:extent>\n`
          break;
        case "startDate":
        case "temporal":
          // We convert
          catalog += "<terms:temporal xsi:type=\"terms:Period\">";
            if (value instanceof Object) {
              Object.entries(value).forEach(([subKey, subValue]) => {
                catalog += `${subKey}=${subValue instanceof Date ? subValue.toISOString() : subValue}; `;
              });
            } else {
              catalog += value instanceof Date ? value.toISOString() : value;
            }
          catalog += "</terms:temporal>";
          break;
        default:
          catalog += `<terms:${key}>${value instanceof Date ? value.toISOString() : value}</terms:${key}>`
          break;
      }
    });
    catalog += `</${rootTag}>\n`;
    return catalog;
  }

  private generateEventDublinCore(
    event: OpencastEvent,
    description = "",
    language = "lv",
    publisher = "LBTU",
    contributor = "PlugNMeet",
    creator = "LBTUMediaAPI"
  ) {
    return this.generateDublinCore(
      {
        created: event.start,
        temporal: {
          start: event.start,
          end: event.end,
          scheme: "W3C-DTF"
        },
        isPartOf: event.seriesId,
        language: language,
        spatial: event.location || "PlugNMeet Conference",
        title: event.title,
        subject: event.subject || "PlugNMeet Conference",
        description: description,
        publisher: publisher,
        creator: creator,
        contributor: contributor,
        rightsHolder: publisher,
        source: "8018b5af-c519-4a0d-b140-2183e91b16f6",
        license: "ALLRIGHTS"
      })
  }
  async addDublinCore(event: OpencastEvent, mediaPackage: string) {
    const params = new URLSearchParams();
    params.set('mediaPackage', mediaPackage);
    const dublinCore = this.generateEventDublinCore(event);
    params.set('dublinCore', dublinCore);
    params.set('flavor', 'dublincore/episode');

    const headers = this.makeAuthHeader('application/x-www-form-urlencoded; charset=utf-8',);
    return firstValueFrom(this.httpService.post(`${this.host}/ingest/addDCCatalog`, {}, {
      headers: headers,
      params: params
    }).pipe(
      map((response) => response.data),
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
    params.set('source', event.title);

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
  async createRecordingEventUsingSchedule(event: OpencastEvent, mediaPackage: string) {
    const data = new FormData();
    data.set('mediaPackage', mediaPackage);

    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    const res = await firstValueFrom(this.httpService.post(`${this.host}/ingest/schedule`, data,{
      headers: headers
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
    const acls = await this.getAccessListTemplates();
    return acls.find(a => a.name.toLowerCase() === aclName.toLowerCase());
  }
  async getAccessListTemplates(): Promise<any> {
    const headers = this.makeAuthHeader();
    return firstValueFrom(this.httpService.get( `${this.host}/acl-manager/acl/acls.json`, {
      headers: headers
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  }

  async generateAccessListTemplate(ace: any, name: string)
  {
    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    const data = new FormData();
    data.set("name", name);
    data.set("acl", JSON.stringify({
      "acl": {
        "ace": ace
      }
    }));
    return firstValueFrom(this.httpService.post( `${this.host}/acl-manager/acl`, data, {
      headers: headers,

    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  }

  async setAccessListTemplate(event: OpencastEvent, aclName: string) {
    const acl = await this.getAccessListTemplate(aclName);
    if (!acl) throw `Cannot find access list template ${aclName}!`;
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
  async startRecordingEvent(data: StartOpencastEventDto) {
    try {
      let event = await this.createOrGetEvent(data);
      event = await this.setCaptureAgentState(event, CaptureAgentState.CAPTURING);
      event = await this.setRecordingEventState(event, OpencastRecordingState.CAPTURING);
      await this.eventRepository.save(event);
    } catch (e) {
      this.logger.error(`Caught exception while creating event: ${e}!`);
    }
    // TODO: Maybe add some retry policy?
  };
  async addIngestJob(job: IngestJobDto) {
    await this.eventRepository.updateOne(
    { roomSid: job.roomSid, recorderId: job.recorderId },
    { $push: { jobs: job } }
    );
  }
  async stopAllRecordingEvents(data: PlugNMeetRoomEndedDto): Promise<void> {
    const events = await this.eventRepository.find({
      where: { roomSid: data.roomMetadata.info.sid }
    });
    if (events.length <= 0) {
      this.logger.warn(`There are no events for conference ${data.roomMetadata.info.sid}!`)
      return;
    }
    for (const event of events)
    {
      await this.stopRecordingEventByEntity(event);
      await this.deleteRecorder(event.recorderId);
    }
  }
  private async deleteRecorder(recorderId: string) {
    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    await firstValueFrom(this.httpService.delete(`${this.host}/capture-admin/agents/${recorderId}`, {
      headers: headers
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  };
  private async updateEventScheduling(event: OpencastEvent) {
    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    const data = new FormData();
    const mediaPackage = <string>await this.getMediaPackageByEventId(event.eventId);
    data.set('start', event.start.getTime().toString());
    data.set('end', event.end.getTime().toString());
    data.set('agent', event.recorderId);
    data.set('mediaPackage', mediaPackage);
    data.set('users', 'admin');
    data.set('source', event.title);
    await firstValueFrom(this.httpService.put(`${this.host}/recordings/${event.eventId}`, data, {
      headers: headers
    }).pipe(
      map((response) => response.data),
      retryPolicy(),
      handleAxiosExceptions(),
    ));
  };
  private async stopRecordingEventByEntity(event: OpencastEvent): Promise<boolean> {
    try {
      /**
       * Set event state, indicating that ingesting queue can start ingesting videos.
       */
      event = await this. setRecordingEventState(event, OpencastRecordingState.CAPTURE_FINISHED);
      event = await this.setCaptureAgentState(event, CaptureAgentState.IDLE);
      event = await this.setRecordingEventState(event, OpencastRecordingState.UPLOADING);
      event.end = new Date();
      await this.updateEventScheduling(event);
      await this.eventRepository.save(event);
      return true;
    } catch (e) {
      this.logger.error(`Caught exception while stopping event: ${e}!`);
      return false;
    }
  }
  async stopRecordingEvent(data: StopOpencastEventDto): Promise<boolean> {
    const event = await this.eventRepository.findOne({
      where: { roomSid: data.roomSid, recorderId: data.recorderId },
      order: { start: 'DESC' }
    })
    if (!event)
    {
      this.logger.error(`Event with recorder ${data.recorderId} dosn't exist!`);
      return false;
    }
    return this.stopRecordingEventByEntity(event);
  }
  async createOrGetEvent(data: StartOpencastEventDto): Promise<OpencastEvent> {
    /**
     *  First we try to see if event exists AND if it already has eventId
     */
    let event = await this.eventRepository.findOne({
      where: {
        roomSid: data.roomMetadata.info.sid,
        recorderId: data.recorderId,
        eventId: {
          $ne: null,
          $exists: true
        }
      }
    });
    if (event) {
      /**
       *  Event is started again, update scheduling
       */
      event.end.setTime(event.start.getTime() + 60000*30);
      await this.updateEventScheduling(event);
      return event;
    }
    /**
     * Create event entity, it must be created everytime, because opencast events cannot be started/stopped
     */
    event = this.eventRepository.create();
    event.recorderId = data.recorderId;
    event.type = data.type
    event.roomSid = data.roomMetadata.info.sid;
    event.start = new Date();
    event.end = new Date();
    event.jobs = [];
    event.title = `${data.roomMetadata.info.room_title} ${toTitle(data.type)} recording (${event.start.toLocaleDateString('lv-LV')})`;
    // 60 minutes
    event.end.setTime(event.start.getTime() + 60000 * 60);

    const series: any = await this.createOrGetSeriesByTitle(data.roomMetadata.courseName, `${data.roomMetadata.info.room_title} ${toTitle(data.type)}`);
    event.seriesId = series.identifier;
    /**
     * Add capture agent if dosnt exist, set it to idle for now
     */
    event = await this.setCaptureAgentState(event, CaptureAgentState.IDLE);
    /**
     *  Create MediaPackage and add DublinCore metadata to MediaPackage
     */
    let mediaPackage = await this.createMediaPackageWithId(`${data.roomMetadata.info.sid}_${data.type}`);
    mediaPackage = await this.addDublinCore(event, <string>mediaPackage);
    /**
     * Create recording
     */
    event = await this.createRecordingEvent(event, <string>mediaPackage);
    /**
     *  Configure event
     */
    await this.setAccessListTemplate(event, 'public');
    await this.setWorkflow(event, 'lbtu-wf-upload');
    return await this.eventRepository.save(event);
  };
  private async createOrGetSeriesByTitle(seriesTitle: string, roomName: string) {
    const headers = this.makeAuthHeader('application/x-www-form-urlencoded');
    const series: any = await firstValueFrom(this.httpService.get(`${this.host}/api/series/series.json?seriesTitle=${seriesTitle}`, {
      headers: headers
    }).pipe(
        map((response) => response.data),
        retryPolicy(),
        handleAxiosExceptions(),
    ));
    if (series.length > 0) return series[0];
    return await this.createSeries(seriesTitle, roomName);
  }

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
