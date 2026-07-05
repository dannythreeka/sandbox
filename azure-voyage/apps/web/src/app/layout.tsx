import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "蒼瀾航路 Azure Voyage",
  description: "原創航海貿易策略遊戲——在蒼瀾海域經商、探索、爭奪商業霸權。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <div className="mx-auto min-h-screen max-w-5xl px-4 py-8">{children}</div>
      </body>
    </html>
  );
}
