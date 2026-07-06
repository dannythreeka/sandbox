import { Logger, UseFilters } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import {
  ClientAdvanceSchema,
  ClientJoinSchema,
  ClientResyncSchema,
  WS_EVENTS,
  type ClientAdvancePayload,
  type ServerJoinedPayload,
  type ServerResyncPayload,
} from "@azure-voyage/shared";
import { AllExceptionsFilter } from "../common/errors/all-exceptions.filter";
import { GameError } from "../common/errors/game-error";
import type { JwtPayload } from "../common/auth/jwt-payload";
import { ZodPipe } from "../common/zod/zod.pipe";
import { ClockService } from "../modules/clock/clock.service";
import type {
  WorldArrivalEventPayload,
  WorldTickEventPayload,
} from "../modules/voyage/voyage.service";
import { WorldService } from "../modules/world/world.service";

interface GameSocketData {
  userId: string;
}

export function worldRoom(worldId: string): string {
  return `world:${worldId}`;
}

@WebSocketGateway({
  namespace: "/game",
  cors: { origin: true, credentials: true },
})
@UseFilters(AllExceptionsFilter)
export class GameGateway implements OnGatewayConnection {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly worldService: WorldService,
    private readonly clockService: ClockService,
  ) {}

  /** 握手驗證：handshake.auth.token 必須是有效 access token，否則直接斷線。 */
  async handleConnection(socket: Socket): Promise<void> {
    const token: unknown = socket.handshake.auth?.token;
    try {
      if (typeof token !== "string") throw new Error("missing token");
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (payload.type !== "access") throw new Error("not an access token");
      (socket.data as GameSocketData).userId = payload.sub;
    } catch {
      this.logger.warn(`rejected ws connection ${socket.id}: bad token`);
      socket.disconnect(true);
    }
  }

  @SubscribeMessage(WS_EVENTS.CLIENT_JOIN)
  async onJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodPipe(ClientJoinSchema)) body: { worldId: string },
  ): Promise<ServerJoinedPayload> {
    const userId = this.requireUser(socket);
    const world = await this.worldService.getOwned(userId, body.worldId);
    await socket.join(worldRoom(world.id));
    const joined: ServerJoinedPayload = { worldId: world.id, tick: world.currentTick };
    socket.emit(WS_EVENTS.SERVER_JOINED, joined);
    return joined; // 亦作為 ack 回傳
  }

  @SubscribeMessage(WS_EVENTS.CLIENT_RESYNC)
  async onResync(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodPipe(ClientResyncSchema)) body: { worldId: string; lastTick: number },
  ): Promise<ServerResyncPayload> {
    const userId = this.requireUser(socket);
    const snapshot = await this.worldService.getSnapshot(userId, body.worldId);
    const resync: ServerResyncPayload = { tick: snapshot.world.currentTick, snapshot };
    socket.emit(WS_EVENTS.SERVER_RESYNC, resync);
    return resync;
  }

  @SubscribeMessage(WS_EVENTS.CLIENT_ADVANCE)
  async onAdvance(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodPipe(ClientAdvanceSchema)) body: ClientAdvancePayload,
  ) {
    const userId = this.requireUser(socket);
    // 廣播由 ClockService → VoyageService 觸發的 domain event 負責（見下方 @OnEvent）；
    // 這裡的回傳值只作為呼叫方的 ack。
    return this.clockService.requestAdvance(userId, body.worldId, body.ticks);
  }

  @OnEvent("world.tick")
  onWorldTick({ worldId, payload }: WorldTickEventPayload): void {
    this.server.to(worldRoom(worldId)).emit(WS_EVENTS.SERVER_TICK, payload);
  }

  @OnEvent("world.arrival")
  onWorldArrival({ worldId, payload }: WorldArrivalEventPayload): void {
    this.server.to(worldRoom(worldId)).emit(WS_EVENTS.SERVER_ARRIVAL, payload);
  }

  private requireUser(socket: Socket): string {
    const userId = (socket.data as Partial<GameSocketData>).userId;
    if (!userId) {
      throw new GameError("UNAUTHORIZED");
    }
    return userId;
  }
}
