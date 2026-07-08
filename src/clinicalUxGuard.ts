type FieldIssue = { label: string; message: string };

let observerStarted = false;
let scheduled = false;

function faToEnDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function stripThousandsFromDateText(value: string) {
  return value.replace(/([۰-۹٠-٩0-9]),([۰-۹٠-٩0-9]{3})/g, "$1$2");
}

function normalizeNumbersInsideCalendars() {
  const labels = Array.from(document.querySelectorAll("label.relative.block"));
  for (const label of labels) {
    const input = label.querySelector<HTMLInputElement>("input.control.numbers");
    if (!input) continue;
    const calendar = input.nextElementSibling;
    if (!calendar) continue;
    const nodes = Array.from(calendar.querySelectorAll<HTMLElement>("span, button"));
    for (const node of nodes) {
      const next = stripThousandsFromDateText(node.textContent || "");
      if (next !== node.textContent) node.textContent = next;
    }
  }
}

function closeCalendarAfterDayClick() {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const dateLabel = target.closest("label.relative.block");
      if (!dateLabel) return;
      const input = dateLabel.querySelector<HTMLInputElement>("input.control.numbers");
      if (!input) return;
      const text = faToEnDigits(target.textContent || "").trim();
      if (!/^\d{1,2}$/.test(text)) return;
      window.setTimeout(() => input.blur(), 80);
    },
    true,
  );
}

function findProfileRoot() {
  const heading = Array.from(document.querySelectorAll("h1")).find((item) => {
    const text = item.textContent || "";
    return text.includes("پرونده مراجع") || text.includes("ثبت مراجع جدید");
  });
  const header = heading?.closest("header");
  const section = header?.nextElementSibling;
  return section instanceof HTMLElement ? section : null;
}

function readFieldByLabel(labelText: string) {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>("label"));
  const label = labels.find((item) => (item.textContent || "").includes(labelText));
  const input = label?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
  return input?.value?.trim() || "";
}

function numericValue(value: string) {
  const clean = faToEnDigits(value).replace(/[^0-9.-]/g, "");
  return Number(clean);
}

function validateClientProfile(): FieldIssue[] {
  if (!findProfileRoot()) return [];

  const issues: FieldIssue[] = [];
  const fullName = readFieldByLabel("نام کامل");
  const age = numericValue(readFieldByLabel("سن"));
  const height = numericValue(readFieldByLabel("قد فعلی"));
  const weight = numericValue(readFieldByLabel("وزن فعلی"));
  const nextVisit = readFieldByLabel("تاریخ مراجعه بعدی");

  if (!fullName) issues.push({ label: "نام کامل", message: "نام مراجع وارد نشده است." });
  if (!Number.isFinite(age) || age < 1 || age > 120) issues.push({ label: "سن", message: "سن باید عددی معتبر بین ۱ تا ۱۲۰ باشد." });
  if (!Number.isFinite(height) || height < 50 || height > 250) issues.push({ label: "قد", message: "قد واردشده معتبر نیست. مقدار معمولاً باید بین ۵۰ تا ۲۵۰ سانتی‌متر باشد." });
  if (!Number.isFinite(weight) || weight < 2 || weight > 400) issues.push({ label: "وزن", message: "وزن واردشده معتبر نیست. مقدار معمولاً باید بین ۲ تا ۴۰۰ کیلوگرم باشد." });

  if (nextVisit && !/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(faToEnDigits(nextVisit))) {
    issues.push({ label: "تاریخ مراجعه بعدی", message: "تاریخ مراجعه بعدی باید با قالب ۱۴۰۵/۰۴/۱۷ وارد شود یا خالی بماند." });
  }

  return issues;
}

function showValidationPanel(issues: FieldIssue[]) {
  document.querySelector(".clinical-validation-panel")?.remove();
  const panel = document.createElement("div");
  panel.className = "clinical-validation-panel";

  const title = document.createElement("p");
  title.className = "clinical-validation-title";
  title.textContent = "ذخیره انجام نشد؛ موارد زیر را اصلاح کنید";

  const list = document.createElement("ul");
  for (const issue of issues) {
    const item = document.createElement("li");
    item.innerHTML = `<strong>${issue.label}:</strong> ${issue.message}`;
    list.appendChild(item);
  }

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "متوجه شدم";
  close.onclick = () => panel.remove();

  panel.append(title, list, close);
  document.body.appendChild(panel);
  window.setTimeout(() => panel.classList.add("is-visible"), 20);
}

function guardProfileSaveClicks() {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement)) return;
      if (!(button.textContent || "").includes("ذخیره پرونده")) return;
      const issues = validateClientProfile();
      if (issues.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showValidationPanel(issues);
    },
    true,
  );
}

function makeClientCardsOpenProfile() {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(".card.flex.flex-col.gap-4.p-4"));
  for (const row of rows) {
    if (row.dataset.openProfileEnhanced === "true") continue;
    const editButton = Array.from(row.querySelectorAll<HTMLButtonElement>("button")).find((button) => (button.textContent || "").includes("ویرایش"));
    if (!editButton) continue;
    row.dataset.openProfileEnhanced = "true";
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.classList.add("client-row-clickable");
    row.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("button")) return;
      editButton.click();
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      editButton.click();
    });
  }
}

function enhanceGenericErrorToasts() {
  const toasts = Array.from(document.querySelectorAll<HTMLElement>(".fixed .rounded-control"));
  for (const toast of toasts) {
    if (toast.dataset.errorEnhanced === "true") continue;
    const text = toast.textContent || "";
    if (!text.includes("ذخیره انجام نشد") && !text.includes("ثبت") && !text.includes("انجام نشد")) continue;
    toast.dataset.errorEnhanced = "true";
    if (text.includes("ذخیره انجام نشد")) {
      toast.textContent = "ذخیره انجام نشد. فیلدهای ضروری، تاریخ، قد و وزن را بررسی کنید. اگر فایل انتخاب کرده‌اید، مسیر فایل باید قابل دسترسی باشد.";
    }
  }
}

function hydrate() {
  normalizeNumbersInsideCalendars();
  makeClientCardsOpenProfile();
  enhanceGenericErrorToasts();
}

function scheduleHydrate() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    hydrate();
  });
}

export function installClinicalUxGuard() {
  closeCalendarAfterDayClick();
  guardProfileSaveClicks();
  scheduleHydrate();
  if (observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver(scheduleHydrate);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", installClinicalUxGuard);
  installClinicalUxGuard();
}
