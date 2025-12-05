import { useMemo, useRef, useState } from "react";

const COACH_CONSTITUTION = `
You are my real-time mixing coach. Be natural, conversational, and helpful—like a great engineer in the room.

Voice / vibe:
- Sound human. Use casual filler words sometimes ("okay", "alright", "yo", "hmm", "let's see").
- Light swearing is allowed: "damn", "shit", "ass", "hell".
- Never use the f-word.
- Keep it concise, but not robotic.

How to coach:
- Maintain an INTERNAL checklist of problems you hear/expect from the analysis + what the user said. Don't always show the whole list.
- Be dynamic: the user may fix things without telling you. Ask quick check-ins like: "What changed on your end?" or "Did you touch anything just now?"
- Don't spam a giant list. Give 1–2 high-impact moves max at a time.
- After each move, ask a short question and adapt based on what the user reports.
- If the user says something creative ("chorus feels small"), respond creatively AND translate into concrete DAW actions.

When analysis is provided:
- Ask ONE question at a time.
- First ask for reference track / target vibe.
- Then ask the main complaint.
- Then propose the first priority fix and iterate.
`;

function sendEvent(dc, obj) {
  if (!dc || dc.readyState !== "open") return false;
  dc.send(JSON.stringify(obj));
  return true;
}

function isAiff(name = "", type = "") {
  const n = name.toLowerCase();
  return n.endsWith(".aif") || n.endsWith(".aiff") || type === "audio/aiff";
}

function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function decodeAudioArrayBuffer(arrayBuffer) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const audio = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close();
  return audio;
}

async function decodeAudioFile(file) {
  const buf = await file.arrayBuffer();
  return decodeAudioArrayBuffer(buf);
}

function toMono(audioBuffer) {
  const { numberOfChannels, length } = audioBuffer;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i] / numberOfChannels;
  }
  return mono;
}

function guessRole(filename = "") {
  const n = filename.toLowerCase();

  const vocalHit =
    n.includes("vocal") ||
    n.includes("vox") ||
    n.includes("leadvox") ||
    n.includes("voxlead") ||
    n.includes("bgv") ||
    n.includes("bvg") ||
    n.includes("harmony") ||
    n.includes("harm") ||
    n.includes("adlib") ||
    n.includes("ad-lib") ||
    n.includes("dbl") ||
    n.includes("double") ||
    n.includes("stack") ||
    n.includes("choir") ||
    n.includes("chorusvox") ||
    n.includes("hookvox");

  if (vocalHit) {
    if (n.includes("bgv") || n.includes("bvg") || n.includes("harmony") || n.includes("harm") || n.includes("choir"))
      return "vocals_bgv";
    if (n.includes("adlib") || n.includes("ad-lib")) return "vocals_adlibs";
    if (n.includes("dbl") || n.includes("double") || n.includes("stack")) return "vocals_doubles";
    if (n.includes("lead") || n.includes("main")) return "vocals_lead";
    return "vocals";
  }

  if (n.includes("kick")) return "kick";
  if (n.includes("snare")) return "snare";
  if (n.includes("hat") || n.includes("hihat") || n.includes("hi-hat")) return "hihat";
  if (n.includes("tom")) return "toms";
  if (n.includes("clap")) return "clap";
  if (n.includes("perc")) return "percussion";
  if (n.includes("drum")) return "drums";
  if (n.includes("808")) return "bass_808";
  if (n.includes("bass")) return "bass";

  if (n.includes("gtr") || n.includes("guitar")) return "guitar";
  if (n.includes("piano") || n.includes("keys") || n.includes("key")) return "keys";
  if (n.includes("synth")) return "synth";
  if (n.includes("pad")) return "pad";
  if (n.includes("string") || n.includes("strings")) return "strings";
  if (n.includes("brass") || n.includes("horn")) return "brass";

  if (n.includes("fx") || n.includes("sfx") || n.includes("risr") || n.includes("riser") || n.includes("impact"))
    return "fx";

  return "unknown";
}

function analyzeMono(samples, sampleRate) {
  let peak = 0,
    sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const ax = Math.abs(x);
    if (ax > peak) peak = ax;
    sumSq += x * x;
  }
  const rms = Math.sqrt(sumSq / samples.length);
  const crest = peak / (rms || 1e-12);
  const toDb = (a) => 20 * Math.log10(Math.max(a, 1e-12));

  const fftSize = 1024;
  const hop = 2048;
  const bins = fftSize / 2;

  const bandDefs = [
    { name: "sub_20_60", lo: 20, hi: 60 },
    { name: "low_60_200", lo: 60, hi: 200 },
    { name: "lowmid_200_500", lo: 200, hi: 500 },
    { name: "mid_500_2k", lo: 500, hi: 2000 },
    { name: "highmid_2k_5k", lo: 2000, hi: 5000 },
    { name: "presence_5k_10k", lo: 5000, hi: 10000 },
    { name: "air_10k_18k", lo: 10000, hi: 18000 },
  ];

  const bandEnergy = Object.fromEntries(bandDefs.map((b) => [b.name, 0]));
  const maxSamples = Math.min(samples.length, Math.floor(sampleRate * 20));

  for (let start = 0; start + fftSize <= maxSamples; start += hop) {
    for (let k = 1; k < bins; k++) {
      const freq = (k * sampleRate) / fftSize;
      if (freq < 20 || freq > 18000) continue;

      let re = 0,
        im = 0;
      for (let n = 0; n < fftSize; n++) {
        const angle = (2 * Math.PI * k * n) / fftSize;
        const v = samples[start + n];
        re += v * Math.cos(angle);
        im -= v * Math.sin(angle);
      }
      const mag = Math.sqrt(re * re + im * im);

      for (const b of bandDefs) {
        if (freq >= b.lo && freq < b.hi) {
          bandEnergy[b.name] += mag;
          break;
        }
      }
    }
  }

  const total = Object.values(bandEnergy).reduce((a, c) => a + c, 0) || 1;
  const bandPct = Object.fromEntries(
    Object.entries(bandEnergy).map(([k, v]) => [k, +((100 * v) / total).toFixed(1)])
  );

  return {
    rms_db: +toDb(rms).toFixed(1),
    peak_db: +toDb(peak).toFixed(1),
    crest: +crest.toFixed(2),
    band_pct: bandPct,
  };
}

function summarizeSong(stems) {
  if (!stems?.length) return null;

  const bandKeys = Object.keys(stems[0]?.metrics?.band_pct || {});
  const avgBand = Object.fromEntries(bandKeys.map((k) => [k, 0]));

  for (const s of stems) {
    for (const k of bandKeys) avgBand[k] += s.metrics.band_pct[k] || 0;
  }
  for (const k of bandKeys) avgBand[k] = +(avgBand[k] / stems.length).toFixed(1);

  const byRms = [...stems].sort((a, b) => b.metrics.rms_db - a.metrics.rms_db);

  const vocalCount = stems.filter((s) => String(s.role_guess || "").startsWith("vocals")).length;

  return {
    avg_band_pct: avgBand,
    stem_count: stems.length,
    vocal_stem_count: vocalCount,
    loudest_stem: byRms[0]?.name || null,
    quietest_stem: byRms[byRms.length - 1]?.name || null,
  };
}

const styles = `
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
    min-height: 100vh;
  }

  .app {
    min-height: 100vh;
    padding: 40px 20px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e0e0e0;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
  }

  .header {
    text-align: center;
    margin-bottom: 40px;
  }

  .header h1 {
    font-size: 2.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 8px 0;
  }

  .header p {
    color: #888;
    font-size: 1rem;
    margin: 0;
  }

  .orb-container {
    display: flex;
    justify-content: center;
    margin: 30px 0;
  }

  .orb {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #667eea, #764ba2, #2d1f47);
    box-shadow: 0 0 60px rgba(102, 126, 234, 0.3);
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .orb.off {
    opacity: 0.3;
    box-shadow: 0 0 20px rgba(102, 126, 234, 0.1);
  }

  .orb.ready {
    opacity: 0.7;
    box-shadow: 0 0 40px rgba(102, 126, 234, 0.3);
    animation: breathe 3s ease-in-out infinite;
  }

  .orb.on {
    animation: pulse 2s ease-in-out infinite;
    box-shadow: 0 0 80px rgba(102, 126, 234, 0.5), 0 0 120px rgba(118, 75, 162, 0.3);
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
  }

  @keyframes breathe {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.03); opacity: 0.8; }
  }

  .status-text {
    text-align: center;
    font-size: 0.95rem;
    color: #888;
    margin-top: 12px;
    min-height: 24px;
  }

  .status-text.ready {
    color: #fbbf24;
  }

  .status-text.connected {
    color: #4ade80;
  }

  .step-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 20px;
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
  }

  .step-card.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .step-card.active {
    border-color: rgba(102, 126, 234, 0.4);
    box-shadow: 0 0 30px rgba(102, 126, 234, 0.1);
  }

  .step-card.completed {
    border-color: rgba(74, 222, 128, 0.3);
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .step-number {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.9rem;
    color: #888;
  }

  .step-card.active .step-number {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .step-card.completed .step-number {
    background: #4ade80;
    color: #0f0f1a;
  }

  .step-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #e0e0e0;
    margin: 0;
  }

  .step-description {
    color: #888;
    font-size: 0.9rem;
    margin: 0 0 16px 44px;
  }

  .step-content {
    margin-left: 44px;
  }

  .controls {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }

  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
  }

  .btn-success {
    background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
    color: #0f0f1a;
  }

  .btn-success:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(74, 222, 128, 0.4);
  }

  .btn-danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
  }

  .btn-danger:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(239, 68, 68, 0.4);
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }

  .btn-large {
    padding: 16px 32px;
    font-size: 1.1rem;
  }

  .select-wrapper {
    position: relative;
  }

  .select-wrapper select {
    appearance: none;
    padding: 12px 40px 12px 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    color: #e0e0e0;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .select-wrapper select:hover {
    border-color: rgba(102, 126, 234, 0.5);
  }

  .select-wrapper select:focus {
    outline: none;
    border-color: #667eea;
  }

  .select-wrapper::after {
    content: "▼";
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.7rem;
    color: #888;
    pointer-events: none;
  }

  .file-input-wrapper {
    position: relative;
    flex: 1;
    min-width: 200px;
  }

  .file-input-wrapper input[type="file"] {
    position: absolute;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .file-input-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px 24px;
    border: 2px dashed rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    color: #888;
    font-size: 0.95rem;
    transition: all 0.2s ease;
  }

  .file-input-wrapper:hover .file-input-label {
    border-color: rgba(102, 126, 234, 0.5);
    color: #e0e0e0;
  }

  .file-count {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .stems-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .stem-tag {
    background: rgba(102, 126, 234, 0.15);
    border: 1px solid rgba(102, 126, 234, 0.3);
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    color: #a0a0ff;
  }

  .analysis-panel {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 10px;
    padding: 16px;
    max-height: 200px;
    overflow: auto;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.75rem;
    line-height: 1.5;
    color: #a0a0a0;
    margin-top: 16px;
  }

  .log-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 24px;
    margin-top: 20px;
  }

  .log-title {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888;
    margin: 0 0 16px 0;
  }

  .log-panel {
    background: rgba(0, 0, 0, 0.4);
    border-radius: 10px;
    padding: 16px;
    max-height: 200px;
    overflow: auto;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.75rem;
    line-height: 1.6;
  }

  .log-entry {
    padding: 4px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    color: #707070;
  }

  .log-entry:last-child {
    border-bottom: none;
  }

  .log-entry.success {
    color: #4ade80;
  }

  .log-entry.error {
    color: #f87171;
  }

  .empty-state {
    text-align: center;
    padding: 20px;
    color: #555;
  }

  .session-active {
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.3);
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    margin-top: 16px;
  }

  .session-active p {
    margin: 0 0 16px 0;
    color: #4ade80;
    font-size: 1rem;
  }

  .checkmark {
    color: #4ade80;
    margin-left: 8px;
  }

  @media (max-width: 600px) {
    .header h1 {
      font-size: 1.8rem;
    }

    .orb {
      width: 100px;
      height: 100px;
    }

    .controls {
      flex-direction: column;
    }

    .btn, .select-wrapper select {
      width: 100%;
    }

    .file-input-wrapper {
      width: 100%;
    }

    .step-content, .step-description {
      margin-left: 0;
    }
  }
`;

export default function App() {
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);
  const [daw, setDaw] = useState("Logic Pro");
  const [files, setFiles] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const localStreamRef = useRef(null);
  const logPanelRef = useRef(null);

  const log = (message, type = "info") => {
    setLogs((l) => [...l, { message, type, time: new Date().toLocaleTimeString() }]);
    setTimeout(() => {
      if (logPanelRef.current) {
        logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
      }
    }, 50);
  };

  const analysisSummary = useMemo(() => {
    if (!analysis) return "";
    return JSON.stringify(analysis, null, 2);
  }, [analysis]);

  const currentStep = useMemo(() => {
    if (sessionStarted) return 4;
    if (analysis) return 3;
    if (files.length > 0) return 2;
    return 1;
  }, [files.length, analysis, sessionStarted]);

  async function connectVoice() {
    try {
      log("Requesting ephemeral key...");
      const r = await fetch("/session", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      const { client_secret } = await r.json();
      const EPHEMERAL_KEY = client_secret?.value;
      if (!EPHEMERAL_KEY) throw new Error("Missing client_secret.value");

      log("Creating RTCPeerConnection...");
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        let remoteAudioEl = document.getElementById("remote-audio");
        if (!remoteAudioEl) {
          remoteAudioEl = document.createElement("audio");
          remoteAudioEl.id = "remote-audio";
          remoteAudioEl.autoplay = true;
          document.body.appendChild(remoteAudioEl);
        }
        remoteAudioEl.srcObject = stream;
      };

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        log("Voice connected!", "success");

        sendEvent(dc, {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "system",
            content: [{ type: "input_text", text: COACH_CONSTITUTION }],
          },
        });

        const prompt =
          `DAW: ${daw}\n\n` +
          "We are in a live mixing session. Be dynamic and conversational.\n" +
          "Keep an internal checklist of problems but don't dump it.\n" +
          "I might make changes without telling you, so check in naturally sometimes.\n\n" +
          "Given the stem analysis JSON below:\n" +
          "- First ask ONE question: reference track / target vibe.\n" +
          "- Then ask ONE question: what's the main complaint in my words.\n" +
          "- Then pick ONE big priority fix and guide me.\n" +
          "- Keep moves small: 1–2 steps max before checking in.\n\n" +
          "STEM_ANALYSIS_JSON:\n" +
          analysisSummary;

        sendEvent(dc, {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        });

        sendEvent(dc, {
          type: "response.create",
          response: { modalities: ["audio", "text"] },
        });

        setSessionStarted(true);
      };

      dc.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "response.audio_transcript.done") {
            log(`Coach: ${data.transcript}`, "success");
          }
        } catch {}
      };

      log("Getting microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      log("Creating offer...");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      log("Connecting to Realtime API...");
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-realtime";

      const sdpResp = await fetch(`${baseUrl}?model=${encodeURIComponent(model)}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResp.ok) throw new Error(await sdpResp.text());

      const answerSdp = await sdpResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setConnected(true);
    } catch (e) {
      log(`ERROR: ${e?.message || String(e)}`, "error");
      cleanup();
    }
  }

  function cleanup() {
    try {
      dcRef.current?.close?.();
      pcRef.current?.close?.();
      localStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch {}
    dcRef.current = null;
    pcRef.current = null;
    localStreamRef.current = null;
    setConnected(false);
    setSessionStarted(false);
  }

  function disconnect() {
    cleanup();
    log("Session ended.");
  }

  async function convertAiffOnServer(file) {
    const form = new FormData();
    form.append("files", file);

    const resp = await fetch("/convert", { method: "POST", body: form });
    if (!resp.ok) throw new Error(await resp.text());

    const data = await resp.json();
    const first = data?.files?.[0];
    if (!first?.wav_base64) throw new Error("Convert response missing wav_base64");

    const wavArrayBuffer = base64ToArrayBuffer(first.wav_base64);
    return decodeAudioArrayBuffer(wavArrayBuffer);
  }

  async function runAnalysis() {
    if (!files.length) return log("No files selected.", "error");
    setIsAnalyzing(true);
    log(`Analyzing ${files.length} file(s)...`);

    const stems = [];

    for (const f of files) {
      log(`Processing: ${f.name}`);

      let audio;
      try {
        if (isAiff(f.name, f.type)) {
          log(`Converting AIFF: ${f.name}`);
          audio = await convertAiffOnServer(f);
        } else {
          audio = await decodeAudioFile(f);
        }
      } catch (err) {
        log(`Failed: ${f.name} - ${err?.message || String(err)}`, "error");
        continue;
      }

      const mono = toMono(audio);

      stems.push({
        name: f.name,
        role_guess: guessRole(f.name),
        type: f.type,
        duration_s: +audio.duration.toFixed(2),
        sample_rate: audio.sampleRate,
        channels: audio.numberOfChannels,
        metrics: analyzeMono(mono, audio.sampleRate),
      });

      log(`Analyzed: ${f.name} (${guessRole(f.name)})`, "success");
    }

    const payload = {
      analyzed_at: new Date().toISOString(),
      stems,
      song_summary: summarizeSong(stems),
      notes: "Dynamics + spectral balance analysis for mixing guidance.",
    };

    setAnalysis(payload);
    setIsAnalyzing(false);
    log("Analysis complete!", "success");
  }

  function getOrbClass() {
    if (sessionStarted) return "on";
    if (analysis) return "ready";
    return "off";
  }

  function getStatusText() {
    if (sessionStarted) return "Session active - speak to your coach";
    if (analysis) return "Ready to start coaching session";
    if (files.length > 0) return "Files selected - analyze them next";
    return "Upload your audio stems to begin";
  }

  function getStatusClass() {
    if (sessionStarted) return "connected";
    if (analysis) return "ready";
    return "";
  }

  return (
    <div className="app">
      <style>{styles}</style>

      <div className="container">
        <header className="header">
          <h1>Voice Mixing Coach</h1>
          <p>AI-powered mixing guidance through natural conversation</p>
        </header>

        <div className="orb-container">
          <div className={`orb ${getOrbClass()}`} />
        </div>
        <p className={`status-text ${getStatusClass()}`}>
          {getStatusText()}
        </p>

        {/* Step 1: Select DAW & Upload Files */}
        <div className={`step-card ${currentStep === 1 ? "active" : ""} ${currentStep > 1 ? "completed" : ""}`}>
          <div className="step-header">
            <div className="step-number">{currentStep > 1 ? "✓" : "1"}</div>
            <h3 className="step-title">Setup</h3>
          </div>
          <p className="step-description">Select your DAW and upload audio stems</p>
          <div className="step-content">
            <div className="controls">
              <div className="select-wrapper">
                <select value={daw} onChange={(e) => setDaw(e.target.value)} disabled={sessionStarted}>
                  <option>Ableton</option>
                  <option>Logic Pro</option>
                  <option>GarageBand</option>
                  <option>Pro Tools</option>
                  <option>FL Studio</option>
                  <option>Reaper</option>
                  <option>Studio One</option>
                </select>
              </div>

              <div className="file-input-wrapper">
                <input
                  type="file"
                  multiple
                  accept="audio/*,.wav,.mp3,.aif,.aiff"
                  onChange={(e) => {
                    setFiles(Array.from(e.target.files || []));
                    setAnalysis(null);
                  }}
                  disabled={sessionStarted}
                />
                <div className="file-input-label">
                  <span>Drop audio files or click to browse</span>
                  {files.length > 0 && <span className="file-count">{files.length}</span>}
                </div>
              </div>
            </div>

            {files.length > 0 && (
              <div className="stems-list">
                {files.map((f, i) => (
                  <span key={i} className="stem-tag">{f.name}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Analyze */}
        <div className={`step-card ${currentStep === 2 ? "active" : ""} ${currentStep > 2 ? "completed" : ""} ${currentStep < 2 ? "disabled" : ""}`}>
          <div className="step-header">
            <div className="step-number">{currentStep > 2 ? "✓" : "2"}</div>
            <h3 className="step-title">Analyze Audio</h3>
          </div>
          <p className="step-description">Extract dynamics and spectral information from your stems</p>
          <div className="step-content">
            <button
              className="btn btn-primary btn-large"
              onClick={runAnalysis}
              disabled={!files.length || isAnalyzing || sessionStarted}
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Files"}
            </button>

            {analysis && (
              <pre className="analysis-panel">{analysisSummary}</pre>
            )}
          </div>
        </div>

        {/* Step 3: Start Session */}
        <div className={`step-card ${currentStep === 3 ? "active" : ""} ${currentStep > 3 ? "completed" : ""} ${currentStep < 3 ? "disabled" : ""}`}>
          <div className="step-header">
            <div className="step-number">{currentStep > 3 ? "✓" : "3"}</div>
            <h3 className="step-title">Start Coaching Session</h3>
          </div>
          <p className="step-description">Connect your voice and start getting mixing advice</p>
          <div className="step-content">
            {!sessionStarted ? (
              <button
                className="btn btn-success btn-large"
                onClick={connectVoice}
                disabled={!analysis || connected}
              >
                {connected ? "Connecting..." : "Start Voice Session"}
              </button>
            ) : (
              <div className="session-active">
                <p>Session is active - speak naturally to your coach</p>
                <button className="btn btn-danger" onClick={disconnect}>
                  End Session
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Activity Log - only show after session starts */}
        {sessionStarted && (
          <div className="log-card">
            <h3 className="log-title">Conversation Log</h3>
            <div className="log-panel" ref={logPanelRef}>
              {logs.filter(l => l.type === "success" && l.message.startsWith("Coach:")).length === 0 ? (
                <div className="empty-state">Waiting for coach to respond...</div>
              ) : (
                logs.filter(l => l.message.startsWith("Coach:")).map((entry, i) => (
                  <div key={i} className={`log-entry ${entry.type}`}>
                    <span style={{ opacity: 0.5 }}>[{entry.time}]</span> {entry.message.replace("Coach: ", "")}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
