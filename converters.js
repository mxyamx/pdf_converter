import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";
import heicDecode from "heic-decode";
import { PNG } from "pngjs";

export async function convertImageToPdf(inputPath, outputPath) {
  const dataUrl = await dataUrlFor(inputPath);

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"], 
  });
  const page = await browser.newPage();

  const html = `<!doctype html><meta charset="utf-8">
  <style>html,body{margin:0;height:100%}.wrap{display:flex;align-items:center;justify-content:center;height:100%}
  img{max-width:100%;max-height:100%;object-fit:contain}</style>
  <div class="wrap"><img src="${dataUrl}" /></div>`;

  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.pdf({ path: outputPath, format: "A4", printBackground: true });
  await browser.close();
  return outputPath;
}

async function dataUrlFor(inputPath) {
  const buf = await fs.readFile(inputPath);
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === ".heic" || ext === ".heif") {
    const pngBuf = await heicToPng(buf);
    return `data:image/png;base64,${pngBuf.toString("base64")}`;
  }
  const mime = ext === ".png" ? "image/png" :
               (ext === ".jpg" || ext === ".jpeg") ? "image/jpeg" :
               "application/octet-stream";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function heicToPng(heicBuffer) {
  const { width, height, data } = await heicDecode({ buffer: heicBuffer });
  const png = new PNG({ width, height });
  png.data = Buffer.from(data);
  return PNG.sync.write(png);
}
