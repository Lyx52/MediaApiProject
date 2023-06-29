import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MongoRepository } from "typeorm";
import { ObjectID } from "mongodb";
import { CreateEpiphanDto } from "../dto/CreateEpiphanDto";
import { HttpService } from "@nestjs/axios";
import { StartEpiphanRecordingDto } from "../dto/StartEpiphanRecordingDto";
import { firstValueFrom, map } from "rxjs";
import { handleAxiosExceptions, makeBasicAuthHeader, retryPolicy } from "../../common/utils/axios.utils";
import { StopEpiphanRecordingDto } from "../dto/StopEpiphanRecordingDto";
import { ConfigService } from "@nestjs/config";
import { GetEpiphanRecordingsDto } from "../dto/GetEpiphanRecordingsDto";
import {
  CREATE_OR_GET_INGRESS_STREAM_KEY,
  EPIPHAN_SERVICE
} from "../../app.constants";
import { ClientProxy } from "@nestjs/microservices";
import { CreateOrGetIngressStreamKeyDto } from "../../livekit/dto/CreateOrGetIngressStreamKeyDto";
import { IngressInfo } from "livekit-server-sdk";
import { RecordingDeviceDto } from "../dto/RecordingDeviceDto";
import { EpiphanDto } from "../dto/EpiphanDto";
import { PingEpiphanDto } from "../dto/PingEpiphanDto";
import { PingEpiphanResDto } from "../dto/PingEpiphanResDto";
@Injectable()
export class EpiphanService implements OnModuleInit {
  private readonly logger: Logger = new Logger(EpiphanService.name);
  private readonly livekitRTMPUrl: string;
  private readonly epiphanDevices: EpiphanDto[];
  private activeDevices: PingEpiphanResDto[];
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    @Inject(EPIPHAN_SERVICE) private readonly client: ClientProxy
  ) {
    this.livekitRTMPUrl = this.config.getOrThrow<string>("livekit.rtmp_url");
    this.epiphanDevices = this.config.getOrThrow<EpiphanDto[]>("epiphan_config");
  }

  async onModuleInit() {
    const allDevices = this.getAllDeviceLocations();
    this.activeDevices = await this.pingEpiphanDevices(allDevices.map(d => d.deviceIdentifier));
  }
  async updateActiveDevices() {
    // 15 sec
    const requireUpdate = this.activeDevices.filter(d => Date.now() - d.lastPinged > 15_000).map(d => d.epiphanId);
    const responses = await this.pingEpiphanDevices(requireUpdate);
    this.activeDevices.forEach((device, index) => {
      const updatedDevice = responses.find(d => d.epiphanId === device.epiphanId);
      if (updatedDevice)
      {
        this.activeDevices[index] = updatedDevice;
      }
    });
  }
  public pingEpiphanDevices(epiphanIds: string[]) {
    const epiphanDevicePings = epiphanIds.map(epiphanId => this.pingEpiphanDevice({ epiphanId: epiphanId }));
    return Promise.all(epiphanDevicePings);
  }
  getAllDeviceLocations(): RecordingDeviceDto[] {
    return this.epiphanDevices.map(cfg => <RecordingDeviceDto>{
      deviceIdentifier: cfg.identifier,
      deviceName: cfg.name
    });
  }
  async getAllActiveDeviceLocations(): Promise<RecordingDeviceDto[]> {
    await this.updateActiveDevices();
    const allDevices = this.getAllDeviceLocations();
    return allDevices.filter(device => this.activeDevices.find(activeDevice => activeDevice.epiphanId === device.deviceIdentifier && activeDevice.active));
  }
  findConfig(epiphanId: string): EpiphanDto {
    return <EpiphanDto>this.epiphanDevices.find(cfg => cfg.identifier === epiphanId);
  }
  /**
   * Pings epiphan device
   * @param data
   */
  async pingEpiphanDevice(data: PingEpiphanDto): Promise<PingEpiphanResDto> {
    // 1. Find epiphan device
    const epiphanConfig = await this.findConfig(data.epiphanId);

    if (!epiphanConfig) {
      this.logger.error(`Epiphan configuration with epiphanId ${data.epiphanId} not found!`)
      return { epiphanId: data.epiphanId, active: false, lastPinged: Date.now() };
    }

    // 2. Ping epiphan using API
    try {
      const headers = makeBasicAuthHeader(epiphanConfig.username, epiphanConfig.password);
      const response: any = await firstValueFrom(this.httpService.get(
        `${epiphanConfig.host}/api/system/status`, {
          headers: headers
        }).pipe(
        map((response) => response.data),
        handleAxiosExceptions(),
      ));
      return { epiphanId: data.epiphanId, active: response && response.status == "ok", lastPinged: Date.now() };
    } catch (e) {
      this.logger.error(`Error while starting Epiphan livestream: ${e}`);
    }
    return { epiphanId: data.epiphanId, active: false, lastPinged: Date.now() };
  }
  /**
   * Stops epiphan livestreams using epiphan API
   *  1. Finds epiphan device by epiphanId
   *  2. Stops epiphan livestream using API
   * @param data
   */
  async stopEpiphanLivestream(data: StopEpiphanRecordingDto): Promise<boolean> {
    let success = true;

    // 1. Find epiphan device
    const epiphanConfig = await this.findConfig(data.epiphanId);

    if (!epiphanConfig) {
      this.logger.error(`Epiphan configuration with epiphanId ${data.epiphanId} not found!`)
      success = false;
    }

    // 2. Stop epiphan livestream using API
    try {
      const headers = makeBasicAuthHeader(epiphanConfig.username, epiphanConfig.password);
      const response: any = await firstValueFrom(this.httpService.post(
        `${epiphanConfig.host}/api/channels/${epiphanConfig.default_channel || 1}/publishers/${epiphanConfig.default_publisher || 0}/control/stop`, {}, {
        headers: headers
      }).pipe(
        map((response) => response.data),
        retryPolicy(),
        handleAxiosExceptions(),
      ));
      success &&= response && response.status == "ok";
    } catch (e) {
      this.logger.error(`Error while starting Epiphan livestream: ${e}`);
      success = false;
    }
    // If we are still livestreaming, something went wrong
    success &&= !(await this.isLivestreaming(data.epiphanId));
    return success;
  }

  /**
   * Stops epiphan recordings using epiphan API
   *  1. Finds epiphan device by epiphanId
   *  2. Stops epiphan recording using API
   *  3. Updates epiphan recording state
   * @param data
   */
  async stopEpiphanRecording(data: StopEpiphanRecordingDto): Promise<boolean> {
    let success = true;

    // 1. Find epiphan device
    const epiphanConfig = await this.findConfig(data.epiphanId);

    if (!epiphanConfig) {
      this.logger.error(`Epiphan configuration with epiphanId ${data.epiphanId} not found!`)
      success = false;
    }

    // 2. Stop epiphan recording using API
    try {
      const headers = makeBasicAuthHeader(epiphanConfig.username, epiphanConfig.password);
      const response: any = await firstValueFrom(this.httpService.post(`${epiphanConfig.host}/api/recorders/${epiphanConfig.default_channel || 1}/control/stop`, {}, {
        headers: headers
      }).pipe(
        map((response) => response.data),
        retryPolicy(),
        handleAxiosExceptions(),
      ));
      success &&= response && response.status == "ok";
    } catch (e) {
      this.logger.error(`Error while starting Epiphan recording: ${e}`);
      success = false;
    }
    // If we are still recording, something went wrong
    success &&= !(await this.isRecording(data.epiphanId));
    return success;
  }

  async isRecording(id: string): Promise<boolean> {
    return (await this.getRecorderStatus(id)) === "started";
  }

  /**
   * Gets current recorder statuses
   * @param id - Epiphan identifier
   */
  async getRecorderStatus(id: string): Promise<any> {
    const config = await this.findConfig(id);

    if (!config) {
      this.logger.error(`Epiphan configuration with id ${id} not found!`)
      return false;
    }

    try {
      const headers = makeBasicAuthHeader(config.username, config.password);
      return await firstValueFrom(this.httpService.get(`${config.host}/api/recorders/${config.default_channel || 1}/status`, {
        headers: headers
      }).pipe(
        map((response) => {
          if(response.data.status === "ok" && response.data.result) {
            return response.data.result.status
          }
          return "stopped";
        }),
        retryPolicy(),
        handleAxiosExceptions(),
      ));
    } catch (e) {
      this.logger.error(`Error while getting Epiphan publisher status: ${e}`);
      return "stopped";
    }
  };

  async isLivestreaming(id: string): Promise<boolean> {
    return (await this.getPublisherStatus(id)) === "started";
  }
  /**
   * Gets current publisher statuses
   * @param id - Epiphan identifier
   */
  async getPublisherStatus(id: string) {
    const config = await this.findConfig(id);

    if (!config) {
      this.logger.error(`Epiphan configuration with id ${id} not found!`)
      return false;
    }

    try {
      const headers = makeBasicAuthHeader(config.username, config.password);
      return await firstValueFrom(this.httpService.get(`${config.host}/api/channels/${config.default_channel || 1}/publishers/${config.default_publisher || 0}/status`, {
        headers: headers
      }).pipe(
        map((response) => {
          if(response.data.status === "ok" && response.data.result) {
            return response.data.result.status
          }
          return "stopped";
        }),
        retryPolicy(),
        handleAxiosExceptions(),
      ));
    } catch (e) {
      this.logger.error(`Error while getting Epiphan publisher status: ${e}`);
      return false;
    }
  };

  /**
   * Gets all epiphan recordings
   *  1. Finds epiphan device by epiphanId
   *  2. Gets all epiphan recordings for a recorder using epiphan API
   * @param data
   */
  async getEpiphanRecordings(data: GetEpiphanRecordingsDto) {
    // 1. Find epiphan device
    const epiphanConfig = await this.findConfig(data.epiphanId);

    if (!epiphanConfig) {
      this.logger.error(`Epiphan configuration with epiphanId ${data.epiphanId} not found!`)
      return false;
    }
    // 2. Get all epiphan recordings as json
    try {
      const headers = makeBasicAuthHeader(epiphanConfig.username, epiphanConfig.password);
      return await firstValueFrom(this.httpService.get(`${epiphanConfig.host}/api/recorders/${epiphanConfig.default_channel || 1}/archive/files`, {
        headers: headers
      }).pipe(
        map((response) => response.data),
        retryPolicy(),
        handleAxiosExceptions(),
      ));
    } catch (e) {
      this.logger.error(`Error while getting Epiphan recordings: ${e}`);
      return false;
    }
  };

  /**
   * Gets last epiphan recording based on recording created timestamp
   * @param data
   */
  async getLastEpiphanRecording(data: GetEpiphanRecordingsDto) {
    const response: any = await this.getEpiphanRecordings(data);
    if (!response) return {};
    const files = response.result;
    return files.reduce((prev, curr) => Date.parse(curr.created) > Date.parse(prev.created) ? curr : prev);
  };

  /**
   * Starts epiphan livestreams using epiphan API
   *  1. Finds epiphan device by epiphanId
   *  2. Sends message to livekit to create or get stream key
   *  3. Updates epiphan rtmp livestream config including the streamkey
   * @param data
   */
  async startEpiphanLivestream(data: StartEpiphanRecordingDto): Promise<boolean> {
    let success = true;

    // 1. Find epiphan device
    const epiphanConfig = await this.findConfig(data.epiphanId);

    if (!epiphanConfig) {
      this.logger.error(`Epiphan configuration with epiphanId ${data.epiphanId} not found!`)
      success = false;
    }

    // 2. Create or get ingress stream key
    const streamKeyCreateResponse: ServiceMessageResponse<IngressInfo> = await firstValueFrom(
      this.client.send<ServiceMessageResponse<IngressInfo>, CreateOrGetIngressStreamKeyDto>(CREATE_OR_GET_INGRESS_STREAM_KEY, <CreateOrGetIngressStreamKeyDto>
      {
        epiphanId: data.epiphanId,
        roomMetadata: data.roomMetadata
      }));
    success &&= streamKeyCreateResponse.success;

    // 3. Update RTMP livestream config
    if (streamKeyCreateResponse.success) {
      try {
        const headers = makeBasicAuthHeader(epiphanConfig.username, epiphanConfig.password);
        headers["Content-Type"] = "application/json";
        const response: any = await firstValueFrom(this.httpService.patch(
          `${epiphanConfig.host}/api/channels/${epiphanConfig.default_channel || 1}/publishers/${epiphanConfig.default_publisher || 0}/settings`,
          {
            type: 'rtmp',
            started: true,
            'single-touch': false,
            'disable-audio': false,
            // Always override, because this might be without domain/behind nginx etc.
            url: this.livekitRTMPUrl,
            stream: streamKeyCreateResponse.data.streamKey,
            username: '',
            password: '',
            auto_created: false,
            name: `${data.roomMetadata.info.room_title || "PlugNMeet Livestream"}`,
          }, { headers: headers }).pipe(
          map((response) => response.data),
          retryPolicy(),
          handleAxiosExceptions(),
        ));
        success &&= response && response.status == "ok";
      } catch (e) {
        this.logger.error(`Error while starting Epiphan: ${e}`);
        success = false;
      }
    }

    return success;
  }


  /**
   * Starts epiphan recording using epiphan API
   *  1. Finds epiphan device by epiphanId
   *  2. Starts recording using epiphan API
   *  3. Updates epiphan recording state based on if recording started
   * @param data
   */
  async startEpiphanRecording(data: StartEpiphanRecordingDto): Promise<boolean> {
    let success = true;

    // 1. Find epiphan device
    const epiphanConfig = await this.findConfig(data.epiphanId);

    if (!epiphanConfig) {
      this.logger.error(`Epiphan configuration with id ${data.epiphanId} not found!`)
      success = false;
    }
    // 2. Start epiphan recording
    try {
      const headers = makeBasicAuthHeader(epiphanConfig.username, epiphanConfig.password);
      const response: any = await firstValueFrom(this.httpService.post(`${epiphanConfig.host}/api/recorders/${epiphanConfig.default_channel || 1}/control/start`, {}, {
        headers: headers
      }).pipe(
        map((response) => response.data),
        retryPolicy(),
        handleAxiosExceptions(),
      ));
      success &&= response && response.status == "ok";
    } catch (e) {
      this.logger.error(`Error while starting Epiphan: ${e}`);
      success = false;
    }
    return success;
  }
}
