import type { ReactNode } from "react";
import { GameArt } from "@/game/GameArt";

/** 登入/註冊頁共用主視覺（M17；docs/11 §2 F）：缺圖時走漸層裝飾 fallback，不擋玩。 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="relative mx-auto mt-8 h-40 w-full max-w-3xl overflow-hidden rounded-lg border border-gold/30 sm:h-56">
        <GameArt
          category="key-visual"
          id="title"
          alt="蒼瀾航路"
          className="h-full w-full object-cover"
          fallback={
            <div
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(ellipse at 30% -10%, rgba(217,164,65,0.25), transparent 55%), " +
                  "linear-gradient(160deg, #12283f, #08111f 70%)",
              }}
            />
          }
        />
        <div className="absolute inset-0 bg-gradient-to-t from-abyss/90 via-transparent to-transparent" />
      </div>
      {children}
    </div>
  );
}
