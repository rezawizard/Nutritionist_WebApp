export type Gender = "female" | "male";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type VisitStatus = "tentative" | "confirmed" | "done" | "cancelled" | "completed" | "scheduled" | "canceled" | "pending";
export type VisitType = "initial" | "diet_followup" | "body_analysis" | "device" | "consultation" | "combined";
export type VisitModeKey = "in_person" | "online" | string;
export type ServiceGroup = "diet" | "consultation" | "body_analysis" | "device" | "followup" | "package" | "report" | "other";
export type AttachmentCategory = "profile" | "body_analysis" | "lab" | "medical_report" | "diet_plan" | "device" | "before_after" | "report" | "other";
export type CareTrackType = "diet" | "body_analysis" | "device" | "consultation" | "combined";
export type CareTrackStatus = "active" | "paused" | "completed";

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

export interface CareTrack {
  id?: number;
  client_id: number;
  track_type: CareTrackType;
  goal: Goal;
  title: string;
  start_date: string;
  status: CareTrackStatus;
  target_weight?: number | null;
  notes: string;
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
  track_id?: number | null;
  visit_type?: VisitType;
  visit_mode_key?: VisitModeKey;
  visit_mode_name_snapshot?: string;
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

export interface ExtendedMeasurements {
  body_water_percent?: number;
  fat_mass_kg?: number;
  muscle_percent?: number;
  metabolic_age?: number;
  device_score?: number;
  upper_abdomen_cm?: number;
  lower_abdomen_cm?: number;
  upper_arm_left_cm?: number;
  upper_arm_right_cm?: number;
  forearm_left_cm?: number;
  forearm_right_cm?: number;
  wrist_left_cm?: number;
  wrist_right_cm?: number;
  thigh_left_cm?: number;
  thigh_right_cm?: number;
  calf_left_cm?: number;
  calf_right_cm?: number;
  ankle_left_cm?: number;
  ankle_right_cm?: number;
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
  service_group_snapshot?: ServiceGroup | string;
  body_area: string;
  device_name: string;
  duration_minutes?: number | null;
  price: number;
  quantity: number;
  total: number;
  notes: string;
}


export interface VisitModeOption {
  id?: number;
  key: VisitModeKey;
  name: string;
  active: boolean;
  description?: string;
}

export interface NutritionCalculation {
  id?: number;
  client_id: number;
  visit_id?: number | null;
  track_id?: number | null;
  calculated_at: string;
  gender: Gender;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal: Goal;
  bmi: number;
  ibw: number;
  abw: number;
  bmr: number;
  tee: number;
  target_calories: number;
  calorie_adjustment_percent: number;
  protein_percent: number;
  carb_percent: number;
  fat_percent: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface DietMealItem {
  id: string;
  title: string;
  amount: string;
  calories: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  notes: string;
}

export interface DietMeal {
  id: string;
  title: string;
  target_percent: number;
  notes: string;
  items: DietMealItem[];
}

export interface DietPlan {
  id?: number;
  client_id: number;
  visit_id?: number | null;
  track_id?: number | null;
  calculation_id?: number | null;
  title: string;
  plan_date: string;
  status: "draft" | "active" | "archived" | string;
  calories_target: number;
  protein_target_g: number;
  carb_target_g: number;
  fat_target_g: number;
  meals_json: string;
  hydration_text: string;
  activity_text: string;
  guidance_text: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface Attachment {
  id?: number;
  client_id: number;
  visit_id?: number | null;
  track_id?: number | null;
  related_type?: string;
  related_id?: number | null;
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
  group_key?: ServiceGroup | string;
  name: string;
  default_price: number;
  default_duration_minutes?: number | null;
  body_area_required: boolean;
  active: boolean;
  description?: string;
}

export interface MeasurementValue {
  id?: number;
  visit_id: number;
  metric_key: string;
  side: "left" | "right" | "center" | string;
  value: number;
  unit: string;
  created_at?: string;
  updated_at?: string;
}

export interface VisitBundle {
  visit: Visit;
  measurements?: VisitMeasurements | null;
  services: VisitService[];
  measurement_values: MeasurementValue[];
}

export interface ClientProfileBundle {
  client: Client;
  care_tracks: CareTrack[];
  visits: VisitBundle[];
  attachments: Attachment[];
  nutrition_calculations: NutritionCalculation[];
  diet_plans: DietPlan[];
}

export interface AttachmentPreview {
  mime_type: string;
  base64_data: string;
  file_name: string;
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
  diet_plan_header_title?: string;
  diet_plan_footer_text?: string;
  diet_plan_margin_mm?: number;
  diet_plan_show_logo?: boolean;
  diet_plan_show_macros?: boolean;
  diet_plan_show_calories?: boolean;
  report_show_contact?: boolean;
}

export interface DashboardVisitSummary {
  id?: number;
  client_id: number;
  client_name: string;
  visit_date: string;
  visit_time: string;
  status: string;
  total_fee: number;
  visit_type?: VisitType | string;
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
