import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-8 text-center">
      <div>
        <h1 className="text-5xl font-bold tracking-wide text-foam">蒼瀾航路</h1>
        <p className="mt-2 text-lg text-slate-300">Azure Voyage</p>
      </div>
      <p className="max-w-xl text-slate-300">
        羅盤初成、星圖未全的時代——率領你的艦隊駛入蒼瀾海域：
        低買高賣、結交航海士、爭奪各港的商業影響力，成為七海的無冕之王。
      </p>
      <div className="flex gap-4">
        <Link href="/register" className="btn">
          建立帳號啟航
        </Link>
        <Link href="/login" className="btn-ghost">
          登入
        </Link>
      </div>
      <p className="text-xs text-slate-500">貿易 · 海戰 · 探索 · 商會外交，一段完整可玩的航海生涯</p>
    </main>
  );
}
