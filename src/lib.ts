import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ActivityLevel, Client, Gender, Goal } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const genderLabels: Record<Gender, string> = {
  female: "خانم",
  male: "آقا",
};

export const activityLabels: Record<ActivityLevel, string> = {
  sedentary: "کم‌تحرک",
  light: "فعالیت سبک",
  moderate: "فعالیت متوسط",
  active: "فعال",
  very_active: "بسیار فعال",
};

export const goalLabels: Record<Goal, string> = {
  lose: "کاهش وزن",
  maintain: "ثبات وزن",
  gain: "افزایش وزن",
};

export const activityFactors: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const emptyClient: Client = {
  full_name: "",
  phone: "",
  email: "",
  profile_image_path: "",
  gender: "female",
  age: 30,
  height_cm: 165,
  weight_kg: 65,
  activity_level: "moderate",
  goal: "maintain",
  notes: "",
  archived: false,
};

export function bmiCategory(bmi: number) {
  if (bmi < 18.5) return "کمبود وزن";
  if (bmi < 25) return "محدوده طبیعی";
  if (bmi < 30) return "اضافه وزن";
  return "چاقی";
}

export function clampNumber(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function calculateNutrition(input: Pick<Client, "gender" | "age" | "height_cm" | "weight_kg" | "activity_level" | "goal">) {
  const age = clampNumber(input.age, 30);
  const height = clampNumber(input.height_cm, 165);
  const weight = clampNumber(input.weight_kg, 65);
  const bmi = weight / Math.pow(height / 100, 2);
  const bmr = 10 * weight + 6.25 * height - 5 * age + (input.gender === "male" ? 5 : -161);
  const tdee = bmr * activityFactors[input.activity_level];
  const targetCalories = input.goal === "lose" ? tdee - 500 : input.goal === "gain" ? tdee + 300 : tdee;

  return {
    bmi,
    bmr,
    tdee,
    targetCalories,
    proteinGrams: (targetCalories * 0.25) / 4,
    carbsGrams: (targetCalories * 0.45) / 4,
    fatGrams: (targetCalories * 0.3) / 9,
  };
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatPersianDate(date: Date | string = new Date()) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const faDigits = "۰۱۲۳۴۵۶۷۸۹";
const arDigits = "٠١٢٣٤٥٦٧٨٩";

export function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => faDigits[Number(digit)]);
}

export function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(faDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arDigits.indexOf(digit)));
}

function div(a: number, b: number) {
  return Math.trunc(a / b);
}

function gregorianToDay(gy: number, gm: number, gd: number) {
  let day =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * ((gm + 9) % 12) + 2, 5) +
    gd -
    34840408;
  day = day - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return day;
}

function dayToGregorian(day: number) {
  let j = 4 * day + 139361631;
  j = j + div(div(4 * day + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div((j % 1461), 4) * 5 + 308;
  const gd = div((i % 153), 5) + 1;
  const gm = ((div(i, 153) % 12) + 1);
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function jalaliToDay(jy: number, jm: number, jd: number) {
  const r = jalaliCalendar(jy);
  return gregorianToDay(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function dayToJalali(day: number) {
  const gy = dayToGregorian(day).gy;
  let jy = gy - 621;
  let r = jalaliCalendar(jy);
  const jdn1f = gregorianToDay(gy, 3, r.march);
  let k = day - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: (k % 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: (k % 30) + 1 };
}

function jalaliCalendar(jy: number) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm = 0;
  let jump = 0;

  for (let i = 1; i < breaks.length; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div((jump % 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(((n % 33) + 3), 4);
  if (jump % 33 === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = (((n + 1) % 33) - 1) % 4;
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isoToJalaliInput(value: string) {
  const iso = isValidIsoDate(value) ? value : todayIsoDate();
  const [gy, gm, gd] = iso.split("-").map(Number);
  const { jy, jm, jd } = dayToJalali(gregorianToDay(gy, gm, gd));
  return `${toPersianDigits(jy)}/${toPersianDigits(String(jm).padStart(2, "0"))}/${toPersianDigits(String(jd).padStart(2, "0"))}`;
}

export function jalaliInputToIso(value: string) {
  const normalized = normalizeDigits(value.trim()).replace(/[.\-\s]/g, "/");
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (jm < 1 || jm > 12 || jd < 1 || jd > daysInJalaliMonth(jy, jm)) return null;
  const { gy, gm, gd } = dayToGregorian(jalaliToDay(jy, jm, jd));
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

export function jalaliPartsFromIso(value: string) {
  const [gy, gm, gd] = (isValidIsoDate(value) ? value : todayIsoDate()).split("-").map(Number);
  return dayToJalali(gregorianToDay(gy, gm, gd));
}

export function daysInJalaliMonth(year: number, month: number) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return jalaliCalendar(year).leap === 0 ? 30 : 29;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
