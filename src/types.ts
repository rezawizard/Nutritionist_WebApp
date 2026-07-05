export type Gender = "female" | "male";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";

export interface Client {
  id?: number;
  full_name: string;
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
  username: string;
}

export interface DashboardStats {
  total_clients: number;
  active_clients: number;
  recent_clients: Client[];
}

export type Screen = "dashboard" | "clients" | "client-form" | "calculator" | "settings";
