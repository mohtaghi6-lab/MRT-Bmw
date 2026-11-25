import { MusicTrack } from "../types";

const DB_NAME = "bmw728li_usb_vault";
const DB_VERSION = 1;
const TRACKS_STORE = "tracks";
const HANDLES_STORE = "handles";
const LAST_POS_KEY = "bmw728li_last_usb_pos_v1";

const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|aac|flac|ogg|opus|wma|webm|mp4)$/i;

export interface StoredUsbTrackRecord {
  id: string;
  title: string;
  artist: string;
  duration: string;
  fileSize: string;
  fileName: string;
  lastModified: number;
  byteSize: number;
  blob: Blob;
  addedAt: number;
}

const activeBlobUrls = new Map<string, string>();

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TRACKS_STORE)) {
        db.createObjectStore(TRACKS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(HANDLES_STORE)) {
        db.createObjectStore(HANDLES_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open USB vault"));
  });
}

function formatSecondsMMSS(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return "03:40";
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function readAudioDuration(fileOrBlob: Blob): Promise<string> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve("03:40");
      return;
    }
    const tempUrl = URL.createObjectURL(fileOrBlob);
    const audio = document.createElement("audio");
    let settled = false;
    const finish = (durStr: string) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(tempUrl);
      resolve(durStr);
    };
    const timeout = window.setTimeout(() => finish("03:40"), 1500);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      finish(formatSecondsMMSS(audio.duration));
    };
    audio.onerror = () => {
      window.clearTimeout(timeout);
      finish("03:40");
    };
    audio.src = tempUrl;
  });
}

function recordToMusicTrack(rec: StoredUsbTrackRecord): MusicTrack {
  let url = activeBlobUrls.get(rec.id);
  if (!url && rec.blob) {
    url = URL.createObjectURL(rec.blob);
    activeBlobUrls.set(rec.id, url);
  }
  return {
    id: rec.id,
    title: rec.title,
    artist: rec.artist,
    duration: rec.duration || "03:40",
    url,
    isFlash: true,
    fileSize: rec.fileSize,
    fileName: rec.fileName,
  };
}

export async function loadUsbTracksFromVault(): Promise<MusicTrack[]> {
  try {
    const db = await openVaultDb();
    const records: StoredUsbTrackRecord[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, "readonly");
      const store = tx.objectStore(TRACKS_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as StoredUsbTrackRecord[]);
      req.onerror = () => reject(req.error);
    });
    records.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    return records.map(recordToMusicTrack);
  } catch {
    return [];
  }
}

export async function saveUsbFilesToVault(files: FileList | File[]): Promise<MusicTrack[]> {
  const fileArray = Array.from(files).filter(
    (f) => f.type.startsWith("audio/") || AUDIO_EXTENSIONS.test(f.name)
  );
  if (fileArray.length === 0) return [];

  const db = await openVaultDb();

  // Read existing metadata keys to avoid duplicates across re-inserts
  const existingKeys = new Set<string>();
  try {
    const existing: StoredUsbTrackRecord[] = await new Promise((resolve) => {
      const tx = db.transaction(TRACKS_STORE, "readonly");
      const req = tx.objectStore(TRACKS_STORE).getAll();
      req.onsuccess = () => resolve((req.result || []) as StoredUsbTrackRecord[]);
      req.onerror = () => resolve([]);
    });
    for (const item of existing) {
      existingKeys.add(`${item.fileName}__${item.byteSize}`);
    }
  } catch {}

  const preparedRecords: StoredUsbTrackRecord[] = [];
  const baseTs = Date.now();

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const dedupKey = `${file.name}__${file.size}`;
    if (existingKeys.has(dedupKey)) continue;
    existingKeys.add(dedupKey);

    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const duration = await readAudioDuration(file);

    preparedRecords.push({
      id: `usb-${baseTs}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      title: cleanName,
      artist: "فلش USB خودرو (ذخیره دائمی)",
      duration,
      fileSize: `${sizeMB} MB`,
      fileName: file.name,
      lastModified: file.lastModified || baseTs,
      byteSize: file.size,
      blob: file,
      addedAt: baseTs + i,
    });
  }

  if (preparedRecords.length > 0) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, "readwrite");
      const store = tx.objectStore(TRACKS_STORE);
      for (const rec of preparedRecords) {
        store.put(rec);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return preparedRecords.map(recordToMusicTrack);
}

async function collectFilesFromDirectoryHandle(dirHandle: any, depth = 0): Promise<File[]> {
  if (!dirHandle || depth > 4) return [];
  const collected: File[] = [];
  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === "file") {
        try {
          const file: File = await entry.getFile();
          if (file.type.startsWith("audio/") || AUDIO_EXTENSIONS.test(file.name)) {
            collected.push(file);
          }
        } catch {}
      } else if (entry.kind === "directory") {
        const subFiles = await collectFilesFromDirectoryHandle(entry, depth + 1);
        collected.push(...subFiles);
      }
    }
  } catch {}
  return collected;
}

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as any).showDirectoryPicker === "function";
}

export async function pickAndPersistUsbFolder(): Promise<{
  tracks: MusicTrack[];
  folderName: string;
} | null> {
  if (!isDirectoryPickerSupported()) return null;
  const dirHandle = await (window as any).showDirectoryPicker({ mode: "read" });
  if (!dirHandle) return null;

  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(HANDLES_STORE, "readwrite");
      tx.objectStore(HANDLES_STORE).put({
        key: "usb_dir_handle",
        handle: dirHandle,
        folderName: dirHandle.name || "USB Flash",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}

  const files = await collectFilesFromDirectoryHandle(dirHandle);
  const newTracks = await saveUsbFilesToVault(files);
  const allTracks = await loadUsbTracksFromVault();
  return {
    tracks: allTracks.length > 0 ? allTracks : newTracks,
    folderName: dirHandle.name || "USB Flash",
  };
}

export async function syncSavedUsbFolderIfPermitted(): Promise<MusicTrack[]> {
  if (typeof window === "undefined") return [];
  try {
    const db = await openVaultDb();
    const saved: any = await new Promise((resolve) => {
      const tx = db.transaction(HANDLES_STORE, "readonly");
      const req = tx.objectStore(HANDLES_STORE).get("usb_dir_handle");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (!saved?.handle) return [];

    const perm = await saved.handle.queryPermission?.({ mode: "read" });
    if (perm !== "granted") return [];

    const files = await collectFilesFromDirectoryHandle(saved.handle);
    if (files.length > 0) {
      await saveUsbFilesToVault(files);
    }
    return await loadUsbTracksFromVault();
  } catch {
    return [];
  }
}

export async function removeUsbTrackFromVault(id: string): Promise<void> {
  const existingUrl = activeBlobUrls.get(id);
  if (existingUrl) {
    URL.revokeObjectURL(existingUrl);
    activeBlobUrls.delete(id);
  }
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(TRACKS_STORE, "readwrite");
      tx.objectStore(TRACKS_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

export async function clearUsbVault(): Promise<void> {
  for (const url of activeBlobUrls.values()) {
    URL.revokeObjectURL(url);
  }
  activeBlobUrls.clear();
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([TRACKS_STORE, HANDLES_STORE], "readwrite");
      tx.objectStore(TRACKS_STORE).clear();
      tx.objectStore(HANDLES_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

export function saveLastTrackPosition(trackId: string, trackIndex: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LAST_POS_KEY, JSON.stringify({ trackId, trackIndex }));
  } catch {}
}

export function loadLastTrackPosition(): { trackId?: string; trackIndex?: number } {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(LAST_POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}
