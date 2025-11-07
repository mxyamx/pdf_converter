import { Buffer } from "node:buffer";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import heicDecode from "heic-decode";
import { PNG } from "pngjs";

export const config = {
  path: "/convert" 
};

export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file) {
      return new Response(JSON.stringify({ error: "No file" }), { status: 400 });
    }

    const name = file.name || "image";
    const ext = (name.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    const supported = new Set([".png", ".jpg", ".jpeg", ".heic", ".heif"]);
    if (!supported.has(ext)) {
      return new Response(JSON.stringify({ error: `Unsupported: ${ext}` }), { status: 415 });
    }

    const html = await renderHTMLForImage(buf, ext);

    const exePath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: exePath,
      headless: chromium.headless,
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
        "Content-Disposition": `attachment; filename="${outName}"`
      }
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Conversion failed", details: String(e.message || e) }),
      { status: 500 }
    );
  }
};

// ---- helpers ----
async function renderHTMLForImage(buf, ext) {
  const dataUrl = await toDataURL(buf, ext);
  return `<!doctype html><html><head><meta charset="utf-8">
    <style>
      html,body{margin:0;height:100%}
      .wrap{display:flex;align-items:center;justify-content:center;height:100%}
      img{max-width:100%;max-height:100%;object-fit:contain}
    </style>
  </head><body>
    <div class="wrap"><img src="${dataUrl}" /></div>
  </body></html>`;
}

async function toDataURL(buf, ext) {
  if (ext === ".heic" || ext === ".heif") {
    const pngBuf = await heicToPng(buf);
    return `data:image/png;base64,${pngBuf.toString("base64")}`;
  }
  const mime =
    ext === ".png"  ? "image/png"  :
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
    "application/octet-stream";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function heicToPng(heicBuffer) {
  const { width, height, data } = await heicDecode({ buffer: heicBuffer }); // RGBA
  const png = new PNG({ width, height });
  png.data = Buffer.from(data);
  return PNG.sync.write(png);
}
