import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const UPLOAD_DIR = path.join(__dirname, "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

const upload = multer({ dest: UPLOAD_DIR });

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", args, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve({ stdout, stderr });
    });
  });
}

function cleanupFile(filepath) {
  try {
    fs.unlinkSync(filepath);
  } catch {}
}

app.post("/session", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY on server" });
    }

    console.log("Creating OpenAI Realtime session...");

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "ballad",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI Error:", response.status, data);
      return res.status(response.status).json(data);
    }

    console.log("Session created successfully");
    res.json(data);
  } catch (e) {
    console.error("Session error:", e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.post("/convert", upload.array("files"), async (req, res) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const outputs = [];

    for (const file of req.files) {
      const inputPath = file.path;
      const baseName = path.parse(file.originalname).name.replace(/[^a-z0-9-_]/gi, "_");
      const outputPath = path.join(UPLOAD_DIR, `${baseName}_${Date.now()}.wav`);

      await runFfmpeg([
        "-y",
        "-i", inputPath,
        "-acodec", "pcm_s16le",
        "-ar", "44100",
        outputPath,
      ]);

      const wavBuffer = fs.readFileSync(outputPath);

      outputs.push({
        original: file.originalname,
        wav_name: path.basename(outputPath),
        wav_base64: wavBuffer.toString("base64"),
        mime: "audio/wav",
      });

      cleanupFile(inputPath);
      cleanupFile(outputPath);
    }

    res.json({ files: outputs });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    hasApiKey: !!OPENAI_API_KEY,
  });
});

app.listen(PORT, () => {
  console.log(`\n🎛️  Voice Mixing Coach Backend`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   API Key: ${OPENAI_API_KEY ? "✓ Configured" : "✗ Missing"}\n`);
});
