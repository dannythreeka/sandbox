#!/usr/bin/env node
/**
 * M16 生圖管線（Pollinations.ai 備援路徑）：跟 generate.mjs 共用同一份
 * manifest.mjs 訂單表，但改打 Pollinations 的圖片 API。
 *
 * ⚠️ 這支腳本必須在「本機」（不是這個 sandbox）執行——sandbox 的網路政策
 * 直接擋掉 pollinations.ai（proxy CONNECT 就回 403），不是程式或 key 的問題。
 *
 * 用法（在你自己的機器上，clone 這個 repo 之後）：
 *   cd tools/artgen
 *   pnpm install                     # 裝 sharp（webp 轉檔用）
 *   POLLINATIONS_API_KEY=xxx node generate-pollinations.mjs --dry-run
 *   POLLINATIONS_API_KEY=xxx node generate-pollinations.mjs
 *   POLLINATIONS_API_KEY=xxx node generate-pollinations.mjs --only=ship
 *   POLLINATIONS_API_KEY=xxx node generate-pollinations.mjs --id=sera
 *   POLLINATIONS_API_KEY=xxx node generate-pollinations.mjs --skip-existing  # 只補缺的檔案
 *
 * 產出直接寫進 ../../apps/web/public/art/<category>/<id>.webp（相對這支腳本的
 * 位置算），跑完把整個 apps/web/public/art/ 目錄的變更 commit/push 回來，
 * 或直接把資料夾傳回來給我整理入庫都可以。
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { MANIFEST } from "./manifest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.resolve(__dirname, "../../apps/web/public/art");
const API_BASE = "https://image.pollinations.ai/prompt";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipExisting = args.includes("--skip-existing");
const onlyCategory = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);
const onlyId = args.find((a) => a.startsWith("--id="))?.slice("--id=".length);

function selectEntries() {
  return MANIFEST.filter(
    (e) =>
      (!onlyCategory || e.category === onlyCategory) &&
      (!onlyId || e.id === onlyId) &&
      (!skipExisting || !existsSync(path.join(OUT_ROOT, e.category, `${e.id}.webp`))),
  );
}

/**
 * Pollinations 的圖片端點是 GET /prompt/<url-encoded prompt>，直接回傳圖片 bytes。
 * 認證機制官方文件近期有變動過，這裡兩種都送，兼容兩種版本：
 *   1. Authorization: Bearer <key> header
 *   2. ?token=<key> query 參數
 * 如果兩種都失效，去 https://pollinations.ai 官方文件確認當前正確的認證方式。
 */
async function callPollinations(apiKey, entry, attempt = 1) {
  const url = new URL(`${API_BASE}/${encodeURIComponent(entry.prompt)}`);
  url.searchParams.set("width", String(entry.width));
  url.searchParams.set("height", String(entry.height));
  url.searchParams.set("nologo", "true");
  url.searchParams.set("model", "flux");
  url.searchParams.set("seed", String(hashSeed(entry.category + entry.id)));
  url.searchParams.set("token", apiKey);

  const res = await fetch(url, {
    headers: { authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const msg = `pollinations request failed: HTTP ${res.status} ${bodyText.slice(0, 300)}`;
    if (attempt < 3 && /HTTP (429|5\d\d)/.test(msg)) {
      const delay = attempt * 2000;
      console.warn(`  retry ${entry.category}/${entry.id} after ${delay}ms (${msg.slice(0, 120)})`);
      await new Promise((r) => setTimeout(r, delay));
      return callPollinations(apiKey, entry, attempt + 1);
    }
    throw new Error(msg);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** 確定性 seed：同一筆資產每次重跑都拿到同構圖，方便重試/校對。 */
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 1_000_000;
}

async function main() {
  const entries = selectEntries();
  console.log(`selected ${entries.length}/${MANIFEST.length} manifest entries`);

  if (dryRun) {
    for (const e of entries) {
      console.log(`[dry-run] ${e.category}/${e.id}.webp (${e.width}x${e.height})\n  prompt: ${e.prompt}`);
    }
    return;
  }

  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) {
    console.error("missing POLLINATIONS_API_KEY env var. Usage: POLLINATIONS_API_KEY=xxx node generate-pollinations.mjs");
    process.exitCode = 1;
    return;
  }

  const failures = [];
  for (const entry of entries) {
    const outDir = path.join(OUT_ROOT, entry.category);
    const outPath = path.join(outDir, `${entry.id}.webp`);
    try {
      console.log(`generating ${entry.category}/${entry.id} ...`);
      const raw = await callPollinations(apiKey, entry);
      const webp = await sharp(raw)
        .resize(entry.width, entry.height, { fit: "cover" })
        .webp({ quality: 88 })
        .toBuffer();
      await mkdir(outDir, { recursive: true });
      await writeFile(outPath, webp);
      console.log(`  wrote ${path.relative(OUT_ROOT, outPath)}`);
      await new Promise((r) => setTimeout(r, 1000)); // 溫和節流
    } catch (err) {
      console.error(`  FAILED ${entry.category}/${entry.id}: ${err.message}`);
      failures.push(entry);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} entries failed: ${failures.map((f) => `${f.category}/${f.id}`).join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(`\nall ${entries.length} entries generated.`);
  }
}

main();
