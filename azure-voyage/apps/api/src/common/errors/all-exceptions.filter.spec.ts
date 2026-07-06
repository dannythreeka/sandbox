import type { ArgumentsHost } from "@nestjs/common";
import type { Socket } from "socket.io";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { GameError } from "./game-error";

function makeWsHost(args: unknown[]) {
  const client = { emit: jest.fn() } as unknown as Socket;
  const host = {
    getType: () => "ws",
    switchToWs: () => ({ getClient: () => client }),
    getArgs: () => args,
  } as unknown as ArgumentsHost;
  return { host, client };
}

describe("AllExceptionsFilter (ws)", () => {
  it("invokes the ack callback even when it isn't the last raw argument", () => {
    // 實測觀察到 Nest 的 ws context 傳入 getArgs() 的順序是
    // [client, data, ackFn, eventName]——ack 並非陣列最後一個元素，
    // 若照舊假設「取最後一個」會誤抓到事件名稱字串，導致呼叫端的
    // ack Promise 永遠掛住（曾在 client:join 對不存在世界時實際重現）。
    const ackFn = jest.fn();
    const { host, client } = makeWsHost([{ id: "client-data" }, { worldId: "w1" }, ackFn, "client:join"]);
    const filter = new AllExceptionsFilter();

    filter.catch(new GameError("NOT_FOUND"), host);

    expect(ackFn).toHaveBeenCalledTimes(1);
    expect(ackFn).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "NOT_FOUND" }) });
    expect(client.emit).toHaveBeenCalledWith("server:error", expect.objectContaining({ code: "NOT_FOUND" }));
  });

  it("does nothing extra when no ack function was provided", () => {
    const { host, client } = makeWsHost([{ worldId: "w1" }]);
    const filter = new AllExceptionsFilter();

    expect(() => filter.catch(new GameError("NOT_FOUND"), host)).not.toThrow();
    expect(client.emit).toHaveBeenCalledWith("server:error", expect.objectContaining({ code: "NOT_FOUND" }));
  });
});
