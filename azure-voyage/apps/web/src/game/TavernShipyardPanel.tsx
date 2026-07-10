"use client";

import { useEffect, useState } from "react";
import { OFFICER_ROLES, SHIP_CLASSES, type FleetView, type TavernOfficerView } from "@azure-voyage/shared";
import { officerApi } from "@/lib/officerApi";
import { DialoguePanel } from "./DialoguePanel";
import { GameArt } from "./GameArt";

const ROLE_LABELS: Record<string, string> = {
  FIRST_MATE: "副官",
  NAVIGATOR: "航海長",
  GUNNER: "炮術長",
  PURSER: "會計長",
  LOOKOUT: "瞭望員",
};

/** 航海士立繪縮圖：有 `art/portrait/<key>.webp` 就顯示，否則首字暖金頭像框（M15）。 */
function OfficerAvatar({ portrait, name }: { portrait: string; name: string }) {
  return (
    <GameArt
      category="portrait"
      id={portrait.replace(/^portrait\./, "")}
      alt={name}
      className="h-12 w-10 shrink-0 rounded border border-gold/40 object-cover"
      fallback={
        <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded border border-gold/40 bg-abyss font-serif text-lg text-gold">
          {name.charAt(0)}
        </span>
      }
    />
  );
}

/** 船級縮圖：有 `art/ship/<classId>.webp` 就顯示，否則錨形指標佔位（M16）。 */
function ShipClassThumb({ shipClassId, name }: { shipClassId: string; name: string }) {
  return (
    <GameArt
      category="ship"
      id={shipClassId.replace(/^ship\./, "")}
      alt={name}
      className="h-12 w-16 shrink-0 rounded border border-gold/40 object-cover"
      fallback={
        <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded border border-gold/40 bg-abyss text-lg text-gold">
          ⚓
        </span>
      }
    />
  );
}

interface Props {
  worldId: string;
  portId: string;
  fleet: FleetView;
  onChanged: () => void;
}

/** 酒館與造船廠合併面板（M4；docs/07 §4 port scene 的簡化版）。 */
export function TavernShipyardPanel({ worldId, portId, fleet, onChanged }: Props) {
  const [tavern, setTavern] = useState<TavernOfficerView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shipName, setShipName] = useState("");
  const [shipClassId, setShipClassId] = useState(SHIP_CLASSES[0].id);
  const [dialogueTarget, setDialogueTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    officerApi
      .getTavern(worldId, portId)
      .then(setTavern)
      .catch((e) => setError(e.message));
  }, [worldId, portId]);

  async function recruit(officerId: string) {
    setError(null);
    try {
      await officerApi.recruit(worldId, portId, fleet.id, officerId);
      setTavern((prev) => prev?.filter((o) => o.id !== officerId) ?? null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "招募失敗");
    }
  }

  async function assignRole(officerId: string, role: string) {
    setError(null);
    try {
      await officerApi.assignRole(worldId, fleet.id, officerId, role || null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "指派職位失敗");
    }
  }

  async function build() {
    setError(null);
    try {
      await officerApi.build(worldId, portId, { fleetId: fleet.id, shipClassId, name: shipName || "新船" });
      setShipName("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "建造失敗");
    }
  }

  async function repair(shipId?: string) {
    setError(null);
    try {
      await officerApi.repair(worldId, portId, { fleetId: fleet.id, shipId });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "修理失敗");
    }
  }

  async function sell(shipId: string) {
    setError(null);
    try {
      await officerApi.sell(worldId, portId, { fleetId: fleet.id, shipId });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "賣船失敗");
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {error && <p className="text-sm text-red-400 md:col-span-2">{error}</p>}

      <div>
        <h3 className="mb-2 text-lg font-semibold text-foam">酒館</h3>
        {tavern === null ? (
          <p className="text-slate-400">載入中…</p>
        ) : tavern.length === 0 ? (
          <p className="text-slate-400">目前沒有待業航海士。</p>
        ) : (
          <ul className="space-y-2">
            {tavern.map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-3 rounded-md border border-foam/20 p-2 text-sm"
                title={o.persona?.greeting}
              >
                <OfficerAvatar portrait={o.portrait} name={o.name} />
                <span className="flex-1">
                  <span className="font-serif text-base text-slate-100">{o.name}</span>
                  <br />
                  統率{o.stats.lead} 航海{o.stats.nav} 戰鬥{o.stats.combat} 商才{o.stats.trade} 學識
                  {o.stats.lore} · 薪 {o.salary}
                  {o.persona && <span className="block text-xs text-foam/60">{o.persona.description}</span>}
                </span>
                <button className="btn-ghost" onClick={() => setDialogueTarget({ id: o.id, name: o.name })}>
                  對話
                </button>
                <button className="btn-ghost" onClick={() => recruit(o.id)}>
                  招募
                </button>
              </li>
            ))}
          </ul>
        )}

        <h4 className="mb-2 mt-4 font-medium text-slate-200">艦隊航海士</h4>
        <ul className="space-y-2">
          {fleet.officers.map((o) => (
            <li
              key={o.id}
              className="flex items-center gap-3 rounded-md border border-foam/20 p-2 text-sm"
              title={o.persona?.greeting}
            >
              <OfficerAvatar portrait={o.portrait} name={o.name} />
              <span className="flex-1">
                {o.name}（忠誠 {o.loyalty}）
                {o.persona && <span className="block text-xs text-foam/60">{o.persona.description}</span>}
              </span>
              <button className="btn-ghost" onClick={() => setDialogueTarget({ id: o.id, name: o.name })}>
                對話
              </button>
              <select
                className="input w-32 py-1"
                value={o.role ?? ""}
                onChange={(e) => assignRole(o.id, e.target.value)}
              >
                <option value="">未指派</option>
                {OFFICER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-lg font-semibold text-foam">造船廠</h3>
        <ul className="mb-4 space-y-2">
          {fleet.ships.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-md border border-foam/20 p-2 text-sm">
              <ShipClassThumb shipClassId={s.shipClassId} name={s.name} />
              <span className="flex-1">
                {s.isFlagship ? "⚓ " : ""}
                {s.name} · 耐久 {s.hull}
              </span>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => repair(s.id)}>
                  修理
                </button>
                <button className="btn-ghost" onClick={() => sell(s.id)}>
                  賣船
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <ShipClassThumb
            shipClassId={shipClassId}
            name={SHIP_CLASSES.find((sc) => sc.id === shipClassId)?.name ?? shipClassId}
          />
          <select className="input w-40" value={shipClassId} onChange={(e) => setShipClassId(e.target.value)}>
            {SHIP_CLASSES.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}（{sc.price.toLocaleString("zh-TW")} 金）
              </option>
            ))}
          </select>
          <input
            className="input w-32"
            placeholder="船名"
            value={shipName}
            onChange={(e) => setShipName(e.target.value)}
          />
          <button className="btn" onClick={build}>
            建造
          </button>
        </div>
      </div>
      {dialogueTarget && (
        <DialoguePanel
          worldId={worldId}
          targetType="OFFICER"
          targetId={dialogueTarget.id}
          targetName={dialogueTarget.name}
          onClose={() => setDialogueTarget(null)}
        />
      )}
    </div>
  );
}
