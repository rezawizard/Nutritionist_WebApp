const BUILD_MARKER_ID = "dietoy-final-build-marker";
const BUILD_LABEL = "Dietoy Final Build 0.3.0 · تغییرات جدید فعال است";

function installBuildMarker() {
  if (document.getElementById(BUILD_MARKER_ID)) return;
  const marker = document.createElement("div");
  marker.id = BUILD_MARKER_ID;
  marker.textContent = BUILD_LABEL;
  marker.style.position = "fixed";
  marker.style.left = "16px";
  marker.style.bottom = "16px";
  marker.style.zIndex = "999999";
  marker.style.padding = "8px 12px";
  marker.style.borderRadius = "999px";
  marker.style.background = "#0f5b46";
  marker.style.color = "#fff";
  marker.style.fontFamily = "Vazirmatn, sans-serif";
  marker.style.fontSize = "12px";
  marker.style.fontWeight = "700";
  marker.style.boxShadow = "0 12px 28px rgba(15, 91, 70, 0.28)";
  marker.style.direction = "rtl";
  marker.style.pointerEvents = "none";
  document.body.appendChild(marker);
}

window.addEventListener("DOMContentLoaded", installBuildMarker);
window.setTimeout(installBuildMarker, 800);
