// converters.js
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";
import heicDecode from "heic-decode";
import { PNG } from "pngjs";

export async function convertImageToPdf(inputPath, outputPath) {
  const dataUrl = await dataUrlFor(inputPath);

  const browser = await puppeteer.launch({
    headless: true,                              // ← add this
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
