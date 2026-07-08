export type Gender = "female" | "male";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";

export interface Client {
  id?: number;
  full_name: string;
  phone: string;
  email: string;
  profile_image_path: string;
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

export interface Visit {
  id?: number;
  client_id: number;
  visit_date: string;
  visit_time: string;
  status: string;
  reason: string;
  clinical_notes: string;
  private_notes: string;
  next_visit_enabled: boolean;
  next_visit_date: string;
  next_visit_time: string;
  next_visit_status: string;
  total_fee: number;
  created_at?: string;
  updated_at?: string;
}

export interface VisitMeasurements {
  id?: number;
  visit_id?: number;
  weight_kg: number;
  height_cm?: number;
  bmi_snapshot?: number;
  body_fat_percent?: number;
  muscle_mass?: number;
  visceral_fat?: number;
  waist_cm?: number;
  abdomen_cm?: number;
  hip_cm?: number;
  chest_cm?: number;
  arm_cm?: number;
  thigh_cm?: number;
  calf_cm?: number;
  neck_cm?: number;
  custom_measurements_json?: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface VisitDetail {
  visit: Visit;
  measurements?: VisitMeasurements | null;
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
}

export interface DashboardStats {
  total_clients: number;
  active_clients: number;
  recent_clients: Client[];
}

export type Screen = "dashboard" | "clients" | "client-form" | "calculator" | "settings";
