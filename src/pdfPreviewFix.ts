import { invoke } from "@tauri-apps/api/core";

let observerStarted = false;
let scheduled = false;

function isLocalPdfFrame(frame: HTMLIFrameElement) {
  const src = frame.getAttribute("src") || "";
  return src.includes("asset.localhost") || src.startsWith("asset://") || src.startsWith("file://");
}

function pathFromAssetUrl(src: string) {
  try {
    const url = new URL(src);
    let path = decodeURIComponent(url.pathname || "");
    if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1);
    return path.replace(/\//g, "\\");
  } catch {
    return "";
  }
}

function fileUrlFromPath(path: string) {
  if (!path) return "";
  const normalized = path.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(normalized)) return `file:///${normalized}`;
  if (normalized.startsWith("/")) return `file://${normalized}`;
  return `file:///${normalized}`;
}

async function openPath(path: string, fallbackUrl: string) {
  try {
    await invoke("plugin:opener|open_path", { path });
    return;
  } catch {
    if (fallbackUrl) window.open(fallbackUrl, "_blank", "noreferrer");
  }
}

function replaceFrame(frame: HTMLIFrameElement) {
  if (frame.dataset.pdfFallbackApplied === "true") return;
  frame.dataset.pdfFallbackApplied = "true";

  const src = frame.getAttribute("src") || "";
  const path = pathFromAssetUrl(src);
  const fallbackUrl = fileUrlFromPath(path);

  const panel = document.createElement("div");
  panel.className = "pdf-fallback-panel";

  const title = document.createElement("p");
  title.className = "pdf-fallback-title";
  title.textContent = "نمایش داخلی PDF در WebView محدود شد";

  const text = document.createElement("p");
  text.className = "pdf-fallback-text";
  text.textContent = "برای جلوگیری از خطای asset.localhost، PDF را با viewer سیستم باز کنید.";

  const actions = document.createElement("div");
  actions.className = "pdf-fallback-actions";

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.textContent = "باز کردن PDF";
  openButton.onclick = () => openPath(path, fallbackUrl);

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "کپی مسیر فایل";
  copyButton.onclick = async () => {
    if (!path) return;
    await navigator.clipboard?.writeText(path);
    copyButton.textContent = "کپی شد";
    window.setTimeout(() => {
      copyButton.textContent = "کپی مسیر فایل";
    }, 1600);
  };

  actions.append(openButton, copyButton);
  panel.append(title, text, actions);

  if (path) {
    const pathText = document.createElement("p");
    pathText.className = "pdf-fallback-path";
    pathText.textContent = path;
    panel.append(pathText);
  }

  frame.replaceWith(panel);
}

function hydratePdfFallbacks() {
  const frames = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe"));
  for (const frame of frames) {
    if (isLocalPdfFrame(frame)) replaceFrame(frame);
  }
}

function scheduleHydrate() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    hydratePdfFallbacks();
  });
}

export function installPdfPreviewFix() {
  scheduleHydrate();
  if (observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver(scheduleHydrate);
  observer.observe(document.body, { childList: true, subtree: true });
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", installPdfPreviewFix);
  installPdfPreviewFix();
}
