import type { Metadata } from "next";
import "./globals.css";
import { RuntimeMonitor } from "./RuntimeMonitor";
import { GameErrorBoundary } from "./GameErrorBoundary";

export const metadata: Metadata = {
  title: "蒼瀾航路：晨汐紀事",
  description: "Azure Voyage RPG — 敘事探索原型（P1/P2 垂直切片）",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <RuntimeMonitor />
        <GameErrorBoundary>{children}</GameErrorBoundary>
      </body>
    </html>
  );
}
