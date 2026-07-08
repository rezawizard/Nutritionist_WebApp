const faDigits = "۰۱۲۳۴۵۶۷۸۹";

function toFa(value: string | number) {
  return String(value).replace(/\d/g, (digit) => faDigits[Number(digit)]);
}

function normalizeNumber(value: string) {
  const normalized = value
    .replace(/[۰-۹]/g, (digit) => String(faDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^0-9.\-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function format(value: number, digits = 0) {
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value).replace(/٬/g, "");
}

function findCalculatorRoot() {
  return Array.from(document.querySelectorAll("h1,h2")).find((el) => /ماشین حساب|محاسبات/.test(el.textContent || ""))?.closest("main") || null;
}

function readCalculatorInputs(root: Element) {
  const labels = Array.from(root.querySelectorAll("label"));
  const readByLabel = (pattern: RegExp) => {
    const label = labels.find((item) => pattern.test(item.textContent || ""));
    const input = label?.parentElement?.querySelector("input") || label?.querySelector("input");
    return normalizeNumber((input as HTMLInputElement | null)?.value || "0");
  };
  const genderSelect = labels.find((item) => /جنسیت/.test(item.textContent || ""))?.parentElement?.querySelector("select") as HTMLSelectElement | null;
  const activitySelect = labels.find((item) => /سطح فعالیت/.test(item.textContent || ""))?.parentElement?.querySelector("select") as HTMLSelectElement | null;
  const goalSelect = labels.find((item) => /هدف/.test(item.textContent || ""))?.parentElement?.querySelector("select") as HTMLSelectElement | null;

  return {
    age: readByLabel(/سن/),
    height: readByLabel(/قد/),
    weight: readByLabel(/وزن/),
    gender: genderSelect?.value || "female",
    activity: activitySelect?.value || "moderate",
    goal: goalSelect?.value || "maintain",
  };
}

function compute(values: ReturnType<typeof readCalculatorInputs>) {
  const height = values.height || 165;
  const weight = values.weight || 65;
  const heightM = height / 100;
  const bmi = weight / (heightM * heightM);
  const ibw = 22 * heightM * heightM;
  const abw = ibw + (weight - ibw) / 4;
  const genderFactor = values.gender === "male" ? 1 : 0.95;
  const bmr = 24 * genderFactor * abw * 1.1;
  const activityFactors: Record<string, number> = { sedentary: 1.3, light: 1.3, moderate: 1.3, active: 1.3, very_active: 1.3 };
  const tee = bmr * (activityFactors[values.activity] || 1.3);
  const target = tee + (values.goal === "lose" ? -500 : values.goal === "gain" ? 300 : 0);
  return {
    bmi,
    ibw,
    abw,
    bmr,
    tee,
    target,
    protein: (target * 0.2) / 4,
    carbs: (target * 0.5) / 4,
    fat: (target * 0.3) / 9,
  };
}

function setCard(root: Element, title: string, value: string, unit: string, helper: string) {
  const cards = Array.from(root.querySelectorAll(".card"));
  const existing = cards.find((card) => (card.textContent || "").includes(title));
  if (!existing) return false;
  const valueEl = existing.querySelector(".numbers.text-4xl, .numbers");
  const unitEl = Array.from(existing.querySelectorAll("p")).find((p) => (p.textContent || "").includes("کیلوکالری") || (p.textContent || "").includes("گرم") || (p.textContent || "").includes("کیلوگرم") || (p.textContent || "").includes("kg"));
  const helperEl = Array.from(existing.querySelectorAll("p")).at(-1);
  if (valueEl) valueEl.textContent = value;
  if (unitEl) unitEl.textContent = unit;
  if (helperEl) helperEl.textContent = helper;
  return true;
}

function makeCard(title: string, value: string, unit: string, helper: string) {
  const div = document.createElement("div");
  div.className = "card p-5 delivery-calc-card";
  div.innerHTML = `
    <p class="text-sm font-semibold text-warm-500">${title}</p>
    <div class="mt-5 flex items-end gap-2"><p class="numbers text-4xl font-bold text-charcoal">${value}</p><p class="pb-1 text-sm text-olive">${unit}</p></div>
    <p class="mt-4 text-xs leading-6 text-warm-500">${helper}</p>
  `;
  return div;
}

function polishCalculator() {
  const root = findCalculatorRoot();
  if (!root) return;
  const heading = Array.from(root.querySelectorAll("h1")).find((el) => /ماشین حساب/.test(el.textContent || ""));
  if (heading) heading.textContent = "محاسبات تغذیه";
  const values = compute(readCalculatorInputs(root));
  setCard(root, "BMI", format(values.bmi, 1), values.bmi < 18.5 ? "کمبود وزن" : values.bmi < 25 ? "محدوده طبیعی" : values.bmi < 30 ? "اضافه وزن" : "چاقی", "نمای سریع وضعیت وزنی بر اساس قد و وزن.");
  setCard(root, "BMR", format(values.bmr), "کیلوکالری", "انرژی پایه بر اساس ABW و ضرایب تخصصی برنامه.");
  setCard(root, "TDEE", format(values.tee), "کیلوکالری", "TEE؛ نیاز انرژی روزانه با ضریب فعالیت.");
  setCard(root, "کالری هدف", format(values.target), "کیلوکالری", "بر اساس TEE و هدف کاهش، ثبات یا افزایش وزن.");
  setCard(root, "پروتئین", format(values.protein), "گرم", "پیش‌فرض ۲۰٪ از کالری هدف.");
  setCard(root, "کربوهیدرات", format(values.carbs), "گرم", "پیش‌فرض ۵۰٪ از کالری هدف.");
  setCard(root, "چربی", format(values.fat), "گرم", "پیش‌فرض ۳۰٪ از کالری هدف.");

  const resultGrid = Array.from(root.querySelectorAll("section")).find((section) => (section.textContent || "").includes("BMR") && (section.textContent || "").includes("کالری هدف"));
  if (resultGrid && !resultGrid.querySelector(".delivery-calc-card")) {
    resultGrid.insertBefore(makeCard("IBW", format(values.ibw, 1), "کیلوگرم", "وزن ایده‌آل بر اساس BMI هدف ۲۲."), resultGrid.children[1] || null);
    resultGrid.insertBefore(makeCard("ABW", format(values.abw, 1), "کیلوگرم", "وزن تعدیل‌شده برای محاسبه BMR."), resultGrid.children[2] || null);
  }
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  window.setTimeout(() => {
    scheduled = false;
    polishCalculator();
  }, 120);
}

window.addEventListener("DOMContentLoaded", schedule);
document.addEventListener("input", schedule, true);
document.addEventListener("change", schedule, true);
document.addEventListener("click", schedule, true);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
