type ProfileTabKey = "base" | "records" | "attachments" | "visits";

type ProfileSectionMap = Partial<Record<ProfileTabKey, HTMLElement>>;

const tabs: Array<{ key: ProfileTabKey; label: string }> = [
  { key: "base", label: "اطلاعات پایه" },
  { key: "records", label: "رکوردها" },
  { key: "attachments", label: "بادی‌آنالیز و پیوست‌ها" },
  { key: "visits", label: "ویزیت‌ها و خدمات" },
];

let scheduled = false;
let observerStarted = false;

function isProfileHeader(element: Element) {
  const text = element.textContent || "";
  return text.includes("پرونده مراجع") || text.includes("ثبت مراجع جدید");
}

function findProfileSection() {
  const heading = Array.from(document.querySelectorAll("h1")).find(isProfileHeader);
  const header = heading?.closest("header");
  const section = header?.nextElementSibling;
  return section instanceof HTMLElement ? section : null;
}

function sectionTitle(element: Element) {
  return element.querySelector("h2")?.textContent?.trim() || "";
}

function collectSections(section: HTMLElement): ProfileSectionMap {
  const [baseCard, modulesContainer] = Array.from(section.children).filter(
    (item): item is HTMLElement => item instanceof HTMLElement,
  );
  const map: ProfileSectionMap = {};
  if (baseCard?.classList.contains("card")) map.base = baseCard;

  const moduleCards = Array.from(modulesContainer?.children || []).filter(
    (item): item is HTMLElement => item instanceof HTMLElement && item.classList.contains("card"),
  );

  for (const card of moduleCards) {
    const title = sectionTitle(card);
    if (title.includes("رکوردهای پایش")) map.records = card;
    if (title.includes("بادی‌آنالیز") || title.includes("پیوست")) map.attachments = card;
    if (title.includes("ویزیت") || title.includes("خدمات")) map.visits = card;
  }

  return map;
}

function createTabsBar(section: HTMLElement) {
  let bar = document.querySelector<HTMLElement>(".profile-tabs-bar");
  if (bar) return bar;

  bar = document.createElement("div");
  bar.className = "profile-tabs-bar";
  bar.setAttribute("role", "tablist");

  for (const tab of tabs) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.profileTab = tab.key;
    button.setAttribute("role", "tab");
    button.textContent = tab.label;
    bar.appendChild(button);
  }

  section.parentElement?.insertBefore(bar, section);
  return bar;
}

function getActiveTab(map: ProfileSectionMap): ProfileTabKey {
  const saved = sessionStorage.getItem("dietoy-profile-tab") as ProfileTabKey | null;
  if (saved && map[saved]) return saved;
  return "base";
}

function applyTab(section: HTMLElement, map: ProfileSectionMap, active: ProfileTabKey) {
  const [baseCard, modulesContainer] = Array.from(section.children).filter(
    (item): item is HTMLElement => item instanceof HTMLElement,
  );

  if (baseCard) baseCard.style.display = active === "base" ? "block" : "none";
  if (modulesContainer) modulesContainer.style.display = active === "base" ? "none" : "grid";

  for (const tab of tabs) {
    const element = map[tab.key];
    if (!element || tab.key === "base") continue;
    element.style.display = tab.key === active ? "block" : "none";
  }

  const buttons = document.querySelectorAll<HTMLButtonElement>(".profile-tabs-bar [data-profile-tab]");
  for (const button of buttons) {
    const isActive = button.dataset.profileTab === active;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  }
}

function hydrateProfileTabs() {
  const section = findProfileSection();
  const oldBar = document.querySelector<HTMLElement>(".profile-tabs-bar");

  if (!section) {
    oldBar?.remove();
    return;
  }

  const map = collectSections(section);
  if (!map.base || !map.records || !map.attachments || !map.visits) return;

  const bar = createTabsBar(section);
  const active = getActiveTab(map);
  applyTab(section, map, active);

  bar.onclick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const key = target.dataset.profileTab as ProfileTabKey | undefined;
    if (!key || !map[key]) return;
    sessionStorage.setItem("dietoy-profile-tab", key);
    applyTab(section, map, key);
  };
}

function scheduleHydrate() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    hydrateProfileTabs();
  });
}

export function installProfileTabs() {
  scheduleHydrate();
  if (observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver(scheduleHydrate);
  observer.observe(document.body, { childList: true, subtree: true });
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", installProfileTabs);
  installProfileTabs();
}
