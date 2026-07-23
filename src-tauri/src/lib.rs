use chrono::{Duration, Local, NaiveDate, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use argon2::{password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString}, Argon2};
use rand_core::OsRng;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration as StdDuration;
use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;

struct AppState {
    conn: Mutex<Connection>,
    db_path: PathBuf,
}

#[derive(Debug, Serialize, Deserialize)]
struct Client {
    id: Option<i64>,
    full_name: String,
    #[serde(default)]
    phone: String,
    #[serde(default)]
    email: String,
    #[serde(default)]
    profile_image_path: String,
    gender: String,
    age: i64,
    height_cm: f64,
    weight_kg: f64,
    activity_level: String,
    goal: String,
    notes: String,
    archived: bool,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ClientRecord {
    id: Option<i64>,
    client_id: i64,
    record_date: String,
    weight_kg: f64,
    height_cm: f64,
    notes: String,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Visit {
    id: Option<i64>,
    client_id: i64,
    #[serde(default)]
    track_id: Option<i64>,
    #[serde(default = "default_visit_type")]
    visit_type: String,
    #[serde(default = "default_visit_mode_key")]
    visit_mode_key: String,
    #[serde(default = "default_visit_mode_name")]
    visit_mode_name_snapshot: String,
    #[serde(default)]
    visit_date: String,
    #[serde(default)]
    visit_time: String,
    #[serde(default)]
    status: String,
    #[serde(default)]
    reason: String,
    #[serde(default)]
    clinical_notes: String,
    #[serde(default)]
    private_notes: String,
    #[serde(default)]
    next_visit_enabled: bool,
    #[serde(default)]
    next_visit_date: String,
    #[serde(default)]
    next_visit_time: String,
    #[serde(default)]
    next_visit_status: String,
    #[serde(default)]
    total_fee: f64,
    #[serde(default)]
    request_id: String,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct VisitMeasurements {
    id: Option<i64>,
    #[serde(default)]
    visit_id: Option<i64>,
    weight_kg: f64,
    #[serde(default)]
    height_cm: Option<f64>,
    #[serde(default)]
    bmi_snapshot: Option<f64>,
    #[serde(default)]
    body_fat_percent: Option<f64>,
    #[serde(default)]
    muscle_mass: Option<f64>,
    #[serde(default)]
    visceral_fat: Option<f64>,
    #[serde(default)]
    waist_cm: Option<f64>,
    #[serde(default)]
    abdomen_cm: Option<f64>,
    #[serde(default)]
    hip_cm: Option<f64>,
    #[serde(default)]
    chest_cm: Option<f64>,
    #[serde(default)]
    arm_cm: Option<f64>,
    #[serde(default)]
    thigh_cm: Option<f64>,
    #[serde(default)]
    calf_cm: Option<f64>,
    #[serde(default)]
    neck_cm: Option<f64>,
    #[serde(default)]
    custom_measurements_json: Option<String>,
    #[serde(default)]
    notes: String,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize)]
struct VisitDetail {
    visit: Visit,
    measurements: Option<VisitMeasurements>,
}

#[derive(Debug, Serialize, Deserialize)]
struct VisitService {
    id: Option<i64>,
    visit_id: i64,
    #[serde(default)]
    service_id: Option<i64>,
    #[serde(default)]
    device_id: Option<i64>,
    service_name_snapshot: String,
    #[serde(default = "default_service_group")]
    service_group_snapshot: String,
    #[serde(default)]
    body_area: String,
    #[serde(default)]
    device_name: String,
    #[serde(default)]
    device_rental_percent_snapshot: f64,
    #[serde(default)]
    duration_minutes: Option<i64>,
    #[serde(default)]
    price: f64,
    #[serde(default)]
    quantity: f64,
    #[serde(default)]
    total: f64,
    #[serde(default)]
    notes: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct DeviceCatalogItem {
    id: Option<i64>,
    name: String,
    #[serde(default)]
    rental_percent: f64,
    #[serde(default = "default_active_service")]
    active: bool,
    #[serde(default)]
    description: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Attachment {
    id: Option<i64>,
    client_id: i64,
    #[serde(default)]
    visit_id: Option<i64>,
    #[serde(default)]
    track_id: Option<i64>,
    #[serde(default)]
    related_type: String,
    #[serde(default)]
    related_id: Option<i64>,
    #[serde(default)]
    category: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    file_name: String,
    #[serde(default)]
    local_path: String,
    #[serde(default)]
    attachment_date: String,
    #[serde(default)]
    notes: String,
    created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ServiceCatalogItem {
    id: Option<i64>,
    #[serde(default = "default_service_group")]
    group_key: String,
    name: String,
    #[serde(default)]
    default_price: f64,
    #[serde(default)]
    default_duration_minutes: Option<i64>,
    #[serde(default)]
    body_area_required: bool,
    #[serde(default = "default_active_service")]
    active: bool,
    #[serde(default)]
    description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct VisitModeOption {
    id: Option<i64>,
    key: String,
    name: String,
    #[serde(default = "default_active_service")]
    active: bool,
    #[serde(default)]
    description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct NutritionCalculation {
    id: Option<i64>,
    client_id: i64,
    #[serde(default)]
    visit_id: Option<i64>,
    #[serde(default)]
    track_id: Option<i64>,
    calculated_at: String,
    gender: String,
    age: i64,
    height_cm: f64,
    weight_kg: f64,
    activity_level: String,
    goal: String,
    bmi: f64,
    ibw: f64,
    abw: f64,
    bmr: f64,
    tee: f64,
    target_calories: f64,
    #[serde(default)]
    calorie_adjustment_percent: f64,
    protein_percent: f64,
    carb_percent: f64,
    fat_percent: f64,
    protein_g: f64,
    carb_g: f64,
    fat_g: f64,
    #[serde(default)]
    notes: String,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct DietPlan {
    id: Option<i64>,
    client_id: i64,
    #[serde(default)]
    visit_id: Option<i64>,
    #[serde(default)]
    track_id: Option<i64>,
    #[serde(default)]
    calculation_id: Option<i64>,
    title: String,
    plan_date: String,
    #[serde(default = "default_diet_plan_status")]
    status: String,
    calories_target: f64,
    protein_target_g: f64,
    carb_target_g: f64,
    fat_target_g: f64,
    meals_json: String,
    #[serde(default)]
    hydration_text: String,
    #[serde(default)]
    activity_text: String,
    #[serde(default)]
    guidance_text: String,
    #[serde(default)]
    notes: String,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct CareTrack {
    id: Option<i64>,
    client_id: i64,
    track_type: String,
    goal: String,
    title: String,
    start_date: String,
    status: String,
    #[serde(default)]
    target_weight: Option<f64>,
    #[serde(default)]
    notes: String,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct MeasurementValue {
    id: Option<i64>,
    visit_id: i64,
    metric_key: String,
    side: String,
    value: f64,
    unit: String,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize)]
struct VisitBundle {
    visit: Visit,
    measurements: Option<VisitMeasurements>,
    services: Vec<VisitService>,
    measurement_values: Vec<MeasurementValue>,
}

#[derive(Debug, Serialize)]
struct ClientProfileBundle {
    client: Client,
    care_tracks: Vec<CareTrack>,
    visits: Vec<VisitBundle>,
    attachments: Vec<Attachment>,
    nutrition_calculations: Vec<NutritionCalculation>,
    diet_plans: Vec<DietPlan>,
}

#[derive(Debug, Serialize)]
struct AttachmentPreview {
    mime_type: String,
    base64_data: String,
    file_name: String,
}

#[derive(Debug, Serialize)]
struct CleanupResult {
    deleted_count: i64,
    backup_path: String,
}

fn default_active_service() -> bool {
    true
}

fn default_service_group() -> String {
    "other".to_string()
}

fn default_visit_type() -> String {
    "initial".to_string()
}

fn default_visit_mode_key() -> String {
    "in_person".to_string()
}

fn default_visit_mode_name() -> String {
    "حضوری".to_string()
}

fn default_diet_plan_status() -> String {
    "draft".to_string()
}

#[derive(Debug, Serialize)]
struct DashboardGoalCounts {
    lose: i64,
    maintain: i64,
    gain: i64,
}

#[derive(Debug, Serialize)]
struct DashboardVisitSummary {
    id: Option<i64>,
    client_id: i64,
    client_name: String,
    visit_date: String,
    visit_time: String,
    status: String,
    total_fee: f64,
    visit_type: String,
}

#[derive(Debug, Serialize)]
struct DashboardStats {
    total_clients: i64,
    active_clients: i64,
    archived_clients: i64,
    goal_counts: DashboardGoalCounts,
    visits_today: i64,
    visits_next_7_days: i64,
    visits_this_month: i64,
    revenue_this_month: f64,
    upcoming_followups: i64,
    recent_clients: Vec<Client>,
    upcoming_visits: Vec<DashboardVisitSummary>,
    recent_visits: Vec<DashboardVisitSummary>,
}

fn default_true() -> bool { true }

#[derive(Debug, Serialize, Deserialize)]
struct Settings {
    dietitian_name: String,
    clinic_name: String,
    primary_color: String,
    background_color: String,
    text_color: String,
    logo_path: String,
    background_image_path: String,
    username: String,
    calc_ibw_bmi_factor: f64,
    calc_abw_divisor: f64,
    calc_bmr_base: f64,
    calc_male_factor: f64,
    calc_female_factor: f64,
    calc_bmr_adjustment: f64,
    calc_activity_sedentary: f64,
    calc_activity_light: f64,
    calc_activity_moderate: f64,
    calc_activity_active: f64,
    calc_activity_very_active: f64,
    calc_goal_loss: f64,
    calc_goal_maintain: f64,
    calc_goal_gain: f64,
    macro_protein_percent: f64,
    macro_carb_percent: f64,
    macro_fat_percent: f64,
    diet_plan_header_title: String,
    diet_plan_footer_text: String,
    diet_plan_margin_mm: f64,
    diet_plan_show_logo: bool,
    diet_plan_show_macros: bool,
    diet_plan_show_calories: bool,
    report_show_contact: bool,
    #[serde(default = "default_true")]
    reports_completed_only: bool,
    #[serde(default = "default_true")]
    reports_use_service_revenue: bool,
}

#[derive(Debug, Serialize)]
struct SecurityStatus {
    username: String,
    must_change_credentials: bool,
}

#[derive(Debug, Serialize)]
struct MonthlyReportSummary {
    unique_clients: i64,
    completed_visits: i64,
    scheduled_visits: i64,
    canceled_visits: i64,
    diet_plans: i64,
    body_analysis_cases: i64,
    device_cases: i64,
    device_units: f64,
    consultations: i64,
    services_count: i64,
    total_revenue: f64,
    device_rental_due: f64,
}

#[derive(Debug, Serialize)]
struct MonthlyServiceGroupRow {
    group_key: String,
    cases: i64,
    quantity: f64,
    revenue: f64,
}

#[derive(Debug, Serialize)]
struct MonthlyDeviceUsageRow {
    device_id: Option<i64>,
    device_name: String,
    service_name: String,
    body_area: String,
    cases: i64,
    quantity: f64,
    total_minutes: f64,
    revenue: f64,
    rental_percent: f64,
    rental_due: f64,
}

#[derive(Debug, Serialize)]
struct MonthlyDeviceCaseRow {
    visit_id: i64,
    visit_date: String,
    client_id: i64,
    client_name: String,
    device_name: String,
    service_name: String,
    body_area: String,
    quantity: f64,
    revenue: f64,
    rental_percent: f64,
    rental_due: f64,
}

#[derive(Debug, Serialize)]
struct MonthlyReport {
    start_date: String,
    end_date: String,
    completed_only: bool,
    revenue_from_services: bool,
    summary: MonthlyReportSummary,
    service_groups: Vec<MonthlyServiceGroupRow>,
    devices: Vec<MonthlyDeviceUsageRow>,
    device_cases_detail: Vec<MonthlyDeviceCaseRow>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SettingEntry {
    key: String,
    value: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct DataBackup {
    app: String,
    version: String,
    exported_at: String,
    clients: Vec<Client>,
    #[serde(default)]
    records: Vec<ClientRecord>,
    settings: Vec<SettingEntry>,
}

#[derive(Debug, Deserialize)]
struct LoginInput {
    username: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct CredentialsInput {
    current_password: String,
    username: String,
    password: String,
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn local_today() -> String {
    Local::now().date_naive().to_string()
}

fn is_valid_iso_date(value: &str) -> bool {
    NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok()
}

fn is_valid_time(value: &str) -> bool {
    if value.is_empty() {
        return true;
    }
    let parts: Vec<&str> = value.split(':').collect();
    if parts.len() != 2 {
        return false;
    }
    let hour = parts[0].parse::<u32>().ok();
    let minute = parts[1].parse::<u32>().ok();
    matches!((hour, minute), (Some(h), Some(m)) if h < 24 && m < 60)
}

fn validate_client_input(client: &Client) -> Result<(), String> {
    if client.full_name.trim().is_empty() {
        return Err("نام کامل مراجعه‌کننده الزامی است.".to_string());
    }
    if client.age < 1 || client.age > 120 {
        return Err("سن باید عددی بین ۱ تا ۱۲۰ باشد.".to_string());
    }
    if !(40.0..=250.0).contains(&client.height_cm) {
        return Err("قد باید عددی بین ۴۰ تا ۲۵۰ سانتی‌متر باشد.".to_string());
    }
    if !(1.0..=400.0).contains(&client.weight_kg) {
        return Err("وزن باید عددی بین ۱ تا ۴۰۰ کیلوگرم باشد.".to_string());
    }
    if client.profile_image_path.contains('\n') || client.profile_image_path.contains('\r') {
        return Err("مسیر عکس پروفایل معتبر نیست.".to_string());
    }
    Ok(())
}

fn validate_visit_input(visit: &Visit) -> Result<(), String> {
    if !is_valid_iso_date(&visit.visit_date) {
        return Err("تاریخ ویزیت معتبر نیست.".to_string());
    }
    if !is_valid_time(&visit.visit_time) {
        return Err("ساعت ویزیت باید با قالب HH:mm باشد.".to_string());
    }
    if visit.next_visit_enabled {
        if !is_valid_iso_date(&visit.next_visit_date) {
            return Err("برای مراجعه بعدی تاریخ معتبر وارد کنید.".to_string());
        }
        if !is_valid_time(&visit.next_visit_time) {
            return Err("ساعت مراجعه بعدی باید با قالب HH:mm باشد.".to_string());
        }
    }
    Ok(())
}

fn validate_measurements_input(measurements: &VisitMeasurements) -> Result<(), String> {
    if !(1.0..=400.0).contains(&measurements.weight_kg) {
        return Err("وزن ویزیت باید عددی بین ۱ تا ۴۰۰ کیلوگرم باشد.".to_string());
    }
    if let Some(height) = measurements.height_cm {
        if !(40.0..=250.0).contains(&height) {
            return Err("قد ویزیت باید عددی بین ۴۰ تا ۲۵۰ سانتی‌متر باشد.".to_string());
        }
    }
    Ok(())
}

fn legacy_hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|err| format!("ساخت رمز امن انجام نشد: {err}"))
}

fn verify_password(password: &str, stored: &str, algorithm: &str) -> bool {
    if algorithm == "argon2" || stored.starts_with("$argon2") {
        return PasswordHash::new(stored)
            .ok()
            .and_then(|parsed| Argon2::default().verify_password(password.as_bytes(), &parsed).ok())
            .is_some();
    }
    legacy_hash_password(password) == stored
}

const CALCULATION_DEFAULT_SETTINGS: [(&str, &str); 17] = [
    ("calc_ibw_bmi_factor", "22"),
    ("calc_abw_divisor", "4"),
    ("calc_bmr_base", "24"),
    ("calc_male_factor", "1"),
    ("calc_female_factor", "0.95"),
    ("calc_bmr_adjustment", "1.1"),
    ("calc_activity_sedentary", "1.3"),
    ("calc_activity_light", "1.3"),
    ("calc_activity_moderate", "1.3"),
    ("calc_activity_active", "1.3"),
    ("calc_activity_very_active", "1.3"),
    ("calc_goal_loss", "-500"),
    ("calc_goal_maintain", "0"),
    ("calc_goal_gain", "300"),
    ("macro_protein_percent", "20"),
    ("macro_carb_percent", "50"),
    ("macro_fat_percent", "30"),
];

fn read_setting(conn: &Connection, key: &str) -> Result<String, String> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |row| row.get(0))
        .map_err(|err| err.to_string())
}

fn read_setting_or(conn: &Connection, key: &str, default: &str) -> Result<String, String> {
    let value: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key = ?1", params![key], |row| row.get(0))
        .optional()
        .map_err(|err| err.to_string())?;
    Ok(value.unwrap_or_else(|| default.to_string()))
}

fn read_number_setting(conn: &Connection, key: &str, default: f64) -> Result<f64, String> {
    let value = read_setting_or(conn, key, &default.to_string())?;
    Ok(value.parse::<f64>().unwrap_or(default))
}

fn write_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

fn write_default_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    let exists: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key = ?1", params![key], |row| row.get(0))
        .optional()
        .map_err(|err| err.to_string())?;
    if exists.is_none() {
        write_setting(conn, key, value)?;
    }
    Ok(())
}

fn ensure_column(conn: &Connection, table: &str, column: &str, definition: &str) -> Result<(), String> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({})", table))
        .map_err(|err| err.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    if !columns.iter().any(|name| name == column) {
        conn.execute(&format!("ALTER TABLE {} ADD COLUMN {}", table, definition), [])
            .map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn init_db(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;")
        .map_err(|err| err.to_string())?;
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            gender TEXT NOT NULL,
            age INTEGER NOT NULL,
            height_cm REAL NOT NULL,
            weight_kg REAL NOT NULL,
            base_height_cm REAL NOT NULL DEFAULT 0,
            base_weight_kg REAL NOT NULL DEFAULT 0,
            activity_level TEXT NOT NULL,
            goal TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            archived INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS client_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            visit_id INTEGER,
            record_date TEXT NOT NULL,
            weight_kg REAL NOT NULL,
            height_cm REAL NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS care_tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            track_type TEXT NOT NULL,
            goal TEXT NOT NULL DEFAULT 'maintain',
            title TEXT NOT NULL,
            start_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            target_weight REAL,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            track_id INTEGER,
            visit_date TEXT NOT NULL,
            visit_time TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'completed',
            reason TEXT NOT NULL DEFAULT '',
            clinical_notes TEXT NOT NULL DEFAULT '',
            private_notes TEXT NOT NULL DEFAULT '',
            next_visit_enabled INTEGER NOT NULL DEFAULT 0,
            next_visit_date TEXT NOT NULL DEFAULT '',
            next_visit_time TEXT NOT NULL DEFAULT '',
            next_visit_status TEXT NOT NULL DEFAULT '',
            total_fee REAL NOT NULL DEFAULT 0,
            request_id TEXT,
            legacy_record_id INTEGER UNIQUE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY(track_id) REFERENCES care_tracks(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS visit_measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visit_id INTEGER NOT NULL UNIQUE,
            weight_kg REAL NOT NULL,
            height_cm REAL,
            bmi_snapshot REAL,
            body_fat_percent REAL,
            muscle_mass REAL,
            visceral_fat REAL,
            waist_cm REAL,
            abdomen_cm REAL,
            hip_cm REAL,
            chest_cm REAL,
            arm_cm REAL,
            thigh_cm REAL,
            calf_cm REAL,
            neck_cm REAL,
            custom_measurements_json TEXT,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS measurement_values (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visit_id INTEGER NOT NULL,
            metric_key TEXT NOT NULL,
            side TEXT NOT NULL DEFAULT 'center',
            value REAL NOT NULL,
            unit TEXT NOT NULL DEFAULT 'cm',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(visit_id, metric_key, side),
            FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS visit_services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visit_id INTEGER NOT NULL,
            service_id INTEGER,
            device_id INTEGER,
            service_name_snapshot TEXT NOT NULL,
            service_group_snapshot TEXT NOT NULL DEFAULT 'other',
            body_area TEXT NOT NULL DEFAULT '',
            device_name TEXT NOT NULL DEFAULT '',
            device_rental_percent_snapshot REAL NOT NULL DEFAULT 0,
            duration_minutes INTEGER,
            price REAL NOT NULL DEFAULT 0,
            quantity REAL NOT NULL DEFAULT 1,
            total REAL NOT NULL DEFAULT 0,
            notes TEXT NOT NULL DEFAULT '',
            FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            visit_id INTEGER,
            track_id INTEGER,
            related_type TEXT NOT NULL DEFAULT '',
            related_id INTEGER,
            category TEXT NOT NULL DEFAULT 'other',
            title TEXT NOT NULL DEFAULT '',
            file_name TEXT NOT NULL DEFAULT '',
            local_path TEXT NOT NULL DEFAULT '',
            attachment_date TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE SET NULL,
            FOREIGN KEY(track_id) REFERENCES care_tracks(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS service_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_key TEXT NOT NULL DEFAULT 'other',
            name TEXT NOT NULL,
            default_price REAL NOT NULL DEFAULT 0,
            default_duration_minutes INTEGER,
            body_area_required INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            description TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS device_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            rental_percent REAL NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            description TEXT NOT NULL DEFAULT ''
        );


        CREATE TABLE IF NOT EXISTS visit_modes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            description TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS nutrition_calculations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            visit_id INTEGER,
            track_id INTEGER,
            calculated_at TEXT NOT NULL,
            gender TEXT NOT NULL,
            age INTEGER NOT NULL,
            height_cm REAL NOT NULL,
            weight_kg REAL NOT NULL,
            activity_level TEXT NOT NULL,
            goal TEXT NOT NULL,
            bmi REAL NOT NULL,
            ibw REAL NOT NULL,
            abw REAL NOT NULL,
            bmr REAL NOT NULL,
            tee REAL NOT NULL,
            target_calories REAL NOT NULL,
            calorie_adjustment_percent REAL NOT NULL DEFAULT 0,
            protein_percent REAL NOT NULL,
            carb_percent REAL NOT NULL,
            fat_percent REAL NOT NULL,
            protein_g REAL NOT NULL,
            carb_g REAL NOT NULL,
            fat_g REAL NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE SET NULL,
            FOREIGN KEY(track_id) REFERENCES care_tracks(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS diet_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            visit_id INTEGER,
            track_id INTEGER,
            calculation_id INTEGER,
            title TEXT NOT NULL,
            plan_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            calories_target REAL NOT NULL DEFAULT 0,
            protein_target_g REAL NOT NULL DEFAULT 0,
            carb_target_g REAL NOT NULL DEFAULT 0,
            fat_target_g REAL NOT NULL DEFAULT 0,
            meals_json TEXT NOT NULL DEFAULT '[]',
            hydration_text TEXT NOT NULL DEFAULT '',
            activity_text TEXT NOT NULL DEFAULT '',
            guidance_text TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE SET NULL,
            FOREIGN KEY(track_id) REFERENCES care_tracks(id) ON DELETE SET NULL,
            FOREIGN KEY(calculation_id) REFERENCES nutrition_calculations(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_visits_client_date ON visits(client_id, visit_date, id);
        CREATE INDEX IF NOT EXISTS idx_visits_track ON visits(track_id, visit_date);
        CREATE INDEX IF NOT EXISTS idx_services_visit ON visit_services(visit_id);
        CREATE INDEX IF NOT EXISTS idx_measurements_visit ON visit_measurements(visit_id);
        CREATE INDEX IF NOT EXISTS idx_measurement_values_visit ON measurement_values(visit_id, metric_key);
        CREATE INDEX IF NOT EXISTS idx_attachments_client ON attachments(client_id, attachment_date);
        CREATE INDEX IF NOT EXISTS idx_attachments_visit ON attachments(visit_id);
        CREATE INDEX IF NOT EXISTS idx_attachments_track ON attachments(track_id);
        CREATE INDEX IF NOT EXISTS idx_nutrition_client_date ON nutrition_calculations(client_id, calculated_at);
        CREATE INDEX IF NOT EXISTS idx_diet_plans_client_date ON diet_plans(client_id, plan_date);
        CREATE INDEX IF NOT EXISTS idx_care_tracks_client ON care_tracks(client_id, status, track_type);
        ",
    )
    .map_err(|err| err.to_string())?;

    ensure_column(conn, "service_catalog", "group_key", "group_key TEXT NOT NULL DEFAULT 'other'")?;
    ensure_column(conn, "service_catalog", "description", "description TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "visit_services", "service_group_snapshot", "service_group_snapshot TEXT NOT NULL DEFAULT 'other'")?;
    ensure_column(conn, "visit_services", "device_id", "device_id INTEGER")?;
    ensure_column(conn, "visit_services", "device_rental_percent_snapshot", "device_rental_percent_snapshot REAL NOT NULL DEFAULT 0")?;
    ensure_column(conn, "visits", "track_id", "track_id INTEGER")?;
    ensure_column(conn, "visits", "visit_type", "visit_type TEXT NOT NULL DEFAULT 'initial'")?;
    ensure_column(conn, "visits", "visit_mode_key", "visit_mode_key TEXT NOT NULL DEFAULT 'in_person'")?;
    ensure_column(conn, "visits", "visit_mode_name_snapshot", "visit_mode_name_snapshot TEXT NOT NULL DEFAULT 'حضوری'")?;
    ensure_column(conn, "visits", "request_id", "request_id TEXT")?;
    ensure_column(conn, "client_records", "visit_id", "visit_id INTEGER")?;
    ensure_column(conn, "attachments", "track_id", "track_id INTEGER")?;
    ensure_column(conn, "attachments", "related_type", "related_type TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "attachments", "related_id", "related_id INTEGER")?;
    ensure_column(conn, "nutrition_calculations", "track_id", "track_id INTEGER")?;
    ensure_column(conn, "diet_plans", "track_id", "track_id INTEGER")?;
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_request_id ON visits(request_id)", [])
        .map_err(|err| err.to_string())?;
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_client_records_visit_id ON client_records(visit_id)", [])
        .map_err(|err| err.to_string())?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_services_device ON visit_services(device_id)", [])
        .map_err(|err| err.to_string())?;

    let service_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM service_catalog", [], |row| row.get(0))
        .map_err(|err| err.to_string())?;
    if service_count == 0 {
        let default_services = [
            ("diet", "برنامه غذایی کاهش وزن", 0.0, Some(45_i64), 0_i64),
            ("diet", "تنظیم برنامه غذایی", 0.0, Some(45_i64), 0_i64),
            ("body_analysis", "بادی آنالیز", 0.0, Some(20_i64), 0_i64),
            ("device", "جلسه دستگاه", 0.0, Some(30_i64), 1_i64),
            ("consultation", "مشاوره تغذیه", 0.0, Some(30_i64), 0_i64),
            ("followup", "ویزیت پیگیری", 0.0, Some(20_i64), 0_i64),
        ];
        for (group_key, name, price, duration, body_area_required) in default_services {
            conn.execute(
                "INSERT INTO service_catalog (group_key, name, default_price, default_duration_minutes, body_area_required, active, description) VALUES (?1, ?2, ?3, ?4, ?5, 1, '')",
                params![group_key, name, price, duration, body_area_required],
            )
            .map_err(|err| err.to_string())?;
        }
    }

    let visit_mode_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM visit_modes", [], |row| row.get(0))
        .map_err(|err| err.to_string())?;
    if visit_mode_count == 0 {
        for (key, name, description) in [
            ("in_person", "حضوری", "ویزیت در کلینیک"),
            ("online", "آنلاین", "ویزیت غیرحضوری یا تماس تصویری"),
        ] {
            conn.execute(
                "INSERT INTO visit_modes (key, name, active, description) VALUES (?1, ?2, 1, ?3)",
                params![key, name, description],
            )
            .map_err(|err| err.to_string())?;
        }
    }

    ensure_column(conn, "clients", "phone", "phone TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "clients", "email", "email TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "clients", "base_height_cm", "base_height_cm REAL NOT NULL DEFAULT 0")?;
    ensure_column(conn, "clients", "base_weight_kg", "base_weight_kg REAL NOT NULL DEFAULT 0")?;
    conn.execute(
        "UPDATE clients
         SET base_height_cm = COALESCE((
             SELECT m.height_cm FROM visits v JOIN visit_measurements m ON m.visit_id=v.id
             WHERE v.client_id=clients.id AND v.reason='ثبت اولیه مراجعه' AND v.clinical_notes='ثبت اولیه مراجعه' AND m.notes='ثبت اولیه مراجعه'
               AND ABS((julianday(v.created_at)-julianday(clients.created_at))*86400) <= 60
             ORDER BY v.id ASC LIMIT 1
         ), height_cm)
         WHERE base_height_cm <= 0",
        [],
    ).map_err(|err| err.to_string())?;
    conn.execute(
        "UPDATE clients
         SET base_weight_kg = COALESCE((
             SELECT m.weight_kg FROM visits v JOIN visit_measurements m ON m.visit_id=v.id
             WHERE v.client_id=clients.id AND v.reason='ثبت اولیه مراجعه' AND v.clinical_notes='ثبت اولیه مراجعه' AND m.notes='ثبت اولیه مراجعه'
               AND ABS((julianday(v.created_at)-julianday(clients.created_at))*86400) <= 60
             ORDER BY v.id ASC LIMIT 1
         ), weight_kg)
         WHERE base_weight_kg <= 0",
        [],
    ).map_err(|err| err.to_string())?;
    ensure_column(
        conn,
        "clients",
        "profile_image_path",
        "profile_image_path TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(conn, "clients", "code", "code TEXT NOT NULL DEFAULT ''")?;
    migrate_legacy_records(conn)?;

    write_default_setting(conn, "dietitian_name", "")?;
    write_default_setting(conn, "clinic_name", "")?;
    write_default_setting(conn, "primary_color", "#31A69D")?;
    write_default_setting(conn, "background_color", "#0F5079")?;
    write_default_setting(conn, "text_color", "#F5FBF9")?;
    write_default_setting(conn, "logo_path", "")?;
    write_default_setting(conn, "background_image_path", "")?;
    write_default_setting(conn, "username", "admin")?;
    for (key, value) in CALCULATION_DEFAULT_SETTINGS {
        write_default_setting(conn, key, value)?;
    }
    write_default_setting(conn, "diet_plan_header_title", "برنامه غذایی اختصاصی")?;
    write_default_setting(conn, "diet_plan_footer_text", "این برنامه بر اساس شرایط فردی مراجع تنظیم شده است.")?;
    write_default_setting(conn, "diet_plan_margin_mm", "14")?;
    write_default_setting(conn, "diet_plan_show_logo", "1")?;
    write_default_setting(conn, "diet_plan_show_macros", "1")?;
    write_default_setting(conn, "diet_plan_show_calories", "1")?;
    write_default_setting(conn, "report_show_contact", "1")?;
    write_default_setting(conn, "reports_completed_only", "1")?;
    write_default_setting(conn, "reports_use_service_revenue", "1")?;
    if read_setting_or(conn, "password_hash", "")?.is_empty() {
        write_setting(conn, "password_hash", &legacy_hash_password("admin"))?;
        write_setting(conn, "password_algorithm", "sha256")?;
        write_setting(conn, "must_change_credentials", "1")?;
    } else {
        write_default_setting(conn, "password_algorithm", "sha256")?;
        let username = read_setting_or(conn, "username", "admin")?;
        let stored = read_setting_or(conn, "password_hash", "")?;
        let must_change = username == "admin" && stored == legacy_hash_password("admin");
        write_default_setting(conn, "must_change_credentials", if must_change { "1" } else { "0" })?;
    }
    Ok(())
}

fn migrate_legacy_records(conn: &Connection) -> Result<(), String> {
    let timestamp = now();
    conn.execute(
        "
        INSERT OR IGNORE INTO visits (
            client_id, visit_date, visit_time, status, reason, clinical_notes, private_notes,
            next_visit_enabled, next_visit_date, next_visit_time, next_visit_status, total_fee,
            legacy_record_id, created_at, updated_at
        )
        SELECT
            client_id, record_date, '', 'completed', 'رکورد قدیمی', notes, '',
            0, '', '', '', 0,
            id, created_at, updated_at
        FROM client_records
        ",
        [],
    )
    .map_err(|err| format!("مهاجرت رکوردهای قدیمی به ویزیت انجام نشد: {err}"))?;

    conn.execute(
        "
        INSERT OR IGNORE INTO visit_measurements (
            visit_id, weight_kg, height_cm, bmi_snapshot, notes, created_at, updated_at
        )
        SELECT
            visits.id,
            client_records.weight_kg,
            client_records.height_cm,
            CASE
                WHEN client_records.height_cm > 0
                THEN client_records.weight_kg / ((client_records.height_cm / 100.0) * (client_records.height_cm / 100.0))
                ELSE NULL
            END,
            client_records.notes,
            client_records.created_at,
            client_records.updated_at
        FROM client_records
        JOIN visits ON visits.legacy_record_id = client_records.id
        ",
        [],
    )
    .map_err(|err| format!("مهاجرت اندازه‌گیری‌های قدیمی انجام نشد: {err}"))?;

    conn.execute(
        "UPDATE client_records
         SET visit_id = (SELECT visits.id FROM visits WHERE visits.legacy_record_id = client_records.id)
         WHERE visit_id IS NULL
           AND EXISTS (SELECT 1 FROM visits WHERE visits.legacy_record_id = client_records.id)",
        [],
    )
    .map_err(|err| format!("اتصال رکوردهای قدیمی به ویزیت‌ها انجام نشد: {err}"))?;

    // نسخه‌های قبلی برای هر اندازه‌گیری یک client_record بدون visit_id می‌ساختند.
    // نزدیک‌ترین رکورد هم‌تاریخ و هم‌مقدار را فقط یک‌بار به ویزیت متناظر متصل می‌کنیم.
    let record_visit_candidates = {
        let mut stmt = conn.prepare(
            "SELECT r.id, v.id
             FROM client_records r
             JOIN visits v ON v.client_id=r.client_id AND v.visit_date=r.record_date
             JOIN visit_measurements m ON m.visit_id=v.id
             WHERE r.visit_id IS NULL
               AND NOT EXISTS (SELECT 1 FROM client_records linked WHERE linked.visit_id=v.id)
               AND ABS(r.weight_kg-m.weight_kg) < 0.001
               AND (m.height_cm IS NULL OR ABS(r.height_cm-m.height_cm) < 0.001)
               AND ABS((julianday(r.created_at)-julianday(v.created_at))*86400) <= 600
             ORDER BY ABS((julianday(r.created_at)-julianday(v.created_at))*86400), r.id, v.id"
        ).map_err(|err| format!("خواندن نگاشت تاریخچه قدیمی انجام نشد: {err}"))?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)))
            .map_err(|err| format!("خواندن نگاشت تاریخچه قدیمی انجام نشد: {err}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|err| format!("خواندن نگاشت تاریخچه قدیمی انجام نشد: {err}"))?
    };
    let mut linked_records = HashSet::new();
    let mut linked_visits = HashSet::new();
    for (record_id, visit_id) in record_visit_candidates {
        if linked_records.contains(&record_id) || linked_visits.contains(&visit_id) { continue; }
        let affected = conn.execute(
            "UPDATE client_records SET visit_id=?1 WHERE id=?2 AND visit_id IS NULL",
            params![visit_id, record_id],
        ).map_err(|err| format!("اتصال تاریخچه قدیمی به ویزیت انجام نشد: {err}"))?;
        if affected > 0 {
            linked_records.insert(record_id);
            linked_visits.insert(visit_id);
        }
    }

    conn.execute(
        "UPDATE visits SET updated_at = ?1 WHERE updated_at IS NULL OR updated_at = ''",
        params![timestamp],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

fn row_to_client(row: &rusqlite::Row<'_>) -> rusqlite::Result<Client> {
    Ok(Client {
        id: row.get(0)?,
        full_name: row.get(1)?,
        gender: row.get(2)?,
        age: row.get(3)?,
        height_cm: row.get(4)?,
        weight_kg: row.get(5)?,
        activity_level: row.get(6)?,
        goal: row.get(7)?,
        notes: row.get(8)?,
        archived: row.get::<_, i64>(9)? == 1,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        phone: row.get(12)?,
        email: row.get(13)?,
        profile_image_path: row.get(14)?,
    })
}

#[tauri::command]
fn list_clients(state: tauri::State<'_, AppState>, include_archived: bool) -> Result<Vec<Client>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let sql = if include_archived {
        "SELECT id, full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at, phone, email, profile_image_path FROM clients ORDER BY archived ASC, updated_at DESC"
    } else {
        "SELECT id, full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at, phone, email, profile_image_path FROM clients WHERE archived = 0 ORDER BY updated_at DESC"
    };

    let mut stmt = conn.prepare(sql).map_err(|err| err.to_string())?;
    let clients = stmt
        .query_map([], row_to_client)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(clients)
}

#[tauri::command]
fn search_clients(state: tauri::State<'_, AppState>, query: String) -> Result<Vec<Client>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let like_query = format!("%{}%", query.trim());
    let mut stmt = conn
        .prepare("SELECT id, full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at, phone, email, profile_image_path FROM clients WHERE archived = 0 AND (full_name LIKE ?1 OR phone LIKE ?1 OR email LIKE ?1) ORDER BY updated_at DESC LIMIT 20")
        .map_err(|err| err.to_string())?;
    let clients = stmt
        .query_map(params![like_query], row_to_client)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(clients)
}

#[tauri::command]
fn save_client(state: tauri::State<'_, AppState>, client: Client) -> Result<Client, String> {
    validate_client_input(&client)?;
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let timestamp = now();

    if let Some(id) = client.id {
        conn.execute(
            "UPDATE clients SET full_name=?1, gender=?2, age=?3, height_cm=?4, weight_kg=?5, base_height_cm=?4, base_weight_kg=?5, activity_level=?6, goal=?7, notes=?8, archived=?9, updated_at=?10, phone=?11, email=?12, profile_image_path=?13 WHERE id=?14",
            params![
                client.full_name,
                client.gender,
                client.age,
                client.height_cm,
                client.weight_kg,
                client.activity_level,
                client.goal,
                client.notes,
                if client.archived { 1 } else { 0 },
                timestamp,
                client.phone,
                client.email,
                client.profile_image_path,
                id
            ],
        )
        .map_err(|err| err.to_string())?;
        get_client(&conn, id)
    } else {
        conn.execute(
            "INSERT INTO clients (full_name, gender, age, height_cm, weight_kg, base_height_cm, base_weight_kg, activity_level, goal, notes, archived, created_at, updated_at, phone, email, profile_image_path) VALUES (?1, ?2, ?3, ?4, ?5, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?9, ?10, ?11, ?12)",
            params![
                client.full_name,
                client.gender,
                client.age,
                client.height_cm,
                client.weight_kg,
                client.activity_level,
                client.goal,
                client.notes,
                timestamp,
                client.phone,
                client.email,
                client.profile_image_path
            ],
        )
        .map_err(|err| err.to_string())?;
        get_client(&conn, conn.last_insert_rowid())
    }
}

fn row_to_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<ClientRecord> {
    Ok(ClientRecord {
        id: row.get(0)?,
        client_id: row.get(1)?,
        record_date: row.get(2)?,
        weight_kg: row.get(3)?,
        height_cm: row.get(4)?,
        notes: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn get_client(conn: &Connection, id: i64) -> Result<Client, String> {
    conn.query_row("SELECT id, full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at, phone, email, profile_image_path FROM clients WHERE id = ?1", params![id], row_to_client)
        .optional()
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "مراجع پیدا نشد.".to_string())
}

#[tauri::command]
fn get_client_by_id(state: tauri::State<'_, AppState>, id: i64) -> Result<Client, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_client(&conn, id)
}

fn refresh_client_latest_measurements_inner(conn: &Connection, client_id: i64) -> Result<(), String> {
    let latest: Option<(f64, Option<f64>)> = conn
        .query_row(
            "SELECT m.weight_kg, m.height_cm
             FROM visits v
             JOIN visit_measurements m ON m.visit_id = v.id
             WHERE v.client_id = ?1
             ORDER BY v.visit_date DESC,
                      CASE WHEN v.visit_time = '' THEN 0 ELSE 1 END DESC,
                      v.visit_time DESC,
                      v.id DESC
             LIMIT 1",
            params![client_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|err| err.to_string())?;

    if let Some((weight, height)) = latest {
        conn.execute(
            "UPDATE clients SET weight_kg=?1, height_cm=COALESCE(?2, height_cm), updated_at=?3 WHERE id=?4",
            params![weight, height, now(), client_id],
        )
        .map_err(|err| err.to_string())?;
    } else {
        conn.execute(
            "UPDATE clients SET weight_kg=CASE WHEN base_weight_kg>0 THEN base_weight_kg ELSE weight_kg END, height_cm=CASE WHEN base_height_cm>0 THEN base_height_cm ELSE height_cm END, updated_at=?1 WHERE id=?2",
            params![now(), client_id],
        )
        .map_err(|err| err.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn list_client_records(state: tauri::State<'_, AppState>, client_id: i64) -> Result<Vec<ClientRecord>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, client_id, record_date, weight_kg, height_cm, notes, created_at, updated_at FROM client_records WHERE client_id = ?1 ORDER BY record_date ASC, id ASC")
        .map_err(|err| err.to_string())?;
    let records = stmt
        .query_map(params![client_id], row_to_record)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(records)
}

#[tauri::command]
fn save_client_record(state: tauri::State<'_, AppState>, record: ClientRecord) -> Result<ClientRecord, String> {
    if !is_valid_iso_date(&record.record_date) {
        return Err("تاریخ رکورد معتبر نیست.".to_string());
    }
    if !(1.0..=400.0).contains(&record.weight_kg) {
        return Err("وزن رکورد باید عددی بین ۱ تا ۴۰۰ کیلوگرم باشد.".to_string());
    }
    if !(40.0..=250.0).contains(&record.height_cm) {
        return Err("قد رکورد باید عددی بین ۴۰ تا ۲۵۰ سانتی‌متر باشد.".to_string());
    }
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let timestamp = now();

    if let Some(id) = record.id {
        conn.execute(
            "UPDATE client_records SET record_date=?1, weight_kg=?2, height_cm=?3, notes=?4, updated_at=?5 WHERE id=?6",
            params![record.record_date, record.weight_kg, record.height_cm, record.notes, timestamp, id],
        )
        .map_err(|err| err.to_string())?;
        conn.query_row("SELECT id, client_id, record_date, weight_kg, height_cm, notes, created_at, updated_at FROM client_records WHERE id = ?1", params![id], row_to_record)
            .map_err(|err| err.to_string())
    } else {
        conn.execute(
            "INSERT INTO client_records (client_id, record_date, weight_kg, height_cm, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![record.client_id, record.record_date, record.weight_kg, record.height_cm, record.notes, timestamp],
        )
        .map_err(|err| err.to_string())?;
        let id = conn.last_insert_rowid();
        conn.query_row("SELECT id, client_id, record_date, weight_kg, height_cm, notes, created_at, updated_at FROM client_records WHERE id = ?1", params![id], row_to_record)
            .map_err(|err| err.to_string())
    }
}

fn track_type_for_visit_type(visit_type: &str) -> &'static str {
    match visit_type {
        "body_analysis" => "body_analysis",
        "device" => "device",
        "consultation" => "consultation",
        "combined" => "combined",
        _ => "diet",
    }
}

fn care_track_title(track_type: &str) -> &'static str {
    match track_type {
        "body_analysis" => "بادی آنالیز",
        "device" => "دستگاه و خدمات موضعی",
        "consultation" => "مشاوره تغذیه",
        "combined" => "مراقبت ترکیبی",
        _ => "رژیم غذایی",
    }
}

fn row_to_care_track(row: &rusqlite::Row<'_>) -> rusqlite::Result<CareTrack> {
    Ok(CareTrack {
        id: row.get(0)?,
        client_id: row.get(1)?,
        track_type: row.get(2)?,
        goal: row.get(3)?,
        title: row.get(4)?,
        start_date: row.get(5)?,
        status: row.get(6)?,
        target_weight: row.get(7)?,
        notes: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn list_client_care_tracks_inner(conn: &Connection, client_id: i64) -> Result<Vec<CareTrack>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, client_id, track_type, goal, title, start_date, status, target_weight, notes, created_at, updated_at FROM care_tracks WHERE client_id=?1 ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, start_date DESC, id DESC"
    ).map_err(|err| err.to_string())?;
    let items = stmt.query_map(params![client_id], row_to_care_track)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(items)
}

fn ensure_care_track_inner(conn: &Connection, client_id: i64, track_type: &str, _source: &str, timestamp: &str) -> Result<i64, String> {
    let existing: Option<i64> = conn.query_row(
        "SELECT id FROM care_tracks WHERE client_id=?1 AND track_type=?2 AND status IN ('active','paused') ORDER BY id DESC LIMIT 1",
        params![client_id, track_type],
        |row| row.get(0),
    ).optional().map_err(|err| err.to_string())?;
    if let Some(id) = existing { return Ok(id); }
    let goal: String = conn.query_row("SELECT goal FROM clients WHERE id=?1", params![client_id], |row| row.get(0))
        .map_err(|err| err.to_string())?;
    conn.execute(
        "INSERT INTO care_tracks (client_id, track_type, goal, title, start_date, status, target_weight, notes, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,'active',NULL,'',?6,?6)",
        params![client_id, track_type, goal, care_track_title(track_type), local_today(), timestamp],
    ).map_err(|err| err.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn list_client_care_tracks(state: tauri::State<'_, AppState>, client_id: i64) -> Result<Vec<CareTrack>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_client(&conn, client_id)?;
    list_client_care_tracks_inner(&conn, client_id)
}

#[tauri::command]
fn save_care_track(state: tauri::State<'_, AppState>, item: CareTrack) -> Result<CareTrack, String> {
    if item.client_id <= 0 { return Err("مراجع برای مسیر مراقبت مشخص نشده است.".to_string()); }
    if item.title.trim().is_empty() { return Err("عنوان مسیر مراقبت الزامی است.".to_string()); }
    if !is_valid_iso_date(&item.start_date) { return Err("تاریخ شروع مسیر معتبر نیست.".to_string()); }
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_client(&conn, item.client_id)?;
    let timestamp = now();
    let id = if let Some(id) = item.id {
        conn.execute(
            "UPDATE care_tracks SET track_type=?1, goal=?2, title=?3, start_date=?4, status=?5, target_weight=?6, notes=?7, updated_at=?8 WHERE id=?9 AND client_id=?10",
            params![item.track_type, item.goal, item.title, item.start_date, item.status, item.target_weight, item.notes, timestamp, id, item.client_id],
        ).map_err(|err| err.to_string())?;
        id
    } else {
        conn.execute(
            "INSERT INTO care_tracks (client_id, track_type, goal, title, start_date, status, target_weight, notes, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)",
            params![item.client_id, item.track_type, item.goal, item.title, item.start_date, item.status, item.target_weight, item.notes, timestamp],
        ).map_err(|err| err.to_string())?;
        conn.last_insert_rowid()
    };
    conn.query_row(
        "SELECT id, client_id, track_type, goal, title, start_date, status, target_weight, notes, created_at, updated_at FROM care_tracks WHERE id=?1",
        params![id], row_to_care_track,
    ).map_err(|err| err.to_string())
}

fn row_to_measurement_value(row: &rusqlite::Row<'_>) -> rusqlite::Result<MeasurementValue> {
    Ok(MeasurementValue {
        id: row.get(0)?, visit_id: row.get(1)?, metric_key: row.get(2)?, side: row.get(3)?,
        value: row.get(4)?, unit: row.get(5)?, created_at: row.get(6)?, updated_at: row.get(7)?,
    })
}

fn list_measurement_values_inner(conn: &Connection, visit_id: i64) -> Result<Vec<MeasurementValue>, String> {
    let mut stmt = conn.prepare("SELECT id, visit_id, metric_key, side, value, unit, created_at, updated_at FROM measurement_values WHERE visit_id=?1 ORDER BY metric_key, side")
        .map_err(|err| err.to_string())?;
    let values = stmt.query_map(params![visit_id], row_to_measurement_value)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(values)
}

fn insert_measurement_value(conn: &Connection, visit_id: i64, key: &str, side: &str, value: Option<f64>, unit: &str, timestamp: &str) -> Result<(), String> {
    if let Some(value) = value.filter(|value| value.is_finite()) {
        conn.execute(
            "INSERT INTO measurement_values (visit_id, metric_key, side, value, unit, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?6) ON CONFLICT(visit_id, metric_key, side) DO UPDATE SET value=excluded.value, unit=excluded.unit, updated_at=excluded.updated_at",
            params![visit_id, key, side, value, unit, timestamp],
        ).map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn sync_measurement_values(conn: &Connection, measurements: &VisitMeasurements, timestamp: &str) -> Result<(), String> {
    let visit_id = measurements.visit_id.ok_or_else(|| "شناسه ویزیت برای شاخص‌ها لازم است.".to_string())?;
    conn.execute("DELETE FROM measurement_values WHERE visit_id=?1", params![visit_id]).map_err(|err| err.to_string())?;
    let standard = [
        ("weight", "center", Some(measurements.weight_kg), "kg"),
        ("bmi", "center", measurements.bmi_snapshot, ""),
        ("body_fat_percent", "center", measurements.body_fat_percent, "%"),
        ("muscle_mass", "center", measurements.muscle_mass, "kg"),
        ("visceral_fat", "center", measurements.visceral_fat, ""),
        ("waist", "center", measurements.waist_cm, "cm"),
        ("abdomen", "center", measurements.abdomen_cm, "cm"),
        ("hip", "center", measurements.hip_cm, "cm"),
        ("chest", "center", measurements.chest_cm, "cm"),
        ("arm", "center", measurements.arm_cm, "cm"),
        ("thigh", "center", measurements.thigh_cm, "cm"),
        ("calf", "center", measurements.calf_cm, "cm"),
        ("neck", "center", measurements.neck_cm, "cm"),
    ];
    for (key, side, value, unit) in standard { insert_measurement_value(conn, visit_id, key, side, value, unit, timestamp)?; }

    if let Some(raw) = measurements.custom_measurements_json.as_deref() {
        if let Ok(values) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(raw) {
            for (key, raw_value) in values {
                let value = raw_value.as_f64().or_else(|| raw_value.as_str().and_then(|item| item.parse::<f64>().ok()));
                let side = if key.contains("_left_") { "left" } else if key.contains("_right_") { "right" } else { "center" };
                let unit = if key.contains("percent") { "%" } else if key.contains("age") { "year" } else if key.contains("score") { "" } else if key.ends_with("_kg") { "kg" } else { "cm" };
                insert_measurement_value(conn, visit_id, &key, side, value, unit, timestamp)?;
            }
        }
    }
    Ok(())
}

fn row_to_visit(row: &rusqlite::Row<'_>) -> rusqlite::Result<Visit> {
    Ok(Visit {
        id: row.get(0)?,
        client_id: row.get(1)?,
        track_id: row.get(2)?,
        visit_date: row.get(3)?,
        visit_time: row.get(4)?,
        status: row.get(5)?,
        reason: row.get(6)?,
        clinical_notes: row.get(7)?,
        private_notes: row.get(8)?,
        next_visit_enabled: row.get::<_, i64>(9)? == 1,
        next_visit_date: row.get(10)?,
        next_visit_time: row.get(11)?,
        next_visit_status: row.get(12)?,
        total_fee: row.get(13)?,
        request_id: String::new(),
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
        visit_type: row.get(16)?,
        visit_mode_key: row.get(17)?,
        visit_mode_name_snapshot: row.get(18)?,
    })
}

fn row_to_measurements(row: &rusqlite::Row<'_>) -> rusqlite::Result<VisitMeasurements> {
    Ok(VisitMeasurements {
        id: row.get(0)?,
        visit_id: row.get(1)?,
        weight_kg: row.get(2)?,
        height_cm: row.get(3)?,
        bmi_snapshot: row.get(4)?,
        body_fat_percent: row.get(5)?,
        muscle_mass: row.get(6)?,
        visceral_fat: row.get(7)?,
        waist_cm: row.get(8)?,
        abdomen_cm: row.get(9)?,
        hip_cm: row.get(10)?,
        chest_cm: row.get(11)?,
        arm_cm: row.get(12)?,
        thigh_cm: row.get(13)?,
        calf_cm: row.get(14)?,
        neck_cm: row.get(15)?,
        custom_measurements_json: row.get(16)?,
        notes: row.get(17)?,
        created_at: row.get(18)?,
        updated_at: row.get(19)?,
    })
}

fn get_measurements_for_visit(conn: &Connection, visit_id: i64) -> Result<Option<VisitMeasurements>, String> {
    conn.query_row(
        "SELECT id, visit_id, weight_kg, height_cm, bmi_snapshot, body_fat_percent, muscle_mass, visceral_fat, waist_cm, abdomen_cm, hip_cm, chest_cm, arm_cm, thigh_cm, calf_cm, neck_cm, custom_measurements_json, notes, created_at, updated_at FROM visit_measurements WHERE visit_id = ?1",
        params![visit_id],
        row_to_measurements,
    )
    .optional()
    .map_err(|err| err.to_string())
}

fn get_visit(conn: &Connection, id: i64) -> Result<Visit, String> {
    conn.query_row(
        "SELECT id, client_id, track_id, visit_date, visit_time, status, reason, clinical_notes, private_notes, next_visit_enabled, next_visit_date, next_visit_time, next_visit_status, total_fee, created_at, updated_at, visit_type, visit_mode_key, visit_mode_name_snapshot FROM visits WHERE id = ?1",
        params![id],
        row_to_visit,
    )
    .optional()
    .map_err(|err| err.to_string())?
    .ok_or_else(|| "ویزیت پیدا نشد.".to_string())
}

fn get_visit_detail_inner(conn: &Connection, id: i64) -> Result<VisitDetail, String> {
    let visit = get_visit(conn, id)?;
    let measurements = get_measurements_for_visit(conn, id)?;
    Ok(VisitDetail { visit, measurements })
}

#[tauri::command]
fn list_client_visits(state: tauri::State<'_, AppState>, client_id: i64) -> Result<Vec<VisitDetail>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, client_id, track_id, visit_date, visit_time, status, reason, clinical_notes, private_notes, next_visit_enabled, next_visit_date, next_visit_time, next_visit_status, total_fee, created_at, updated_at, visit_type, visit_mode_key, visit_mode_name_snapshot FROM visits WHERE client_id = ?1 ORDER BY visit_date ASC, visit_time ASC, id ASC")
        .map_err(|err| err.to_string())?;
    let visits = stmt
        .query_map(params![client_id], row_to_visit)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    visits
        .into_iter()
        .map(|visit| {
            let visit_id = visit.id.ok_or_else(|| "شناسه ویزیت معتبر نیست.".to_string())?;
            let measurements = get_measurements_for_visit(&conn, visit_id)?;
            Ok(VisitDetail { visit, measurements })
        })
        .collect()
}

#[tauri::command]
fn get_visit_detail(state: tauri::State<'_, AppState>, id: i64) -> Result<VisitDetail, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_visit_detail_inner(&conn, id)
}

#[tauri::command]
fn save_visit_with_measurements(
    state: tauri::State<'_, AppState>,
    visit: Visit,
    measurements: Option<VisitMeasurements>,
) -> Result<VisitDetail, String> {
    validate_visit_input(&visit)?;
    if let Some(measurements) = measurements.as_ref() {
        validate_measurements_input(measurements)?;
    }

    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    if visit.id.is_none() && !visit.request_id.trim().is_empty() {
        let existing_id: Option<i64> = conn
            .query_row(
                "SELECT id FROM visits WHERE request_id=?1 AND client_id=?2 LIMIT 1",
                params![visit.request_id.trim(), visit.client_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|err| err.to_string())?;
        if let Some(id) = existing_id {
            return get_visit_detail_inner(&conn, id);
        }
    }

    let tx = conn.transaction().map_err(|err| err.to_string())?;
    get_client(&tx, visit.client_id)?;
    let timestamp = now();
    let inferred_track_type = track_type_for_visit_type(&visit.visit_type);
    let track_id = match visit.track_id {
        Some(id) => Some(id),
        None => Some(ensure_care_track_inner(&tx, visit.client_id, inferred_track_type, &visit.visit_type, &timestamp)?),
    };

    let visit_id = if let Some(id) = visit.id {
        let affected = tx.execute(
            "UPDATE visits SET track_id=?1, visit_date=?2, visit_time=?3, status=?4, reason=?5, clinical_notes=?6, private_notes=?7, next_visit_enabled=?8, next_visit_date=?9, next_visit_time=?10, next_visit_status=?11, total_fee=?12, visit_type=?13, visit_mode_key=?14, visit_mode_name_snapshot=?15, updated_at=?16 WHERE id=?17 AND client_id=?18",
            params![
                track_id,
                visit.visit_date,
                visit.visit_time,
                visit.status,
                visit.reason,
                visit.clinical_notes,
                visit.private_notes,
                if visit.next_visit_enabled { 1 } else { 0 },
                if visit.next_visit_enabled { visit.next_visit_date } else { String::new() },
                if visit.next_visit_enabled { visit.next_visit_time } else { String::new() },
                if visit.next_visit_enabled { visit.next_visit_status } else { String::new() },
                visit.total_fee,
                visit.visit_type,
                visit.visit_mode_key,
                visit.visit_mode_name_snapshot,
                timestamp,
                id,
                visit.client_id,
            ],
        ).map_err(|err| err.to_string())?;
        if affected == 0 {
            return Err("ویزیت برای این مراجعه‌کننده پیدا نشد.".to_string());
        }
        id
    } else {
        tx.execute(
            "INSERT INTO visits (client_id, track_id, visit_date, visit_time, status, reason, clinical_notes, private_notes, next_visit_enabled, next_visit_date, next_visit_time, next_visit_status, total_fee, visit_type, visit_mode_key, visit_mode_name_snapshot, request_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, NULLIF(?17, ''), ?18, ?18)",
            params![
                visit.client_id,
                track_id,
                visit.visit_date,
                visit.visit_time,
                visit.status,
                visit.reason,
                visit.clinical_notes,
                visit.private_notes,
                if visit.next_visit_enabled { 1 } else { 0 },
                if visit.next_visit_enabled { visit.next_visit_date } else { String::new() },
                if visit.next_visit_enabled { visit.next_visit_time } else { String::new() },
                if visit.next_visit_enabled { visit.next_visit_status } else { String::new() },
                visit.total_fee,
                visit.visit_type,
                visit.visit_mode_key,
                visit.visit_mode_name_snapshot,
                visit.request_id.trim(),
                timestamp,
            ],
        ).map_err(|err| err.to_string())?;
        tx.last_insert_rowid()
    };

    if let Some(mut measurements) = measurements {
        measurements.visit_id = Some(visit_id);
        save_visit_measurements_inner(&tx, measurements)?;
    }
    refresh_client_latest_measurements_inner(&tx, visit.client_id)?;
    let detail = get_visit_detail_inner(&tx, visit_id)?;
    tx.commit().map_err(|err| err.to_string())?;
    Ok(detail)
}

fn save_visit_measurements_inner(conn: &Connection, measurements: VisitMeasurements) -> Result<VisitMeasurements, String> {
    validate_measurements_input(&measurements)?;
    let visit_id = measurements.visit_id.ok_or_else(|| "شناسه ویزیت برای اندازه‌گیری لازم است.".to_string())?;
    let visit = get_visit(conn, visit_id)?;
    let timestamp = now();
    let bmi_snapshot = measurements
        .bmi_snapshot
        .or_else(|| measurements.height_cm.filter(|height| *height > 0.0).map(|height| measurements.weight_kg / ((height / 100.0) * (height / 100.0))));
    let notes = measurements.notes.clone();
    let custom_measurements_json = measurements.custom_measurements_json.clone();
    let mut normalized_measurements = measurements.clone();
    normalized_measurements.bmi_snapshot = bmi_snapshot;

    conn.execute(
        "INSERT INTO visit_measurements (visit_id, weight_kg, height_cm, bmi_snapshot, body_fat_percent, muscle_mass, visceral_fat, waist_cm, abdomen_cm, hip_cm, chest_cm, arm_cm, thigh_cm, calf_cm, neck_cm, custom_measurements_json, notes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?18)
         ON CONFLICT(visit_id) DO UPDATE SET weight_kg=excluded.weight_kg, height_cm=excluded.height_cm, bmi_snapshot=excluded.bmi_snapshot, body_fat_percent=excluded.body_fat_percent, muscle_mass=excluded.muscle_mass, visceral_fat=excluded.visceral_fat, waist_cm=excluded.waist_cm, abdomen_cm=excluded.abdomen_cm, hip_cm=excluded.hip_cm, chest_cm=excluded.chest_cm, arm_cm=excluded.arm_cm, thigh_cm=excluded.thigh_cm, calf_cm=excluded.calf_cm, neck_cm=excluded.neck_cm, custom_measurements_json=excluded.custom_measurements_json, notes=excluded.notes, updated_at=excluded.updated_at",
        params![
            visit_id,
            measurements.weight_kg,
            measurements.height_cm,
            bmi_snapshot,
            measurements.body_fat_percent,
            measurements.muscle_mass,
            measurements.visceral_fat,
            measurements.waist_cm,
            measurements.abdomen_cm,
            measurements.hip_cm,
            measurements.chest_cm,
            measurements.arm_cm,
            measurements.thigh_cm,
            measurements.calf_cm,
            measurements.neck_cm,
            custom_measurements_json,
            notes,
            timestamp
        ],
    )
    .map_err(|err| err.to_string())?;
    sync_measurement_values(conn, &normalized_measurements, &timestamp)?;

    conn.execute(
        "INSERT INTO client_records (client_id, visit_id, record_date, weight_kg, height_cm, notes, created_at, updated_at)
         VALUES (?1, ?7, ?2, ?3, COALESCE(?4, 0), ?5, ?6, ?6)
         ON CONFLICT(visit_id) DO UPDATE SET
             record_date=excluded.record_date,
             weight_kg=excluded.weight_kg,
             height_cm=excluded.height_cm,
             notes=excluded.notes,
             updated_at=excluded.updated_at",
        params![
            visit.client_id,
            visit.visit_date,
            measurements.weight_kg,
            measurements.height_cm,
            measurements.notes,
            timestamp,
            visit_id
        ],
    )
    .map_err(|err| err.to_string())?;

    get_measurements_for_visit(conn, visit_id)?.ok_or_else(|| "اندازه‌گیری ویزیت ذخیره نشد.".to_string())
}

#[tauri::command]
fn save_visit_measurements(state: tauri::State<'_, AppState>, measurements: VisitMeasurements) -> Result<VisitMeasurements, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let visit_id = measurements.visit_id.ok_or_else(|| "شناسه ویزیت برای اندازه‌گیری لازم است.".to_string())?;
    let visit = get_visit(&conn, visit_id)?;
    let saved = save_visit_measurements_inner(&conn, measurements)?;
    refresh_client_latest_measurements_inner(&conn, visit.client_id)?;
    Ok(saved)
}

fn delete_historical_record_for_visit_inner(conn: &Connection, visit_id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM client_records WHERE visit_id=?1", params![visit_id])
        .map_err(|err| err.to_string())?;
    // برای داده‌های نسخه‌های قدیمی که visit_id نداشتند، فقط رکوردی با تاریخ، مقدار و زمان ساخت متناظر حذف می‌شود.
    conn.execute(
        "DELETE FROM client_records
         WHERE id=(
             SELECT r.id
             FROM client_records r
             JOIN visits v ON v.id=?1
             JOIN visit_measurements m ON m.visit_id=v.id
             WHERE r.visit_id IS NULL
               AND r.client_id=v.client_id
               AND r.record_date=v.visit_date
               AND ABS(r.weight_kg-m.weight_kg) < 0.001
               AND (m.height_cm IS NULL OR ABS(r.height_cm-m.height_cm) < 0.001)
               AND ABS((julianday(r.created_at)-julianday(v.created_at))*86400) <= 600
             ORDER BY ABS((julianday(r.created_at)-julianday(v.created_at))*86400), r.id
             LIMIT 1
         )",
        params![visit_id],
    ).map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_visit(state: tauri::State<'_, AppState>, id: i64) -> Result<Client, String> {
    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    let visit = get_visit(&conn, id)?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    delete_historical_record_for_visit_inner(&tx, id)?;
    let affected = tx.execute("DELETE FROM visits WHERE id=?1 AND client_id=?2", params![id, visit.client_id]).map_err(|err| err.to_string())?;
    if affected == 0 { return Err("ویزیت پیدا نشد.".to_string()); }
    refresh_client_latest_measurements_inner(&tx, visit.client_id)?;
    let client = get_client(&tx, visit.client_id)?;
    tx.commit().map_err(|err| err.to_string())?;
    Ok(client)
}

#[tauri::command]
fn cleanup_auto_created_visits(state: tauri::State<'_, AppState>) -> Result<CleanupResult, String> {
    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT v.id, v.client_id, v.track_id, v.created_at
         FROM visits v
         JOIN clients c ON c.id=v.client_id
         JOIN visit_measurements m ON m.visit_id=v.id
         WHERE v.reason='ثبت اولیه مراجعه'
           AND v.clinical_notes='ثبت اولیه مراجعه'
           AND v.private_notes=''
           AND m.notes='ثبت اولیه مراجعه'
           AND v.visit_time=''
           AND v.status='completed'
           AND v.next_visit_enabled=0
           AND v.total_fee=0
           AND ABS((julianday(v.updated_at)-julianday(v.created_at))*86400) <= 1
           AND ABS((julianday(m.updated_at)-julianday(m.created_at))*86400) <= 1
           AND ABS((julianday(v.created_at)-julianday(c.created_at))*86400) <= 60
           AND NOT EXISTS (SELECT 1 FROM visit_services s WHERE s.visit_id=v.id)
           AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.visit_id=v.id)
           AND NOT EXISTS (SELECT 1 FROM nutrition_calculations n WHERE n.visit_id=v.id)
           AND NOT EXISTS (SELECT 1 FROM diet_plans d WHERE d.visit_id=v.id)"
    ).map_err(|err| err.to_string())?;
    let candidates = stmt.query_map([], |row| Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, Option<i64>>(2)?,
            row.get::<_, String>(3)?,
        )))
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    drop(stmt);
    if candidates.is_empty() {
        return Ok(CleanupResult { deleted_count: 0, backup_path: String::new() });
    }

    let backup_path = state.db_path.parent().ok_or_else(|| "مسیر داده‌های برنامه پیدا نشد.".to_string())?
        .join(format!("nutritionist-pre-auto-visit-cleanup-{}.sqlite", Utc::now().format("%Y%m%d-%H%M%S")));
    let mut destination = Connection::open(&backup_path).map_err(|err| err.to_string())?;
    {
        let backup = rusqlite::backup::Backup::new(&conn, &mut destination).map_err(|err| err.to_string())?;
        backup.run_to_completion(5, StdDuration::from_millis(50), None).map_err(|err| err.to_string())?;
    }

    let tx = conn.transaction().map_err(|err| err.to_string())?;
    let mut affected_clients: Vec<i64> = Vec::new();
    for (visit_id, client_id, track_id, visit_created_at) in &candidates {
        delete_historical_record_for_visit_inner(&tx, *visit_id)?;
        tx.execute("DELETE FROM visits WHERE id=?1", params![visit_id]).map_err(|err| err.to_string())?;
        if let Some(track_id) = track_id {
            // مسیر فقط زمانی حذف می‌شود که دقیقاً هم‌زمان با ویزیت مصنوعی ساخته شده، دست‌نخورده و کاملاً بدون وابستگی باشد.
            tx.execute(
                "DELETE FROM care_tracks
                 WHERE id=?1 AND client_id=?2 AND status='active' AND notes=''
                   AND ABS((julianday(created_at)-julianday(?3))*86400) <= 1
                   AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.track_id=care_tracks.id)
                   AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.track_id=care_tracks.id)
                   AND NOT EXISTS (SELECT 1 FROM nutrition_calculations n WHERE n.track_id=care_tracks.id)
                   AND NOT EXISTS (SELECT 1 FROM diet_plans d WHERE d.track_id=care_tracks.id)",
                params![track_id, client_id, visit_created_at],
            ).map_err(|err| err.to_string())?;
        }
        if !affected_clients.contains(client_id) { affected_clients.push(*client_id); }
    }
    for client_id in affected_clients { refresh_client_latest_measurements_inner(&tx, client_id)?; }
    tx.commit().map_err(|err| err.to_string())?;
    Ok(CleanupResult { deleted_count: candidates.len() as i64, backup_path: backup_path.to_string_lossy().to_string() })
}

fn row_to_service_catalog_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<ServiceCatalogItem> {
    Ok(ServiceCatalogItem {
        id: row.get(0)?,
        group_key: row.get(1)?,
        name: row.get(2)?,
        default_price: row.get(3)?,
        default_duration_minutes: row.get(4)?,
        body_area_required: row.get::<_, i64>(5)? == 1,
        active: row.get::<_, i64>(6)? == 1,
        description: row.get(7)?,
    })
}

#[tauri::command]
fn list_service_catalog(state: tauri::State<'_, AppState>, active_only: bool) -> Result<Vec<ServiceCatalogItem>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let sql = if active_only {
        "SELECT id, group_key, name, default_price, default_duration_minutes, body_area_required, active, description FROM service_catalog WHERE active = 1 ORDER BY group_key ASC, name ASC, id ASC"
    } else {
        "SELECT id, group_key, name, default_price, default_duration_minutes, body_area_required, active, description FROM service_catalog ORDER BY active DESC, group_key ASC, name ASC, id ASC"
    };
    let mut stmt = conn.prepare(sql).map_err(|err| err.to_string())?;
    let items = stmt
        .query_map([], row_to_service_catalog_item)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(items)
}

#[tauri::command]
fn save_service_catalog_item(
    state: tauri::State<'_, AppState>,
    item: ServiceCatalogItem,
) -> Result<ServiceCatalogItem, String> {
    let name = item.name.trim();
    if name.is_empty() {
        return Err("نام خدمت الزامی است.".to_string());
    }
    if !item.default_price.is_finite() || item.default_price < 0.0 {
        return Err("تعرفه خدمت باید عددی معتبر و غیرمنفی باشد.".to_string());
    }
    if let Some(duration) = item.default_duration_minutes {
        if duration < 0 || duration > 1440 {
            return Err("مدت خدمت باید بین ۰ تا ۱۴۴۰ دقیقه باشد.".to_string());
        }
    }

    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let id = if let Some(id) = item.id {
        let affected = conn
            .execute(
                "UPDATE service_catalog SET group_key=?1, name=?2, default_price=?3, default_duration_minutes=?4, body_area_required=?5, active=?6, description=?7 WHERE id=?8",
                params![
                    item.group_key,
                    name,
                    item.default_price,
                    item.default_duration_minutes,
                    if item.body_area_required { 1 } else { 0 },
                    if item.active { 1 } else { 0 },
                    item.description,
                    id
                ],
            )
            .map_err(|err| err.to_string())?;
        if affected == 0 {
            return Err("خدمت موردنظر پیدا نشد.".to_string());
        }
        id
    } else {
        conn.execute(
            "INSERT INTO service_catalog (group_key, name, default_price, default_duration_minutes, body_area_required, active, description) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                item.group_key,
                name,
                item.default_price,
                item.default_duration_minutes,
                if item.body_area_required { 1 } else { 0 },
                if item.active { 1 } else { 0 },
                item.description
            ],
        )
        .map_err(|err| err.to_string())?;
        conn.last_insert_rowid()
    };

    conn.query_row(
        "SELECT id, group_key, name, default_price, default_duration_minutes, body_area_required, active, description FROM service_catalog WHERE id=?1",
        params![id],
        row_to_service_catalog_item,
    )
    .map_err(|err| err.to_string())
}

fn row_to_device_catalog_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<DeviceCatalogItem> {
    Ok(DeviceCatalogItem {
        id: row.get(0)?,
        name: row.get(1)?,
        rental_percent: row.get(2)?,
        active: row.get::<_, i64>(3)? == 1,
        description: row.get(4)?,
    })
}

#[tauri::command]
fn list_device_catalog(state: tauri::State<'_, AppState>, active_only: bool) -> Result<Vec<DeviceCatalogItem>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let sql = if active_only {
        "SELECT id, name, rental_percent, active, description FROM device_catalog WHERE active=1 ORDER BY name ASC, id ASC"
    } else {
        "SELECT id, name, rental_percent, active, description FROM device_catalog ORDER BY active DESC, name ASC, id ASC"
    };
    let mut stmt = conn.prepare(sql).map_err(|err| err.to_string())?;
    stmt.query_map([], row_to_device_catalog_item)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn save_device_catalog_item(state: tauri::State<'_, AppState>, item: DeviceCatalogItem) -> Result<DeviceCatalogItem, String> {
    let name = item.name.trim();
    if name.is_empty() { return Err("نام دستگاه الزامی است.".to_string()); }
    if !item.rental_percent.is_finite() || !(0.0..=100.0).contains(&item.rental_percent) {
        return Err("درصد سهم اجاره باید بین ۰ تا ۱۰۰ باشد.".to_string());
    }
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let id = if let Some(id) = item.id {
        let affected = conn.execute(
            "UPDATE device_catalog SET name=?1, rental_percent=?2, active=?3, description=?4 WHERE id=?5",
            params![name, item.rental_percent, if item.active {1} else {0}, item.description, id],
        ).map_err(|err| if err.to_string().contains("UNIQUE") { "دستگاهی با این نام قبلاً ثبت شده است.".to_string() } else { err.to_string() })?;
        if affected == 0 { return Err("دستگاه موردنظر پیدا نشد.".to_string()); }
        id
    } else {
        conn.execute(
            "INSERT INTO device_catalog (name, rental_percent, active, description) VALUES (?1, ?2, ?3, ?4)",
            params![name, item.rental_percent, if item.active {1} else {0}, item.description],
        ).map_err(|err| if err.to_string().contains("UNIQUE") { "دستگاهی با این نام قبلاً ثبت شده است.".to_string() } else { err.to_string() })?;
        conn.last_insert_rowid()
    };
    conn.query_row(
        "SELECT id, name, rental_percent, active, description FROM device_catalog WHERE id=?1",
        params![id], row_to_device_catalog_item,
    ).map_err(|err| err.to_string())
}

fn row_to_visit_service(row: &rusqlite::Row<'_>) -> rusqlite::Result<VisitService> {
    Ok(VisitService {
        id: row.get(0)?,
        visit_id: row.get(1)?,
        service_id: row.get(2)?,
        device_id: row.get(3)?,
        service_name_snapshot: row.get(4)?,
        service_group_snapshot: row.get(5)?,
        body_area: row.get(6)?,
        device_name: row.get(7)?,
        device_rental_percent_snapshot: row.get(8)?,
        duration_minutes: row.get(9)?,
        price: row.get(10)?,
        quantity: row.get(11)?,
        total: row.get(12)?,
        notes: row.get(13)?,
    })
}

#[tauri::command]
fn save_visit_service(state: tauri::State<'_, AppState>, service: VisitService) -> Result<VisitService, String> {
    if service.service_name_snapshot.trim().is_empty() {
        return Err("نام خدمت الزامی است.".to_string());
    }
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_visit(&conn, service.visit_id)?;
    let total = if service.total > 0.0 { service.total } else { service.price * service.quantity.max(1.0) };
    let id = if let Some(id) = service.id {
        conn.execute(
            "UPDATE visit_services SET visit_id=?1, service_id=?2, device_id=?3, service_name_snapshot=?4, service_group_snapshot=?5, body_area=?6, device_name=?7, device_rental_percent_snapshot=?8, duration_minutes=?9, price=?10, quantity=?11, total=?12, notes=?13 WHERE id=?14",
            params![service.visit_id, service.service_id, service.device_id, service.service_name_snapshot, service.service_group_snapshot, service.body_area, service.device_name, service.device_rental_percent_snapshot, service.duration_minutes, service.price, service.quantity.max(1.0), total, service.notes, id],
        )
        .map_err(|err| err.to_string())?;
        id
    } else {
        conn.execute(
            "INSERT INTO visit_services (visit_id, service_id, device_id, service_name_snapshot, service_group_snapshot, body_area, device_name, device_rental_percent_snapshot, duration_minutes, price, quantity, total, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![service.visit_id, service.service_id, service.device_id, service.service_name_snapshot, service.service_group_snapshot, service.body_area, service.device_name, service.device_rental_percent_snapshot, service.duration_minutes, service.price, service.quantity.max(1.0), total, service.notes],
        )
        .map_err(|err| err.to_string())?;
        conn.last_insert_rowid()
    };
    conn.query_row("SELECT id, visit_id, service_id, device_id, service_name_snapshot, service_group_snapshot, body_area, device_name, device_rental_percent_snapshot, duration_minutes, price, quantity, total, notes FROM visit_services WHERE id=?1", params![id], row_to_visit_service)
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn list_visit_services(state: tauri::State<'_, AppState>, visit_id: i64) -> Result<Vec<VisitService>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, visit_id, service_id, device_id, service_name_snapshot, service_group_snapshot, body_area, device_name, device_rental_percent_snapshot, duration_minutes, price, quantity, total, notes FROM visit_services WHERE visit_id=?1 ORDER BY id ASC")
        .map_err(|err| err.to_string())?;
    let items = stmt
        .query_map(params![visit_id], row_to_visit_service)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(items)
}


#[tauri::command]
fn delete_visit_service(state: tauri::State<'_, AppState>, id: i64) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let affected = conn.execute("DELETE FROM visit_services WHERE id=?1", params![id]).map_err(|err| err.to_string())?;
    if affected == 0 { return Err("خدمت ویزیت پیدا نشد.".to_string()); }
    Ok(())
}

fn row_to_visit_mode(row: &rusqlite::Row<'_>) -> rusqlite::Result<VisitModeOption> {
    Ok(VisitModeOption {
        id: row.get(0)?,
        key: row.get(1)?,
        name: row.get(2)?,
        active: row.get::<_, i64>(3)? == 1,
        description: row.get(4)?,
    })
}

#[tauri::command]
fn list_visit_modes(state: tauri::State<'_, AppState>, active_only: Option<bool>) -> Result<Vec<VisitModeOption>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let sql = if active_only.unwrap_or(false) {
        "SELECT id, key, name, active, description FROM visit_modes WHERE active=1 ORDER BY id ASC"
    } else {
        "SELECT id, key, name, active, description FROM visit_modes ORDER BY id ASC"
    };
    let mut stmt = conn.prepare(sql).map_err(|err| err.to_string())?;
    let items = stmt.query_map([], row_to_visit_mode).map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?;
    Ok(items)
}

#[tauri::command]
fn save_visit_mode(state: tauri::State<'_, AppState>, mut item: VisitModeOption) -> Result<VisitModeOption, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    item.name = item.name.trim().to_string();
    if item.name.is_empty() { return Err("نام شیوه ویزیت الزامی است.".to_string()); }
    let key = if item.key.trim().is_empty() {
        format!("custom_{}", Utc::now().timestamp_millis())
    } else { item.key.trim().to_lowercase().replace(' ', "_") };
    let id = if let Some(id) = item.id {
        let affected = conn.execute(
            "UPDATE visit_modes SET key=?1, name=?2, active=?3, description=?4 WHERE id=?5",
            params![key, item.name, if item.active {1} else {0}, item.description, id],
        ).map_err(|err| err.to_string())?;
        if affected == 0 { return Err("شیوه ویزیت پیدا نشد.".to_string()); }
        id
    } else {
        conn.execute(
            "INSERT INTO visit_modes (key, name, active, description) VALUES (?1, ?2, ?3, ?4)",
            params![key, item.name, if item.active {1} else {0}, item.description],
        ).map_err(|err| format!("ذخیره شیوه ویزیت انجام نشد: {err}"))?;
        conn.last_insert_rowid()
    };
    conn.query_row("SELECT id, key, name, active, description FROM visit_modes WHERE id=?1", params![id], row_to_visit_mode)
        .map_err(|err| err.to_string())
}

fn row_to_nutrition_calculation(row: &rusqlite::Row<'_>) -> rusqlite::Result<NutritionCalculation> {
    Ok(NutritionCalculation {
        id: row.get(0)?, client_id: row.get(1)?, visit_id: row.get(2)?, track_id: row.get(3)?, calculated_at: row.get(4)?,
        gender: row.get(5)?, age: row.get(6)?, height_cm: row.get(7)?, weight_kg: row.get(8)?,
        activity_level: row.get(9)?, goal: row.get(10)?, bmi: row.get(11)?, ibw: row.get(12)?,
        abw: row.get(13)?, bmr: row.get(14)?, tee: row.get(15)?, target_calories: row.get(16)?,
        calorie_adjustment_percent: row.get(17)?, protein_percent: row.get(18)?, carb_percent: row.get(19)?,
        fat_percent: row.get(20)?, protein_g: row.get(21)?, carb_g: row.get(22)?, fat_g: row.get(23)?,
        notes: row.get(24)?, created_at: row.get(25)?, updated_at: row.get(26)?,
    })
}

const NUTRITION_CALC_SELECT: &str = "SELECT id, client_id, visit_id, track_id, calculated_at, gender, age, height_cm, weight_kg, activity_level, goal, bmi, ibw, abw, bmr, tee, target_calories, calorie_adjustment_percent, protein_percent, carb_percent, fat_percent, protein_g, carb_g, fat_g, notes, created_at, updated_at FROM nutrition_calculations";

#[tauri::command]
fn list_client_nutrition_calculations(state: tauri::State<'_, AppState>, client_id: i64) -> Result<Vec<NutritionCalculation>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn.prepare(&format!("{} WHERE client_id=?1 ORDER BY calculated_at DESC, id DESC", NUTRITION_CALC_SELECT)).map_err(|err| err.to_string())?;
    let items = stmt.query_map(params![client_id], row_to_nutrition_calculation).map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?;
    Ok(items)
}

#[tauri::command]
fn save_nutrition_calculation(state: tauri::State<'_, AppState>, item: NutritionCalculation) -> Result<NutritionCalculation, String> {
    if item.client_id <= 0 { return Err("ابتدا یک مراجع را انتخاب کنید.".to_string()); }
    if item.target_calories <= 0.0 { return Err("کالری هدف معتبر نیست.".to_string()); }
    let total_percent = item.protein_percent + item.carb_percent + item.fat_percent;
    if (total_percent - 100.0).abs() > 0.2 { return Err("جمع درصد پروتئین، کربوهیدرات و چربی باید ۱۰۰ باشد.".to_string()); }
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_client(&conn, item.client_id)?;
    let timestamp = now();
    let track_id = match item.track_id {
        Some(id) => Some(id),
        None => Some(ensure_care_track_inner(&conn, item.client_id, "diet", "nutrition_calculation", &timestamp)?),
    };
    let calculated_at = if item.calculated_at.trim().is_empty() { local_today() } else { item.calculated_at.clone() };
    let id = if let Some(id) = item.id {
        conn.execute("UPDATE nutrition_calculations SET visit_id=?1, track_id=?2, calculated_at=?3, gender=?4, age=?5, height_cm=?6, weight_kg=?7, activity_level=?8, goal=?9, bmi=?10, ibw=?11, abw=?12, bmr=?13, tee=?14, target_calories=?15, calorie_adjustment_percent=?16, protein_percent=?17, carb_percent=?18, fat_percent=?19, protein_g=?20, carb_g=?21, fat_g=?22, notes=?23, updated_at=?24 WHERE id=?25 AND client_id=?26",
            params![item.visit_id, track_id, calculated_at, item.gender, item.age, item.height_cm, item.weight_kg, item.activity_level, item.goal, item.bmi, item.ibw, item.abw, item.bmr, item.tee, item.target_calories, item.calorie_adjustment_percent, item.protein_percent, item.carb_percent, item.fat_percent, item.protein_g, item.carb_g, item.fat_g, item.notes, timestamp, id, item.client_id])
            .map_err(|err| err.to_string())?;
        id
    } else {
        conn.execute("INSERT INTO nutrition_calculations (client_id, visit_id, track_id, calculated_at, gender, age, height_cm, weight_kg, activity_level, goal, bmi, ibw, abw, bmr, tee, target_calories, calorie_adjustment_percent, protein_percent, carb_percent, fat_percent, protein_g, carb_g, fat_g, notes, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?25)",
            params![item.client_id, item.visit_id, track_id, calculated_at, item.gender, item.age, item.height_cm, item.weight_kg, item.activity_level, item.goal, item.bmi, item.ibw, item.abw, item.bmr, item.tee, item.target_calories, item.calorie_adjustment_percent, item.protein_percent, item.carb_percent, item.fat_percent, item.protein_g, item.carb_g, item.fat_g, item.notes, timestamp])
            .map_err(|err| err.to_string())?;
        conn.last_insert_rowid()
    };
    conn.query_row(&format!("{} WHERE id=?1", NUTRITION_CALC_SELECT), params![id], row_to_nutrition_calculation).map_err(|err| err.to_string())
}

fn row_to_diet_plan(row: &rusqlite::Row<'_>) -> rusqlite::Result<DietPlan> {
    Ok(DietPlan {
        id: row.get(0)?, client_id: row.get(1)?, visit_id: row.get(2)?, track_id: row.get(3)?, calculation_id: row.get(4)?,
        title: row.get(5)?, plan_date: row.get(6)?, status: row.get(7)?, calories_target: row.get(8)?,
        protein_target_g: row.get(9)?, carb_target_g: row.get(10)?, fat_target_g: row.get(11)?, meals_json: row.get(12)?,
        hydration_text: row.get(13)?, activity_text: row.get(14)?, guidance_text: row.get(15)?, notes: row.get(16)?,
        created_at: row.get(17)?, updated_at: row.get(18)?,
    })
}

const DIET_PLAN_SELECT: &str = "SELECT id, client_id, visit_id, track_id, calculation_id, title, plan_date, status, calories_target, protein_target_g, carb_target_g, fat_target_g, meals_json, hydration_text, activity_text, guidance_text, notes, created_at, updated_at FROM diet_plans";

#[tauri::command]
fn list_client_diet_plans(state: tauri::State<'_, AppState>, client_id: i64) -> Result<Vec<DietPlan>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn.prepare(&format!("{} WHERE client_id=?1 ORDER BY plan_date DESC, id DESC", DIET_PLAN_SELECT)).map_err(|err| err.to_string())?;
    let items = stmt.query_map(params![client_id], row_to_diet_plan).map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?;
    Ok(items)
}

#[tauri::command]
fn save_diet_plan(state: tauri::State<'_, AppState>, plan: DietPlan) -> Result<DietPlan, String> {
    if plan.title.trim().is_empty() { return Err("عنوان برنامه غذایی الزامی است.".to_string()); }
    if !is_valid_iso_date(&plan.plan_date) { return Err("تاریخ برنامه غذایی معتبر نیست.".to_string()); }
    serde_json::from_str::<serde_json::Value>(&plan.meals_json).map_err(|_| "ساختار وعده‌های غذایی معتبر نیست.".to_string())?;
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_client(&conn, plan.client_id)?;
    let timestamp = now();
    let track_id = match plan.track_id {
        Some(id) => Some(id),
        None => Some(ensure_care_track_inner(&conn, plan.client_id, "diet", "diet_plan", &timestamp)?),
    };
    let id = if let Some(id) = plan.id {
        conn.execute("UPDATE diet_plans SET visit_id=?1, track_id=?2, calculation_id=?3, title=?4, plan_date=?5, status=?6, calories_target=?7, protein_target_g=?8, carb_target_g=?9, fat_target_g=?10, meals_json=?11, hydration_text=?12, activity_text=?13, guidance_text=?14, notes=?15, updated_at=?16 WHERE id=?17 AND client_id=?18",
            params![plan.visit_id, track_id, plan.calculation_id, plan.title, plan.plan_date, plan.status, plan.calories_target, plan.protein_target_g, plan.carb_target_g, plan.fat_target_g, plan.meals_json, plan.hydration_text, plan.activity_text, plan.guidance_text, plan.notes, timestamp, id, plan.client_id])
            .map_err(|err| err.to_string())?;
        id
    } else {
        conn.execute("INSERT INTO diet_plans (client_id, visit_id, track_id, calculation_id, title, plan_date, status, calories_target, protein_target_g, carb_target_g, fat_target_g, meals_json, hydration_text, activity_text, guidance_text, notes, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?17)",
            params![plan.client_id, plan.visit_id, track_id, plan.calculation_id, plan.title, plan.plan_date, plan.status, plan.calories_target, plan.protein_target_g, plan.carb_target_g, plan.fat_target_g, plan.meals_json, plan.hydration_text, plan.activity_text, plan.guidance_text, plan.notes, timestamp])
            .map_err(|err| err.to_string())?;
        conn.last_insert_rowid()
    };
    conn.query_row(&format!("{} WHERE id=?1", DIET_PLAN_SELECT), params![id], row_to_diet_plan).map_err(|err| err.to_string())
}

fn build_diet_plan_html(conn: &Connection, client: &Client, plan: &DietPlan) -> Result<String, String> {
    let clinic_name = read_setting_or(conn, "clinic_name", "Dietory")?;
    let dietitian_name = read_setting_or(conn, "dietitian_name", "")?;
    let header_title = read_setting_or(conn, "diet_plan_header_title", "برنامه غذایی اختصاصی")?;
    let footer_text = read_setting_or(conn, "diet_plan_footer_text", "این برنامه بر اساس شرایط فردی مراجع تنظیم شده است.")?;
    let logo_src = default_logo_data_uri();
    let margin = read_number_setting(conn, "diet_plan_margin_mm", 14.0)?.clamp(5.0, 35.0);
    let show_macros = read_setting_or(conn, "diet_plan_show_macros", "1")? != "0";
    let show_calories = read_setting_or(conn, "diet_plan_show_calories", "1")? != "0";
    let meals: serde_json::Value = serde_json::from_str(&plan.meals_json).unwrap_or_else(|_| serde_json::json!([]));
    let mut meals_html = String::new();
    if let Some(items) = meals.as_array() {
        for meal in items {
            let title = meal.get("title").and_then(|v| v.as_str()).unwrap_or("وعده");
            let target_percent = meal.get("target_percent").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let notes = meal.get("notes").and_then(|v| v.as_str()).unwrap_or("");
            let mut rows = String::new();
            if let Some(food_items) = meal.get("items").and_then(|v| v.as_array()) {
                for food in food_items {
                    let name = food.get("title").and_then(|v| v.as_str()).unwrap_or("—");
                    let amount = food.get("amount").and_then(|v| v.as_str()).unwrap_or("—");
                    let calories = food.get("calories").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let protein = food.get("protein_g").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let carb = food.get("carb_g").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let fat = food.get("fat_g").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let detail = if show_macros { format!("پروتئین {}g · کربوهیدرات {}g · چربی {}g", number(protein,1), number(carb,1), number(fat,1)) } else { String::new() };
                    let kcal = if show_calories { format!("{} kcal", number(calories,0)) } else { String::new() };
                    rows.push_str(&format!("<tr><td><strong>{}</strong><small>{}</small></td><td>{}</td><td>{}</td></tr>", escape_html(name), escape_html(&detail), escape_html(amount), escape_html(&kcal)));
                }
            }
            if rows.is_empty() { rows.push_str("<tr><td colspan=3 class=empty>برای این وعده آیتمی ثبت نشده است.</td></tr>"); }
            meals_html.push_str(&format!("<section class=meal><div class=meal-head><div><span>سهم پیشنهادی {}٪</span><h2>{}</h2></div></div><table><tbody>{}</tbody></table>{}</section>", number(target_percent,0), escape_html(title), rows, if notes.trim().is_empty(){String::new()}else{format!("<p class=meal-note>{}</p>",escape_html(notes))}));
        }
    }
    let macro_block = if show_macros { format!("<div class=target><span>پروتئین</span><b>{} g</b></div><div class=target><span>کربوهیدرات</span><b>{} g</b></div><div class=target><span>چربی</span><b>{} g</b></div>", number(plan.protein_target_g,0), number(plan.carb_target_g,0), number(plan.fat_target_g,0)) } else { String::new() };
    let calorie_block = if show_calories { format!("<div class=target primary><span>کالری روزانه</span><b>{} kcal</b></div>", number(plan.calories_target,0)) } else { String::new() };
    Ok(format!(r#"<!doctype html><html lang=fa dir=rtl><head><meta charset=utf-8><title>{title}</title><style>
@page{{size:A4;margin:{margin}mm}}*{{box-sizing:border-box}}body{{font-family:Vazirmatn,Tahoma,Arial,sans-serif;color:#143c4c;background:#eef7f5;margin:0;line-height:1.75}}.toolbar{{position:sticky;top:0;z-index:3;background:#0F5079;color:#fff;padding:11px 20px;display:flex;justify-content:space-between;align-items:center}}button{{font:inherit;border:0;border-radius:12px;padding:9px 16px;font-weight:800;color:#0F5079;background:#8AE3C3;cursor:pointer}}main{{max-width:920px;margin:24px auto;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 24px 80px #0f507926}}header{{padding:30px 34px;background:linear-gradient(135deg,#0F5079,#16788a);color:#fff;position:relative}}header:after{{content:'';position:absolute;width:260px;height:260px;border-radius:50%;background:#8AE3C31f;left:-80px;top:-130px}}.logo{{display:block;width:92px;height:92px;object-fit:contain;border-radius:18px;margin-bottom:12px;box-shadow:0 10px 28px #063b5c55}}.brand{{font-size:13px;color:#b9f3df}}h1{{font-size:32px;margin:10px 0 2px}}header p{{margin:0;opacity:.9}}.targets{{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:20px 34px;background:#f7fcfa}}.target{{border:1px solid #dbece6;border-radius:16px;padding:12px;background:#fff}}.target span{{display:block;font-size:12px;color:#72847f}}.target b{{font-size:19px;color:#0F5079}}.target.primary{{background:#e4f8f1;border-color:#8AE3C3}}.content{{padding:28px 34px}}.meal{{border:1px solid #dce9e5;border-radius:20px;overflow:hidden;margin-bottom:18px;break-inside:avoid}}.meal-head{{padding:14px 18px;background:linear-gradient(90deg,#effaf6,#fff)}}.meal-head span{{font-size:11px;color:#729187}}.meal h2{{margin:2px 0;color:#0F5079;font-size:20px}}table{{width:100%;border-collapse:collapse}}td{{padding:11px 16px;border-top:1px solid #edf2f0;vertical-align:top}}td:nth-child(2),td:nth-child(3){{width:22%;white-space:nowrap}}td small{{display:block;color:#7d8c87;font-size:10px}}.meal-note{{padding:10px 16px;margin:0;background:#fbfdfc;color:#526a62}}.guides{{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:24px}}.guide{{border-radius:18px;padding:15px;background:#f4faf8;border:1px solid #e0ece8}}.guide h3{{margin:0 0 6px;color:#0F5079}}.guide p{{white-space:pre-wrap;margin:0}}footer{{padding:18px 34px;border-top:1px solid #e6efec;text-align:center;color:#70817c;font-size:11px}}.empty{{text-align:center;color:#82918c}}@media print{{body{{background:#fff}}.toolbar{{display:none}}main{{margin:0;max-width:none;border-radius:0;box-shadow:none}}header{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}}}@media(max-width:700px){{.targets{{grid-template-columns:repeat(2,1fr)}}.guides{{grid-template-columns:1fr}}}}
</style></head><body><div class=toolbar><strong>پیش‌نمایش برنامه غذایی</strong><button onclick=window.print()>چاپ / ذخیره PDF</button></div><main><header><img class=logo src="{logo}" alt="Dietory"><div class=brand>{clinic} · {dietitian}</div><h1>{header}</h1><p>{client} · تاریخ برنامه: <time data-date='{date}'>{date}</time></p></header><div class=targets>{calorie}{macros}</div><div class=content>{meals}<div class=guides><div class=guide><h3>آب و مایعات</h3><p>{hydration}</p></div><div class=guide><h3>فعالیت</h3><p>{activity}</p></div><div class=guide><h3>راهنمای اجرا</h3><p>{guidance}</p></div><div class=guide><h3>یادداشت متخصص</h3><p>{notes}</p></div></div></div><footer>{footer}</footer></main><script>document.querySelectorAll('time[data-date]').forEach(function(el){{var d=new Date(el.dataset.date+'T00:00:00');if(!isNaN(d))el.textContent=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{{year:'numeric',month:'long',day:'numeric'}}).format(d)}})</script></body></html>"#,
        title=escape_html(&plan.title), margin=margin, logo=logo_src, clinic=escape_html(&clinic_name), dietitian=escape_html(&dietitian_name), header=escape_html(&header_title), client=escape_html(&client.full_name), date=escape_html(&plan.plan_date), calorie=calorie_block, macros=macro_block, meals=meals_html, hydration=escape_html(non_empty(&plan.hydration_text,"طبق توصیه متخصص")), activity=escape_html(non_empty(&plan.activity_text,"طبق برنامه فردی")), guidance=escape_html(non_empty(&plan.guidance_text,"وعده‌ها را منظم و مطابق مقادیر نوشته‌شده مصرف کنید.")), notes=escape_html(non_empty(&plan.notes,"—")), footer=escape_html(&footer_text)))
}

#[tauri::command]
fn export_diet_plan(state: tauri::State<'_, AppState>, plan_id: i64) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let plan = conn.query_row(&format!("{} WHERE id=?1", DIET_PLAN_SELECT), params![plan_id], row_to_diet_plan)
        .optional().map_err(|err| err.to_string())?.ok_or_else(|| "برنامه غذایی پیدا نشد.".to_string())?;
    let client = get_client(&conn, plan.client_id)?;
    let html = build_diet_plan_html(&conn, &client, &plan)?;
    drop(conn);
    let dir = client_folder(&state, plan.client_id)?.join("diet-plans");
    fs::create_dir_all(&dir).map_err(|err| format!("ساخت پوشه برنامه غذایی انجام نشد: {err}"))?;
    let path = dir.join(format!("diet-plan-{}-{}.html", plan.id.unwrap_or(plan_id), Utc::now().format("%Y%m%d-%H%M%S")));
    fs::write(&path, html).map_err(|err| format!("ساخت فایل برنامه غذایی انجام نشد: {err}"))?;
    open_path_with_system(path.clone())?;
    Ok(path.to_string_lossy().to_string())
}

fn row_to_attachment(row: &rusqlite::Row<'_>) -> rusqlite::Result<Attachment> {
    Ok(Attachment {
        id: row.get(0)?,
        client_id: row.get(1)?,
        visit_id: row.get(2)?,
        track_id: row.get(3)?,
        related_type: row.get(4)?,
        related_id: row.get(5)?,
        category: row.get(6)?,
        title: row.get(7)?,
        file_name: row.get(8)?,
        local_path: row.get(9)?,
        attachment_date: row.get(10)?,
        notes: row.get(11)?,
        created_at: row.get(12)?,
    })
}

fn client_folder_path(state: &AppState, client_id: i64) -> Result<PathBuf, String> {
    Ok(state
        .db_path
        .parent()
        .ok_or_else(|| "مسیر داده‌های برنامه پیدا نشد.".to_string())?
        .join("DietoyData")
        .join("clients")
        .join(format!("client-{client_id:06}")))
}

fn client_folder(state: &AppState, client_id: i64) -> Result<PathBuf, String> {
    let base = client_folder_path(state, client_id)?;
    fs::create_dir_all(&base).map_err(|err| format!("ساخت پوشه مراجعه‌کننده انجام نشد: {err}"))?;
    for folder in ["profile", "visits", "body-analysis", "lab-results", "medical", "diet-plans", "device", "photos", "reports", "other"] {
        let _ = fs::create_dir_all(base.join(folder));
    }
    Ok(base)
}

fn attachment_folder_name(category: &str) -> &'static str {
    match category {
        "profile" => "profile",
        "body_analysis" => "body-analysis",
        "lab" => "lab-results",
        "medical_report" => "medical",
        "diet_plan" => "diet-plans",
        "device" => "device",
        "before_after" => "photos",
        "report" => "reports",
        _ => "other",
    }
}

fn import_attachment_inner(
    state: &AppState,
    source_path: String,
    mut attachment: Attachment,
) -> Result<Attachment, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err("فایل انتخاب‌شده پیدا نشد.".to_string());
    }
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_client(&conn, attachment.client_id)?;
    if let Some(visit_id) = attachment.visit_id {
        let visit = get_visit(&conn, visit_id)?;
        if attachment.track_id.is_none() { attachment.track_id = visit.track_id; }
        if attachment.related_type.is_empty() { attachment.related_type = "visit".to_string(); }
        if attachment.related_id.is_none() { attachment.related_id = Some(visit_id); }
    }
    let file_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "نام فایل معتبر نیست.".to_string())?
        .to_string();
    let target_dir = client_folder(state, attachment.client_id)?.join(attachment_folder_name(&attachment.category));
    fs::create_dir_all(&target_dir).map_err(|err| err.to_string())?;

    let mut target = target_dir.join(&file_name);
    if target.exists() {
        let extension = source.extension().and_then(|value| value.to_str()).unwrap_or("");
        let stem = source.file_stem().and_then(|value| value.to_str()).unwrap_or("attachment");
        let suffix = Utc::now().timestamp_millis();
        let unique_name = if extension.is_empty() {
            format!("{stem}-{suffix}")
        } else {
            format!("{stem}-{suffix}.{extension}")
        };
        target = target_dir.join(unique_name);
    }

    fs::copy(&source, &target).map_err(|err| format!("کپی فایل انجام نشد: {err}"))?;
    let timestamp = now();
    attachment.file_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(&file_name)
        .to_string();
    attachment.local_path = target.to_string_lossy().to_string();
    if attachment.attachment_date.is_empty() {
        attachment.attachment_date = local_today();
    }
    conn.execute(
        "INSERT INTO attachments (client_id, visit_id, track_id, related_type, related_id, category, title, file_name, local_path, attachment_date, notes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![attachment.client_id, attachment.visit_id, attachment.track_id, attachment.related_type, attachment.related_id, attachment.category, attachment.title, attachment.file_name, attachment.local_path, attachment.attachment_date, attachment.notes, timestamp],
    )
    .map_err(|err| err.to_string())?;
    let id = conn.last_insert_rowid();
    conn.query_row("SELECT id, client_id, visit_id, track_id, related_type, related_id, category, title, file_name, local_path, attachment_date, notes, created_at FROM attachments WHERE id=?1", params![id], row_to_attachment)
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn import_visit_attachment(
    state: tauri::State<'_, AppState>,
    source_path: String,
    attachment: Attachment,
) -> Result<Attachment, String> {
    import_attachment_inner(state.inner(), source_path, attachment)
}

#[tauri::command]
fn import_attachment(
    state: tauri::State<'_, AppState>,
    client_id: i64,
    visit_id: Option<i64>,
    path: String,
    category: String,
    title: String,
    attachment_date: String,
    notes: String,
) -> Result<Attachment, String> {
    let attachment = Attachment {
        id: None,
        client_id,
        visit_id,
        track_id: None,
        related_type: if visit_id.is_some() { "visit".to_string() } else { "client".to_string() },
        related_id: visit_id,
        category: if category.trim().is_empty() { "other".to_string() } else { category },
        title,
        file_name: String::new(),
        local_path: String::new(),
        attachment_date,
        notes,
        created_at: None,
    };
    import_attachment_inner(state.inner(), path, attachment)
}


#[tauri::command]
fn list_client_attachments(state: tauri::State<'_, AppState>, client_id: i64) -> Result<Vec<Attachment>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, client_id, visit_id, track_id, related_type, related_id, category, title, file_name, local_path, attachment_date, notes, created_at FROM attachments WHERE client_id=?1 ORDER BY attachment_date DESC, id DESC")
        .map_err(|err| err.to_string())?;
    let items = stmt
        .query_map(params![client_id], row_to_attachment)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(items)
}

fn open_path_with_system(path: PathBuf) -> Result<(), String> {
    if !path.exists() {
        return Err("مسیر موردنظر پیدا نشد.".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        let path_string = path.to_string_lossy().to_string();
        Command::new("cmd")
            .args(["/C", "start", ""])
            .arg(path_string)
            .spawn()
            .map_err(|err| format!("باز کردن مسیر انجام نشد: {err}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|err| format!("باز کردن مسیر انجام نشد: {err}"))?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|err| format!("باز کردن مسیر انجام نشد: {err}"))?;
    }
    Ok(())
}

#[tauri::command]
fn open_client_folder(state: tauri::State<'_, AppState>, client_id: i64) -> Result<(), String> {
    let path = client_folder(&state, client_id)?;
    open_path_with_system(path)
}

#[tauri::command]
fn open_attachment(state: tauri::State<'_, AppState>, attachment_id: i64) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let path: String = conn
        .query_row("SELECT local_path FROM attachments WHERE id=?1", params![attachment_id], |row| row.get(0))
        .optional()
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "فایل پیوست پیدا نشد.".to_string())?;
    open_path_with_system(PathBuf::from(path))
}

#[tauri::command]
fn delete_attachment(state: tauri::State<'_, AppState>, attachment_id: i64) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let path: String = conn
        .query_row("SELECT local_path FROM attachments WHERE id=?1", params![attachment_id], |row| row.get(0))
        .optional()
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "فایل پیوست پیدا نشد.".to_string())?;

    let file_path = PathBuf::from(path);
    let mut staged_file: Option<(PathBuf, PathBuf)> = None;
    if file_path.exists() {
        let data_root = state.db_path.parent().ok_or_else(|| "مسیر داده‌های برنامه پیدا نشد.".to_string())?;
        let canonical_root = fs::canonicalize(data_root).map_err(|err| err.to_string())?;
        let canonical_file = fs::canonicalize(&file_path).map_err(|err| err.to_string())?;
        if canonical_file.starts_with(canonical_root) {
            let staged = canonical_file.with_file_name(format!(
                ".dietory-delete-{}-{}",
                attachment_id,
                Utc::now().format("%Y%m%d%H%M%S%3f")
            ));
            fs::rename(&canonical_file, &staged).map_err(|err| format!("آماده‌سازی فایل برای حذف انجام نشد: {err}"))?;
            staged_file = Some((staged, canonical_file));
        }
    }

    let affected = match conn.execute("DELETE FROM attachments WHERE id=?1", params![attachment_id]) {
        Ok(value) => value,
        Err(error) => {
            if let Some((staged, original)) = staged_file.as_ref() {
                if staged.exists() { let _ = fs::rename(staged, original); }
            }
            return Err(error.to_string());
        }
    };
    if affected == 0 {
        if let Some((staged, original)) = staged_file.as_ref() {
            if staged.exists() { let _ = fs::rename(staged, original); }
        }
        return Err("فایل پیوست پیدا نشد.".to_string());
    }

    if let Some((staged, _)) = staged_file {
        if staged.exists() { let _ = fs::remove_file(staged); }
    }
    Ok(())
}

#[tauri::command]
fn read_attachment_preview(state: tauri::State<'_, AppState>, attachment_id: i64) -> Result<AttachmentPreview, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let (path, file_name): (String, String) = conn.query_row(
        "SELECT local_path, file_name FROM attachments WHERE id=?1",
        params![attachment_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).optional().map_err(|err| err.to_string())?
        .ok_or_else(|| "فایل پیوست پیدا نشد.".to_string())?;
    drop(conn);
    let path = PathBuf::from(path);
    let metadata = fs::metadata(&path).map_err(|err| format!("خواندن مشخصات فایل انجام نشد: {err}"))?;
    if metadata.len() > 40 * 1024 * 1024 {
        return Err("حجم فایل برای پیش‌نمایش داخل اپ بیشتر از ۴۰ مگابایت است؛ از گزینه بازکردن کامل استفاده کنید.".to_string());
    }
    let bytes = fs::read(&path).map_err(|err| format!("خواندن فایل انجام نشد: {err}"))?;
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("").to_lowercase();
    let mime_type = match extension.as_str() {
        "pdf" => "application/pdf",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    }.to_string();
    Ok(AttachmentPreview { mime_type, base64_data: base64_encode(&bytes), file_name })
}


fn base64_encode(data: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity((data.len() + 2) / 3 * 4);
    let mut index = 0;
    while index < data.len() {
        let b0 = data[index];
        let b1 = if index + 1 < data.len() { data[index + 1] } else { 0 };
        let b2 = if index + 2 < data.len() { data[index + 2] } else { 0 };
        output.push(TABLE[(b0 >> 2) as usize] as char);
        output.push(TABLE[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if index + 1 < data.len() {
            output.push(TABLE[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            output.push('=');
        }
        if index + 2 < data.len() {
            output.push(TABLE[(b2 & 0x3f) as usize] as char);
        } else {
            output.push('=');
        }
        index += 3;
    }
    output
}

fn default_logo_data_uri() -> String {
    format!("data:image/png;base64,{}", base64_encode(include_bytes!("../../public/logo.png")))
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn non_empty<'a>(value: &'a str, fallback: &'a str) -> &'a str {
    if value.trim().is_empty() { fallback } else { value.trim() }
}

fn gender_label(value: &str) -> &'static str {
    match value {
        "male" => "آقا",
        "female" => "خانم",
        _ => "—",
    }
}

fn goal_label(value: &str) -> &'static str {
    match value {
        "lose" => "کاهش وزن",
        "maintain" => "ثبات وزن",
        "gain" => "افزایش وزن",
        _ => "—",
    }
}

fn activity_label(value: &str) -> &'static str {
    match value {
        "sedentary" => "کم‌تحرک",
        "light" => "فعالیت سبک",
        "moderate" => "فعالیت متوسط",
        "active" => "فعال",
        "very_active" => "بسیار فعال",
        _ => "—",
    }
}

fn visit_status_label(value: &str) -> &'static str {
    match value {
        "tentative" => "پیشنهادی",
        "confirmed" => "تأیید شده",
        "scheduled" => "زمان‌بندی شده",
        "completed" | "done" => "انجام شده",
        "cancelled" | "canceled" => "لغو شده",
        "pending" => "در انتظار",
        _ => "—",
    }
}

fn attachment_category_label(value: &str) -> &'static str {
    match value {
        "profile" => "عکس پروفایل",
        "body_analysis" => "بادی آنالیز",
        "lab" => "آزمایش",
        "medical_report" => "گزارش پزشکی",
        "diet_plan" => "برنامه غذایی",
        "device" => "دستگاه",
        "before_after" => "قبل و بعد",
        "report" => "گزارش",
        "other" => "سایر",
        _ => "سایر",
    }
}

fn service_group_label(value: &str) -> &'static str {
    match value {
        "diet" => "رژیم غذایی",
        "consultation" => "مشاوره تغذیه",
        "body_analysis" => "بادی آنالیز",
        "device" => "دستگاه و خدمات موضعی",
        "followup" => "پیگیری و کنترل",
        "package" => "پکیج خدمات",
        "report" => "گزارش و فایل",
        "other" => "سایر",
        _ => "سایر",
    }
}

fn money(value: f64) -> String {
    if value.abs() < f64::EPSILON {
        "۰".to_string()
    } else {
        format!("{value:.0}")
    }
}

fn number(value: f64, digits: usize) -> String {
    match digits {
        0 => format!("{value:.0}"),
        1 => format!("{value:.1}"),
        2 => format!("{value:.2}"),
        _ => format!("{value:.3}"),
    }
}

fn optional_number(value: Option<f64>, digits: usize) -> String {
    value.map(|item| number(item, digits)).unwrap_or_else(|| "—".to_string())
}

fn bmi_value(weight_kg: f64, height_cm: f64) -> f64 {
    if height_cm <= 0.0 { return 0.0; }
    let height_m = height_cm / 100.0;
    weight_kg / (height_m * height_m)
}

fn report_calculations(conn: &Connection, client: &Client) -> Result<(f64, f64, f64, f64, f64, f64, f64, f64, f64, f64), String> {
    let saved = conn.query_row(
        "SELECT bmi, ibw, abw, bmr, tee, target_calories, protein_percent, carb_percent, fat_percent FROM nutrition_calculations WHERE client_id=?1 ORDER BY calculated_at DESC, id DESC LIMIT 1",
        params![client.id.unwrap_or_default()],
        |row| Ok((row.get(0)?,row.get(1)?,row.get(2)?,row.get(3)?,row.get(4)?,row.get(5)?,row.get(6)?,row.get(7)?,row.get(8)?)),
    ).optional().map_err(|err| err.to_string())?;
    if let Some((bmi,ibw,abw,bmr,tee,target,protein_percent,carb_percent,fat_percent)) = saved {
        let activity_factor = match client.activity_level.as_str() {
            "sedentary" => read_number_setting(conn, "calc_activity_sedentary", 1.3)?,
            "light" => read_number_setting(conn, "calc_activity_light", 1.3)?,
            "moderate" => read_number_setting(conn, "calc_activity_moderate", 1.3)?,
            "active" => read_number_setting(conn, "calc_activity_active", 1.3)?,
            "very_active" => read_number_setting(conn, "calc_activity_very_active", 1.3)?, _ => 1.3,
        };
        return Ok((bmi,ibw,abw,bmr,tee,target,protein_percent,carb_percent,fat_percent,activity_factor));
    }
    let bmi = bmi_value(client.weight_kg, client.height_cm);
    let height_m = client.height_cm / 100.0;
    let ibw_factor = read_number_setting(conn, "calc_ibw_bmi_factor", 22.0)?;
    let abw_divisor = read_number_setting(conn, "calc_abw_divisor", 4.0)?;
    let bmr_base = read_number_setting(conn, "calc_bmr_base", 24.0)?;
    let gender_factor = if client.gender == "male" { read_number_setting(conn, "calc_male_factor", 1.0)? } else { read_number_setting(conn, "calc_female_factor", 0.95)? };
    let bmr_adjustment = read_number_setting(conn, "calc_bmr_adjustment", 1.1)?;
    let activity_factor = match client.activity_level.as_str() {
        "sedentary" => read_number_setting(conn, "calc_activity_sedentary", 1.3)?, "light" => read_number_setting(conn, "calc_activity_light", 1.3)?,
        "moderate" => read_number_setting(conn, "calc_activity_moderate", 1.3)?, "active" => read_number_setting(conn, "calc_activity_active", 1.3)?,
        "very_active" => read_number_setting(conn, "calc_activity_very_active", 1.3)?, _ => 1.3,
    };
    let goal_adjustment = match client.goal.as_str() { "lose" => read_number_setting(conn, "calc_goal_loss", -500.0)?, "gain" => read_number_setting(conn, "calc_goal_gain", 300.0)?, _ => read_number_setting(conn, "calc_goal_maintain", 0.0)? };
    let protein_percent = read_number_setting(conn, "macro_protein_percent", 20.0)?;
    let carb_percent = read_number_setting(conn, "macro_carb_percent", 50.0)?;
    let fat_percent = read_number_setting(conn, "macro_fat_percent", 30.0)?;
    let ibw = ibw_factor * height_m * height_m;
    let abw = ibw + (client.weight_kg - ibw) / abw_divisor.max(0.1);
    let bmr = bmr_base * gender_factor * abw * bmr_adjustment;
    let tee = bmr * activity_factor;
    let target = tee + goal_adjustment;
    Ok((bmi, ibw, abw, bmr, tee, target, protein_percent, carb_percent, fat_percent, activity_factor))
}

fn list_visit_services_inner(conn: &Connection, visit_id: i64) -> Result<Vec<VisitService>, String> {
    let mut stmt = conn
        .prepare("SELECT id, visit_id, service_id, device_id, service_name_snapshot, service_group_snapshot, body_area, device_name, device_rental_percent_snapshot, duration_minutes, price, quantity, total, notes FROM visit_services WHERE visit_id=?1 ORDER BY id ASC")
        .map_err(|err| err.to_string())?;
    let items = stmt
        .query_map(params![visit_id], row_to_visit_service)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(items)
}

fn list_client_attachments_inner(conn: &Connection, client_id: i64) -> Result<Vec<Attachment>, String> {
    let mut stmt = conn
        .prepare("SELECT id, client_id, visit_id, track_id, related_type, related_id, category, title, file_name, local_path, attachment_date, notes, created_at FROM attachments WHERE client_id=?1 ORDER BY attachment_date DESC, id DESC")
        .map_err(|err| err.to_string())?;
    let items = stmt
        .query_map(params![client_id], row_to_attachment)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(items)
}

fn list_client_nutrition_calculations_inner(conn: &Connection, client_id: i64) -> Result<Vec<NutritionCalculation>, String> {
    let mut stmt = conn.prepare(&format!("{} WHERE client_id=?1 ORDER BY calculated_at DESC, id DESC", NUTRITION_CALC_SELECT))
        .map_err(|err| err.to_string())?;
    let items = stmt.query_map(params![client_id], row_to_nutrition_calculation)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(items)
}

fn list_client_diet_plans_inner(conn: &Connection, client_id: i64) -> Result<Vec<DietPlan>, String> {
    let mut stmt = conn.prepare(&format!("{} WHERE client_id=?1 ORDER BY plan_date DESC, id DESC", DIET_PLAN_SELECT))
        .map_err(|err| err.to_string())?;
    let items = stmt.query_map(params![client_id], row_to_diet_plan)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(items)
}

#[tauri::command]
fn get_client_profile_bundle(state: tauri::State<'_, AppState>, client_id: i64) -> Result<ClientProfileBundle, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let client = get_client(&conn, client_id)?;
    let care_tracks = list_client_care_tracks_inner(&conn, client_id)?;
    let attachments = list_client_attachments_inner(&conn, client_id)?;
    let nutrition_calculations = list_client_nutrition_calculations_inner(&conn, client_id)?;
    let diet_plans = list_client_diet_plans_inner(&conn, client_id)?;

    let mut stmt = conn.prepare(
        "SELECT id, client_id, track_id, visit_date, visit_time, status, reason, clinical_notes, private_notes, next_visit_enabled, next_visit_date, next_visit_time, next_visit_status, total_fee, created_at, updated_at, visit_type, visit_mode_key, visit_mode_name_snapshot FROM visits WHERE client_id=?1 ORDER BY visit_date ASC, visit_time ASC, id ASC"
    ).map_err(|err| err.to_string())?;
    let visits = stmt.query_map(params![client_id], row_to_visit)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    let mut measurements_by_visit: HashMap<i64, VisitMeasurements> = HashMap::new();
    {
        let mut measurements_stmt = conn.prepare(
            "SELECT m.id, m.visit_id, m.weight_kg, m.height_cm, m.bmi_snapshot, m.body_fat_percent, m.muscle_mass, m.visceral_fat, m.waist_cm, m.abdomen_cm, m.hip_cm, m.chest_cm, m.arm_cm, m.thigh_cm, m.calf_cm, m.neck_cm, m.custom_measurements_json, m.notes, m.created_at, m.updated_at FROM visit_measurements m JOIN visits v ON v.id=m.visit_id WHERE v.client_id=?1"
        ).map_err(|err| err.to_string())?;
        for item in measurements_stmt.query_map(params![client_id], row_to_measurements).map_err(|err| err.to_string())? {
            let measurement = item.map_err(|err| err.to_string())?;
            if let Some(visit_id) = measurement.visit_id {
                measurements_by_visit.insert(visit_id, measurement);
            }
        }
    }

    let mut services_by_visit: HashMap<i64, Vec<VisitService>> = HashMap::new();
    {
        let mut services_stmt = conn.prepare(
            "SELECT s.id, s.visit_id, s.service_id, s.device_id, s.service_name_snapshot, s.service_group_snapshot, s.body_area, s.device_name, s.device_rental_percent_snapshot, s.duration_minutes, s.price, s.quantity, s.total, s.notes FROM visit_services s JOIN visits v ON v.id=s.visit_id WHERE v.client_id=?1 ORDER BY s.id ASC"
        ).map_err(|err| err.to_string())?;
        for item in services_stmt.query_map(params![client_id], row_to_visit_service).map_err(|err| err.to_string())? {
            let service = item.map_err(|err| err.to_string())?;
            services_by_visit.entry(service.visit_id).or_default().push(service);
        }
    }

    let mut values_by_visit: HashMap<i64, Vec<MeasurementValue>> = HashMap::new();
    {
        let mut values_stmt = conn.prepare(
            "SELECT mv.id, mv.visit_id, mv.metric_key, mv.side, mv.value, mv.unit, mv.created_at, mv.updated_at FROM measurement_values mv JOIN visits v ON v.id=mv.visit_id WHERE v.client_id=?1 ORDER BY mv.visit_id, mv.metric_key, mv.side"
        ).map_err(|err| err.to_string())?;
        for item in values_stmt.query_map(params![client_id], row_to_measurement_value).map_err(|err| err.to_string())? {
            let value = item.map_err(|err| err.to_string())?;
            values_by_visit.entry(value.visit_id).or_default().push(value);
        }
    }

    let mut bundles = Vec::with_capacity(visits.len());
    for visit in visits {
        let visit_id = visit.id.ok_or_else(|| "شناسه ویزیت معتبر نیست.".to_string())?;
        bundles.push(VisitBundle {
            measurements: measurements_by_visit.remove(&visit_id),
            services: services_by_visit.remove(&visit_id).unwrap_or_default(),
            measurement_values: values_by_visit.remove(&visit_id).unwrap_or_default(),
            visit,
        });
    }

    Ok(ClientProfileBundle { client, care_tracks, visits: bundles, attachments, nutrition_calculations, diet_plans })
}

fn report_table_row(label: &str, value: String) -> String {
    format!("<tr><th>{}</th><td>{}</td></tr>", escape_html(label), value)
}

fn optional_report_row(label: &str, value: Option<f64>, digits: usize, unit: &str) -> String {
    value.map(|item| {
        let rendered = if unit.is_empty() {
            number(item, digits)
        } else {
            format!("{} <small>{}</small>", number(item, digits), escape_html(unit))
        };
        report_table_row(label, rendered)
    }).unwrap_or_default()
}

fn extended_measurement_rows(value: Option<&str>) -> String {
    let Some(value) = value.filter(|item| !item.trim().is_empty()) else { return String::new(); };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(value) else { return String::new(); };
    let fields = [
        ("body_water_percent", "آب بدن", "درصد"),
        ("fat_mass_kg", "توده چربی", "کیلوگرم"),
        ("muscle_percent", "درصد عضله", "درصد"),
        ("metabolic_age", "سن متابولیک", "سال"),
        ("device_score", "امتیاز دستگاه", ""),
        ("upper_abdomen_cm", "بالای شکم", "سانتی‌متر"),
        ("lower_abdomen_cm", "پایین شکم", "سانتی‌متر"),
        ("upper_arm_left_cm", "بازوی چپ", "سانتی‌متر"),
        ("upper_arm_right_cm", "بازوی راست", "سانتی‌متر"),
        ("forearm_left_cm", "ساعد چپ", "سانتی‌متر"),
        ("forearm_right_cm", "ساعد راست", "سانتی‌متر"),
        ("wrist_left_cm", "مچ دست چپ", "سانتی‌متر"),
        ("wrist_right_cm", "مچ دست راست", "سانتی‌متر"),
        ("thigh_left_cm", "ران چپ", "سانتی‌متر"),
        ("thigh_right_cm", "ران راست", "سانتی‌متر"),
        ("calf_left_cm", "ساق چپ", "سانتی‌متر"),
        ("calf_right_cm", "ساق راست", "سانتی‌متر"),
        ("ankle_left_cm", "مچ پای چپ", "سانتی‌متر"),
        ("ankle_right_cm", "مچ پای راست", "سانتی‌متر"),
    ];
    let mut rows = String::new();
    for (key, label, unit) in fields {
        if let Some(item) = json.get(key).and_then(|entry| entry.as_f64()) {
            rows.push_str(&optional_report_row(label, Some(item), 1, unit));
        }
    }
    rows
}

fn visit_type_label(value: &str) -> &'static str {
    match value {
        "initial" => "ویزیت اولیه",
        "diet_followup" => "پیگیری رژیم",
        "body_analysis" => "بادی آنالیز",
        "device" => "جلسه دستگاه",
        "consultation" => "مشاوره",
        "combined" => "ویزیت ترکیبی",
        _ => "ویزیت",
    }
}

fn build_client_report_html(conn: &Connection, client: &Client) -> Result<String, String> {
    let clinic_name = read_setting(conn, "clinic_name").unwrap_or_default();
    let dietitian_name = read_setting(conn, "dietitian_name").unwrap_or_default();
    let report_logo_src = default_logo_data_uri();
    let client_id = client.id.ok_or_else(|| "شناسه مراجع معتبر نیست.".to_string())?;
    let visits = {
        let mut stmt = conn
            .prepare("SELECT id, client_id, track_id, visit_date, visit_time, status, reason, clinical_notes, private_notes, next_visit_enabled, next_visit_date, next_visit_time, next_visit_status, total_fee, created_at, updated_at, visit_type, visit_mode_key, visit_mode_name_snapshot FROM visits WHERE client_id = ?1 ORDER BY visit_date ASC, visit_time ASC, id ASC")
            .map_err(|err| err.to_string())?;
        let rows = stmt
            .query_map(params![client_id], row_to_visit)
            .map_err(|err| err.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|err| err.to_string())?;
        rows
    };
    let attachments = list_client_attachments_inner(conn, client_id)?;
    let (bmi, ibw, abw, bmr, tee, target, protein_percent, carb_percent, fat_percent, activity_factor) = report_calculations(conn, client)?;
    let protein_grams = (target * (protein_percent / 100.0)) / 4.0;
    let carb_grams = (target * (carb_percent / 100.0)) / 4.0;
    let fat_grams = (target * (fat_percent / 100.0)) / 9.0;

    let mut track_labels: Vec<&str> = Vec::new();
    for visit in &visits {
        let label = match visit.visit_type.as_str() {
            "body_analysis" => "بادی آنالیز",
            "device" => "دستگاه و لاغری موضعی",
            "consultation" => "مشاوره",
            "combined" => "مراقبت ترکیبی",
            _ => "رژیم غذایی",
        };
        if !track_labels.contains(&label) { track_labels.push(label); }
    }
    if track_labels.is_empty() { track_labels.push("رژیم غذایی"); }
    let tracks_html = track_labels.iter().map(|label| format!("<span class=\"tag\">{}</span>", escape_html(label))).collect::<Vec<_>>().join("");

    let mut visit_cards = String::new();
    for (index, visit) in visits.iter().enumerate() {
        let measurements = if let Some(visit_id) = visit.id { get_measurements_for_visit(conn, visit_id)? } else { None };
        let services = if let Some(visit_id) = visit.id { list_visit_services_inner(conn, visit_id)? } else { Vec::new() };
        let mut measurement_rows = String::new();
        if let Some(ref m) = measurements {
            let bmi_snapshot = m.bmi_snapshot.unwrap_or_else(|| bmi_value(m.weight_kg, m.height_cm.unwrap_or(client.height_cm)));
            measurement_rows.push_str(&report_table_row("وزن", format!("{} <small>کیلوگرم</small>", number(m.weight_kg, 1))));
            measurement_rows.push_str(&optional_report_row("قد", m.height_cm, 1, "سانتی‌متر"));
            measurement_rows.push_str(&report_table_row("BMI", number(bmi_snapshot, 1)));
            measurement_rows.push_str(&optional_report_row("درصد چربی", m.body_fat_percent, 1, "درصد"));
            measurement_rows.push_str(&optional_report_row("توده عضله", m.muscle_mass, 1, "کیلوگرم"));
            measurement_rows.push_str(&optional_report_row("چربی احشایی", m.visceral_fat, 1, ""));
            measurement_rows.push_str(&optional_report_row("دور کمر", m.waist_cm, 1, "سانتی‌متر"));
            measurement_rows.push_str(&optional_report_row("دور شکم", m.abdomen_cm, 1, "سانتی‌متر"));
            measurement_rows.push_str(&optional_report_row("دور باسن", m.hip_cm, 1, "سانتی‌متر"));
            measurement_rows.push_str(&optional_report_row("دور سینه", m.chest_cm, 1, "سانتی‌متر"));
            measurement_rows.push_str(&optional_report_row("دور بازو", m.arm_cm, 1, "سانتی‌متر"));
            measurement_rows.push_str(&optional_report_row("دور ران", m.thigh_cm, 1, "سانتی‌متر"));
            measurement_rows.push_str(&optional_report_row("دور ساق", m.calf_cm, 1, "سانتی‌متر"));
            measurement_rows.push_str(&optional_report_row("دور گردن", m.neck_cm, 1, "سانتی‌متر"));
            measurement_rows.push_str(&extended_measurement_rows(m.custom_measurements_json.as_deref()));
        }
        let measurement_html = if measurement_rows.is_empty() {
            "<div class=\"empty\">اندازه‌گیری تکمیلی برای این ویزیت ثبت نشده است.</div>".to_string()
        } else {
            format!("<div class=\"table-wrap\"><table><tbody>{}</tbody></table></div>", measurement_rows)
        };

        let services_html = if services.is_empty() {
            "<div class=\"empty\">خدمتی برای این ویزیت ثبت نشده است.</div>".to_string()
        } else {
            services.iter().map(|service| format!(
                "<div class=\"service-line\"><div><strong>{}</strong><small>{}{}{}{}</small></div><b>{} تومان</b></div>",
                escape_html(&service.service_name_snapshot),
                escape_html(service_group_label(&service.service_group_snapshot)),
                if service.body_area.is_empty() { "" } else { " · " },
                escape_html(&service.body_area),
                if service.device_name.is_empty() { "" } else { " · دستگاه" },
                money(service.total),
            )).collect::<Vec<_>>().join("")
        };
        let next_visit = if visit.next_visit_enabled && !visit.next_visit_date.is_empty() {
            format!("<span>پیگیری بعدی: <time data-date=\"{}\">{}</time>{}</span>", escape_html(&visit.next_visit_date), escape_html(&visit.next_visit_date), if visit.next_visit_time.is_empty() { String::new() } else { format!(" · {}", escape_html(&visit.next_visit_time)) })
        } else { "<span>پیگیری بعدی: ثبت نشده</span>".to_string() };
        visit_cards.push_str(&format!(
            "<article class=\"visit-card\"><div class=\"visit-head\"><div><span class=\"eyebrow\">جلسه {}</span><h3>{}</h3><p><time data-date=\"{}\">{}</time>{}</p></div><span class=\"status\">{}</span></div><div class=\"meta-row\"><span>{}</span>{}</div><div class=\"visit-grid\"><section><h4>اندازه‌گیری‌ها</h4>{}</section><section><h4>خدمات</h4>{}</section></div><section class=\"notes\"><h4>یادداشت بالینی</h4><p>{}</p></section></article>",
            index + 1,
            escape_html(visit_type_label(&visit.visit_type)),
            escape_html(&visit.visit_date), escape_html(&visit.visit_date),
            if visit.visit_time.is_empty() { String::new() } else { format!(" · {}", escape_html(&visit.visit_time)) },
            escape_html(visit_status_label(&visit.status)),
            if visit.reason.trim().is_empty() { "بدون دلیل مراجعه".to_string() } else { escape_html(&visit.reason) },
            next_visit,
            measurement_html,
            services_html,
            escape_html(non_empty(&visit.clinical_notes, "یادداشتی ثبت نشده است.")),
        ));
    }
    if visit_cards.is_empty() { visit_cards = "<div class=\"empty large\">هنوز ویزیتی برای این مراجع ثبت نشده است.</div>".to_string(); }

    let attachments_html = if attachments.is_empty() {
        "<div class=\"empty\">فایلی به پرونده وصل نشده است.</div>".to_string()
    } else {
        attachments.iter().map(|attachment| format!(
            "<div class=\"file-card\"><div class=\"file-icon\">▣</div><div><strong>{}</strong><span>{} · <time data-date=\"{}\">{}</time></span>{}</div></div>",
            escape_html(non_empty(&attachment.title, non_empty(&attachment.file_name, "فایل پرونده"))),
            escape_html(attachment_category_label(&attachment.category)),
            escape_html(&attachment.attachment_date), escape_html(non_empty(&attachment.attachment_date, "—")),
            if attachment.notes.trim().is_empty() { String::new() } else { format!("<p>{}</p>", escape_html(&attachment.notes)) },
        )).collect::<Vec<_>>().join("")
    };

    let latest_visit_date = visits.last().map(|visit| visit.visit_date.as_str()).unwrap_or("");
    let base_rows = format!(
        "{}{}{}{}{}{}{}{}{}{}",
        report_table_row("نام و نام خانوادگی", escape_html(&client.full_name)),
        report_table_row("جنسیت", gender_label(&client.gender).to_string()),
        report_table_row("سن", format!("{} سال", client.age)),
        report_table_row("قد", format!("{} سانتی‌متر", number(client.height_cm, 1))),
        report_table_row("وزن فعلی", format!("{} کیلوگرم", number(client.weight_kg, 1))),
        report_table_row("هدف", goal_label(&client.goal).to_string()),
        report_table_row("سطح فعالیت", activity_label(&client.activity_level).to_string()),
        report_table_row("شماره تماس", escape_html(non_empty(&client.phone, "—"))),
        report_table_row("ایمیل", escape_html(non_empty(&client.email, "—"))),
        report_table_row("وضعیت پرونده", if client.archived { "بایگانی" } else { "فعال" }.to_string()),
    );
    let macro_rows = format!(
        "{}{}{}{}",
        report_table_row("ضریب فعالیت", number(activity_factor, 2)),
        report_table_row("پروتئین", format!("{}٪ · {} گرم", number(protein_percent, 0), number(protein_grams, 0))),
        report_table_row("کربوهیدرات", format!("{}٪ · {} گرم", number(carb_percent, 0), number(carb_grams, 0))),
        report_table_row("چربی", format!("{}٪ · {} گرم", number(fat_percent, 0), number(fat_grams, 0))),
    );

    let template = r#"<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>پرونده مراجع - {{CLIENT_NAME}}</title>
<style>
@page { size:A4; margin:12mm; }
*{box-sizing:border-box} body{font-family:Vazirmatn,Tahoma,Arial,sans-serif;direction:rtl;color:#1f312b;background:#edf3f1;margin:0;line-height:1.8} button{font:inherit}
.toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 24px;background:#0F5079;color:#fff}.toolbar button{border:0;border-radius:12px;padding:9px 18px;background:#fff;color:#0F5079;font-weight:800;cursor:pointer}.toolbar small{opacity:.8}
.page{max-width:980px;margin:24px auto;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 20px 60px rgba(21,67,55,.14)}
.cover{position:relative;padding:34px;background:linear-gradient(135deg,#0F5079,#16788a);color:#fff;overflow:hidden}.cover:after{content:"";position:absolute;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.07);left:-70px;top:-120px}.report-logo{display:block;width:88px;height:88px;object-fit:contain;border-radius:18px;margin-bottom:12px;box-shadow:0 12px 30px rgba(0,0,0,.18)}.brand{font-size:13px;opacity:.85}.cover h1{font-size:34px;margin:18px 0 4px}.cover p{margin:0;opacity:.9}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:26px;position:relative;z-index:1}.summary div{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:12px}.summary span{display:block;font-size:11px;opacity:.8}.summary strong{font-size:18px}
.content{padding:30px}.section{margin:0 0 30px}.section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.section-title h2{font-size:21px;margin:0;color:#0F5079}.section-title span{font-size:12px;color:#74817c}.tags{display:flex;flex-wrap:wrap;gap:8px}.tag,.status{display:inline-flex;border-radius:999px;background:#e6f2ed;color:#0F5079;padding:5px 12px;font-size:12px;font-weight:800}
.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.table-wrap{border:1px solid #e5ebe8;border-radius:16px;overflow:hidden;background:#fff}table{width:100%;border-collapse:collapse}th,td{padding:10px 12px;border-bottom:1px solid #edf0ee;text-align:right;vertical-align:top}tr:last-child th,tr:last-child td{border-bottom:0}th{width:38%;background:#f7faf8;color:#466158}td small{color:#7a8983}
.metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.metric{border:1px solid #dfe9e4;border-radius:18px;padding:15px;background:linear-gradient(180deg,#fff,#f7faf8)}.metric span{display:block;color:#6d7c76;font-size:12px}.metric b{display:block;margin-top:5px;color:#0F5079;font-size:22px}.macro-table{margin-top:14px}
.visit-card{border:1px solid #dfe8e4;border-radius:20px;padding:18px;margin:14px 0;background:#fff;break-inside:auto}.visit-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.visit-head h3{font-size:19px;margin:2px 0;color:#183d33}.visit-head p{margin:0;color:#77847f;font-size:13px}.eyebrow{font-size:11px;color:#7d8b86}.meta-row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.meta-row span{border-radius:10px;background:#f3f7f5;padding:6px 10px;font-size:12px;color:#52665f}.visit-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.visit-grid h4,.notes h4{margin:0 0 8px;color:#31564b;font-size:14px}.service-line{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #edf1ef;padding:9px 0}.service-line:last-child{border-bottom:0}.service-line small{display:block;color:#78857f}.service-line b{white-space:nowrap;color:#0F5079}.notes{margin-top:14px;border:1px dashed #d9e3de;border-radius:14px;padding:12px;background:#fbfcfb}.notes p{margin:0;white-space:pre-wrap}.empty{border:1px dashed #d9e3de;border-radius:14px;padding:16px;text-align:center;color:#7a8782;background:#fafcfb}.empty.large{padding:30px}
.files{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.file-card{display:flex;gap:12px;border:1px solid #e1e9e5;border-radius:16px;padding:12px;background:#fff}.file-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:#e7f2ed;color:#0F5079}.file-card strong{display:block}.file-card span{display:block;color:#77847f;font-size:12px}.file-card p{margin:4px 0 0;font-size:12px}.client-note{white-space:pre-wrap;border-radius:16px;padding:16px;background:#f8faf9;border:1px dashed #d8e2dd}
footer{padding:18px 30px;border-top:1px solid #edf0ee;color:#819089;font-size:11px;text-align:center}
h2,h3,h4{break-after:avoid-page}tr,.metric,.file-card,.service-line{break-inside:avoid}.visit-head{break-inside:avoid}
@media(max-width:760px){.summary,.metric-grid{grid-template-columns:repeat(2,1fr)}.profile-grid,.visit-grid,.files{grid-template-columns:1fr}.content{padding:20px}.cover{padding:26px}.cover h1{font-size:27px}}
@media print{body{background:#fff}.toolbar{display:none!important}.page{margin:0;max-width:none;border-radius:0;box-shadow:none}.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}.content{padding:22px}.section{margin-bottom:22px}.visit-card{break-inside:auto}.page-break-before{break-before:page}footer{display:none}}
</style>
</head>
<body>
<div class="toolbar"><div><strong>پیش‌نمایش پرونده</strong><small> برای PDF تمیز، گزینه Headers and footers چاپ را خاموش کنید.</small></div><button onclick="window.print()">چاپ / ذخیره PDF</button></div>
<main class="page">
<header class="cover"><img class="report-logo" src="{{LOGO_SRC}}" alt="Dietory"><div class="brand">{{CLINIC}} {{DIETITIAN}}</div><h1>{{CLIENT_NAME}}</h1><p>پرونده یکپارچه تغذیه، اندازه‌گیری و خدمات</p><div class="summary"><div><span>هدف</span><strong>{{GOAL}}</strong></div><div><span>وزن فعلی</span><strong>{{WEIGHT}} kg</strong></div><div><span>تعداد ویزیت</span><strong>{{VISIT_COUNT}}</strong></div><div><span>آخرین ویزیت</span><strong><time data-date="{{LAST_VISIT}}">{{LAST_VISIT_FALLBACK}}</time></strong></div></div></header>
<div class="content">
<section class="section"><div class="section-title"><h2>مسیرهای مراقبت</h2><span>نمای کلی پرونده</span></div><div class="tags">{{TRACKS}}</div></section>
<section class="section"><div class="section-title"><h2>اطلاعات پایه</h2><span>آخرین اطلاعات ثبت‌شده</span></div><div class="table-wrap"><table><tbody>{{BASE_ROWS}}</tbody></table></div></section>
<section class="section"><div class="section-title"><h2>محاسبات تغذیه</h2><span>بر اساس تنظیمات فعلی کلینیک</span></div><div class="metric-grid"><div class="metric"><span>BMI</span><b>{{BMI}}</b></div><div class="metric"><span>IBW</span><b>{{IBW}} kg</b></div><div class="metric"><span>ABW</span><b>{{ABW}} kg</b></div><div class="metric"><span>BMR</span><b>{{BMR}} kcal</b></div><div class="metric"><span>TEE</span><b>{{TEE}} kcal</b></div><div class="metric"><span>کالری هدف</span><b>{{TARGET}} kcal</b></div></div><div class="table-wrap macro-table"><table><tbody>{{MACRO_ROWS}}</tbody></table></div></section>
<section class="section"><div class="section-title"><h2>ویزیت‌ها، اندازه‌گیری‌ها و خدمات</h2><span>تاریخچه کامل پرونده</span></div>{{VISIT_CARDS}}</section>
<section class="section"><div class="section-title"><h2>فایل‌های پرونده</h2><span>بدون نمایش مسیر داخلی سیستم</span></div><div class="files">{{ATTACHMENTS}}</div></section>
<section class="section"><div class="section-title"><h2>یادداشت پرونده</h2><span>یادداشت عمومی</span></div><div class="client-note">{{CLIENT_NOTES}}</div></section>
</div><footer>ساخته‌شده توسط Dietory · <time data-date="{{GENERATED_AT}}">{{GENERATED_AT}}</time></footer>
</main>
<script>document.querySelectorAll('time[data-date]').forEach(function(el){var raw=el.getAttribute('data-date');if(!raw)return;var d=new Date(raw+'T00:00:00');if(isNaN(d.getTime()))return;el.textContent=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'long',day:'numeric'}).format(d);});</script>
</body></html>"#;

    Ok(template
        .replace("{{LOGO_SRC}}", &report_logo_src)
        .replace("{{CLIENT_NAME}}", &escape_html(&client.full_name))
        .replace("{{CLINIC}}", &escape_html(non_empty(&clinic_name, "Dietory")))
        .replace("{{DIETITIAN}}", &escape_html(&dietitian_name))
        .replace("{{GOAL}}", goal_label(&client.goal))
        .replace("{{WEIGHT}}", &number(client.weight_kg, 1))
        .replace("{{VISIT_COUNT}}", &visits.len().to_string())
        .replace("{{LAST_VISIT}}", latest_visit_date)
        .replace("{{LAST_VISIT_FALLBACK}}", if latest_visit_date.is_empty() { "ثبت نشده" } else { latest_visit_date })
        .replace("{{TRACKS}}", &tracks_html)
        .replace("{{BASE_ROWS}}", &base_rows)
        .replace("{{BMI}}", &number(bmi, 1))
        .replace("{{IBW}}", &number(ibw, 1))
        .replace("{{ABW}}", &number(abw, 1))
        .replace("{{BMR}}", &number(bmr, 0))
        .replace("{{TEE}}", &number(tee, 0))
        .replace("{{TARGET}}", &number(target, 0))
        .replace("{{MACRO_ROWS}}", &macro_rows)
        .replace("{{VISIT_CARDS}}", &visit_cards)
        .replace("{{ATTACHMENTS}}", &attachments_html)
        .replace("{{CLIENT_NOTES}}", &escape_html(non_empty(&client.notes, "یادداشتی ثبت نشده است.")))
        .replace("{{GENERATED_AT}}", &local_today()))
}

fn export_client_report_inner(state: &AppState, client_id: i64) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let client = get_client(&conn, client_id)?;
    let html = build_client_report_html(&conn, &client)?;
    let report_dir = client_folder(state, client_id)?.join("reports");
    fs::create_dir_all(&report_dir).map_err(|err| format!("ساخت پوشه گزارش انجام نشد: {err}"))?;
    let safe_date = Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let path = report_dir.join(format!("dietory-client-{client_id:06}-{safe_date}.html"));
    fs::write(&path, html).map_err(|err| format!("ذخیره پرونده چاپی انجام نشد: {err}"))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn export_client_report(state: tauri::State<'_, AppState>, client_id: i64) -> Result<String, String> {
    let path = export_client_report_inner(state.inner(), client_id)?;
    open_path_with_system(PathBuf::from(&path))?;
    Ok(path)
}

#[tauri::command]
fn export_client_backup(state: tauri::State<'_, AppState>, client_id: i64) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let client = get_client(&conn, client_id)?;
    let mut stmt = conn
        .prepare("SELECT id FROM visits WHERE client_id=?1 ORDER BY visit_date ASC, visit_time ASC, id ASC")
        .map_err(|err| err.to_string())?;
    let visit_ids = stmt
        .query_map(params![client_id], |row| row.get::<_, i64>(0))
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    let visits = visit_ids
        .into_iter()
        .map(|id| get_visit_detail_inner(&conn, id))
        .collect::<Result<Vec<_>, _>>()?;
    let payload = serde_json::json!({
        "client": client,
        "visits": visits,
        "exported_at": now(),
    });
    let file_name = format!("dietory-client-{client_id}-{}.json", Utc::now().format("%Y%m%d-%H%M%S"));
    let target = dirs_next::document_dir()
        .or_else(dirs_next::desktop_dir)
        .ok_or_else(|| "مسیر مناسب برای خروجی پیدا نشد.".to_string())?
        .join(file_name);
    fs::write(&target, serde_json::to_string_pretty(&payload).map_err(|err| err.to_string())?)
        .map_err(|err| err.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn archive_client(state: tauri::State<'_, AppState>, id: i64, archived: bool) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    conn.execute(
        "UPDATE clients SET archived = ?1, updated_at = ?2 WHERE id = ?3",
        params![if archived { 1 } else { 0 }, now(), id],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_client_permanently(state: tauri::State<'_, AppState>, id: i64) -> Result<String, String> {
    let client = {
        let conn = state.conn.lock().map_err(|err| err.to_string())?;
        get_client(&conn, id)?
    };

    let original_folder = client_folder_path(&state, id)?;
    let staged_folder = original_folder.with_file_name(format!(".deleting-client-{id}-{}", Utc::now().timestamp_millis()));
    let assets_dir = state.db_path.parent().ok_or_else(|| "مسیر داده‌های برنامه پیدا نشد.".to_string())?.join("assets");
    let profile_path = PathBuf::from(client.profile_image_path.trim());
    let profile_owned_by_app = profile_path.is_file()
        && profile_path.parent() == Some(assets_dir.as_path())
        && profile_path.file_name().and_then(|value| value.to_str()).map(|name| name.starts_with("client-profile-")).unwrap_or(false);
    let staged_profile = if profile_owned_by_app {
        Some(profile_path.with_file_name(format!(".deleting-client-profile-{id}-{}", Utc::now().timestamp_millis())))
    } else {
        None
    };

    if original_folder.exists() {
        fs::rename(&original_folder, &staged_folder)
            .map_err(|err| format!("آماده‌سازی فایل‌های پرونده برای حذف انجام نشد: {err}"))?;
    }
    if let Some(staged) = staged_profile.as_ref() {
        if let Err(error) = fs::rename(&profile_path, staged) {
            if staged_folder.exists() { let _ = fs::rename(&staged_folder, &original_folder); }
            return Err(format!("آماده‌سازی عکس پروفایل برای حذف انجام نشد: {error}"));
        }
    }

    let delete_result = (|| -> Result<(), String> {
        let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
        let tx = conn.transaction().map_err(|err| err.to_string())?;
        let affected = tx.execute("DELETE FROM clients WHERE id=?1", params![id]).map_err(|err| err.to_string())?;
        if affected == 0 { return Err("پرونده پیدا نشد.".to_string()); }
        tx.commit().map_err(|err| err.to_string())?;
        Ok(())
    })();

    if let Err(error) = delete_result {
        if staged_folder.exists() { let _ = fs::rename(&staged_folder, &original_folder); }
        if let Some(staged) = staged_profile.as_ref() {
            if staged.exists() { let _ = fs::rename(staged, &profile_path); }
        }
        return Err(error);
    }

    let mut warnings = Vec::new();
    if staged_folder.exists() {
        if let Err(error) = fs::remove_dir_all(&staged_folder) {
            warnings.push(format!("پوشه مخفی باقی ماند: {error}"));
        }
    }
    if let Some(staged) = staged_profile.as_ref() {
        if staged.exists() {
            if let Err(error) = fs::remove_file(staged) {
                warnings.push(format!("فایل عکس مخفی باقی ماند: {error}"));
            }
        }
    }

    if warnings.is_empty() {
        Ok("پرونده و تمام داده‌ها و فایل‌های وابسته حذف شدند.".to_string())
    } else {
        Ok(format!("پرونده و داده‌های آن حذف شدند؛ پاک‌سازی فیزیکی کامل نبود: {}", warnings.join("؛ ")))
    }
}

fn row_to_dashboard_visit(row: &rusqlite::Row<'_>) -> rusqlite::Result<DashboardVisitSummary> {
    Ok(DashboardVisitSummary {
        id: row.get(0)?,
        client_id: row.get(1)?,
        client_name: row.get(2)?,
        visit_date: row.get(3)?,
        visit_time: row.get(4)?,
        status: row.get(5)?,
        total_fee: row.get(6)?,
        visit_type: row.get(7)?,
    })
}

#[tauri::command]
fn dashboard_stats(state: tauri::State<'_, AppState>) -> Result<DashboardStats, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let today = Local::now().date_naive();
    let today_iso = today.format("%Y-%m-%d").to_string();
    let next_week_iso = (today + Duration::days(7)).format("%Y-%m-%d").to_string();
    let month_prefix = today.format("%Y-%m").to_string();
    let month_like = format!("{}%", month_prefix);
    let completed_only = read_setting_or(&conn, "reports_completed_only", "1")? != "0";
    let service_revenue = read_setting_or(&conn, "reports_use_service_revenue", "1")? != "0";

    let total_clients: i64 = conn
        .query_row("SELECT COUNT(*) FROM clients", [], |row| row.get(0))
        .map_err(|err| err.to_string())?;
    let active_clients: i64 = conn
        .query_row("SELECT COUNT(*) FROM clients WHERE archived = 0", [], |row| row.get(0))
        .map_err(|err| err.to_string())?;
    let archived_clients: i64 = conn
        .query_row("SELECT COUNT(*) FROM clients WHERE archived = 1", [], |row| row.get(0))
        .map_err(|err| err.to_string())?;

    let goal_count = |goal: &str| -> Result<i64, String> {
        conn.query_row(
            "SELECT COUNT(*) FROM clients WHERE archived = 0 AND goal = ?1",
            params![goal],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())
    };

    let visits_today: i64 = conn
        .query_row("SELECT COUNT(*) FROM visits WHERE visit_date = ?1 AND status NOT IN ('canceled','cancelled')", params![today_iso], |row| row.get(0))
        .map_err(|err| err.to_string())?;
    let visits_next_7_days: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM visits WHERE visit_date >= ?1 AND visit_date <= ?2 AND status NOT IN ('canceled','cancelled')",
            params![today_iso, next_week_iso],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    let visits_this_month_sql = if completed_only {
        "SELECT COUNT(*) FROM visits WHERE visit_date LIKE ?1 AND status IN ('completed','done')"
    } else {
        "SELECT COUNT(*) FROM visits WHERE visit_date LIKE ?1 AND status NOT IN ('canceled','cancelled')"
    };
    let visits_this_month: i64 = conn
        .query_row(visits_this_month_sql, params![month_like], |row| row.get(0))
        .map_err(|err| err.to_string())?;
    let status_clause = if completed_only { "v.status IN ('completed','done')" } else { "v.status NOT IN ('canceled','cancelled')" };
    let revenue_sql = if service_revenue {
        format!("SELECT COALESCE(SUM(s.total),0) FROM visit_services s JOIN visits v ON v.id=s.visit_id WHERE v.visit_date LIKE ?1 AND {status_clause}")
    } else {
        format!("SELECT COALESCE(SUM(v.total_fee),0) FROM visits v WHERE v.visit_date LIKE ?1 AND {status_clause}")
    };
    let revenue_this_month: f64 = conn.query_row(&revenue_sql, params![month_like], |row| row.get(0)).map_err(|err| err.to_string())?;
    let upcoming_followups: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM visits WHERE next_visit_enabled = 1 AND next_visit_date >= ?1 AND status NOT IN ('canceled','cancelled')",
            params![today_iso],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;

    let recent_clients = {
        let mut stmt = conn
            .prepare("SELECT id, full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at, phone, email, profile_image_path FROM clients WHERE archived = 0 ORDER BY updated_at DESC LIMIT 5")
            .map_err(|err| err.to_string())?;
        let items = stmt
            .query_map([], row_to_client)
            .map_err(|err| err.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|err| err.to_string())?;
        items
    };

    let upcoming_visits = {
        let mut stmt = conn
            .prepare("SELECT visits.id, visits.client_id, clients.full_name, visits.visit_date, visits.visit_time, visits.status, visits.total_fee, visits.visit_type FROM visits JOIN clients ON clients.id = visits.client_id WHERE visits.visit_date >= ?1 AND visits.status NOT IN ('canceled','cancelled') ORDER BY visits.visit_date ASC, visits.visit_time ASC LIMIT 8")
            .map_err(|err| err.to_string())?;
        let items = stmt
            .query_map(params![today_iso], row_to_dashboard_visit)
            .map_err(|err| err.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|err| err.to_string())?;
        items
    };

    let recent_visits = {
        let recent_sql = if completed_only {
            "SELECT visits.id, visits.client_id, clients.full_name, visits.visit_date, visits.visit_time, visits.status, visits.total_fee, visits.visit_type FROM visits JOIN clients ON clients.id = visits.client_id WHERE visits.status IN ('completed','done') ORDER BY visits.visit_date DESC, visits.visit_time DESC, visits.id DESC LIMIT 8"
        } else {
            "SELECT visits.id, visits.client_id, clients.full_name, visits.visit_date, visits.visit_time, visits.status, visits.total_fee, visits.visit_type FROM visits JOIN clients ON clients.id = visits.client_id WHERE visits.status NOT IN ('canceled','cancelled') ORDER BY visits.visit_date DESC, visits.visit_time DESC, visits.id DESC LIMIT 8"
        };
        let mut stmt = conn
            .prepare(recent_sql)
            .map_err(|err| err.to_string())?;
        let items = stmt
            .query_map([], row_to_dashboard_visit)
            .map_err(|err| err.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|err| err.to_string())?;
        items
    };

    Ok(DashboardStats {
        total_clients,
        active_clients,
        archived_clients,
        goal_counts: DashboardGoalCounts {
            lose: goal_count("lose")?,
            maintain: goal_count("maintain")?,
            gain: goal_count("gain")?,
        },
        visits_today,
        visits_next_7_days,
        visits_this_month,
        revenue_this_month,
        upcoming_followups,
        recent_clients,
        upcoming_visits,
        recent_visits,
    })
}

#[tauri::command]
fn monthly_report(state: tauri::State<'_, AppState>, start_date: String, end_date: String) -> Result<MonthlyReport, String> {
    if !is_valid_iso_date(&start_date) || !is_valid_iso_date(&end_date) || start_date > end_date {
        return Err("بازه تاریخ گزارش معتبر نیست.".to_string());
    }
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let completed_only = read_setting_or(&conn, "reports_completed_only", "1")? != "0";
    let revenue_from_services = read_setting_or(&conn, "reports_use_service_revenue", "1")? != "0";
    let actual_condition = if completed_only {
        "v.status IN ('completed','done')"
    } else {
        "v.status NOT IN ('canceled','cancelled')"
    };

    let scalar_i64 = |sql: &str| -> Result<i64, String> {
        conn.query_row(sql, params![&start_date, &end_date], |row| row.get(0)).map_err(|err| err.to_string())
    };
    let scalar_f64 = |sql: &str| -> Result<f64, String> {
        conn.query_row(sql, params![&start_date, &end_date], |row| row.get(0)).map_err(|err| err.to_string())
    };

    let unique_clients = scalar_i64(&format!("SELECT COUNT(DISTINCT v.client_id) FROM visits v WHERE v.visit_date BETWEEN ?1 AND ?2 AND {actual_condition}"))?;
    let completed_visits = scalar_i64("SELECT COUNT(*) FROM visits v WHERE v.visit_date BETWEEN ?1 AND ?2 AND v.status IN ('completed','done')")?;
    let scheduled_visits = scalar_i64("SELECT COUNT(*) FROM visits v WHERE v.visit_date BETWEEN ?1 AND ?2 AND v.status IN ('scheduled','confirmed','tentative','pending')")?;
    let canceled_visits = scalar_i64("SELECT COUNT(*) FROM visits v WHERE v.visit_date BETWEEN ?1 AND ?2 AND v.status IN ('canceled','cancelled')")?;
    let diet_plans = scalar_i64("SELECT COUNT(*) FROM diet_plans WHERE plan_date BETWEEN ?1 AND ?2 AND status <> 'archived'")?;
    let body_analysis_cases = scalar_i64(&format!(
        "SELECT COUNT(*) FROM (            SELECT 'v:' || v.id AS case_key FROM visits v LEFT JOIN visit_services s ON s.visit_id=v.id             WHERE v.visit_date BETWEEN ?1 AND ?2 AND {actual_condition} AND (v.visit_type='body_analysis' OR s.service_group_snapshot='body_analysis')             UNION             SELECT CASE WHEN a.visit_id IS NULL THEN 'a:' || a.id ELSE 'v:' || a.visit_id END AS case_key             FROM attachments a LEFT JOIN visits v ON v.id=a.visit_id             WHERE a.attachment_date BETWEEN ?1 AND ?2 AND a.category='body_analysis' AND (a.visit_id IS NULL OR {actual_condition})        )"
    ))?;
    let device_cases = scalar_i64(&format!(
        "SELECT COUNT(DISTINCT v.id) FROM visits v JOIN visit_services s ON s.visit_id=v.id WHERE v.visit_date BETWEEN ?1 AND ?2 AND {actual_condition} AND s.service_group_snapshot='device'"
    ))?;
    let device_units = scalar_f64(&format!(
        "SELECT COALESCE(SUM(s.quantity),0) FROM visits v JOIN visit_services s ON s.visit_id=v.id WHERE v.visit_date BETWEEN ?1 AND ?2 AND {actual_condition} AND s.service_group_snapshot='device'"
    ))?;
    let consultations = scalar_i64(&format!(
        "SELECT COUNT(DISTINCT v.id) FROM visits v LEFT JOIN visit_services s ON s.visit_id=v.id WHERE v.visit_date BETWEEN ?1 AND ?2 AND {actual_condition} AND (v.visit_type='consultation' OR s.service_group_snapshot='consultation')"
    ))?;
    let services_count = scalar_i64(&format!(
        "SELECT COUNT(*) FROM visits v JOIN visit_services s ON s.visit_id=v.id WHERE v.visit_date BETWEEN ?1 AND ?2 AND {actual_condition}"
    ))?;
    let total_revenue = if revenue_from_services {
        scalar_f64(&format!("SELECT COALESCE(SUM(s.total),0) FROM visits v JOIN visit_services s ON s.visit_id=v.id WHERE v.visit_date BETWEEN ?1 AND ?2 AND {actual_condition}"))?
    } else {
        scalar_f64(&format!("SELECT COALESCE(SUM(v.total_fee),0) FROM visits v WHERE v.visit_date BETWEEN ?1 AND ?2 AND {actual_condition}"))?
    };
    let device_rental_due = scalar_f64(&format!(
        "SELECT COALESCE(SUM(s.total * COALESCE(s.device_rental_percent_snapshot,0) / 100.0),0) FROM visits v JOIN visit_services s ON s.visit_id=v.id WHERE v.visit_date BETWEEN ?1 AND ?2 AND {actual_condition} AND s.service_group_snapshot='device'"
    ))?;

    let service_groups = {
        let sql = format!(
            "SELECT s.service_group_snapshot, COUNT(*), COALESCE(SUM(s.quantity),0), COALESCE(SUM(s.total),0) FROM visits v JOIN visit_services s ON s.visit_id=v.id WHERE v.visit_date BETWEEN ?1 AND ?2 AND {actual_condition} GROUP BY s.service_group_snapshot ORDER BY SUM(s.total) DESC, s.service_group_snapshot ASC"
        );
        let mut stmt = conn.prepare(&sql).map_err(|err| err.to_string())?;
        stmt.query_map(params![&start_date, &end_date], |row| Ok(MonthlyServiceGroupRow {
            group_key: row.get(0)?, cases: row.get(1)?, quantity: row.get(2)?, revenue: row.get(3)?,
        })).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?
    };

    let devices = {
        let sql = format!(
            "SELECT s.device_id, CASE WHEN TRIM(s.device_name)='' THEN 'بدون نام دستگاه' ELSE s.device_name END, s.service_name_snapshot, CASE WHEN TRIM(s.body_area)='' THEN 'ناحیه ثبت نشده' ELSE s.body_area END, COUNT(DISTINCT v.id), COALESCE(SUM(s.quantity),0), COALESCE(SUM(COALESCE(s.duration_minutes,0) * s.quantity),0), COALESCE(SUM(s.total),0), COALESCE(s.device_rental_percent_snapshot,0), COALESCE(SUM(s.total * COALESCE(s.device_rental_percent_snapshot,0) / 100.0),0) FROM visits v JOIN visit_services s ON s.visit_id=v.id WHERE v.visit_date BETWEEN ?1 AND ?2 AND {actual_condition} AND s.service_group_snapshot='device' GROUP BY s.device_id, s.device_name, s.service_name_snapshot, s.body_area, COALESCE(s.device_rental_percent_snapshot,0) ORDER BY s.device_name ASC, SUM(s.total) DESC"
        );
        let mut stmt = conn.prepare(&sql).map_err(|err| err.to_string())?;
        stmt.query_map(params![&start_date, &end_date], |row| Ok(MonthlyDeviceUsageRow {
            device_id: row.get(0)?, device_name: row.get(1)?, service_name: row.get(2)?, body_area: row.get(3)?, cases: row.get(4)?, quantity: row.get(5)?, total_minutes: row.get(6)?, revenue: row.get(7)?, rental_percent: row.get(8)?, rental_due: row.get(9)?,
        })).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?
    };

    let device_cases_detail = {
        let sql = format!(
            "SELECT v.id, v.visit_date, c.id, c.full_name, CASE WHEN TRIM(s.device_name)='' THEN 'بدون نام دستگاه' ELSE s.device_name END, s.service_name_snapshot, CASE WHEN TRIM(s.body_area)='' THEN 'ناحیه ثبت نشده' ELSE s.body_area END, s.quantity, s.total, COALESCE(s.device_rental_percent_snapshot,0), s.total * COALESCE(s.device_rental_percent_snapshot,0) / 100.0 FROM visits v JOIN clients c ON c.id=v.client_id JOIN visit_services s ON s.visit_id=v.id WHERE v.visit_date BETWEEN ?1 AND ?2 AND {actual_condition} AND s.service_group_snapshot='device' ORDER BY v.visit_date ASC, v.id ASC, s.id ASC"
        );
        let mut stmt = conn.prepare(&sql).map_err(|err| err.to_string())?;
        stmt.query_map(params![&start_date, &end_date], |row| Ok(MonthlyDeviceCaseRow {
            visit_id: row.get(0)?, visit_date: row.get(1)?, client_id: row.get(2)?, client_name: row.get(3)?, device_name: row.get(4)?, service_name: row.get(5)?, body_area: row.get(6)?, quantity: row.get(7)?, revenue: row.get(8)?, rental_percent: row.get(9)?, rental_due: row.get(10)?,
        })).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?
    };

    Ok(MonthlyReport {
        start_date: start_date.clone(),
        end_date: end_date.clone(),
        completed_only,
        revenue_from_services,
        summary: MonthlyReportSummary {
            unique_clients,
            completed_visits,
            scheduled_visits,
            canceled_visits,
            diet_plans,
            body_analysis_cases,
            device_cases,
            device_units,
            consultations,
            services_count,
            total_revenue,
            device_rental_due,
        },
        service_groups,
        devices,
        device_cases_detail,
    })
}

#[tauri::command]
fn get_settings(state: tauri::State<'_, AppState>) -> Result<Settings, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;

    Ok(Settings {
        dietitian_name: read_setting(&conn, "dietitian_name")?,
        clinic_name: read_setting(&conn, "clinic_name")?,
        primary_color: read_setting(&conn, "primary_color")?,
        background_color: read_setting(&conn, "background_color")?,
        text_color: read_setting(&conn, "text_color")?,
        logo_path: read_setting(&conn, "logo_path")?,
        background_image_path: read_setting(&conn, "background_image_path")?,
        username: read_setting(&conn, "username")?,
        calc_ibw_bmi_factor: read_number_setting(&conn, "calc_ibw_bmi_factor", 22.0)?,
        calc_abw_divisor: read_number_setting(&conn, "calc_abw_divisor", 4.0)?,
        calc_bmr_base: read_number_setting(&conn, "calc_bmr_base", 24.0)?,
        calc_male_factor: read_number_setting(&conn, "calc_male_factor", 1.0)?,
        calc_female_factor: read_number_setting(&conn, "calc_female_factor", 0.95)?,
        calc_bmr_adjustment: read_number_setting(&conn, "calc_bmr_adjustment", 1.1)?,
        calc_activity_sedentary: read_number_setting(&conn, "calc_activity_sedentary", 1.3)?,
        calc_activity_light: read_number_setting(&conn, "calc_activity_light", 1.3)?,
        calc_activity_moderate: read_number_setting(&conn, "calc_activity_moderate", 1.3)?,
        calc_activity_active: read_number_setting(&conn, "calc_activity_active", 1.3)?,
        calc_activity_very_active: read_number_setting(&conn, "calc_activity_very_active", 1.3)?,
        calc_goal_loss: read_number_setting(&conn, "calc_goal_loss", -500.0)?,
        calc_goal_maintain: read_number_setting(&conn, "calc_goal_maintain", 0.0)?,
        calc_goal_gain: read_number_setting(&conn, "calc_goal_gain", 300.0)?,
        macro_protein_percent: read_number_setting(&conn, "macro_protein_percent", 20.0)?,
        macro_carb_percent: read_number_setting(&conn, "macro_carb_percent", 50.0)?,
        macro_fat_percent: read_number_setting(&conn, "macro_fat_percent", 30.0)?,
        diet_plan_header_title: read_setting_or(&conn, "diet_plan_header_title", "برنامه غذایی اختصاصی")?,
        diet_plan_footer_text: read_setting_or(&conn, "diet_plan_footer_text", "این برنامه بر اساس شرایط فردی مراجع تنظیم شده است.")?,
        diet_plan_margin_mm: read_number_setting(&conn, "diet_plan_margin_mm", 14.0)?,
        diet_plan_show_logo: read_setting_or(&conn, "diet_plan_show_logo", "1")? != "0",
        diet_plan_show_macros: read_setting_or(&conn, "diet_plan_show_macros", "1")? != "0",
        diet_plan_show_calories: read_setting_or(&conn, "diet_plan_show_calories", "1")? != "0",
        report_show_contact: read_setting_or(&conn, "report_show_contact", "1")? != "0",
        reports_completed_only: read_setting_or(&conn, "reports_completed_only", "1")? != "0",
        reports_use_service_revenue: read_setting_or(&conn, "reports_use_service_revenue", "1")? != "0",
    })
}

#[tauri::command]
fn save_settings(state: tauri::State<'_, AppState>, settings: Settings) -> Result<Settings, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let values = [
        ("dietitian_name", settings.dietitian_name.as_str()),
        ("clinic_name", settings.clinic_name.as_str()),
        ("primary_color", settings.primary_color.as_str()),
        ("background_color", settings.background_color.as_str()),
        ("text_color", settings.text_color.as_str()),
        ("logo_path", settings.logo_path.as_str()),
        ("background_image_path", settings.background_image_path.as_str()),
        ("username", settings.username.as_str()),
    ];

    for (key, value) in values {
        write_setting(&conn, key, value)?;
    }
    let calc_values = [
        ("calc_ibw_bmi_factor", settings.calc_ibw_bmi_factor),
        ("calc_abw_divisor", settings.calc_abw_divisor),
        ("calc_bmr_base", settings.calc_bmr_base),
        ("calc_male_factor", settings.calc_male_factor),
        ("calc_female_factor", settings.calc_female_factor),
        ("calc_bmr_adjustment", settings.calc_bmr_adjustment),
        ("calc_activity_sedentary", settings.calc_activity_sedentary),
        ("calc_activity_light", settings.calc_activity_light),
        ("calc_activity_moderate", settings.calc_activity_moderate),
        ("calc_activity_active", settings.calc_activity_active),
        ("calc_activity_very_active", settings.calc_activity_very_active),
        ("calc_goal_loss", settings.calc_goal_loss),
        ("calc_goal_maintain", settings.calc_goal_maintain),
        ("calc_goal_gain", settings.calc_goal_gain),
        ("macro_protein_percent", settings.macro_protein_percent),
        ("macro_carb_percent", settings.macro_carb_percent),
        ("macro_fat_percent", settings.macro_fat_percent),
    ];
    for (key, value) in calc_values {
        write_setting(&conn, key, &value.to_string())?;
    }
    write_setting(&conn, "diet_plan_header_title", &settings.diet_plan_header_title)?;
    write_setting(&conn, "diet_plan_footer_text", &settings.diet_plan_footer_text)?;
    write_setting(&conn, "diet_plan_margin_mm", &settings.diet_plan_margin_mm.to_string())?;
    write_setting(&conn, "diet_plan_show_logo", if settings.diet_plan_show_logo { "1" } else { "0" })?;
    write_setting(&conn, "diet_plan_show_macros", if settings.diet_plan_show_macros { "1" } else { "0" })?;
    write_setting(&conn, "diet_plan_show_calories", if settings.diet_plan_show_calories { "1" } else { "0" })?;
    write_setting(&conn, "report_show_contact", if settings.report_show_contact { "1" } else { "0" })?;
    write_setting(&conn, "reports_completed_only", if settings.reports_completed_only { "1" } else { "0" })?;
    write_setting(&conn, "reports_use_service_revenue", if settings.reports_use_service_revenue { "1" } else { "0" })?;

    Ok(settings)
}

#[tauri::command]
fn import_brand_asset(state: tauri::State<'_, AppState>, path: String, kind: String) -> Result<String, String> {
    let source = PathBuf::from(path);
    if !source.exists() {
        return Err("فایل تصویر پیدا نشد.".to_string());
    }

    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let allowed = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "svg"];
    if !allowed.contains(&extension.as_str()) {
        return Err("فرمت تصویر پشتیبانی نمی‌شود.".to_string());
    }

    let file_stem = match kind.as_str() {
        "logo" => "dietoy-logo".to_string(),
        "background" => "dietoy-background".to_string(),
        "client-profile" => format!("client-profile-{}", Utc::now().timestamp_millis()),
        _ => return Err("نوع تصویر نامعتبر است.".to_string()),
    };
    let app_dir = state
        .db_path
        .parent()
        .ok_or_else(|| "مسیر ذخیره‌سازی برنامه پیدا نشد.".to_string())?
        .join("assets");
    fs::create_dir_all(&app_dir).map_err(|err| err.to_string())?;
    let target = app_dir.join(format!("{}.{}", file_stem, extension));
    fs::copy(&source, &target).map_err(|err| err.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn login(state: tauri::State<'_, AppState>, input: LoginInput) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let username = read_setting(&conn, "username")?;
    let password_hash = read_setting(&conn, "password_hash")?;
    let algorithm = read_setting_or(&conn, "password_algorithm", "sha256")?;
    let valid = input.username.trim() == username && verify_password(&input.password, &password_hash, &algorithm);
    if valid && algorithm != "argon2" {
        write_setting(&conn, "password_hash", &hash_password(&input.password)?)?;
        write_setting(&conn, "password_algorithm", "argon2")?;
    }
    Ok(valid)
}

#[tauri::command]
fn get_security_status(state: tauri::State<'_, AppState>) -> Result<SecurityStatus, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    Ok(SecurityStatus {
        username: read_setting_or(&conn, "username", "admin")?,
        must_change_credentials: read_setting_or(&conn, "must_change_credentials", "0")? != "0",
    })
}

#[tauri::command]
fn change_credentials(state: tauri::State<'_, AppState>, input: CredentialsInput) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let password_hash = read_setting(&conn, "password_hash")?;
    let algorithm = read_setting_or(&conn, "password_algorithm", "sha256")?;
    if !verify_password(&input.current_password, &password_hash, &algorithm) {
        return Err("رمز فعلی درست نیست.".to_string());
    }
    let username = input.username.trim();
    if username.len() < 3 || input.password.chars().count() < 8 {
        return Err("نام کاربری باید حداقل ۳ نویسه و رمز جدید حداقل ۸ نویسه باشد.".to_string());
    }
    write_setting(&conn, "username", username)?;
    write_setting(&conn, "password_hash", &hash_password(&input.password)?)?;
    write_setting(&conn, "password_algorithm", "argon2")?;
    write_setting(&conn, "must_change_credentials", "0")?;
    Ok(())
}

fn copy_directory_recursive(source: &Path, target: &Path) -> Result<(), String> {
    if !source.exists() { return Ok(()); }
    fs::create_dir_all(target).map_err(|err| format!("ساخت پوشه پشتیبان انجام نشد: {err}"))?;
    for entry in fs::read_dir(source).map_err(|err| format!("خواندن پوشه انجام نشد: {err}"))? {
        let entry = entry.map_err(|err| err.to_string())?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            copy_directory_recursive(&source_path, &target_path)?;
        } else {
            fs::copy(&source_path, &target_path).map_err(|err| format!("کپی فایل پشتیبان انجام نشد: {err}"))?;
        }
    }
    Ok(())
}

fn export_complete_backup_inner(state: &AppState) -> Result<String, String> {
    let base_dir = dirs_next::document_dir()
        .or_else(dirs_next::desktop_dir)
        .ok_or_else(|| "مسیر مناسب برای ذخیره پشتیبان پیدا نشد.".to_string())?
        .join("Dietory Backups");
    fs::create_dir_all(&base_dir).map_err(|err| err.to_string())?;
    let backup_dir = base_dir.join(format!("Dietory-Backup-{}", Utc::now().format("%Y%m%d-%H%M%S")));
    fs::create_dir_all(&backup_dir).map_err(|err| err.to_string())?;

    let db_target = backup_dir.join("nutritionist.sqlite");
    {
        let conn = state.conn.lock().map_err(|err| err.to_string())?;
        let mut destination = Connection::open(&db_target).map_err(|err| err.to_string())?;
        let backup = rusqlite::backup::Backup::new(&conn, &mut destination).map_err(|err| err.to_string())?;
        backup.run_to_completion(5, StdDuration::from_millis(100), None).map_err(|err| err.to_string())?;
    }

    let app_dir = state.db_path.parent().ok_or_else(|| "پوشه داده‌های برنامه پیدا نشد.".to_string())?;
    for folder in ["DietoyData", "assets"] {
        let source = app_dir.join(folder);
        if source.exists() { copy_directory_recursive(&source, &backup_dir.join(folder))?; }
    }

    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let client_count: i64 = conn.query_row("SELECT COUNT(*) FROM clients", [], |row| row.get(0)).unwrap_or(0);
    let visit_count: i64 = conn.query_row("SELECT COUNT(*) FROM visits", [], |row| row.get(0)).unwrap_or(0);
    let attachment_count: i64 = conn.query_row("SELECT COUNT(*) FROM attachments", [], |row| row.get(0)).unwrap_or(0);
    drop(conn);
    let manifest = serde_json::json!({
        "app": "Dietory",
        "version": env!("CARGO_PKG_VERSION"),
        "created_at": now(),
        "database": "nutritionist.sqlite",
        "clients": client_count,
        "visits": visit_count,
        "attachments": attachment_count,
        "restore_hint": "این پوشه را در بخش بازیابی کامل Dietory انتخاب کنید."
    });
    fs::write(backup_dir.join("manifest.json"), serde_json::to_string_pretty(&manifest).map_err(|err| err.to_string())?)
        .map_err(|err| err.to_string())?;
    Ok(backup_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn export_complete_backup(state: tauri::State<'_, AppState>) -> Result<String, String> {
    export_complete_backup_inner(state.inner())
}

#[tauri::command]
fn restore_complete_backup(state: tauri::State<'_, AppState>, path: String) -> Result<String, String> {
    let selected = PathBuf::from(path);
    let backup_dir = if selected.is_dir() { selected } else { selected.parent().map(Path::to_path_buf).ok_or_else(|| "پوشه پشتیبان معتبر نیست.".to_string())? };
    let source_db = backup_dir.join("nutritionist.sqlite");
    let manifest = backup_dir.join("manifest.json");
    if !source_db.exists() || !manifest.exists() { return Err("این پوشه یک پشتیبان کامل معتبر Dietory نیست.".to_string()); }

    let safety_path = export_complete_backup_inner(state.inner())?;
    {
        let source = Connection::open(&source_db).map_err(|err| format!("بازکردن دیتابیس پشتیبان انجام نشد: {err}"))?;
        let mut destination = state.conn.lock().map_err(|err| err.to_string())?;
        let backup = rusqlite::backup::Backup::new(&source, &mut destination).map_err(|err| err.to_string())?;
        backup.run_to_completion(5, StdDuration::from_millis(100), None).map_err(|err| err.to_string())?;
        drop(backup);
        init_db(&destination)?;
    }

    let app_dir = state.db_path.parent().ok_or_else(|| "پوشه داده‌های برنامه پیدا نشد.".to_string())?;
    for folder in ["DietoyData", "assets"] {
        let source = backup_dir.join(folder);
        if source.exists() {
            let target = app_dir.join(folder);
            if target.exists() { fs::remove_dir_all(&target).map_err(|err| format!("پاک‌سازی فایل‌های قبلی انجام نشد: {err}"))?; }
            copy_directory_recursive(&source, &target)?;
        }
    }
    Ok(safety_path)
}

#[tauri::command]
fn export_database(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let file_name = format!("nutritionist-backup-{}.sqlite", Utc::now().format("%Y%m%d-%H%M%S"));
    let base_dir = dirs_next::document_dir()
        .or_else(dirs_next::desktop_dir)
        .ok_or_else(|| "مسیر مناسب برای ذخیره پشتیبان پیدا نشد.".to_string())?;
    let target = base_dir.join(file_name);
    fs::copy(&state.db_path, &target).map_err(|err| err.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn export_data_backup(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut clients_stmt = conn
        .prepare("SELECT id, full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at, phone, email, profile_image_path FROM clients ORDER BY id ASC")
        .map_err(|err| err.to_string())?;
    let clients = clients_stmt
        .query_map([], row_to_client)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    let mut settings_stmt = conn
        .prepare("SELECT key, value FROM settings ORDER BY key ASC")
        .map_err(|err| err.to_string())?;
    let settings = settings_stmt
        .query_map([], |row| {
            Ok(SettingEntry {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        })
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    let mut records_stmt = conn
        .prepare("SELECT id, client_id, record_date, weight_kg, height_cm, notes, created_at, updated_at FROM client_records ORDER BY client_id ASC, record_date ASC, id ASC")
        .map_err(|err| err.to_string())?;
    let records = records_stmt
        .query_map([], row_to_record)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    let backup = DataBackup {
        app: "dietory".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: now(),
        clients,
        records,
        settings,
    };
    let file_name = format!("dietory-data-{}.json", Utc::now().format("%Y%m%d-%H%M%S"));
    let base_dir = dirs_next::document_dir()
        .or_else(dirs_next::desktop_dir)
        .ok_or_else(|| "مسیر مناسب برای ذخیره پشتیبان پیدا نشد.".to_string())?;
    let target = base_dir.join(file_name);
    let json = serde_json::to_string_pretty(&backup).map_err(|err| err.to_string())?;
    fs::write(&target, json).map_err(|err| err.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn restore_data_backup(state: tauri::State<'_, AppState>, path: String) -> Result<(), String> {
    let content = fs::read_to_string(path).map_err(|err| err.to_string())?;
    let backup: DataBackup = serde_json::from_str(&content).map_err(|err| err.to_string())?;
    if backup.app != "dietory" && backup.app != "dietoy" && backup.app != "matab-taghzieh" {
        return Err("فایل پشتیبان مربوط به این برنامه نیست.".to_string());
    }

    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM client_records", [])
        .map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM clients", [])
        .map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM settings", [])
        .map_err(|err| err.to_string())?;

    for setting in backup.settings {
        tx.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            params![setting.key, setting.value],
        )
        .map_err(|err| err.to_string())?;
    }

    for client in backup.clients {
        tx.execute(
            "INSERT INTO clients (id, full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at, phone, email, profile_image_path) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                client.id,
                client.full_name,
                client.gender,
                client.age,
                client.height_cm,
                client.weight_kg,
                client.activity_level,
                client.goal,
                client.notes,
                if client.archived { 1 } else { 0 },
                client.created_at.unwrap_or_else(now),
                client.updated_at.unwrap_or_else(now),
                client.phone,
                client.email,
                client.profile_image_path,
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    for record in backup.records {
        tx.execute(
            "INSERT INTO client_records (id, client_id, record_date, weight_kg, height_cm, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                record.id,
                record.client_id,
                record.record_date,
                record.weight_kg,
                record.height_cm,
                record.notes,
                record.created_at.unwrap_or_else(now),
                record.updated_at.unwrap_or_else(now),
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    tx.commit().map_err(|err| err.to_string())?;
    init_db(&conn)?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            fs::create_dir_all(&dir)?;
            let path = dir.join("nutritionist.sqlite");
            let conn = Connection::open(&path)?;
            init_db(&conn).map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))?;
            app.manage(AppState {
                conn: Mutex::new(conn),
                db_path: path,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            archive_client,
            change_credentials,
            cleanup_auto_created_visits,
            delete_attachment,
            delete_client_permanently,
            delete_visit,
            delete_visit_service,
            dashboard_stats,
            export_client_backup,
            export_client_report,
            export_diet_plan,
            export_complete_backup,
            export_data_backup,
            export_database,
            get_client_profile_bundle,
            get_client_by_id,
            get_security_status,
            get_settings,
            get_visit_detail,
            import_brand_asset,
            import_attachment,
            import_visit_attachment,
            list_client_records,
            list_client_attachments,
            list_client_care_tracks,
            list_client_diet_plans,
            list_client_nutrition_calculations,
            list_clients,
            list_client_visits,
            list_device_catalog,
            list_service_catalog,
            list_visit_modes,
            list_visit_services,
            login,
            monthly_report,
            open_attachment,
            open_client_folder,
            read_attachment_preview,
            restore_complete_backup,
            restore_data_backup,
            save_client,
            save_client_record,
            save_care_track,
            save_device_catalog_item,
            save_diet_plan,
            save_nutrition_calculation,
            save_service_catalog_item,
            save_visit_mode,
            save_visit_measurements,
            save_visit_service,
            save_visit_with_measurements,
            save_settings,
            search_clients
        ])
        .run(tauri::generate_context!())
        .expect("failed to run app");
}
