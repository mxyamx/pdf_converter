import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import tmp from "tmp";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import { convertImageToPdf } from "./converters.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", true);

app.use(cors({
  origin: true,
  methods: ["POST", "GET", "OPTIONS"],
}));

const uploadsDir = path.join(__dirname, "uploads");
await fs.mkdir(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 30 * 1024 * 1024 },
});

app.get("/health", (_, res) => res.json({ ok: true }));

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif"]);

app.post("/convert", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const tempPath = req.file.path;
  const originalName = req.file.originalname || "image";
  const ext = path.extname(originalName).toLowerCase();

  if (!IMAGE_EXT.has(ext)) {
    await fs.unlink(tempPath).catch(() => {});
    return res.status(415).json({ error: `Unsupported file type: ${ext}` });
  }


  const inputPath = `${tempPath}${ext}`;
  await fs.rename(tempPath, inputPath).catch(async () => {
    await fs.copyFile(tempPath, inputPath);
    await fs.unlink(tempPath).catch(() => {});
  });

  const outDir = tmp.dirSync({ unsafeCleanup: true }).name;
  const outPath = path.join(outDir, `${uuidv4()}.pdf`);

  try {
    const pdfPath = await convertImageToPdf(inputPath, outPath);
    const filename = path.parse(originalName).name + ".pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.sendFile(pdfPath);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Conversion failed", details: String(e.message || e) });
  } finally {
    await fs.unlink(inputPath).catch(() => {});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API en ligne sur port ${PORT}`));
