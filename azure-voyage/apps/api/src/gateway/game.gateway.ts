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
  ClientBattleActionSchema,
  ClientJoinSchema,
  ClientResyncSchema,
  ClientSteerSchema,
  WS_EVENTS,
  type ClientAdvancePayload,
  type ClientBattleActionPayload,
  type ClientSteerPayload,
  type ServerJoinedPayload,
  type ServerResyncPayload,
  type WindDirection,
} from "@azure-voyage/shared";
import { AllExceptionsFilter } from "../common/errors/all-exceptions.filter";
import { GameError } from "../common/errors/game-error";
import type { JwtPayload } from "../common/auth/jwt-payload";
import { ZodPipe } from "../common/zod/zod.pipe";
import { BattleService } from "../modules/battle/battle.service";
import { ClockService } from "../modules/clock/clock.service";
import { VoyageService } from "../modules/voyage/voyage.service";
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
    private readonly battleService: BattleService,
    private readonly voyageService: VoyageService,
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

  @SubscribeMessage(WS_EVENTS.CLIENT_STEER)
  async onSteer(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodPipe(ClientSteerSchema)) body: ClientSteerPayload,
  ) {
    const userId = this.requireUser(socket);
    return this.voyageService.setHeading(
      userId,
      body.worldId,
      body.fleetId,
      body.heading as WindDirection,
    );
  }

  @SubscribeMessage(WS_EVENTS.BATTLE_ACTION)
  async onBattleAction(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodPipe(ClientBattleActionSchema)) body: ClientBattleActionPayload,
  ) {
    const userId = this.requireUser(socket);
    // 找出這個 socket 目前加入的世界房間，逐一嘗試（單一玩家通常只加入一個世界房間）
    const worldId = [...socket.rooms].find((r) => r.startsWith("world:"))?.slice("world:".length);
    if (!worldId) throw new GameError("NOT_FOUND");
    return this.battleService.applyAction(userId, worldId, body.battleId, body.action);
  }

  @OnEvent("world.tick")
  onWorldTick({ worldId, payload }: WorldTickEventPayload): void {
    this.server.to(worldRoom(worldId)).emit(WS_EVENTS.SERVER_TICK, payload);
  }

  @OnEvent("world.arrival")
  onWorldArrival({ worldId, payload }: WorldArrivalEventPayload): void {
    this.server.to(worldRoom(worldId)).emit(WS_EVENTS.SERVER_ARRIVAL, payload);
  }

  @OnEvent("world.battle-start")
  onBattleStart({ worldId, payload }: { worldId: string; payload: unknown }): void {
    this.server.to(worldRoom(worldId)).emit(WS_EVENTS.SERVER_BATTLE_START, payload);
  }

  @OnEvent("world.event")
  onWorldEvent({ worldId, payload }: { worldId: string; payload: unknown }): void {
    this.server.to(worldRoom(worldId)).emit(WS_EVENTS.SERVER_EVENT, payload);
  }

  @OnEvent("battle.update")
  onBattleUpdate({ worldId, payload }: { worldId: string; payload: unknown }): void {
    this.server.to(worldRoom(worldId)).emit(WS_EVENTS.BATTLE_UPDATE, payload);
  }

  @OnEvent("battle.end")
  onBattleEnd({ worldId, payload }: { worldId: string; payload: unknown }): void {
    this.server.to(worldRoom(worldId)).emit(WS_EVENTS.BATTLE_END, payload);
  }

  @OnEvent("world.victory")
  onWorldVictory({ worldId, payload }: { worldId: string; payload: unknown }): void {
    this.server.to(worldRoom(worldId)).emit(WS_EVENTS.SERVER_VICTORY, payload);
  }

  @OnEvent("world.quest-chapter")
  onQuestChapter({ worldId, payload }: { worldId: string; payload: unknown }): void {
    this.server.to(worldRoom(worldId)).emit(WS_EVENTS.SERVER_QUEST_CHAPTER, payload);
  }

  private requireUser(socket: Socket): string {
    const userId = (socket.data as Partial<GameSocketData>).userId;
    if (!userId) {
      throw new GameError("UNAUTHORIZED");
    }
    return userId;
  }
}
