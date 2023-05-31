import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { CreateOpencastEventDto } from "../dto/CreateOpencastEventDto";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom, map } from "rxjs";
import { handleAxiosExceptions, retryPolicy } from "../../common/utils/axios.utils";
import { CaptureAgentState } from "../dto/enums/CaptureAgentState";
import { OpencastRecordingState } from "../dto/enums/OpencastRecordingState";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOneAndReplaceOption, MongoRepository } from "typeorm";
import { ObjectID } from "mongodb";
import { OpencastEvent } from "../entities/opencast.event";
import { StartOpencastIngestDto } from "../dto/StartOpencastIngestDto";
import { IngestJobDto } from "../dto/IngestJobDto";
import * as fs from 'fs/promises';
import { basename } from "path";
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
      //this.logger.debug(await this.createMediaPackageWithId("testId1111222"));
      this.logger.debug(this.generateEventDublinCore(
        "TestDC",
        "Math",
        "LBTU",
        "test-series",
        new Date(),
        new Date()
      ));
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
      select: ['id', 'name', "agentState", "recorderId", "recordingState", "agentState", "roomSid", "eventId"],
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
      headers: headers
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
    title: string,
    subject: string,
    location: string,
    series: string,
    start: Date,
    end: Date,
    description = "",
    language = "lv",
    publisher = "LBTU",
    contributor = "PlugNMeet",
    creator = "LBTUMediaAPI"
  ) {
    return this.generateDublinCore(
      {
        created: start,
        temporal: {
          start: start,
          end: end,
          scheme: "W3C-DTF"
        },
        isPartOf: series,
        language: language,
        spatial: location,
        title: title,
        subject: subject,
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
    const dublinCore = this.generateEventDublinCore(
      `${event.start.toLocaleDateString('lv-LV')} ${event.name} recording`,
      event.subject || "PlugNMeet Conference",
      event.location || "PlugNMeet Conference",
      `${event.name} PlugNMeet recording`,
      event.start,
      event.end
    );
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
    await firstValueFrom(this.httpService.post(`${this.host}/capture-admin/agents/${event.recorderId}_${event.roomSid}_${event.name}`, {},{
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
    params.set('agent', `${event.recorderId}_${event.roomSid}_${event.name}`);
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
    const createdEvent: any = await this.getLastRecording(`${event.recorderId}_${event.roomSid}_${event.name}`);
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
    return;
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
  async startRecordingEvent(data: CreateOpencastEventDto) {
    try {
      // Remove old stopped recordings
      await this.removeOldScheduledRecordings();
      let event = await this.createOrGetEvent(data);
      event = await this.setCaptureAgentState(event, CaptureAgentState.CAPTURING);
      event = await this.setRecordingEventState(event, OpencastRecordingState.CAPTURING);
      await this.eventRepository.save(event);
    } catch (e) {
      this.logger.error(`Caught exception while creating event: ${e}!`);
    }
    // TODO: Maybe add some retry policy?
  };
  async stopRecordingEvent(data: StartOpencastIngestDto): Promise<OpencastEvent> {
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
      /**
       * Set event state, indicating that ingesting queue can start ingesting videos.
       */
      event = await this.setRecordingEventState(event, OpencastRecordingState.CAPTURE_FINISHED);
      event = await this.setCaptureAgentState(event, CaptureAgentState.IDLE);
      event = await this.setRecordingEventState(event, OpencastRecordingState.UPLOADING);
      // TODO: Update end time in opencast event aswell, thisway we can try to avoid scheduling conflicts
      // Set end time as now
      event.end = new Date();
      await this.eventRepository.save(event);
      return event;
    } catch (e) {
      this.logger.error(`Caught exception while stopping event: ${e}!`);
    }
  }
  async createOrGetEvent(data: CreateOpencastEventDto): Promise<OpencastEvent> {
    /**
     *  First we try to see if event exists AND if it already has eventId
     */
    let event = await this.eventRepository.findOne({
      where: {
        recorderId: data.recorderId,
        roomSid: data.roomSid,
        eventId: {
          $ne: null,
          $exists: true
        }
      }
    });
    if (event) return event;
    /**
     * Create event entity, it must be created everytime, because opencast events cannot be started/stopped
     */
    event = this.eventRepository.create();
    event.recorderId = data.recorderId;
    event.name = data.name;
    event.roomSid = data.roomSid;
    event.start = new Date();
    event.end = new Date();
    // End of recording is in one hour
    // TODO: Change this to one hour currently 60 sec
    event.end.setTime(event.start.getTime() + 60000);
    const series: any = await this.createSeries(`${data.name} PlugNMeet recording`, data.name);
    event.seriesId = series.identifier;
    /**
     * Add capture agent if dosnt exist, set it to idle for now
     */
    event = await this.setCaptureAgentState(event, CaptureAgentState.IDLE);

    /**
     *  Create MediaPackage and add DublinCore metadata to MediaPackage
     */
    let mediaPackage = await this.createMediaPackageWithId(`${data.roomSid}_${data.recorderId}`);
    mediaPackage = await this.addDublinCore(event, <string>mediaPackage);
    /**
     * Create recording, if not already created
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