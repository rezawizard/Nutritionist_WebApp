import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ActivityLevel, Client, Gender, Goal, Settings } from "./types";

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

export const visitStatusLabels = {
  tentative: "موقت",
  confirmed: "قطعی",
} as const;

export const defaultCalculationSettings = {
  calc_ibw_bmi_factor: 22,
  calc_abw_divisor: 4,
  calc_bmr_base: 24,
  calc_male_factor: 1,
  calc_female_factor: 0.95,
  calc_bmr_adjustment: 1.1,
  calc_activity_sedentary: 1.3,
  calc_activity_light: 1.3,
  calc_activity_moderate: 1.3,
  calc_activity_active: 1.3,
  calc_activity_very_active: 1.3,
  calc_goal_loss: -500,
  calc_goal_maintain: 0,
  calc_goal_gain: 300,
  macro_protein_percent: 20,
  macro_carb_percent: 50,
  macro_fat_percent: 30,
};

export const activityFactors: Record<ActivityLevel, number> = {
  sedentary: 1.3,
  light: 1.3,
  moderate: 1.3,
  active: 1.3,
  very_active: 1.3,
};

export const emptyClient: Client = {
  full_name: "",
  phone: "",
  email: "",
  profile_image_path: "",
  next_visit_date: "",
  next_visit_status: "tentative",
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

function settingNumber(settings: Partial<Settings> | undefined, key: keyof typeof defaultCalculationSettings) {
  const value = Number(settings?.[key as keyof Settings]);
  if (key === "calc_goal_maintain" || key === "calc_goal_loss" || key === "calc_goal_gain") {
    return Number.isFinite(value) ? value : defaultCalculationSettings[key];
  }
  return Number.isFinite(value) && value > 0 ? value : defaultCalculationSettings[key];
}

function activityFactor(level: ActivityLevel, settings?: Partial<Settings>) {
  const map: Record<ActivityLevel, keyof typeof defaultCalculationSettings> = {
    sedentary: "calc_activity_sedentary",
    light: "calc_activity_light",
    moderate: "calc_activity_moderate",
    active: "calc_activity_active",
    very_active: "calc_activity_very_active",
  };
  return settingNumber(settings, map[level]);
}

function goalAdjustment(goal: Goal, settings?: Partial<Settings>) {
  const map: Record<Goal, keyof typeof defaultCalculationSettings> = {
    lose: "calc_goal_loss",
    maintain: "calc_goal_maintain",
    gain: "calc_goal_gain",
  };
  return settingNumber(settings, map[goal]);
}

export function calculateNutrition(
  input: Pick<Client, "gender" | "age" | "height_cm" | "weight_kg" | "activity_level" | "goal">,
  settings?: Partial<Settings>,
) {
  const height = clampNumber(input.height_cm, 165);
  const weight = clampNumber(input.weight_kg, 65);
  const heightM = height / 100;
  const bmi = weight / Math.pow(heightM, 2);
  const ibw = settingNumber(settings, "calc_ibw_bmi_factor") * Math.pow(heightM, 2);
  const abw = ibw + (weight - ibw) / settingNumber(settings, "calc_abw_divisor");
  const genderFactor = input.gender === "male" ? settingNumber(settings, "calc_male_factor") : settingNumber(settings, "calc_female_factor");
  const bmr = settingNumber(settings, "calc_bmr_base") * genderFactor * abw * settingNumber(settings, "calc_bmr_adjustment");
  const selectedActivityFactor = activityFactor(input.activity_level, settings);
  const tee = bmr * selectedActivityFactor;
  const targetCalories = tee + goalAdjustment(input.goal, settings);
  const proteinPercent = settingNumber(settings, "macro_protein_percent");
  const carbsPercent = settingNumber(settings, "macro_carb_percent");
  const fatPercent = settingNumber(settings, "macro_fat_percent");

  return {
    bmi,
    ibw,
    abw,
    bmr,
    tee,
    tdee: tee,
    targetCalories,
    activityFactor: selectedActivityFactor,
    proteinPercent,
    carbsPercent,
    fatPercent,
    proteinGrams: (targetCalories * (proteinPercent / 100)) / 4,
    carbsGrams: (targetCalories * (carbsPercent / 100)) / 4,
    fatGrams: (targetCalories * (fatPercent / 100)) / 9,
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
