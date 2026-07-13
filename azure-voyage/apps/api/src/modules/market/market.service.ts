import { Injectable } from "@nestjs/common";
import {
  BALANCE,
  bestTradeRoutesFrom,
  captainTradeBonus,
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
import { awardCaptainExp } from "../officer/captain-growth.util";
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

    // M25：港口人物用「解析後」的港口 id 查——已刪除的舊港口 id 沒有對應人物。
    const notable = await this.prisma.portNotable.findUnique({
      where: { worldId_portId: { worldId, portId: port.id } },
    });

    return {
      portId,
      name: port.name,
      regionId: port.regionId,
      size: port.size,
      description: port.description,
      prosperity: portState.prosperity,
      market: portState.market.map((m) => ({
        commodityId: m.commodityId,
        stock: m.stock,
        buyPrice: effectiveBuyPrice(m.price, playerShare),
        sellPrice: effectiveSellPrice(m.price, playerShare),
        priceHistory: m.priceHistory as { t: number; p: number }[],
      })),
      notable: notable
        ? {
            id: notable.id,
            name: notable.name,
            portrait: notable.portrait,
            archetype: notable.archetype,
            persona: (notable.persona as { description: string; greeting: string } | null) ?? undefined,
          }
        : undefined,
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
   * 貿易路線建議（docs/01 §4.2、M24；M32 市場情報不完全）：以 portId 為起點，
   * 起點港讀「即時」市場真相（玩家人就站在這裡）；其餘候選港只用玩家上次實際
   * 抵達當下留下的舊情報（`PortIntel`）——從沒去過的港口沒有情報列，直接不
   * 列入候選，不再是全地圖即時全知。不含 PURSER 職位加成（那是下單時才套用
   * 的折扣，這裡單純是市場情報，維持跟 getPortDetail 一致的簡化）。
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

    const originState = await this.prisma.portState.findUnique({
      where: { worldId_portId: { worldId, portId } },
      include: { market: true, influences: true },
    });
    if (!originState) throw new GameError("NOT_FOUND");
    const originPort = portById(originState.portId);
    const originShare = Number(originState.influences.find((i) => i.guildId === playerGuild.id)?.share ?? 0);
    const origin: PortMarketSnapshot = {
      portId: originState.portId,
      portName: originPort.name,
      coord: originPort.coord,
      listings: originState.market.map((m) => ({
        commodityId: m.commodityId,
        buyPrice: effectiveBuyPrice(m.price, originShare),
        sellPrice: effectiveSellPrice(m.price, originShare),
      })),
    };

    // 只取現行 15 港（排除 M21 刪除後留下的孤兒 PortIntel，見 docs/13 §2）
    const intelRows = await this.prisma.portIntel.findMany({
      where: { worldId, portId: { in: PORT_IDS.filter((id) => id !== portId) } },
    });
    const candidates: PortMarketSnapshot[] = intelRows.map((intel) => {
      const port = portById(intel.portId);
      return {
        portId: intel.portId,
        portName: port.name,
        coord: port.coord,
        listings: intel.market as { commodityId: string; buyPrice: number; sellPrice: number }[],
        intelAgeTicks: world.currentTick - intel.lastVisitedTick,
      };
    });

    return bestTradeRoutesFrom(origin, [origin, ...candidates], limit);
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
      // 會計長（PURSER）＋提督商才（M27）：買賣折扣加成，與影響力折扣疊加
      const purser = fleet.officers.find((o) => o.role === "PURSER");
      const purserBonus =
        purserTradeBonus((purser?.stats as unknown as OfficerStats | undefined)?.trade) +
        captainTradeBonus(guild.captainTrade);

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
        await awardCaptainExp(tx, guild.id, BALANCE.CAPTAIN_EXP_PER_TRADE);
      }

      return { fills, goldRemaining: gold };
    });
  }
}
