import { Inject, Injectable } from "@nestjs/common";
import { LIVEKIT_EGRESS_SERVICE, LIVEKIT_INGRESS_SERVICE } from "../../app.constants";
import { ClientProxy } from "@nestjs/microservices";
@Injectable()
export class EgressService {
  constructor(@Inject(LIVEKIT_EGRESS_SERVICE) private readonly client: ClientProxy) {}
}
