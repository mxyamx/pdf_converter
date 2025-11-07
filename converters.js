import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";
import heicDecode from "heic-decode";
import { PNG } from "pngjs";

/**
 * Convert a single image (jpg/jpeg/png/heic) to a 1-page A4 PDF
 * @param {string} inputPath - path to source image
 * @param {string} outputPath - path to write PDF
 */
export async function convertImageToPdf(inputPath, outputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  const allowed = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif"]);
  if (!allowed.has(ext)) {
    throw new Error(`Unsupported image format: ${ext}. Allowed: jpg, jpeg, png, heic`);
  }

  const dataUrl = await imageDataUrl(inputPath, ext);

  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    const html = `
      <!doctype html><html><head><meta charset="utf-8">
        <style>
          html,body{margin:0;height:100%}
          .wrap{display:flex;align-items:center;justify-content:center;height:100%}
          img{max-width:100%;max-height:100%;object-fit:contain}
        </style>
      </head><body>
        <div class="wrap"><img src="${dataUrl}" /></div>
      </body></html>`;
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({ path: outputPath, format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
  return outputPath;
}


async function imageDataUrl(inputPath, ext) {
  const buf = await fs.readFile(inputPath);
  if (ext === ".heic" || ext === ".heif") {
    const { width, height, data } = await heicDecode({ buffer: buf });
    const png = new PNG({ width, height });
    png.data = Buffer.from(data); // RGBA
    const pngBuf = PNG.sync.write(png);
    return `data:image/png;base64,${pngBuf.toString("base64")}`;
  }
  const mime =
    ext === ".png" ? "image/png" :
    (ext === ".jpg" || ext === ".jpeg") ? "image/jpeg" :
    "application/octet-stream";
  return `data:${mime};base64,${buf.toString("base64")}`;
}


export async function convertWithLibreOffice() {
  throw new Error("Office formats are disabled. Only jpg/jpeg/png/heic supported.");
}
export async function convertHtmlFileToPdf() {
  throw new Error("HTML→PDF disabled. Only jpg/jpeg/png/heic supported.");
}
export async function convertTxtToPdf() {
  throw new Error("TXT→PDF disabled. Only jpg/jpeg/png/heic supported.");
}
export async function convertMdToPdf() {
  throw new Error("MD→PDF disabled. Only jpg/jpeg/png/heic supported.");
}
