#!/usr/bin/env node
/**
 * M16 生圖管線（docs/11 §3 API 模式）：讀 manifest.mjs → 呼叫 Google Generative Language
 * API（Imagen `:predict` 或 Gemini 原生圖片輸出 `:generateContent`，動態探測可用模型，
 * 不寫死型號）→ sharp 轉 webp 並縮放到目標尺寸 → 寫入 apps/web/public/art/<category>/<id>.webp。
 *
 * 用法：
 *   GEMINI_API_KEY=xxx node generate.mjs              # 產生 manifest 全部項目
 *   GEMINI_API_KEY=xxx node generate.mjs --only=ship  # 只做某 category
 *   GEMINI_API_KEY=xxx node generate.mjs --id=sera    # 只做某一筆（id 精確比對）
 *   node generate.mjs --dry-run                       # 不呼叫 API，只列出將產生的項目
 *
 * ⚠️ 不要把 API key 寫進任何檔案——一律用環境變數，用完即丟。
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { MANIFEST, NEGATIVE_PROMPT } from "./manifest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.resolve(__dirname, "../../apps/web/public/art");
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyCategory = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);
const onlyId = args.find((a) => a.startsWith("--id="))?.slice("--id=".length);

function selectEntries() {
  return MANIFEST.filter((e) => (!onlyCategory || e.category === onlyCategory) && (!onlyId || e.id === onlyId));
}

async function listModels(apiKey) {
  const res = await fetch(`${API_BASE}/models?pageSize=100&key=${apiKey}`);
  if (!res.ok) {
    throw new Error(`list models failed: HTTP ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return body.models ?? [];
}

/**
 * 動態挑模型：優先支援圖片輸出的 Gemini（:generateContent）——Imagen 的 :predict
 * 目前只開放付費方案（實測 HTTP 400 "Imagen 3 is only available on paid plans"），
 * 免費 API key 一律走不到。非 preview 的穩定型號優先，避免 preview 配額/穩定性問題。
 */
function pickModel(models) {
  const byName = (name) => models.find((m) => m.name === `models/${name}`);
  const preferredGemini = [
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-lite-image",
    "gemini-3-pro-image",
    "gemini-3.1-flash-image",
  ];
  for (const name of preferredGemini) {
    const m = byName(name);
    if (m) return { name: m.name, kind: "gemini" };
  }

  const geminiImage = models.find(
    (m) => /image/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes("generateContent"),
  );
  if (geminiImage) return { name: geminiImage.name, kind: "gemini" };

  const imagen = models.find(
    (m) => /imagen/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes("predict"),
  );
  if (imagen) return { name: imagen.name, kind: "imagen" };

  throw new Error("no image-capable model found in this API key's model list");
}

async function callImagen(apiKey, modelName, prompt) {
  // 注意：目前 Imagen 版本已不接受 parameters.negativePrompt（HTTP 400
  // INVALID_ARGUMENT: "Setting negativePrompt is no longer supported."）——
  // 改把負面提示併進 prompt 文字本身，跟 Gemini 路徑一致的做法。
  const res = await fetch(`${API_BASE}/${modelName}:predict?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt: `${prompt}. Avoid: ${NEGATIVE_PROMPT}.` }],
      parameters: { sampleCount: 1 },
    }),
  });
  if (!res.ok) throw new Error(`imagen predict failed: HTTP ${res.status} ${await res.text()}`);
  const body = await res.json();
  const b64 = body.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error(`imagen predict: no image bytes in response: ${JSON.stringify(body).slice(0, 300)}`);
  return Buffer.from(b64, "base64");
}

async function callGeminiImage(apiKey, modelName, prompt) {
  const res = await fetch(`${API_BASE}/${modelName}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}\n\nAvoid: ${NEGATIVE_PROMPT}` }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });
  if (!res.ok) throw new Error(`gemini generateContent failed: HTTP ${res.status} ${await res.text()}`);
  const body = await res.json();
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart) throw new Error(`gemini generateContent: no image part in response: ${JSON.stringify(body).slice(0, 300)}`);
  return Buffer.from(imagePart.inlineData.data, "base64");
}

async function generateOne(apiKey, model, entry, attempt = 1) {
  try {
    const buf =
      model.kind === "imagen"
        ? await callImagen(apiKey, model.name, entry.prompt)
        : await callGeminiImage(apiKey, model.name, entry.prompt);
    return buf;
  } catch (err) {
    if (attempt < 3 && /HTTP (429|5\d\d)/.test(String(err.message))) {
      const delay = attempt * 2000;
      console.warn(`  retry ${entry.category}/${entry.id} after ${delay}ms (${err.message.slice(0, 120)})`);
      await new Promise((r) => setTimeout(r, delay));
      return generateOne(apiKey, model, entry, attempt + 1);
    }
    throw err;
  }
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("missing GEMINI_API_KEY env var. Usage: GEMINI_API_KEY=xxx node generate.mjs");
    process.exitCode = 1;
    return;
  }

  const models = await listModels(apiKey);
  const model = pickModel(models);
  console.log(`using model: ${model.name} (${model.kind})`);

  const failures = [];
  for (const entry of entries) {
    const outDir = path.join(OUT_ROOT, entry.category);
    const outPath = path.join(outDir, `${entry.id}.webp`);
    try {
      console.log(`generating ${entry.category}/${entry.id} ...`);
      const raw = await generateOne(apiKey, model, entry);
      const webp = await sharp(raw)
        .resize(entry.width, entry.height, { fit: "cover" })
        .webp({ quality: 88 })
        .toBuffer();
      await mkdir(outDir, { recursive: true });
      await writeFile(outPath, webp);
      console.log(`  wrote ${path.relative(OUT_ROOT, outPath)}`);
      await new Promise((r) => setTimeout(r, 1500)); // 溫和節流，避免打爆 rate limit
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
