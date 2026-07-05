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
