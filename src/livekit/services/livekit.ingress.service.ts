import { Inject, Injectable } from "@nestjs/common";
import { LIVEKIT_EGRESS_SERVICE, LIVEKIT_INGRESS_SERVICE } from "../../app.constants";
import { ClientProxy } from "@nestjs/microservices";
@Injectable()
export class LivekitIngressService {
  constructor(@Inject(LIVEKIT_INGRESS_SERVICE) private readonly client: ClientProxy) {}
}
