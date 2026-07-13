"use client";

import { useEffect, useState } from "react";
import type { PortNotableView } from "@azure-voyage/shared";
import { api, ApiError } from "@/lib/api";
import { DialoguePanel } from "./DialoguePanel";
import { GameArt } from "./GameArt";

interface Props {
  worldId: string;
  portId: string;
}

const ARCHETYPE_LABELS: Record<string, string> = {
  HARBORMASTER: "港務總管",
  FUR_TRADER: "毛皮商",
  GUILD_ELDER: "商會元老",
  OLD_FISHERMAN: "老漁夫",
  BLACKSMITH: "鐵匠工頭",
  SILK_MERCHANT: "絲織商人",
  RETIRED_PRIVATEER: "退役私掠船長",
  PEARL_MERCHANT: "珍珠商",
  DIVER_ELDER: "潛水人長老",
  CARTOGRAPHER: "製圖師",
  HERMIT_ASTRONOMER: "隱居占星師",
};

/** 港口人物（docs/01 §1；M25）：一港一位原創人物，可對話。 */
export function PortNotablePanel({ worldId, portId }: Props) {
  const [notable, setNotable] = useState<PortNotableView | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [dialogueOpen, setDialogueOpen] = useState(false);

  useEffect(() => {
    setNotable(undefined);
    api
      .getPort(worldId, portId)
      .then((detail) => setNotable(detail.notable ?? null))
      .catch((err) => setError(err instanceof ApiError ? err.message : "載入港口人物失敗"));
  }, [worldId, portId]);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (notable === undefined) return null;
  if (notable === null) return null;

  return (
    <div className="flex items-center gap-3 rounded-md border border-foam/20 p-2 text-sm">
      <GameArt
        category="portrait"
        id={notable.portrait.replace(/^portrait\./, "")}
        alt={notable.name}
        className="h-12 w-10 shrink-0 rounded border border-gold/40 object-cover"
        fallback={
          <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded border border-gold/40 bg-abyss font-serif text-lg text-gold">
            {notable.name.charAt(0)}
          </span>
        }
      />
      <span className="flex-1">
        <span className="text-foam">{notable.name}</span>
        <span className="ml-1 text-xs text-slate-400">· {ARCHETYPE_LABELS[notable.archetype] ?? notable.archetype}</span>
        {notable.persona && <span className="block text-xs text-foam/60">{notable.persona.description}</span>}
      </span>
      <button className="btn-ghost" onClick={() => setDialogueOpen(true)}>
        對話
      </button>
      {dialogueOpen && (
        <DialoguePanel
          worldId={worldId}
          targetType="PORT_NOTABLE"
          targetId={notable.id}
          targetName={notable.name}
          onClose={() => setDialogueOpen(false)}
        />
      )}
    </div>
  );
}
