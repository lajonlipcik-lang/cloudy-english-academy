import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = Number(process.env.PORT || 8787);
const TOKEN = String(process.env.CLOUDY_MEDIA_PROCESSOR_TOKEN || "");
const CONTENT_URL = String(process.env.CLOUDY_CONTENT_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const BUCKET = "cloudy-shorts";
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_AUDIO_BYTES = 8_000_000;
const MAX_FRAME_BYTES = 200_000;
const MAX_DURATION_SECONDS = 180;
const MAX_CONCURRENT_JOBS = 2;
let activeJobs = 0;

function authorized(value) {
  const supplied = String(value || "").replace(/^Bearer\s+/i, "");
  if (TOKEN.length < 32 || !supplied) return false;
  const a = Buffer.from(TOKEN);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readBody(req, limit = 16_384) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Request body too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateSourceUrl(value, videoId) {
  if (!CONTENT_URL) throw new Error("Content storage URL is not configured.");
  const expected = new URL(CONTENT_URL);
  const source = new URL(String(value || ""));
  if (source.protocol !== "https:" || source.origin !== expected.origin) {
    throw new Error("Source URL origin is not allowed.");
  }
  if (source.username || source.password || source.hash) throw new Error("Invalid source URL.");
  const prefix = "/storage/v1/object/sign/" + BUCKET + "/";
  if (!source.pathname.startsWith(prefix)) throw new Error("Source must be a signed private Shorts object.");
  const objectPath = source.pathname.slice(prefix.length).split("/").map(decodeURIComponent);
  if (objectPath.length !== 2 || !/^[0-9a-f-]{36}$/i.test(objectPath[0])) throw new Error("Invalid Shorts storage path.");
  const match = /^([0-9a-f-]{36})\.(mp4|webm|mov)$/i.exec(objectPath[1]);
  if (!match || match[1].toLowerCase() !== String(videoId).toLowerCase()) throw new Error("Video identifier does not match storage path.");
  if (!source.searchParams.has("token")) throw new Error("Signed storage token is missing.");
  return source.toString();
}

function run(command, args, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(command + " timed out."));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { if (stdout.length < 32_000) stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { if (stderr.length < 8_000) stderr += chunk.toString(); });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(command + " failed (" + code + "): " + stderr.slice(-1200)));
    });
  });
}

async function downloadOriginal(sourceUrl, destination) {
  const response = await fetch(sourceUrl, { redirect: "error", signal: AbortSignal.timeout(45_000) });
  if (!response.ok || !response.body) throw new Error("Private video download failed.");
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_VIDEO_BYTES) throw new Error("Video exceeds the 100 MB limit.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_VIDEO_BYTES) throw new Error("Invalid video size.");
  await writeFile(destination, bytes, { flag: "wx" });
}

async function probeDuration(input) {
  const raw = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", input,
  ], 20_000);
  const duration = Number(raw);
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS) {
    throw new Error("Only videos up to three minutes can be automatically analyzed.");
  }
  return duration;
}

async function extractFrames(input, directory, duration) {
  const ratios = [0.08, 0.25, 0.42, 0.58, 0.75, 0.92];
  const frames = [];
  for (let index = 0; index < ratios.length; index++) {
    const output = path.join(directory, "frame-" + index + ".jpg");
    const seconds = Math.max(0, Math.min(duration - 0.05, duration * ratios[index]));
    await run("ffmpeg", [
      "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
      "-ss", seconds.toFixed(3), "-i", input, "-map", "0:v:0",
      "-frames:v", "1", "-vf", "scale='min(384,iw)':-2",
      "-q:v", "5", output,
    ]);
    const info = await stat(output);
    if (!info.size || info.size > MAX_FRAME_BYTES) throw new Error("Extracted frame exceeds the safety limit.");
    const bytes = await readFile(output);
    frames.push("data:image/jpeg;base64," + bytes.toString("base64"));
  }
  return frames;
}

async function extractAudio(input, directory) {
  const pattern = path.join(directory, "audio-%03d.wav");
  await run("ffmpeg", [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
    "-i", input, "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000",
    "-c:a", "pcm_s16le", "-f", "segment", "-segment_time", "20",
    "-reset_timestamps", "1", "-segment_format", "wav", pattern,
  ]);
  const files = (await readdir(directory)).filter((name) => /^audio-\d{3}\.wav$/.test(name)).sort();
  if (!files.length || files.length > 9) throw new Error("No supported audio track was extracted.");
  let total = 0;
  const chunks = [];
  for (const name of files) {
    const filePath = path.join(directory, name);
    const info = await stat(filePath);
    total += info.size;
    if (!info.size || total > MAX_AUDIO_BYTES) throw new Error("Extracted audio exceeds the safety limit.");
    chunks.push((await readFile(filePath)).toString("base64"));
  }
  return chunks;
}

async function handleExtract(req, res) {
  if (!authorized(req.headers.authorization)) return json(res, 401, { error: "Unauthorized" });
  if (activeJobs >= MAX_CONCURRENT_JOBS) return json(res, 429, { error: "Media processor is busy." });
  activeJobs++;
  let directory;
  try {
    const body = await readBody(req);
    const videoId = String(body.videoId || "");
    if (!/^[0-9a-f-]{36}$/i.test(videoId)) return json(res, 400, { error: "Invalid video ID." });
    if (body.mode !== "frames" && body.mode !== "audio") return json(res, 400, { error: "Invalid extraction mode." });
    const sourceUrl = validateSourceUrl(body.sourceUrl, videoId);
    directory = await mkdtemp(path.join(tmpdir(), "cloudy-shorts-"));
    const input = path.join(directory, "original-video");
    await downloadOriginal(sourceUrl, input);
    const durationSeconds = await probeDuration(input);
    if (body.mode === "frames") {
      const frames = await extractFrames(input, directory, durationSeconds);
      return json(res, 200, { ok: true, mode: "frames", durationSeconds, frames });
    }
    const chunks = await extractAudio(input, directory);
    return json(res, 200, { ok: true, mode: "audio", durationSeconds, chunks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media extraction failed.";
    console.warn("[cloudy-media-processor] extraction deferred:", message.slice(0, 300));
    return json(res, 422, { error: "Media could not be safely extracted." });
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
    activeJobs--;
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return json(res, TOKEN.length >= 32 && CONTENT_URL ? 200 : 503, { ok: Boolean(TOKEN.length >= 32 && CONTENT_URL) });
  }
  if (req.method === "POST" && req.url === "/v1/extract") return handleExtract(req, res);
  return json(res, 404, { error: "Not found." });
});

server.headersTimeout = 10_000;
server.requestTimeout = 120_000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("[cloudy-media-processor] listening on port " + PORT);
});
