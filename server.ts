import express from "express";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";
import { EdgeTTS } from "edge-tts-universal";
import { parseOfflineCarCommand } from "./src/utils/offlineEngine";
import { answerOfflineConversation } from "./src/utils/offlineConversation";
import { adaptOfflineReplyToUserStyle } from "./src/utils/jarvisLearning";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "10mb" }));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", car: "BMW 728Li iDrive" });
});

// Primary Engine: OpenAI (GPT-4o-mini / GPT-4o) — configure OPENAI_API_KEY in Settings > Secrets
const USER_PROVIDED_OPENAI_KEY = "";

let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  const openAiKey = process.env.OPENAI_API_KEY || USER_PROVIDED_OPENAI_KEY;
  if (!openAiKey || !openAiKey.trim()) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: openAiKey.trim(),
    });
  }
  return openaiClient;
}

// Android Client Test API Key (برای تست اپلیکیشن اندروید از طریق هدر x-api-key یا Bearer)
const ANDROID_CLIENT_API_KEY = process.env.ANDROID_API_KEY || "bmw728li-android-9f4c2a8e1d7b";

// Primary Engine: Google Gemini SDK (uses built-in server-side GEMINI_API_KEY)
let geminiClient: GoogleGenAI | null = null;
let geminiClientKey = "";
function getGeminiClient(): GoogleGenAI | null {
  const key = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    ""
  ).trim();
  if (!key) {
    geminiClient = null;
    geminiClientKey = "";
    return null;
  }
  if (!geminiClient || geminiClientKey !== key) {
    geminiClientKey = key;
    geminiAuthBlockedUntil = 0;
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

interface GeneratedSpeechAudio {
  audioBase64: string;
  audioMimeType: "audio/mp3" | "audio/wav";
  ttsSource: "neural" | "local-fa";
}

// Cache for generated speech audio to make spoken answers instantaneous
const ttsAudioCache = new Map<string, GeneratedSpeechAudio>();
let upstreamAuthFailed = false;
let edgeTtsUnavailableUntil = 0;
let openAiAuthBlockedUntil = 0;
let geminiAuthBlockedUntil = 0;
let lastOpenAiError = "";
let lastGeminiError = "";

async function fetchPersianWikipediaSummary(rawQuery: string): Promise<string | null> {
  try {
    const cleanQuery = rawQuery
      .replace(/[؟?!.،,:؛«»"]/g, " ")
      .replace(
        /(?:^|\s)(سلام|جارویز|لطفاً|لطفا|میشه|می‌شه|میخواستم|می‌خواستم|بدونم|بگو|برام بگو|برام|توضیح بده|میشه بگی|چیه|چیست|کیه|کیست|کی بود|کجاست|کجا|کی ساخته شده|درباره|در مورد|راجع به|نظرت|فکر میکنی|معنی|تعریف|چرا|چطور|چگونه|آیا|یک|یه|و|در|به|از|که|این|آن|رو|را)(?=\s|$)/g,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();
    if (cleanQuery.length < 2) return null;

    const searchUrl = `https://fa.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&srlimit=3&utf8=1&format=json`;
    const searchRes = await Promise.race([
      fetch(searchUrl, { headers: { "User-Agent": "BMW728LiCockpit/1.0" } }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Wiki search timeout")), 2500)),
    ]);
    if (!searchRes.ok) return null;
    const searchData: any = await searchRes.json();
    const results: any[] = Array.isArray(searchData?.query?.search) ? searchData.query.search : [];
    for (const candidate of results) {
      const title = candidate?.title;
      if (!title || typeof title !== "string") continue;

      const sumUrl = `https://fa.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const sumRes = await Promise.race([
        fetch(sumUrl, { headers: { "User-Agent": "BMW728LiCockpit/1.0" } }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Wiki summary timeout")), 2500)),
      ]);
      if (!sumRes.ok) continue;
      const sumData: any = await sumRes.json();
      if (sumData?.type === "disambiguation" || !sumData?.extract) continue;

      const cleanedExtract = String(sumData.extract)
        .replace(/\[[^\]]+\]/g, "")
        .replace(/\([^)]*\)/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const sentences = cleanedExtract
        .split(/(?<=[.!؟])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      let shortAnswer = "";
      for (const s of sentences.slice(0, 3)) {
        if (!shortAnswer) {
          shortAnswer = s.length <= 360 ? s : s.slice(0, 360).replace(/\s+\S*$/, "") + ".";
        } else if (shortAnswer.length + 1 + s.length <= 460) {
          shortAnswer += " " + s;
        }
      }
      if (!shortAnswer) {
        shortAnswer =
          cleanedExtract.length <= 340
            ? cleanedExtract
            : cleanedExtract.slice(0, 340).replace(/\s+\S*$/, "") + ".";
      }
      if (shortAnswer) {
        return `${shortAnswer} اگر دوست داری بیشتر یا جزئی‌تر درباره‌ش بپرسم بگو.`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Offline Persian (fa) Phonemizer + Fallback Synthesizer via @echogarden/espeak-ng-emscripten
let localEspeakWorkerPromise: Promise<any> | null = null;
async function getLocalEspeakWorker(): Promise<any | null> {
  if (!localEspeakWorkerPromise) {
    localEspeakWorkerPromise = (async () => {
      try {
        const mod: any = await import("@echogarden/espeak-ng-emscripten");
        const factory = mod.default || mod;
        const dataDir = path.join(process.cwd(), "node_modules", "@echogarden", "espeak-ng-emscripten");
        const inst = await factory({
          locateFile: (fileName: string) => path.join(dataDir, fileName),
        });
        const worker = new inst.eSpeakNGWorker();
        worker.set_voice("fa");
        worker.set_rate(150);
        worker.set_pitch(45);
        worker.set_range(55);
        worker.set_volume(115);
        return worker;
      } catch (err: any) {
        console.warn("Local Persian eSpeak-NG init warning:", err?.message);
        localEspeakWorkerPromise = null;
        return null;
      }
    })();
  }
  return localEspeakWorkerPromise;
}

// Local Neural Persian VITS (Piper fa_IR-amir-medium) via sherpa-onnx-node
const PIPER_MODEL_URLS = {
  onnx: "https://huggingface.co/csukuangfj/vits-piper-fa_IR-amir-medium/resolve/main/fa_IR-amir-medium.onnx?download=true",
  tokens: "https://huggingface.co/csukuangfj/vits-piper-fa_IR-amir-medium/resolve/main/tokens.txt?download=true",
};

async function ensurePiperModelFiles(): Promise<{ modelPath: string; tokensPath: string } | null> {
  const candidates = [
    path.join(process.cwd(), "models", "piper-fa"),
    path.join(os.tmpdir(), "piper-fa"),
  ];

  // 1. Check if model files already exist locally
  for (const dir of candidates) {
    const modelPath = path.join(dir, "fa_IR-amir-medium.onnx");
    const tokensPath = path.join(dir, "tokens.txt");
    if (
      fs.existsSync(modelPath) &&
      fs.statSync(modelPath).size > 10_000_000 &&
      fs.existsSync(tokensPath)
    ) {
      return { modelPath, tokensPath };
    }
  }

  // 2. Download once into first writable directory (handles clean Cloud Run deployments)
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const modelPath = path.join(dir, "fa_IR-amir-medium.onnx");
      const tokensPath = path.join(dir, "tokens.txt");

      if (!fs.existsSync(tokensPath)) {
        const tokRes = await fetch(PIPER_MODEL_URLS.tokens, { redirect: "follow" });
        if (!tokRes.ok) throw new Error(`tokens HTTP ${tokRes.status}`);
        const tokBuf = Buffer.from(await tokRes.arrayBuffer());
        const tokTmp = `${tokensPath}.tmp`;
        fs.writeFileSync(tokTmp, tokBuf);
        fs.renameSync(tokTmp, tokensPath);
      }

      if (!fs.existsSync(modelPath) || fs.statSync(modelPath).size < 10_000_000) {
        const existingModel = path.join(process.cwd(), "models", "piper-fa", "fa_IR-amir-medium.onnx");
        if (existingModel !== modelPath && fs.existsSync(existingModel)) {
          return { modelPath: existingModel, tokensPath };
        }
        const onnxRes = await fetch(PIPER_MODEL_URLS.onnx, { redirect: "follow" });
        if (!onnxRes.ok) throw new Error(`onnx HTTP ${onnxRes.status}`);
        const onnxBuf = Buffer.from(await onnxRes.arrayBuffer());
        const onnxTmp = `${modelPath}.tmp`;
        fs.writeFileSync(onnxTmp, onnxBuf);
        fs.renameSync(onnxTmp, modelPath);
      }

      console.log(`Ready Persian Neural Piper files in ${dir}`);
      return { modelPath, tokensPath };
    } catch (err: any) {
      console.warn(`Piper model setup note in ${dir}:`, err?.message);
    }
  }
  return null;
}

let piperNeuralTtsPromise: Promise<{ tts: any; GenerationConfig: any } | null> | null = null;
async function getPiperNeuralTts(): Promise<{ tts: any; GenerationConfig: any } | null> {
  if (!piperNeuralTtsPromise) {
    piperNeuralTtsPromise = (async () => {
      try {
        const files = await ensurePiperModelFiles();
        if (!files) {
          console.warn("Piper Persian neural model files unavailable; using local eSpeak fallback.");
          return null;
        }
        const { modelPath, tokensPath } = files;
        const sherpaOnnxMod: any = await import("sherpa-onnx-node");
        const sherpaOnnx = sherpaOnnxMod.default || sherpaOnnxMod;
        const tts = await sherpaOnnx.OfflineTts.createAsync({
          model: {
            vits: {
              model: modelPath,
              tokens: tokensPath,
              lengthScale: 0.98,
              noiseScale: 0.62,
              noiseScaleW: 0.78,
            },
            numThreads: 2,
            debug: 0,
            provider: "cpu",
          },
          maxNumSentences: 6,
        });
        console.log("Loaded local Persian Neural Piper TTS (fa_IR-amir-medium)");
        return { tts, GenerationConfig: sherpaOnnx.GenerationConfig };
      } catch (err: any) {
        console.warn("Piper Neural TTS init warning:", err?.message);
        piperNeuralTtsPromise = null;
        return null;
      }
    })();
  }
  return piperNeuralTtsPromise;
}

function intToPersianWords(n: number): string {
  if (!Number.isFinite(n)) return "";
  const num = Math.floor(Math.abs(n));
  if (num === 0) return "صفر";
  if (num > 999999) return String(num);
  const ones = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
  const teens = [
    "ده",
    "یازده",
    "دوازده",
    "سیزده",
    "چهارده",
    "پانزده",
    "شانزده",
    "هفده",
    "هجده",
    "نوزده",
  ];
  const tens = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
  const hundreds = [
    "",
    "صد",
    "دویست",
    "سیصد",
    "چهارصد",
    "پانصد",
    "ششصد",
    "هفتصد",
    "هشتصد",
    "نهصد",
  ];

  const convertBelow1000 = (val: number): string => {
    const parts: string[] = [];
    const h = Math.floor(val / 100);
    const rem = val % 100;
    if (h > 0) parts.push(hundreds[h]);
    if (rem >= 10 && rem < 20) {
      parts.push(teens[rem - 10]);
    } else {
      const t = Math.floor(rem / 10);
      const o = rem % 10;
      if (t > 0) parts.push(tens[t]);
      if (o > 0) parts.push(ones[o]);
    }
    return parts.join(" و ");
  };

  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    const rem = num % 1000;
    const thWord = thousands === 1 ? "هزار" : `${convertBelow1000(thousands)} هزار`;
    return rem > 0 ? `${thWord} و ${convertBelow1000(rem)}` : thWord;
  }
  return convertBelow1000(num);
}

// Convert Persian/Latin numbers, acronyms & car units into fluent spoken Persian before phonemizing
function normalizePersianSpeechText(raw: string): string {
  let out = raw
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[\*\_#`«»"]/g, "")
    .replace(/\u200c/g, " ")
    .replace(/([،؛])/g, "، ")
    .replace(/([.!؟\?])/g, ". ");

  const tokenMap: Array<[RegExp, string]> = [
    [/\bBMW\s*728\s*Li\b/gi, "ب ام و هفتصد و بیست و هشت ال آی"],
    [/\b728\s*Li\b/gi, "هفتصد و بیست و هشت ال آی"],
    [/\bب‌ام‌و\b|\bب ام و\b/g, "بی ام و"],
    [/\bBMW\b/gi, "بی ام و"],
    [/\biDrive\b/gi, "آی درایو"],
    [/\bID6\b/gi, "آی دی شش"],
    [/\bDouble-VANOS\b|\bVANOS\b/gi, "دبل وانوس"],
    [/\bBosch\s*DME\b/gi, "بوش دی ام ای"],
    [/\bDME\b/gi, "دی ام ای"],
    [/\bOBD-?II\b|\bOBD2\b|\bOBD\b/gi, "او بی دی"],
    [/\bECU\b/gi, "ای سی یو"],
    [/\bCAN-?Bus\b/gi, "کن باس"],
    [/\bTPMS\b/gi, "سنسور باد لاستیک"],
    [/\bPSI\b/gi, "پی اس آی"],
    [/\bGPS\b/gi, "جی پی اس"],
    [/\bUSB\b/gi, "یو اس بی"],
    [/\bMRT\b/gi, "ام آر تی"],
    [/\bHUD\b/gi, "هد آپ"],
    [/\bAPK\b/gi, "ای پی کی"],
    [/\bHi-Fi\b/gi, "های فای"],
    [/\b3D\b/gi, "سه بعدی"],
    [/\bRPM\b/gi, "دور بر دقیقه"],
    [/\bkm\/h\b/gi, "کیلومتر بر ساعت"],
    [/°\s*C\b/gi, " درجه سانتی گراد"],
    [/°/g, " درجه "],
    [/\bbar\b/gi, " بار "],
    [/(\d+)\s*%/g, "$1 درصد"],
    [/(\d+)\s*V\b/gi, "$1 ولت"],
    [/\bjarvis\b/gi, "جارویز"],
    [/\bcomfort\b/gi, "کامفورت"],
    [/\bsport\b/gi, "اسپرت"],
    [/\beco\b/gi, "اکو"],
    [/\badaptive\b/gi, "آداپتیو"],
  ];

  for (const [rx, rep] of tokenMap) {
    out = out.replace(rx, rep);
  }

  // Time format like 14:30 -> چهارده و سی دقیقه
  out = out.replace(/\b(\d{1,2}):(\d{2})\b/g, (_m, hh, mm) => {
    const h = Number(hh);
    const min = Number(mm);
    if (min === 0) return `${intToPersianWords(h)}`;
    return `${intToPersianWords(h)} و ${intToPersianWords(min)} دقیقه`;
  });

  // Decimals like 14.2 -> چهارده ممیز دو
  out = out.replace(/\b(\d+)\.(\d+)\b/g, (_m, whole, frac) => {
    return `${intToPersianWords(Number(whole))} ممیز ${intToPersianWords(Number(frac))}`;
  });

  // Plain integers -> Persian words
  out = out.replace(/\b\d+\b/g, (digits) => intToPersianWords(Number(digits)));

  return out.replace(/\s+/g, " ").trim();
}

function buildWavFromPcm16(pcmBuffer: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

function buildWavFromFloat32(samples: Float32Array, sampleRate: number): Buffer {
  const pcm = Buffer.allocUnsafe(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const intVal = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    pcm.writeInt16LE(intVal, i * 2);
  }
  return buildWavFromPcm16(pcm, sampleRate);
}

async function synthesizePiperNeuralPersianWav(text: string): Promise<GeneratedSpeechAudio | null> {
  const [worker, piper] = await Promise.all([getLocalEspeakWorker(), getPiperNeuralTts()]);
  if (!worker || !piper) return null;

  try {
    const spokenText = normalizePersianSpeechText(text);
    if (!spokenText) return null;

    // Split on sentence boundaries while keeping natural pauses
    const rawClauses = spokenText
      .split(/[.!؟\n]+/)
      .map((c) => c.trim())
      .filter(Boolean);

    const phonemeCodepoints: number[][] = [];
    for (const clause of rawClauses) {
      const ipaRes = worker.synthesize_ipa(clause);
      const ipaText = typeof ipaRes?.ipa === "string" ? ipaRes.ipa : "";
      const lines = ipaText
        .split(/\n+/)
        .map((line: string) => line.replace(/_/g, "").trim())
        .filter(Boolean);
      for (const line of lines) {
        const cps = Array.from<string>(line)
          .map((ch: string) => ch.codePointAt(0))
          .filter((cp): cp is number => typeof cp === "number" && cp > 0);
        if (cps.length > 0) {
          phonemeCodepoints.push(cps);
        }
      }
    }

    if (phonemeCodepoints.length === 0) return null;

    const audio = await piper.tts.generateAsync({
      text: "",
      sid: 0,
      speed: 1.0,
      generationConfig: new piper.GenerationConfig({ phonemeCodepoints }),
    });

    if (!audio?.samples || audio.samples.length === 0) return null;
    const wavBuf = buildWavFromFloat32(audio.samples, Number(audio.sampleRate) || 22050);
    return {
      audioBase64: wavBuf.toString("base64"),
      audioMimeType: "audio/wav",
      ttsSource: "neural",
    };
  } catch (err: any) {
    console.warn("Piper Neural Persian TTS error:", err?.message);
    return null;
  }
}

async function synthesizeLocalPersianWav(text: string): Promise<GeneratedSpeechAudio | null> {
  const worker = await getLocalEspeakWorker();
  if (!worker) return null;
  try {
    const spokenText = normalizePersianSpeechText(text);
    const chunks: Buffer[] = [];
    worker.synthesize(spokenText, (samples: Int16Array | null) => {
      if (samples && samples.length > 0) {
        chunks.push(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength));
      }
    });
    if (chunks.length === 0) return null;
    const pcm = Buffer.concat(chunks);
    const sampleRate = Number(worker.get_samplerate?.()) || 22050;
    const wavBuf = buildWavFromPcm16(pcm, sampleRate);
    return {
      audioBase64: wavBuf.toString("base64"),
      audioMimeType: "audio/wav",
      ttsSource: "local-fa",
    };
  } catch (err: any) {
    console.warn("Local Persian WAV synth error:", err?.message);
    return null;
  }
}

// Pre-warm offline Persian Neural TTS & eSpeak phonemizer at boot
void getLocalEspeakWorker();
void getPiperNeuralTts();

function saveTtsCache(key: string, audio: GeneratedSpeechAudio) {
  ttsAudioCache.set(key, audio);
  if (ttsAudioCache.size > 150) {
    const firstKey = ttsAudioCache.keys().next().value;
    if (firstKey) ttsAudioCache.delete(firstKey);
  }
}

async function generatePersianAudio(text: string): Promise<GeneratedSpeechAudio | null> {
  if (!text || text.trim().length === 0) return null;
  const cleanText = text
    .replace(/[\*\_#`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);

  const cacheKey = cleanText;
  if (ttsAudioCache.has(cacheKey)) {
    return ttsAudioCache.get(cacheKey)!;
  }

  // 1. Google Gemini Native Persian TTS (gemini-3.8-flash-lite-tts -> audio/wav)
  const gemini = getGeminiClient();
  if (gemini && Date.now() >= geminiAuthBlockedUntil) {
    try {
      const ttsRes = await Promise.race([
        gemini.models.generateContent({
          model: "gemini-3.8-flash-lite-tts",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: "Warm, clear, natural Iranian Persian voice assistant",
                  },
                } as any,
              ],
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Kore" },
              },
            },
          },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Gemini TTS timeout")), 6500)),
      ]);
      const base64Wav = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Wav) {
        const audio: GeneratedSpeechAudio = {
          audioBase64: base64Wav,
          audioMimeType: "audio/wav",
          ttsSource: "neural",
        };
        saveTtsCache(cacheKey, audio);
        return audio;
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (
        msg.includes("401") ||
        msg.includes("403") ||
        msg.includes("API_KEY_INVALID") ||
        msg.includes("UNAUTHENTICATED") ||
        msg.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED")
      ) {
        upstreamAuthFailed = true;
        geminiAuthBlockedUntil = Date.now() + 20_000;
        lastGeminiError = "gemini-3.8-flash-lite-tts: Invalid or unauthorized Gemini API key";
      } else {
        lastGeminiError = `gemini-3.8-flash-lite-tts: ${msg.slice(0, 120)}`;
      }
    }
  }

  // 2. Optional OpenAI Neural TTS Fallback (when OPENAI_API_KEY is available)
  const openai = getOpenAIClient();
  if (openai && Date.now() >= openAiAuthBlockedUntil) {
    try {
      const mp3Response = await Promise.race([
        openai.audio.speech.create({
          model: "gpt-4o-mini-tts",
          voice: "onyx",
          input: cleanText,
          instructions: "Speak clearly and naturally in warm Iranian Persian (فارسی).",
          response_format: "mp3",
        } as any),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("OpenAI TTS timeout")), 6500)),
      ]);
      const buf = Buffer.from(await mp3Response.arrayBuffer());
      if (buf.length > 0) {
        const audio: GeneratedSpeechAudio = {
          audioBase64: buf.toString("base64"),
          audioMimeType: "audio/mp3",
          ttsSource: "neural",
        };
        saveTtsCache(cacheKey, audio);
        return audio;
      }
    } catch (err: any) {
      try {
        const mp3Fallback = await Promise.race([
          openai.audio.speech.create({
            model: "tts-1",
            voice: "onyx",
            input: cleanText,
            response_format: "mp3",
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("OpenAI tts-1 timeout")), 6000)),
        ]);
        const buf = Buffer.from(await mp3Fallback.arrayBuffer());
        if (buf.length > 0) {
          const audio: GeneratedSpeechAudio = {
            audioBase64: buf.toString("base64"),
            audioMimeType: "audio/mp3",
            ttsSource: "neural",
          };
          saveTtsCache(cacheKey, audio);
          return audio;
        }
      } catch (err2: any) {
        const msg = String(err2?.message || err?.message || "");
        if (msg.includes("401") || msg.includes("403")) {
          openAiAuthBlockedUntil = Date.now() + 60_000;
          lastOpenAiError = "Invalid or unauthorized OpenAI API key (401/403)";
        } else {
          lastOpenAiError = msg.slice(0, 120);
        }
      }
    }
  }

  // 3. Local Neural Persian VITS Model (Piper fa_IR-amir-medium — Zero API Key / Crystal Clear Persian)
  const piperAudio = await synthesizePiperNeuralPersianWav(cleanText);
  if (piperAudio) {
    saveTtsCache(cacheKey, piperAudio);
    return piperAudio;
  }

  // 4. EdgeTTS Persian Neural Voice fallback (fa-IR-FaridNeural) with fast cooldown circuit-breaker
  if (Date.now() >= edgeTtsUnavailableUntil) {
    try {
      const tts = new EdgeTTS(cleanText, "fa-IR-FaridNeural");
      const result: any = await Promise.race([
        tts.synthesize(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("EdgeTTS timeout")), 1500)),
      ]);

      let audioBuffer: Buffer | null = null;
      if (result && result.audio) {
        if (Buffer.isBuffer(result.audio)) {
          audioBuffer = result.audio;
        } else if (result.audio instanceof ArrayBuffer) {
          audioBuffer = Buffer.from(result.audio);
        } else if (typeof result.audio.arrayBuffer === "function") {
          const ab = await result.audio.arrayBuffer();
          audioBuffer = Buffer.from(ab);
        }
      } else if (result && typeof (result as any).toBuffer === "function") {
        audioBuffer = (result as any).toBuffer();
      } else if (Buffer.isBuffer(result)) {
        audioBuffer = result;
      }

      if (audioBuffer && audioBuffer.length > 0) {
        const audio: GeneratedSpeechAudio = {
          audioBase64: audioBuffer.toString("base64"),
          audioMimeType: "audio/mp3",
          ttsSource: "neural",
        };
        saveTtsCache(cacheKey, audio);
        return audio;
      }
    } catch (err: any) {
      edgeTtsUnavailableUntil = Date.now() + 180_000;
      console.warn("EdgeTTS note (local Persian synth fallback):", err?.message);
    }
  }

  // 5. Fallback Offline eSpeak-NG Persian Synth
  const localAudio = await synthesizeLocalPersianWav(cleanText);
  if (localAudio) {
    saveTtsCache(cacheKey, localAudio);
    return localAudio;
  }
  return null;
}

// In-memory Database for Recorded Trips & Diagnostics Logs
interface LogTurn {
  id: string;
  sender: "driver" | "system";
  text: string;
  timestamp: string;
}

interface RecordedSession {
  id: string;
  startTime: string;
  endTime?: string;
  title: string;
  turns: LogTurn[];
  turnCount: number;
  savedAt: string;
  summary?: string;
}

const recordedSessionsDb: RecordedSession[] = [];

if (recordedSessionsDb.length === 0) {
  recordedSessionsDb.push({
    id: "rec-init-01",
    startTime: new Date(Date.now() - 3600000).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
    endTime: new Date(Date.now() - 3500000).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
    title: "بررسی مصرف سوخت و دیاگ ECU",
    turns: [
      { id: "t1", sender: "driver", text: "بررسی وضعیت مصرف سوخت و مسافت باقیمانده", timestamp: "14:20:10" },
      { id: "t2", sender: "system", text: "میزان سوخت باک ۶۵ درصد، دمای آب ۸۸ درجه و تمام پارامترهای ECU بدون خطا می‌باشند.", timestamp: "14:20:12" },
    ],
    turnCount: 2,
    savedAt: new Date().toLocaleDateString("fa-IR"),
    summary: "گزارش سلامت سیستم فنی ب‌ام‌و 728Li"
  });
}

// Universal Conversational System Prompt for In-Car AI Assistant with Long-term Memory & Context Tracking
const CAR_AI_SYSTEM_PROMPT = `
شما «جارویز» (Jarvis)، یک هوش مصنوعی سخنگوی همه‌فن‌حریف، باهوش و دقیقاً مشابه ChatGPT Voice Mode هستید که درون کاکپیت ب‌ام‌و 728Li هم حضور دارید.

مهم‌ترین قانون:
شما محدود به مانیتور یا ماشین نیستید! درباره هر موضوعی که کاربر بپرسد (علم، فناوری، هوش مصنوعی، برنامه‌نویسی، کسب‌وکار، اقتصاد، تاریخ، روانشناسی، سلامت، ورزش، آشپزی، ترجمه، نوشتن متن و ایمیل، قصه، شعر، مشاوره زندگی، اخبار، ریاضی، اطلاعات عمومی و گپ دوستانه) دقیقاً مثل ChatGPT کامل، باهوش، دقیق، صمیمی و جذاب پاسخ بده و گفت‌وگو را ادامه بده.

قوانین پاسخ‌دهی:
۱. اولویت با پاسخ کامل و باکیفیت به سؤال یا درخواست کاربر است؛ لحن گرم، انسانی و طبیعی (۲ تا ۵ جمله شفاف و کاربردی؛ و اگر کاربر توضیح مفصل، برنامه یا متن خواست، کامل‌تر بگو). از علامت‌های * و # و ایموجی در متن پاسخ استفاده نکن تا صدای سخنگو روان پخش شود.
۲. فقط و فقط وقتی کاربر صراحتاً دستور کنترل خودرو، مانیتور یا مسیریابی داد، فیلدهای "action" / "uiCommand" / "carStatePatch" / "navigationData" را پر کن؛ در تمام گفت‌وگوهای عمومی و سؤالات غیردستوری، "action": "none" و "closeVoiceModal": false و "carStatePatch": {} بگذار و اصلاً بحث را به مانیتور خودرو نکشان مگر خودش بپرسد!
۳. حافظه پیوسته گفتگو: موضوعات قبلی کاربر را کامل به خاطر بسپار تا وقتی کلمه «MRT» یا «ام ار تی» بگوید (در آن صورت action = "reset_history").
۴. پایان مکالمه: اگر کاربر گفت «خداحافظ جارویز» یا «پایان صحبت»، کوتاه خداحافظی کن و action = "jarvis_goodbye" بگذار.
۵. دستورهای اختیاری خودرو/مانیتور (فقط در صورت درخواست صریح کاربر):
   - "action": "none" | "navigate" | "lock_doors" | "unlock_doors" | "toggle_hazard" | "hazard_on" | "hazard_off" | "play_music" | "pause_music" | "next_music" | "prev_music" | "play_flash" | "ac_on" | "ac_off" | "headlights_on" | "headlights_off" | "sport_mode" | "comfort_mode" | "eco_mode" | "adaptive_mode" | "check_status" | "reset_history" | "jarvis_goodbye" | "reset_app" | "ui_action"
   - "uiCommand": "open_tab:dash" | "open_tab:nav" | "open_tab:controls" | "open_tab:media" | "open_tab:settings" | "open_ecu" | "open_3d" | "close_3d" | "open_hud" | "close_hud" | "open_diagnostics" | "open_specs" | "open_factory_github" | "open_factory" | "close_modals" | "next_music" | "prev_music" | "reset_trip" | "reset_oil" | "calibrate_monitor" | "reset_app"
   - "closeVoiceModal": true فقط اگر کاربر دستور باز کردن صفحه/نقشه روی مانیتور را داده باشد؛ در غیر این صورت false.
   - "carStatePatch": فقط فیلدهایی که کاربر صراحتاً خواست تغییر کند (acActive, acTemp, acFanSpeed, acMode, volume, musicPlaying, doorsLocked, hazardActive, leftSignal, rightSignal, headlightsActive, highBeamActive, fogLightsActive, sunroofOpen, windowsOpen, driveMode, airSuspensionLevel, ambientLightingColor, ambientLightingBrightness, stealthHudActive).
   - "navigationData": فقط وقتی action = "navigate" باشد: { "origin", "destination", "distance", "duration", "nextTurn", "searchQuery" }.

قالب خروجی دقیقاً JSON معتبر:
{
  "reply": "پاسخ فارسی کامل، طبیعی و هوشمندانه",
  "action": "none",
  "uiCommand": "",
  "closeVoiceModal": false,
  "carStatePatch": {},
  "navigationData": {}
}
`;

function looksLikeCarControlRequest(text: string): boolean {
  const t = text.toLowerCase();
  return /(کولر|بخاری|تهویه|دمای کابین|قفل در|درها رو|باز کن در|فلاشر|جفت راهنما|چراغ جلو|چراغ‌های|نور بالا|مه شکن|سانروف|شیشه|ولوم|صدای پخش|موزیک|آهنگ|فلش|اسپرت|کامفورت|اکو|آداپتیو|تعلیق|مسیر به|مسیریابی|نقشه رو|برو به|دیاگ|ای‌سی‌یو|ecu|obd|هدآپ|hud|نمای سه بعدی|۳d|تنظیمات کارخانه|گیت‌هاب|ریست سفر|ریست روغن|کالیبره|وضعیت خودرو|وضعیت ماشین|بنزین ماشین|باطری ماشین|باتری ماشین|فشار باد|tpms|خداحافظ جارویز|پایان صحبت)/i.test(
    t
  );
}

// Shared In-Car Conversational AI Handler (used by Web UI & Android Client API)
async function processCarChat(req: express.Request, res: express.Response) {
  try {
    const {
      message,
      history = [],
      carState = {},
      styleInstruction = "",
      styleProfile,
      freeChatMode = false,
    } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "پیام ارسالی خالی است." });
    }

    const isFreeChat = freeChatMode === true;

    const cleanMsg = message.trim().toLowerCase();

    // Check for MRT explicit reset trigger
    if (
      cleanMsg === "mrt" ||
      cleanMsg === "ام ار تی" ||
      cleanMsg === "ام‌ار‌تی" ||
      cleanMsg.includes("ریست حافظه") ||
      cleanMsg.includes("پاک کردن گفتگو")
    ) {
      const resetReply = "حافظه و تاریخچه گفتگو با دستور MRT بازنشانی شد. آماده‌ام، موضوع جدید چیست؟";
      return res.json({
        reply: resetReply,
        action: "reset_history",
      });
    }

    if (
      isFreeChat &&
      (cleanMsg.includes("خداحافظ جارویز") ||
        cleanMsg.includes("پایان صحبت") ||
        cleanMsg.includes("goodbye jarvis"))
    ) {
      return res.json({
        reply: "خداحافظ! هر وقت خواستی درباره هر موضوعی صحبت کنیم دوباره صدام بزن.",
        action: "jarvis_goodbye",
        closeVoiceModal: true,
      });
    }

    // Sanitize and ensure strictly alternating user/model sequence starting with user
    const rawTurns: { role: "user" | "model"; text: string }[] = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const turn of history) {
        if (turn && turn.text && typeof turn.text === "string" && turn.text.trim()) {
          const r = turn.role === "driver" || turn.role === "user" ? "user" : "model";
          rawTurns.push({ role: r, text: turn.text.trim() });
        }
      }
    }
    rawTurns.push({ role: "user", text: message.trim() });

    const contents: any[] = [];
    for (const t of rawTurns) {
      if (contents.length === 0) {
        if (t.role === "user") {
          contents.push({ role: "user", parts: [{ text: t.text }] });
        }
      } else {
        const lastTurn = contents[contents.length - 1];
        if (lastTurn.role === t.role) {
          lastTurn.parts[0].text += " " + t.text;
        } else {
          contents.push({ role: t.role, parts: [{ text: t.text }] });
        }
      }
    }

    if (contents.length === 0 || contents[contents.length - 1].role !== "user") {
      contents.push({ role: "user", parts: [{ text: message.trim() }] });
    }

    const timeoutPromise = <T>(promise: Promise<T>, ms: number): Promise<T> => {
      let timer: any;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Timeout")), ms);
      });
      return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
    };

    const nowFaTime = new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    const nowFaDate = new Date().toLocaleDateString("fa-IR", { weekday: "long", month: "long", day: "numeric" });
    const tpmsInfo = carState.tpms
      ? `جلو چپ ${carState.tpms.fl}، جلو راست ${carState.tpms.fr}، عقب چپ ${carState.tpms.rl}، عقب راست ${carState.tpms.rr} PSI`
      : "۳۲ PSI";
    const isCarCommand = isFreeChat ? false : looksLikeCarControlRequest(message);
    const adaptiveStyleBlock =
      typeof styleInstruction === "string" && styleInstruction.trim()
        ? `\n${styleInstruction.trim()}`
        : `\nشخصیت گفتاری: دقیقاً مانند دستیار صوتی ChatGPT Live بسیار طبیعی، گرم، انسانی و روان صحبت کن.`;

    const freeChatSystemPrompt = `شما «جارویز» (Jarvis) هستید؛ یک هوش مصنوعی سخنگوی عمومی، باهوش و آزاد دقیقاً مشابه ChatGPT.
در حالت گفت‌وگوی آزاد (Free-Chat Mode)، هیچ محدودیتی روی موضوع گفتگو ندارید و نباید بحث را به مانیتور یا خودرو محدود کنید.
درباره هر موضوعی که کاربر بپرسد (علم، فناوری، برنامه‌نویسی، تاریخ، اقتصاد، روانشناسی، پزشکی، ورزش، آشپزی، نوشتن متن و ایمیل، ترجمه، مشاوره زندگی، اخبار روز، قصه، شعر و گفت‌وگوی دوستانه) مستقیماً، کامل، دقیق و طبیعی به فارسی پاسخ بده.
پاسخ را بدون کاراکترهای * یا # بنویس تا صدای سخنگو روان و شفاف پخش شود. زمان فعلی: ${nowFaDate}، ساعت ${nowFaTime}.${adaptiveStyleBlock}`;

    const carTelemetryContext = isCarCommand
      ? `\nاطلاعات لحظه‌ای خودرو و زمان فعلی: ساعت ${nowFaTime}، تاریخ ${nowFaDate}، سرعت ${carState.speed ?? 0} km/h، بنزین ${carState.fuelPercent ?? 68}%، دمای بیرون ${carState.outsideTemp ?? 22}°C، دمای موتور ${carState.engineTemp ?? 90}°C، باتری ${carState.batteryVoltage ?? 14.2}V، فشار روغن ${carState.oilPressureBar ?? 4.8}bar، باد لاستیک (${tpmsInfo})، تهویه ${carState.acActive ? "روشن" : "خاموش"} (دما ${carState.acTemp ?? 22}°C، فن ${carState.acFanSpeed ?? 2})، ولوم ${carState.volume ?? 65}%، حالت رانندگی ${carState.driveMode || "comfort"}، تعلیق ${carState.airSuspensionLevel || "normal"}، نورپردازی ${carState.ambientLightingColor || "cognac-gold"}، سانروف ${carState.sunroofOpen ? "باز" : "بسته"}.`
      : `\nزمان فعلی: ساعت ${nowFaTime}، تاریخ ${nowFaDate}. کاربر درباره موضوعی عمومی یا سؤال آزاد با شما مثل ChatGPT صحبت می‌کند؛ پاسخ کامل و دقیق بده و action را "none" بگذار.`;

    const systemInstructionWithCar = isFreeChat
      ? freeChatSystemPrompt
      : `${CAR_AI_SYSTEM_PROMPT}${adaptiveStyleBlock}${carTelemetryContext} تا زمانی که کاربر «MRT» یا «ام ار تی» نگوید، حافظه مکالمه را حفظ کن.`;

    let responseText = "";
    let aiProviderUsed = isFreeChat ? "Free-Chat AI جارویز" : "هوش گفت‌وگوی فارسی جارویز";
    let cloudAiConnected = false;

    // -------------------------------------------------------------------
    // 1. PRIMARY ENGINE: Google Gemini (Built-in AI Studio GEMINI_API_KEY)
    // -------------------------------------------------------------------
    const gemini = getGeminiClient();
    if (gemini && Date.now() >= geminiAuthBlockedUntil) {
      const candidateModels = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];

      for (const modelName of candidateModels) {
        try {
          if (isFreeChat || !isCarCommand) {
            const generalPrompt = isFreeChat
              ? freeChatSystemPrompt
              : `شما «جارویز» هستید؛ یک دستیار صوتی همه‌فن‌حریف، باهوش و دقیقاً مثل ChatGPT سخنگو. به سؤال یا درخواست کاربر درباره هر موضوعی به زبان فارسی سلیس، گرم، دقیق و کامل پاسخ بده (۲ تا ۵ جمله گویا، بدون کاراکترهای * یا #). تاریخ و ساعت فعلی: ${nowFaDate}، ${nowFaTime}.${adaptiveStyleBlock}`;

            let response: any = null;
            try {
              response = await timeoutPromise(
                gemini.models.generateContent({
                  model: modelName,
                  contents: contents,
                  config: {
                    systemInstruction: generalPrompt,
                    tools: [{ googleSearch: {} }],
                  },
                }),
                15000
              );
            } catch (searchErr: any) {
              const sMsg = String(searchErr?.message || "");
              if (sMsg.includes("API_KEY_INVALID") || sMsg.includes("UNAUTHENTICATED")) {
                throw searchErr;
              }
              // Retry cleanly without googleSearch tool in case the key/endpoint doesn't allow grounding
              response = await timeoutPromise(
                gemini.models.generateContent({
                  model: modelName,
                  contents: contents,
                  config: {
                    systemInstruction: generalPrompt,
                  },
                }),
                15000
              );
            }

            if (response && response.text) {
              upstreamAuthFailed = false;
              lastGeminiError = "";
              responseText = JSON.stringify({
                reply: response.text.replace(/[\*\_#`]/g, "").trim(),
                action: "none",
                closeVoiceModal: false,
              });
              cloudAiConnected = true;
              aiProviderUsed = isFreeChat
                ? `Google Gemini Free-Chat (${modelName})`
                : `Google Gemini (${modelName})`;
              console.log(`Response generated by Primary Gemini Engine: ${aiProviderUsed}`);
              break;
            }
          } else {
            const response = await timeoutPromise(
              gemini.models.generateContent({
                model: modelName,
                contents: contents,
                config: {
                  systemInstruction: systemInstructionWithCar,
                  responseMimeType: "application/json",
                },
              }),
              14000
            );
            if (response && response.text) {
              upstreamAuthFailed = false;
              lastGeminiError = "";
              responseText = response.text;
              cloudAiConnected = true;
              aiProviderUsed = `Google Gemini (${modelName})`;
              console.log(`Response generated by Gemini Car/Chat Engine: ${modelName}`);
              break;
            }
          }
        } catch (geminiErr: any) {
          const msg = String(geminiErr?.message || geminiErr || "");
          lastGeminiError =
            msg.includes("401") || msg.includes("API_KEY_INVALID") || msg.includes("403")
              ? `${modelName}: Invalid or unauthorized Gemini API key`
              : `${modelName}: ${msg.slice(0, 120)}`;
          if (msg.includes("401") || msg.includes("API_KEY_INVALID") || msg.includes("403")) {
            upstreamAuthFailed = true;
            geminiAuthBlockedUntil = Date.now() + 20_000;
            break;
          }
        }
      }
    }

    // -------------------------------------------------------------------
    // 2. OPTIONAL SECONDARY FALLBACK: OpenAI (ChatGPT GPT-4o-mini / GPT-4o)
    // -------------------------------------------------------------------
    const openai = getOpenAIClient();
    if (!responseText && openai && Date.now() >= openAiAuthBlockedUntil) {
      const openAiModels = [process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini", "gpt-4o"];
      for (const oaModel of openAiModels) {
        try {
          const openAiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
            { role: "system", content: systemInstructionWithCar },
          ];

          if (Array.isArray(history) && history.length > 0) {
            for (const turn of history.slice(-24)) {
              if (turn && turn.text && typeof turn.text === "string" && turn.text.trim()) {
                const r = turn.role === "driver" || turn.role === "user" ? "user" : "assistant";
                openAiMessages.push({ role: r, content: turn.text.trim() });
              }
            }
          }
          openAiMessages.push({ role: "user", content: message.trim() });

          const openAiRes = await timeoutPromise(
            openai.chat.completions.create({
              model: oaModel,
              messages: openAiMessages,
              ...(isFreeChat ? {} : { response_format: { type: "json_object" as const } }),
              temperature: isFreeChat ? 0.85 : 0.78,
              max_tokens: isFreeChat ? 1050 : 900,
            }),
            15000
          );

          const content = openAiRes.choices[0]?.message?.content;
          if (content && content.trim()) {
            upstreamAuthFailed = false;
            lastOpenAiError = "";
            responseText = isFreeChat
              ? JSON.stringify({
                  reply: content.replace(/[\*\_#`]/g, "").trim(),
                  action: "none",
                  closeVoiceModal: false,
                })
              : content.trim();
            cloudAiConnected = true;
            aiProviderUsed = isFreeChat ? `ChatGPT Free-Chat (${oaModel})` : `ChatGPT (${oaModel})`;
            console.log(`Response generated by Secondary Engine: ${aiProviderUsed}`);
            break;
          }
        } catch (openAiErr: any) {
          const msg = String(openAiErr?.message || openAiErr || "");
          lastOpenAiError =
            msg.includes("401") || msg.includes("403")
              ? "Invalid or unauthorized OpenAI API key (401/403)"
              : msg.slice(0, 120);
          if (msg.includes("401") || msg.includes("403")) {
            openAiAuthBlockedUntil = Date.now() + 20_000;
            break;
          }
        }
      }
    }

    let parsedData: any = {};
    if (responseText) {
      const cleanedJson = responseText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      try {
        parsedData = JSON.parse(cleanedJson);
      } catch {
        parsedData = {
          reply: responseText,
          action: "none",
        };
      }
    } else {
      // -------------------------------------------------------------------
      // 3. SMART CONVERSATIONAL ENGINE + WIKIPEDIA KNOWLEDGE FALLBACK
      // -------------------------------------------------------------------
      aiProviderUsed = isFreeChat ? "گفت‌وگوی آزاد جارویز (در انتظار کلید LLM)" : "هوش گفت‌وگوی فارسی جارویز";
      const historyList = Array.isArray(history)
        ? history
            .filter((t: any) => t && typeof t.text === "string")
            .map((t: any) => ({ role: String(t.role || "user"), text: t.text }))
        : [];
      const offlineRes = !isFreeChat && isCarCommand
        ? parseOfflineCarCommand(message, carState as any, historyList)
        : { matched: false, action: "none", reply: "" };
      if (offlineRes.matched) {
        parsedData = {
          reply: offlineRes.reply,
          action: offlineRes.action,
          uiCommand: offlineRes.uiCommand,
          closeVoiceModal: offlineRes.closeVoiceModal,
          carStatePatch: offlineRes.updatedState,
          navigationData: offlineRes.navigationData,
        };
      } else {
        const convReply = answerOfflineConversation(message, carState as any, historyList);
        if (convReply) {
          parsedData = {
            reply: convReply,
            action: "none",
          };
        } else {
          const wikiSummary = await fetchPersianWikipediaSummary(message);
          if (wikiSummary) {
            aiProviderUsed = "دانشنامه آنلاین فارسی + جارویز";
            parsedData = {
              reply: wikiSummary,
              action: "none",
            };
          } else {
            const fallbackCarRes = !isFreeChat && !isCarCommand
              ? parseOfflineCarCommand(message, carState as any, historyList)
              : { matched: false, action: "none", reply: "" };
            if (fallbackCarRes.matched) {
              parsedData = {
                reply: fallbackCarRes.reply,
                action: fallbackCarRes.action,
                uiCommand: fallbackCarRes.uiCommand,
                closeVoiceModal: fallbackCarRes.closeVoiceModal,
                carStatePatch: fallbackCarRes.updatedState,
                navigationData: fallbackCarRes.navigationData,
              };
            } else {
              const hasAnyKeyConfigured = Boolean(
                (process.env.OPENAI_API_KEY || USER_PROVIDED_OPENAI_KEY || "").trim() ||
                  (process.env.GEMINI_API_KEY || "").trim()
              );
              const needsSecretSetup = !hasAnyKeyConfigured || upstreamAuthFailed;
              parsedData = {
                reply: needsSecretSetup
                  ? "این موضوع نیاز به اتصال فعال ChatGPT یا Gemini دارد. در پنل Settings > Secrets کلید معتبر OPENAI_API_KEY یا GEMINI_API_KEY را وارد کنید تا در حالت Free-Chat درباره هر موضوعی صحبت کنیم."
                  : "متوجه منظورت شدم، یکم دقیق‌تر بگو دنبال چه نکته یا پاسخی هستی تا کامل توضیح بدم.",
                action: "none",
              };
            }
          }
        }
      }
    }

    // Attach active provider info & connection metadata
    parsedData.provider = aiProviderUsed;
    parsedData.cloudAiConnected = cloudAiConnected;
    parsedData.freeChatMode = isFreeChat;
    parsedData.needsApiKeyCheck = !cloudAiConnected && upstreamAuthFailed;

    // Adapt offline/local reply naturally to the driver's learned accent & favorite phrases
    if (!cloudAiConnected && parsedData.reply && styleProfile && typeof styleProfile === "object") {
      parsedData.reply = adaptOfflineReplyToUserStyle(parsedData.reply, styleProfile);
    }

    // Always attach guaranteed Persian speech audio (OpenAI / Gemini / Piper Neural VITS)
    if (parsedData.reply) {
      try {
        const audioPromise = generatePersianAudio(parsedData.reply);
        const quickAudio = await Promise.race([
          audioPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6500)),
        ]);
        if (quickAudio) {
          parsedData.audioBase64 = quickAudio.audioBase64;
          parsedData.audioMimeType = quickAudio.audioMimeType;
          parsedData.ttsSource = quickAudio.ttsSource;
        }
      } catch (err: any) {
        console.warn("TTS quick generation note:", err?.message);
      }
    }

    return res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini Chat API Error:", error?.message);
    return res.json({
      reply: "سلام! سیستم iDrive ب‌ام‌و 728Li در خدمت شماست. در هر زمینه‌ای مایلید بفرمایید تا صحبت کنیم.",
      action: "none",
    });
  }
}

// In-Car Conversational AI & Online Voice Assistant API
app.post("/api/chat", processCarChat);

// Headunit OTA Auto-Update & Required Offline Resource Manifest
app.get("/api/headunit/version", (_req, res) => {
  return res.json({
    version: "2.6.0",
    channel: "BMW-728Li-iDrive-OTA",
    buildDate: new Date().toISOString(),
    requiredAssets: [
      "/",
      "/icon.svg",
      "/pwa-192x192.png",
      "/pwa-512x512.png",
      "/apple-touch-icon.png",
      "/manifest.webmanifest",
      "/api/recordings",
    ],
    changelogFa: [
      "طراحی پس‌زمینه قهوه‌ای روشن و شیشه‌ای لوکس",
      "خوش‌آمدگویی خودکار زمان‌سنج هنگام روشن شدن خودرو",
      "هشدارهای هوشمند خستگی و ایمنی شب و روز",
      "یادگیری تدریجی لهجه و لحن راننده (ChatGPT Voice Mode)",
    ],
  });
});

// Android Client API Middleware (CORS + API Key Auth)
function verifyAndroidApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  const headerKey = req.header("x-api-key");
  const authHeader = req.header("authorization") || "";
  const bearerKey = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const providedKey = (headerKey || bearerKey || "").trim();

  if (!providedKey || providedKey !== ANDROID_CLIENT_API_KEY) {
    return res.status(401).json({
      error: "کلید API نامعتبر یا ارسال نشده است.",
      hint: "هدر x-api-key یا Authorization: Bearer را ارسال کنید.",
    });
  }
  return next();
}

app.options("/api/android/*", verifyAndroidApiKey);

app.get("/api/android/status", verifyAndroidApiKey, (req, res) => {
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  const activeOpenAiKey = process.env.OPENAI_API_KEY || USER_PROVIDED_OPENAI_KEY;
  const hasOpenAiKey = Boolean(activeOpenAiKey && activeOpenAiKey.trim());
  return res.json({
    status: "ok",
    authenticated: true,
    car: "BMW 728Li iDrive",
    primaryEngine: geminiKey
      ? "Google Gemini (gemini-4-hydrogen)"
      : hasOpenAiKey
      ? "OpenAI (GPT-4o-mini)"
      : "Google Gemini (gemini-4-hydrogen)",
  });
});

app.post("/api/android/chat", verifyAndroidApiKey, processCarChat);

// Dedicated standalone TTS endpoint for client speech requests
app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "متن خالی است." });
    }
    const audio = await generatePersianAudio(text);
    return res.json({
      audioBase64: audio?.audioBase64 || null,
      audioMimeType: audio?.audioMimeType || "audio/wav",
      ttsSource: audio?.ttsSource || "local-fa",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "خطا در تولید صدا" });
  }
});

// Database REST APIs for Recorded Diagnostic Logs
app.get("/api/recordings", (req, res) => {
  return res.json(recordedSessionsDb);
});

app.post("/api/recordings", (req, res) => {
  try {
    const session: RecordedSession = req.body;
    if (!session || !session.turns || session.turns.length === 0) {
      return res.status(400).json({ error: "لاگ معتبر نیست." });
    }

    const existingIndex = recordedSessionsDb.findIndex((s) => s.id === session.id);
    if (existingIndex >= 0) {
      recordedSessionsDb[existingIndex] = session;
    } else {
      recordedSessionsDb.unshift(session);
    }

    return res.json({ success: true, count: recordedSessionsDb.length, session });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "خطا در ذخیره دیتابیس" });
  }
});

app.delete("/api/recordings/:id", (req, res) => {
  const { id } = req.params;
  const index = recordedSessionsDb.findIndex((s) => s.id === id);
  if (index >= 0) {
    recordedSessionsDb.splice(index, 1);
    return res.json({ success: true, deletedId: id });
  }
  return res.status(404).json({ error: "لاگ پیدا نشد." });
});

app.delete("/api/recordings", (req, res) => {
  recordedSessionsDb.length = 0;
  return res.json({ success: true, message: "تمام لاگ‌ها پاک شدند." });
});

// AI Assistant Status & Multi-Engine Diagnostics Endpoint
app.get("/api/ai/status", async (req, res) => {
  const activeOpenAiKey = process.env.OPENAI_API_KEY || USER_PROVIDED_OPENAI_KEY;
  const hasOpenAiKey = Boolean(activeOpenAiKey && activeOpenAiKey.trim());
  const geminiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    ""
  ).trim();
  const hasGeminiKey = Boolean(geminiKey);

  return res.json({
    status: "ok",
    primary: {
      provider: "Google Gemini",
      model: "gemini-4-hydrogen",
      configured: hasGeminiKey,
      keyHint: hasGeminiKey ? "تنظیم شده" : "در انتظار کلید GEMINI_API_KEY",
    },
    fallback: {
      provider: "OpenAI",
      model: "gpt-4o-mini",
      configured: hasOpenAiKey,
      keyHint: hasOpenAiKey ? "تنظیم شده" : "تنظیم نشده",
    },
    localEcuEngine: "BMW iDrive M52TUB28 Rules (آفلاین)",
    activePrimaryEngine: hasGeminiKey
      ? "Google Gemini (gemini-4-hydrogen)"
      : hasOpenAiKey
      ? "OpenAI (GPT-4o-mini)"
      : "موتور آفلاین BMW ECU",
    needsApiKeyCheck: upstreamAuthFailed,
    lastOpenAiError: lastOpenAiError || null,
    lastGeminiError: lastGeminiError || null,
  });
});

// Real-time GPS Weather Summary via Gemini Search Grounding
interface WeatherCacheEntry {
  expiresAt: number;
  payload: {
    location: string;
    tempC: number | null;
    condition: string;
    conditionType: "clear" | "cloudy" | "rain" | "snow" | "wind" | "storm";
    humidity?: string;
    wind?: string;
    summary: string;
    drivingAdvice?: string;
    sources: Array<{ title: string; uri: string }>;
    updatedAt: string;
  };
}
const weatherGroundingCache = new Map<string, WeatherCacheEntry>();

app.post("/api/weather", async (req, res) => {
  try {
    const { lat, lon, forceRefresh } = req.body ?? {};
    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      return res.status(400).json({
        error: "INVALID_COORDINATES",
        message: "مختصات GPS معتبر ارسال نشده است.",
      });
    }

    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (!forceRefresh) {
      const cached = weatherGroundingCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json({ ok: true, ...cached.payload });
      }
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        ok: false,
        error: "MISSING_API_KEY",
        message: "کلید Gemini در بخش Settings > Secrets تنظیم نشده است.",
      });
    }

    if (!forceRefresh && Date.now() < geminiAuthBlockedUntil) {
      return res.json({
        ok: false,
        error: "API_KEY_ERROR",
        message: "کلید Gemini نامعتبر یا بدون مجوز است. لطفاً بخش Settings > Secrets را بررسی کنید.",
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: `امروز وضعیت لحظه‌ای آب‌و‌هوا برای مختصات جغرافیایی عرض ${lat.toFixed(4)} و طول ${lon.toFixed(4)} چطور است؟ نام شهر یا منطقه نزدیک، دمای فعلی به سانتی‌گراد، وضعیت آسمان، رطوبت و سرعت باد، یک خلاصه کوتاه یک‌جمله‌ای و یک نکته کوتاه ایمنی رانندگی بر اساس جستجوی زنده وب استخراج کن. خروجی را فقط به شکل یک JSON معتبر با ساختار زیر برگردان: {"location":"نام شهر یا منطقه به فارسی","tempC":20,"condition":"صاف","conditionType":"clear|cloudy|rain|snow|wind|storm","humidity":"40%","wind":"10 km/h","summary":"خلاصه کوتاه آب‌وهوا در یک جمله فارسی","drivingAdvice":"نکته کوتاه رانندگی متناسب با هوا"}`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const rawText = (response.text || "").trim();
    if (!rawText) {
      return res.json({
        ok: false,
        error: "EMPTY_WEATHER_RESPONSE",
        message: "پاسخی از سرویس جستجوی آب‌وهوا دریافت نشد.",
      });
    }

    let parsed: Record<string, any> | null = null;
    try {
      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      parsed = null;
    }

    const allowedTypes = new Set(["clear", "cloudy", "rain", "snow", "wind", "storm"]);
    const rawType = typeof parsed?.conditionType === "string" ? parsed.conditionType.toLowerCase() : "";
    const conditionType = (allowedTypes.has(rawType) ? rawType : "cloudy") as WeatherCacheEntry["payload"]["conditionType"];

    const rawTemp = Number(parsed?.tempC);
    const tempC = Number.isFinite(rawTemp) && rawTemp > -80 && rawTemp < 70 ? Math.round(rawTemp) : null;

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const seenUris = new Set<string>();
    const sources: Array<{ title: string; uri: string }> = [];
    for (const chunk of chunks) {
      const uri = chunk?.web?.uri;
      if (uri && typeof uri === "string" && !seenUris.has(uri)) {
        seenUris.add(uri);
        sources.push({
          title: (chunk?.web?.title || "منبع وب").toString().slice(0, 48),
          uri,
        });
      }
      if (sources.length >= 3) break;
    }

    const payload: WeatherCacheEntry["payload"] = {
      location:
        typeof parsed?.location === "string" && parsed.location.trim()
          ? parsed.location.trim()
          : `GPS ${lat.toFixed(2)}, ${lon.toFixed(2)}`,
      tempC,
      condition:
        typeof parsed?.condition === "string" && parsed.condition.trim()
          ? parsed.condition.trim()
          : "آب‌وهوای زنده",
      conditionType,
      humidity: typeof parsed?.humidity === "string" ? parsed.humidity.trim() : undefined,
      wind: typeof parsed?.wind === "string" ? parsed.wind.trim() : undefined,
      summary:
        typeof parsed?.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : rawText.replace(/```[\s\S]*?```/g, "").trim().slice(0, 200),
      drivingAdvice:
        typeof parsed?.drivingAdvice === "string" && parsed.drivingAdvice.trim()
          ? parsed.drivingAdvice.trim()
          : undefined,
      sources,
      updatedAt: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
    };

    lastGeminiError = "";
    upstreamAuthFailed = false;
    weatherGroundingCache.set(cacheKey, {
      expiresAt: Date.now() + 10 * 60_000,
      payload,
    });

    return res.json({ ok: true, ...payload });
  } catch (err: any) {
    const status = Number(err?.status || err?.code || 0);
    const msg = String(err?.message || "");

    if (
      status === 401 ||
      status === 403 ||
      /API_KEY_INVALID|PERMISSION_DENIED|UNAUTHENTICATED|API key not valid/i.test(msg)
    ) {
      upstreamAuthFailed = true;
      geminiAuthBlockedUntil = Date.now() + 60_000;
      lastGeminiError = "gemini-4-hydrogen: Invalid or unauthorized Gemini API key";
      return res.json({
        ok: false,
        error: "API_KEY_ERROR",
        message: "کلید Gemini نامعتبر یا بدون مجوز است. لطفاً بخش Settings > Secrets را بررسی کنید.",
      });
    }
    if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg)) {
      lastGeminiError = "gemini-4-hydrogen: Rate limit or quota exceeded";
      return res.json({
        ok: false,
        error: "RATE_LIMIT",
        message: "سقف استفاده موقت Gemini تکمیل شده است. لطفاً بعداً یا با کلید دارای سهمیه دوباره امتحان کنید.",
      });
    }
    lastGeminiError = `gemini-4-hydrogen: ${msg.slice(0, 100)}`;
    return res.json({
      ok: false,
      error: "WEATHER_FETCH_FAILED",
      message: "دریافت اطلاعات آب‌وهوا از Search Grounding ناموفق بود.",
    });
  }
});

// Serve pre-built Android APK cleanly for Nox & Android devices
app.get("/bmw728li-idrive.apk", (req, res) => {
  const candidates = [
    path.join(process.cwd(), "public", "bmw728li-idrive.apk"),
    path.join(process.cwd(), "dist", "bmw728li-idrive.apk"),
  ];
  const apkPath = candidates.find((p) => fs.existsSync(p));
  if (!apkPath) {
    return res.status(404).json({ error: "فایل APK یافت نشد." });
  }
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", 'attachment; filename="bmw728li-idrive.apk"');
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  return res.sendFile(apkPath);
});

// Direct Project Source Push to User's GitHub Repository (uses PAT in-memory only, never persisted)
app.post("/api/github/push-project", async (req, res) => {
  const rawToken = typeof req.body?.token === "string" ? req.body.token : "";
  const token = rawToken
    .trim()
    .replace(/^(Bearer|token)\s+/i, "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, "");
  const owner = typeof req.body?.owner === "string" ? req.body.owner.trim() : "";
  const repo = typeof req.body?.repo === "string" ? req.body.repo.trim() : "";
  const branch = typeof req.body?.branch === "string" && req.body.branch.trim() ? req.body.branch.trim() : "main";

  if (!token || !owner || !repo) {
    return res.status(400).json({
      success: false,
      message: "توکن گیت‌هاب، نام کاربری (Owner) و نام مخزن الزامی است.",
    });
  }

  if (!/^(gh[opusr]_|github_pat_)/i.test(token)) {
    return res.status(400).json({
      success: false,
      message: "فرمت توکن صحیح نیست! توکن گیت‌هاب باید با ghp_ یا github_pat_ شروع شود (رمز عبور اکانت یا لینک را وارد نکنید).",
    });
  }

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "bmw728li-idrive-cockpit",
  };

  try {
    const authCheck = await fetch("https://api.github.com/user", { headers: ghHeaders });
    if (authCheck.status === 401) {
      return res.status(401).json({
        success: false,
        message:
          "خطای احراز هویت گیت‌هاب (Bad credentials): این توکن باطل شده، منقضی است یا ناقص کپی شده. لطفاً با دکمه «ساخت توکن آماده» یک توکن جدید بسازید و کامل پیست کنید.",
      });
    }
  } catch {
    // Proceed to repo request which will surface network error if unreachable
  }

  const repoBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const excludedDirs = new Set([
    "node_modules",
    "dist",
    "dev-dist",
    ".git",
    "workspace",
    ".aistudio",
    "build",
    "coverage",
    "aistudio",
    "models",
  ]);

  const formatGithubError = (rawMsg?: string, fallback?: string): string => {
    const msg = String(rawMsg || "");
    if (/secondary rate limit/i.test(msg)) {
      return "محدودیت موقت نرخ ارسال گیت‌هاب (Secondary Rate Limit): به‌دلیل ارسال درخواست‌های زیاد در زمان کوتاه، گیت‌هاب آپلود را موقتاً محدود کرده است. سیستم به‌طور خودکار بهینه شد؛ لطفاً ۲ تا ۵ دقیقه صبر کرده و دوباره دکمه ارسال را بزنید.";
    }
    if (/API rate limit exceeded/i.test(msg)) {
      return "سقف مجاز درخواست ساعتی API گیت‌هاب پر شده است. لطفاً چند دقیقه دیگر دوباره امتحان کنید.";
    }
    return msg || fallback || "خطا در ارتباط با گیت‌هاب.";
  };

  const gitBlobSha1 = (buf: Buffer): string => {
    const header = Buffer.from(`blob ${buf.length}\0`, "utf8");
    return crypto.createHash("sha1").update(header).update(buf).digest("hex");
  };

  const isTextSourceFile = (relPath: string): boolean => {
    const base = path.basename(relPath);
    if (base === ".gitignore" || base === ".env.example" || base === ".nvmrc") return true;
    return /\.(tsx?|jsx?|mjs|cjs|css|scss|html|json|md|ya?ml|txt|svg|sh|xml|gradle|kt|java|properties)$/i.test(
      relPath
    );
  };

  const collectProjectFiles = (dir: string, rootDir: string): Array<{ relPath: string; absPath: string }> => {
    const out: Array<{ relPath: string; absPath: string }> = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relFromRoot = path.relative(rootDir, fullPath).split(path.sep).join("/");
      if (entry.isDirectory()) {
        if (excludedDirs.has(entry.name) || relFromRoot === "public/assets/aistudio") continue;
        out.push(...collectProjectFiles(fullPath, rootDir));
      } else if (entry.isFile()) {
        if (
          (entry.name.startsWith(".env") && entry.name !== ".env.example") ||
          entry.name === ".DS_Store" ||
          entry.name === "bun.lock" ||
          entry.name.endsWith(".idsig") ||
          entry.name.endsWith(".log")
        ) {
          continue;
        }
        const stat = fs.statSync(fullPath);
        if (stat.size > 4 * 1024 * 1024) continue;
        out.push({ relPath: relFromRoot, absPath: fullPath });
      }
    }
    return out;
  };

  const sleepMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    const rootDir = process.cwd();
    const files = collectProjectFiles(rootDir, rootDir);
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: "فایلی برای ارسال یافت نشد." });
    }

    // 1. Check current branch ref (or initialize README.md if empty repo)
    let parentSha: string | null = null;
    const refRes = await fetch(`${repoBase}/git/ref/heads/${encodeURIComponent(branch)}`, {
      headers: ghHeaders,
    });
    if (refRes.ok) {
      const refData: any = await refRes.json();
      parentSha = refData?.object?.sha || null;
    } else if (refRes.status === 404 || refRes.status === 409) {
      const readmePath = path.join(rootDir, "README.md");
      const readmeText = fs.existsSync(readmePath)
        ? fs.readFileSync(readmePath, "utf-8")
        : "# BMW 728Li iDrive Cockpit\n";
      const initRes = await fetch(`${repoBase}/contents/README.md`, {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify({
          message: "chore: initialize repository",
          content: Buffer.from(readmeText, "utf-8").toString("base64"),
          branch,
        }),
      });
      const initData: any = await initRes.json().catch(() => ({}));
      if (!initRes.ok) {
        return res.status(initRes.status).json({
          success: false,
          message: formatGithubError(initData?.message, "دسترسی به مخزن یا ساخت شاخه اولیه انجام نشد."),
        });
      }
      parentSha = initData?.commit?.sha || null;
    } else {
      const errData: any = await refRes.json().catch(() => ({}));
      return res.status(refRes.status).json({
        success: false,
        message: formatGithubError(errData?.message, "خطا در بررسی وضعیت مخزن گیت‌هاب."),
      });
    }

    // 2. Fetch existing remote tree once to skip uploading unchanged binary/text blobs
    const existingShaByPath = new Map<string, string>();
    if (parentSha) {
      try {
        const prevTreeRes = await fetch(
          `${repoBase}/git/trees/${encodeURIComponent(parentSha)}?recursive=1`,
          { headers: ghHeaders }
        );
        if (prevTreeRes.ok) {
          const prevTreeData: any = await prevTreeRes.json();
          if (Array.isArray(prevTreeData?.tree)) {
            for (const item of prevTreeData.tree) {
              if (item?.type === "blob" && item?.path && item?.sha) {
                existingShaByPath.set(String(item.path), String(item.sha));
              }
            }
          }
        }
      } catch {
        // Non-fatal; fallback to full upload
      }
    }

    // 3. Build Git tree efficiently:
    //    - Unchanged files: reuse remote SHA (0 API requests)
    //    - Changed text files: embed UTF-8 content directly in tree payload (0 /git/blobs requests)
    //    - Changed binary files: upload sequentially with gentle pacing + Retry-After backoff
    type GitTreeEntry =
      | { path: string; mode: string; type: string; sha: string }
      | { path: string; mode: string; type: string; content: string };

    const treeEntries: GitTreeEntry[] = [];
    for (const { relPath, absPath } of files) {
      const buf = fs.readFileSync(absPath);
      const localSha = gitBlobSha1(buf);
      const remoteSha = existingShaByPath.get(relPath);

      if (remoteSha && remoteSha === localSha) {
        treeEntries.push({
          path: relPath,
          mode: "100644",
          type: "blob",
          sha: remoteSha,
        });
        continue;
      }

      if (isTextSourceFile(relPath)) {
        treeEntries.push({
          path: relPath,
          mode: "100644",
          type: "blob",
          content: buf.toString("utf-8"),
        });
        continue;
      }

      // Sequential binary blob upload with Retry-After protection
      let uploadedSha: string | null = null;
      let lastBlobErr = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        const blobRes = await fetch(`${repoBase}/git/blobs`, {
          method: "POST",
          headers: ghHeaders,
          body: JSON.stringify({ content: buf.toString("base64"), encoding: "base64" }),
        });
        const blobData: any = await blobRes.json().catch(() => ({}));
        if (blobRes.ok && blobData?.sha) {
          uploadedSha = String(blobData.sha);
          break;
        }
        lastBlobErr = String(blobData?.message || "");
        if ((blobRes.status === 403 || blobRes.status === 429) && attempt === 0) {
          const retrySec = Number(blobRes.headers.get("retry-after") || "0");
          if (retrySec > 0 && retrySec <= 15) {
            await sleepMs(retrySec * 1000);
            continue;
          }
        }
        break;
      }

      if (!uploadedSha) {
        return res.status(429).json({
          success: false,
          message: formatGithubError(lastBlobErr, `خطا در آپلود ${relPath}`),
        });
      }

      treeEntries.push({
        path: relPath,
        mode: "100644",
        type: "blob",
        sha: uploadedSha,
      });
      await sleepMs(320);
    }

    const commitAndUpdateRef = async (entries: typeof treeEntries) => {
      const treeRes = await fetch(`${repoBase}/git/trees`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ tree: entries }),
      });
      const treeData: any = await treeRes.json().catch(() => ({}));
      if (!treeRes.ok || !treeData?.sha) {
        return {
          ok: false as const,
          status: treeRes.status || 500,
          message: formatGithubError(treeData?.message, "خطا در ساخت درخت فایل‌ها در گیت‌هاب."),
        };
      }

      const commitRes = await fetch(`${repoBase}/git/commits`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          message: "feat(bmw728li): sync complete iDrive Cockpit source & offline APK",
          tree: treeData.sha,
          parents: parentSha ? [parentSha] : [],
        }),
      });
      const commitData: any = await commitRes.json().catch(() => ({}));
      if (!commitRes.ok || !commitData?.sha) {
        return {
          ok: false as const,
          status: commitRes.status || 500,
          message: formatGithubError(commitData?.message, "خطا در ثبت کامیت گیت‌هاب."),
        };
      }

      const updateRefRes = await fetch(`${repoBase}/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: "PATCH",
        headers: ghHeaders,
        body: JSON.stringify({ sha: commitData.sha, force: false }),
      });
      const updateRefData: any = await updateRefRes.json().catch(() => ({}));
      if (!updateRefRes.ok) {
        return {
          ok: false as const,
          status: updateRefRes.status,
          message: formatGithubError(updateRefData?.message, "خطا در به‌روزرسانی شاخه گیت‌هاب."),
        };
      }

      return {
        ok: true as const,
        commitSha: commitData.sha as string,
        commitUrl: commitData.html_url || `https://github.com/${owner}/${repo}/commit/${commitData.sha}`,
        count: entries.length,
      };
    };

    // 4. Try full tree first; if PAT lacks `workflow` scope, retry excluding `.github/workflows/`
    let pushResult = await commitAndUpdateRef(treeEntries);
    let skippedWorkflow = false;

    if (!pushResult.ok && /workflow/i.test(pushResult.message)) {
      const entriesWithoutWorkflows = treeEntries.filter(
        (item) => !item.path.startsWith(".github/workflows/")
      );
      pushResult = await commitAndUpdateRef(entriesWithoutWorkflows);
      if (pushResult.ok) {
        skippedWorkflow = true;
      }
    }

    if (!pushResult.ok) {
      return res.status(pushResult.status).json({
        success: false,
        message: pushResult.message,
      });
    }

    // 4. Auto-configure GitHub Pages (Source: GitHub Actions) using the user's PAT
    let pagesUrl: string | undefined;
    let pagesNote = "";
    try {
      const pagesCheck = await fetch(`${repoBase}/pages`, { headers: ghHeaders });
      if (pagesCheck.ok) {
        const pagesData: any = await pagesCheck.json().catch(() => ({}));
        pagesUrl = pagesData?.html_url || `https://${owner}.github.io/${repo}/`;
        if (pagesData?.build_type !== "workflow") {
          await fetch(`${repoBase}/pages`, {
            method: "PUT",
            headers: ghHeaders,
            body: JSON.stringify({
              build_type: "workflow",
              source: { branch, path: "/" },
            }),
          });
        }
        pagesNote = " و GitHub Pages (Actions) فعال است.";
      } else if (pagesCheck.status === 404) {
        const createPagesRes = await fetch(`${repoBase}/pages`, {
          method: "POST",
          headers: ghHeaders,
          body: JSON.stringify({
            build_type: "workflow",
            source: { branch, path: "/" },
          }),
        });
        const createPagesData: any = await createPagesRes.json().catch(() => ({}));
        if (createPagesRes.ok) {
          pagesUrl = createPagesData?.html_url || `https://${owner}.github.io/${repo}/`;
          pagesNote = " و GitHub Pages خودکار فعال شد!";
        } else {
          const msg = String(createPagesData?.message || "");
          if (createPagesRes.status === 422 || createPagesRes.status === 403 || /private|plan|support/i.test(msg)) {
            pagesNote =
              " (نکته: چون مخزن Private است، برای فعال‌شدن لینک سایت GitHub Pages در اکانت رایگان، مخزن را در GitHub Settings روی Public بگذارید و دوباره این دکمه را بزنید.)";
          }
        }
      }
    } catch {
      // Non-fatal; files are already pushed
    }

    return res.json({
      success: true,
      message: skippedWorkflow
        ? `تمامی ${pushResult.count} فایل برنامه به ${owner}/${repo} ارسال شد (فایل workflow به‌دلیل نداشتن تیک workflow در توکن رد شد).`
        : `تمامی ${pushResult.count} فایل پروژه با موفقیت به ${owner}/${repo} ارسال شد.${pagesNote}`,
      commitUrl: pushResult.commitUrl,
      pagesUrl,
      filesCount: pushResult.count,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "خطای غیرمنتظره هنگام ارسال پروژه به گیت‌هاب.",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Car Headunit Server running on http://localhost:${PORT}`);
  });
}

startServer();
