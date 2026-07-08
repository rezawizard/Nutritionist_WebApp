export type Gender = "female" | "male";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type VisitStatus = "tentative" | "confirmed" | "done" | "cancelled" | "completed" | "scheduled";
export type AttachmentCategory = "body_analysis" | "lab" | "medical_report" | "other";

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

export interface VisitService {
  id?: number;
  visit_id: number;
  service_id?: number | null;
  service_name_snapshot: string;
  body_area: string;
  device_name: string;
  duration_minutes?: number | null;
  price: number;
  quantity: number;
  total: number;
  notes: string;
}

export interface Attachment {
  id?: number;
  client_id: number;
  visit_id?: number | null;
  category: AttachmentCategory | string;
  title: string;
  file_name: string;
  local_path: string;
  attachment_date: string;
  notes: string;
  created_at?: string;
}

export interface ServiceCatalogItem {
  id?: number;
  name: string;
  default_price: number;
  default_duration_minutes?: number | null;
  body_area_required: boolean;
  active: boolean;
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
  calc_ibw_bmi_factor?: number;
  calc_abw_divisor?: number;
  calc_bmr_base?: number;
  calc_male_factor?: number;
  calc_female_factor?: number;
  calc_bmr_adjustment?: number;
  calc_activity_sedentary?: number;
  calc_activity_light?: number;
  calc_activity_moderate?: number;
  calc_activity_active?: number;
  calc_activity_very_active?: number;
  calc_goal_loss?: number;
  calc_goal_maintain?: number;
  calc_goal_gain?: number;
  macro_protein_percent?: number;
  macro_carb_percent?: number;
  macro_fat_percent?: number;
}

export interface DashboardVisitSummary {
  id?: number;
  client_id: number;
  client_name: string;
  visit_date: string;
  visit_time: string;
  status: string;
  total_fee: number;
}

export interface DashboardStats {
  total_clients: number;
  active_clients: number;
  archived_clients: number;
  goal_counts: Record<Goal, number>;
  visits_today: number;
  visits_next_7_days: number;
  visits_this_month: number;
  revenue_this_month: number;
  upcoming_followups: number;
  recent_clients: Client[];
  upcoming_visits: DashboardVisitSummary[];
  recent_visits: DashboardVisitSummary[];
}

export type Screen = "dashboard" | "clients" | "client-form" | "calculator" | "settings";
