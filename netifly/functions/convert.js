import { Buffer } from "node:buffer";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import heicDecode from "heic-decode";
import { PNG } from "pngjs";

export const config = { path: "/convert" };

export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file) {
      return jsonError(400, "No file provided");
    }

    const name = file.name || "image";
    const ext = (name.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    const supported = new Set([".png", ".jpg", ".jpeg", ".heic", ".heif"]);
    if (!supported.has(ext)) {
      return jsonError(415, `Unsupported file type: ${ext}`);
    }

    const html = await renderHTML(buf, ext);

    const exePath = (await chromium.executablePath()) || "/usr/bin/chromium";
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: exePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    const outName = name.replace(/\.[^.]+$/, "") + ".pdf";

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${outName}"`,
      },
    });
  } catch (e) {
    console.error("CONVERT ERROR:", e);
    return jsonError(500, "Conversion failed", e);
  }
};

// ---------- helpers ----------
function jsonError(status, msg, e) {
  return new Response(
    JSON.stringify({ error: msg, details: e?.message || String(e || "") }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

async function renderHTML(buf, ext) {
  const dataUrl = await toDataURL(buf, ext);
  return `<!doctype html><html><head><meta charset="utf-8">
  <style>
    html,body{margin:0;height:100%}
    .wrap{display:flex;align-items:center;justify-content:center;height:100%}
    img{max-width:100%;max-height:100%;object-fit:contain}
  </style></head><body>
  <div class="wrap"><img src="${dataUrl}" /></div>
  </body></html>`;
}

async function toDataURL(buf, ext) {
  if (ext === ".heic" || ext === ".heif") {
    const pngBuf = await heicToPng(buf);
    return `data:image/png;base64,${pngBuf.toString("base64")}`;
  }
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : "application/octet-stream";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function heicToPng(buffer) {
  const { width, height, data } = await heicDecode({ buffer });
  const png = new PNG({ width, height });
  png.data = Buffer.from(data);
  return PNG.sync.write(png);
}
