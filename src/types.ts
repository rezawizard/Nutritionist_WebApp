export type Gender = "female" | "male";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type VisitStatus = "tentative" | "confirmed";

export interface Client {
  id?: number;
  full_name: string;
  phone: string;
  email: string;
  profile_image_path: string;
  next_visit_date: string;
  next_visit_status: VisitStatus;
  gender: Gender;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal: Goal;
  notes: string;
  archived: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ClientRecord {
  id?: number;
  client_id: number;
  record_date: string;
  weight_kg: number;
  height_cm: number;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface Settings {
  dietitian_name: string;
  clinic_name: string;
  primary_color: string;
  background_color: string;
  text_color: string;
  logo_path: string;
  background_image_path: string;
  username: string;
  calc_ibw_bmi_factor: number;
  calc_abw_divisor: number;
  calc_bmr_base: number;
  calc_male_factor: number;
  calc_female_factor: number;
  calc_bmr_adjustment: number;
  calc_activity_sedentary: number;
  calc_activity_light: number;
  calc_activity_moderate: number;
  calc_activity_active: number;
  calc_activity_very_active: number;
  calc_goal_loss: number;
  calc_goal_maintain: number;
  calc_goal_gain: number;
  macro_protein_percent: number;
  macro_carb_percent: number;
  macro_fat_percent: number;
}

export interface DashboardStats {
  total_clients: number;
  active_clients: number;
  recent_clients: Client[];
}

export type Screen = "dashboard" | "clients" | "client-form" | "calculator" | "settings";
