import { Injectable } from "@nestjs/common";
import {
  BALANCE,
  bestTradeRoutesFrom,
  commodityById,
  computeMarketPrice,
  effectiveBuyPrice,
  effectiveSellPrice,
  goodwillFromTrade,
  portById,
  portByIdOrFallback,
  PORT_IDS,
  purserTradeBonus,
  shipClassById,
  type OfficerStats,
  type PortDetail,
  type PortMarketSnapshot,
  type TradeFill,
  type TradeInput,
  type TradeResult,
  type TradeRouteSuggestion,
} from "@azure-voyage/shared";
import { GameError } from "../../common/errors/game-error";
import { awardExpToFleetOfficers } from "../officer/officer-growth.util";
import { PrismaService } from "../../prisma/prisma.service";

interface CargoLine {
  quantity: number;
  avgBuyPrice: number;
}

@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortDetail(userId: string, worldId: string, portId: string): Promise<PortDetail> {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    const port = portByIdOrFallback(portId);
    const portState = await this.prisma.portState.findUnique({
      where: { worldId_portId: { worldId, portId } },
      include: { market: true, influences: { include: { guild: true } } },
    });
    if (!portState) throw new GameError("NOT_FOUND");

    const playerGuild = await this.prisma.guild.findFirstOrThrow({
      where: { worldId, kind: "PLAYER" },
    });
    const playerInfluence = portState.influences.find((i) => i.guildId === playerGuild.id);
    const playerShare = playerInfluence ? Number(playerInfluence.share) : 0;

    return {
      portId,
      name: port.name,
      regionId: port.regionId,
      size: port.size,
      prosperity: portState.prosperity,
      market: portState.market.map((m) => ({
        commodityId: m.commodityId,
        stock: m.stock,
        buyPrice: effectiveBuyPrice(m.price, playerShare),
        sellPrice: effectiveSellPrice(m.price, playerShare),
        priceHistory: m.priceHistory as { t: number; p: number }[],
      })),
      influences: portState.influences.map((i) => ({
        guildId: i.guildId,
        guildName: i.guild.name,
        color: i.guild.color,
        share: Number(i.share),
      })),
      playerShare,
    };
  }

  /**
   * 貿易路線建議（docs/01 §4.2、M24）：以 portId 為起點，比較全部港口目前的
   * 有效買/賣價，算出「在起點買、去哪賣」的獲利建議，按「單位獲利/距離」排序。
   * 只讀當下市場快照，不含 PURSER 職位加成（那是實際下單時才套用的折扣，
   * 這裡單純是市場情報，維持跟 getPortDetail 一致的簡化）。
   */
  async getTradeRouteSuggestions(
    userId: string,
    worldId: string,
    portId: string,
    limit = 10,
  ): Promise<TradeRouteSuggestion[]> {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    const playerGuild = await this.prisma.guild.findFirstOrThrow({ where: { worldId, kind: "PLAYER" } });
    // 只取現行 15 港（排除 M21 刪除後留下的孤兒 PortState，見 docs/13 §2）
    const portStates = await this.prisma.portState.findMany({
      where: { worldId, portId: { in: [...PORT_IDS] } },
      include: { market: true, influences: true },
    });

    const snapshots: PortMarketSnapshot[] = portStates.map((ps) => {
      const port = portById(ps.portId);
      const share = Number(ps.influences.find((i) => i.guildId === playerGuild.id)?.share ?? 0);
      return {
        portId: ps.portId,
        portName: port.name,
        coord: port.coord,
        listings: ps.market.map((m) => ({
          commodityId: m.commodityId,
          buyPrice: effectiveBuyPrice(m.price, share),
          sellPrice: effectiveSellPrice(m.price, share),
        })),
      };
    });

    const origin = snapshots.find((s) => s.portId === portId);
    if (!origin) throw new GameError("NOT_FOUND");

    return bestTradeRoutesFrom(origin, snapshots, limit);
  }

  /**
   * 交易撮合（docs/04 §4、docs/05 §2）。全部在一個 transaction 內完成，
   * 任一筆檢查失敗（資金/庫存/貨艙）都會讓整批訂單一起失敗、不留半套狀態。
   */
  async trade(userId: string, worldId: string, portId: string, input: TradeInput): Promise<TradeResult> {
    const world = await this.prisma.gameWorld.findUnique({ where: { id: worldId } });
    if (!world || world.userId !== userId) throw new GameError("NOT_FOUND");

    return this.prisma.$transaction(async (tx) => {
      const fleet = await tx.fleet.findUnique({
        where: { id: input.fleetId },
        include: { officers: true },
      });
      if (!fleet || fleet.worldId !== worldId) throw new GameError("NOT_FOUND");
      if (fleet.activity !== "DOCKED" || fleet.dockedPortId !== portId) {
        throw new GameError("PORT_NOT_DOCKED");
      }

      const ship = await tx.ship.findUnique({ where: { id: input.shipId }, include: { cargo: true } });
      if (!ship || ship.fleetId !== fleet.id) throw new GameError("NOT_FOUND");

      const guild = await tx.guild.findUniqueOrThrow({ where: { id: fleet.guildId } });
      const portState = await tx.portState.findUniqueOrThrow({
        where: { worldId_portId: { worldId, portId } },
        include: { market: true },
      });
      const playerInfluence = await tx.portInfluence.findUnique({
        where: { portStateId_guildId: { portStateId: portState.id, guildId: guild.id } },
      });
      const share = playerInfluence ? Number(playerInfluence.share) : 0;
      // 會計長（PURSER）：買賣折扣加成，與影響力折扣疊加（M23）
      const purser = fleet.officers.find((o) => o.role === "PURSER");
      const purserBonus = purserTradeBonus((purser?.stats as unknown as OfficerStats | undefined)?.trade);

      const shipClass = shipClassById(ship.shipClassId);
      const cargoMap = new Map<string, CargoLine>(
        ship.cargo.map((c) => [c.commodityId, { quantity: c.quantity, avgBuyPrice: c.avgBuyPrice }]),
      );
      const marketByCommodity = new Map(portState.market.map((m) => [m.commodityId, { ...m }]));
      let gold = Number(guild.gold);
      let totalTradeValue = 0;
      const fills: TradeFill[] = [];

      const currentVolume = () =>
        [...cargoMap.entries()].reduce(
          (acc, [id, line]) => acc + line.quantity * commodityById(id).volume,
          0,
        );

      for (const order of input.orders) {
        const market = marketByCommodity.get(order.commodityId);
        if (!market) throw new GameError("COMMODITY_UNAVAILABLE");
        const commodity = commodityById(order.commodityId);

        if (order.side === "BUY") {
          if (market.stock < order.quantity) throw new GameError("STOCK_INSUFFICIENT");
          const unitPrice = effectiveBuyPrice(market.price, share, purserBonus);
          const total = unitPrice * order.quantity;
          if (gold < total) throw new GameError("INSUFFICIENT_GOLD");
          const addedVolume = order.quantity * commodity.volume;
          if (currentVolume() + addedVolume > shipClass.cargoCapacity) {
            throw new GameError("CARGO_FULL");
          }

          gold -= total;
          totalTradeValue += total;
          market.stock -= order.quantity;
          const existing = cargoMap.get(order.commodityId);
          if (existing) {
            const newQty = existing.quantity + order.quantity;
            existing.avgBuyPrice = Math.round(
              (existing.avgBuyPrice * existing.quantity + total) / newQty,
            );
            existing.quantity = newQty;
          } else {
            cargoMap.set(order.commodityId, { quantity: order.quantity, avgBuyPrice: unitPrice });
          }
          fills.push({ commodityId: order.commodityId, side: "BUY", quantity: order.quantity, unitPrice, total });
        } else {
          const existing = cargoMap.get(order.commodityId);
          if (!existing || existing.quantity < order.quantity) throw new GameError("STOCK_INSUFFICIENT");
          const unitPrice = effectiveSellPrice(market.price, share, purserBonus);
          const total = unitPrice * order.quantity;

          gold += total;
          totalTradeValue += total;
          market.stock += order.quantity;
          existing.quantity -= order.quantity;
          if (existing.quantity === 0) cargoMap.delete(order.commodityId);
          fills.push({ commodityId: order.commodityId, side: "SELL", quantity: order.quantity, unitPrice, total });
        }

        // 同批訂單內，價格立即依新庫存重算，避免單批多筆吃到同一價（docs/05 §2）
        market.price = computeMarketPrice({
          basePrice: commodity.basePrice,
          stock: market.stock,
          baseStock: market.baseStock,
          category: commodity.category,
        });
      }

      // ── 持久化 ──
      for (const market of marketByCommodity.values()) {
        await tx.marketStock.update({
          where: { id: market.id },
          data: { stock: market.stock, price: market.price },
        });
      }
      for (const commodityId of new Set([
        ...ship.cargo.map((c) => c.commodityId),
        ...cargoMap.keys(),
      ])) {
        const line = cargoMap.get(commodityId);
        if (!line) {
          await tx.cargoSlot.deleteMany({ where: { shipId: ship.id, commodityId } });
        } else {
          await tx.cargoSlot.upsert({
            where: { shipId_commodityId: { shipId: ship.id, commodityId } },
            create: { shipId: ship.id, commodityId, quantity: line.quantity, avgBuyPrice: line.avgBuyPrice },
            update: { quantity: line.quantity, avgBuyPrice: line.avgBuyPrice },
          });
        }
      }
      await tx.guild.update({ where: { id: guild.id }, data: { gold: BigInt(gold) } });

      if (totalTradeValue > 0) {
        const goodwillDelta = goodwillFromTrade(totalTradeValue, share);
        await tx.portInfluence.upsert({
          where: { portStateId_guildId: { portStateId: portState.id, guildId: guild.id } },
          create: { portStateId: portState.id, guildId: guild.id, share: 0, goodwill: goodwillDelta },
          update: { goodwill: { increment: goodwillDelta } },
        });
        await awardExpToFleetOfficers(tx, fleet.id, BALANCE.OFFICER_EXP_PER_TRADE);
      }

      return { fills, goldRemaining: gold };
    });
  }
}
