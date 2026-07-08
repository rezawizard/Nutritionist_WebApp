import { convertFileSrc } from "@tauri-apps/api/core";

function isDesktopRuntime() {
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

function maybeFilePath(src: string) {
  return /^(?:[a-zA-Z]:\\|\\\\|\/Users\/|\/home\/|\/mnt\/|\/var\/|\/tmp\/)/.test(src) && !src.startsWith("asset://") && !src.startsWith("http") && !src.startsWith("data:");
}

function polishImages() {
  if (!isDesktopRuntime()) return;
  document.querySelectorAll("img").forEach((img) => {
    const current = img.getAttribute("src") || "";
    if (!current || !maybeFilePath(current)) return;
    try {
      img.src = convertFileSrc(current);
      img.dataset.dietoyFileSrc = "true";
    } catch {
      // keep original src if conversion fails
    }
  });
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  window.setTimeout(() => {
    scheduled = false;
    polishImages();
  }, 120);
}

window.addEventListener("DOMContentLoaded", schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
