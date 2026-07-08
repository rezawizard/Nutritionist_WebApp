use chrono::{NaiveDate, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
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
    service_name_snapshot: String,
    #[serde(default)]
    body_area: String,
    #[serde(default)]
    device_name: String,
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
struct Attachment {
    id: Option<i64>,
    client_id: i64,
    #[serde(default)]
    visit_id: Option<i64>,
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

#[derive(Debug, Serialize)]
struct DashboardStats {
    total_clients: i64,
    active_clients: i64,
    recent_clients: Vec<Client>,
}

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
    #[serde(default)]
    visits: Vec<Visit>,
    #[serde(default)]
    measurements: Vec<VisitMeasurements>,
    #[serde(default)]
    attachments: Vec<Attachment>,
    #[serde(default)]
    visit_services: Vec<VisitService>,
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

fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn read_setting(conn: &Connection, key: &str) -> Result<String, String> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |row| row.get(0))
        .map_err(|err| err.to_string())
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
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            gender TEXT NOT NULL,
            age INTEGER NOT NULL,
            height_cm REAL NOT NULL,
            weight_kg REAL NOT NULL,
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
            record_date TEXT NOT NULL,
            weight_kg REAL NOT NULL,
            height_cm REAL NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
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
            legacy_record_id INTEGER UNIQUE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
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

        CREATE TABLE IF NOT EXISTS visit_services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visit_id INTEGER NOT NULL,
            service_id INTEGER,
            service_name_snapshot TEXT NOT NULL,
            body_area TEXT NOT NULL DEFAULT '',
            device_name TEXT NOT NULL DEFAULT '',
            duration_minutes INTEGER,
            price REAL NOT NULL DEFAULT 0,
            quantity REAL NOT NULL DEFAULT 1,
            total REAL NOT NULL DEFAULT 0,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT '',
            FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            visit_id INTEGER,
            category TEXT NOT NULL DEFAULT 'other',
            title TEXT NOT NULL DEFAULT '',
            file_name TEXT NOT NULL DEFAULT '',
            local_path TEXT NOT NULL DEFAULT '',
            attachment_date TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT '',
            sync_id TEXT NOT NULL DEFAULT '',
            sync_status TEXT NOT NULL DEFAULT 'local',
            FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS service_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            default_price REAL NOT NULL DEFAULT 0,
            default_duration_minutes INTEGER,
            body_area_required INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT ''
        );
        ",
    )
    .map_err(|err| err.to_string())?;

    ensure_column(conn, "clients", "phone", "phone TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "clients", "email", "email TEXT NOT NULL DEFAULT ''")?;
    ensure_column(
        conn,
        "clients",
        "profile_image_path",
        "profile_image_path TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(conn, "clients", "code", "code TEXT NOT NULL DEFAULT ''")?;

    ensure_column(conn, "visits", "visit_time", "visit_time TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "visits", "reason", "reason TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "visits", "clinical_notes", "clinical_notes TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "visits", "private_notes", "private_notes TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "visits", "next_visit_enabled", "next_visit_enabled INTEGER NOT NULL DEFAULT 0")?;
    ensure_column(conn, "visits", "next_visit_date", "next_visit_date TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "visits", "next_visit_time", "next_visit_time TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "visits", "next_visit_status", "next_visit_status TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "visits", "legacy_record_id", "legacy_record_id INTEGER")?;

    ensure_column(conn, "visit_services", "body_area", "body_area TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "visit_services", "device_name", "device_name TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "visit_services", "duration_minutes", "duration_minutes INTEGER")?;
    ensure_column(conn, "visit_services", "created_at", "created_at TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "visit_services", "updated_at", "updated_at TEXT NOT NULL DEFAULT ''")?;

    ensure_column(conn, "attachments", "updated_at", "updated_at TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "attachments", "sync_id", "sync_id TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "attachments", "sync_status", "sync_status TEXT NOT NULL DEFAULT 'local'")?;

    ensure_column(conn, "service_catalog", "default_duration_minutes", "default_duration_minutes INTEGER")?;
    ensure_column(conn, "service_catalog", "body_area_required", "body_area_required INTEGER NOT NULL DEFAULT 0")?;
    ensure_column(conn, "service_catalog", "created_at", "created_at TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "service_catalog", "updated_at", "updated_at TEXT NOT NULL DEFAULT ''")?;

    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_legacy_record_id ON visits(legacy_record_id) WHERE legacy_record_id IS NOT NULL",
        [],
    )
    .map_err(|err| err.to_string())?;

    migrate_legacy_records(conn)?;

    write_default_setting(conn, "dietitian_name", "")?;
    write_default_setting(conn, "clinic_name", "")?;
    write_default_setting(conn, "primary_color", "#0f5b46")?;
    write_default_setting(conn, "background_color", "#10517A")?;
    write_default_setting(conn, "text_color", "#f7f3ea")?;
    write_default_setting(conn, "logo_path", "")?;
    write_default_setting(conn, "background_image_path", "")?;
    write_default_setting(conn, "username", "admin")?;
    write_default_setting(conn, "password_hash", &hash_password("admin"))?;
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
        WHERE NOT EXISTS (
            SELECT 1 FROM visits
            WHERE visits.legacy_record_id = client_records.id
               OR (visits.client_id = client_records.client_id AND visits.visit_date = client_records.record_date)
        )
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
            "UPDATE clients SET full_name=?1, gender=?2, age=?3, height_cm=?4, weight_kg=?5, activity_level=?6, goal=?7, notes=?8, archived=?9, updated_at=?10, phone=?11, email=?12, profile_image_path=?13 WHERE id=?14",
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
            "INSERT INTO clients (full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at, phone, email, profile_image_path) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?9, ?10, ?11, ?12)",
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
fn list_client_records(state: tauri::State<'_, AppState>, client_id: i64) -> Result<Vec<ClientRecord>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM client_records WHERE client_id = ?1 ORDER BY record_date ASC, id ASC")
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
        conn.query_row("SELECT * FROM client_records WHERE id = ?1", params![id], row_to_record)
            .map_err(|err| err.to_string())
    } else {
        conn.execute(
            "INSERT INTO client_records (client_id, record_date, weight_kg, height_cm, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![record.client_id, record.record_date, record.weight_kg, record.height_cm, record.notes, timestamp],
        )
        .map_err(|err| err.to_string())?;
        let id = conn.last_insert_rowid();
        conn.query_row("SELECT * FROM client_records WHERE id = ?1", params![id], row_to_record)
            .map_err(|err| err.to_string())
    }
}

fn row_to_visit(row: &rusqlite::Row<'_>) -> rusqlite::Result<Visit> {
    Ok(Visit {
        id: row.get(0)?,
        client_id: row.get(1)?,
        visit_date: row.get(2)?,
        visit_time: row.get(3)?,
        status: row.get(4)?,
        reason: row.get(5)?,
        clinical_notes: row.get(6)?,
        private_notes: row.get(7)?,
        next_visit_enabled: row.get::<_, i64>(8)? == 1,
        next_visit_date: row.get(9)?,
        next_visit_time: row.get(10)?,
        next_visit_status: row.get(11)?,
        total_fee: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
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
        "SELECT id, client_id, visit_date, visit_time, status, reason, clinical_notes, private_notes, next_visit_enabled, next_visit_date, next_visit_time, next_visit_status, total_fee, created_at, updated_at FROM visits WHERE id = ?1",
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
        .prepare("SELECT id, client_id, visit_date, visit_time, status, reason, clinical_notes, private_notes, next_visit_enabled, next_visit_date, next_visit_time, next_visit_status, total_fee, created_at, updated_at FROM visits WHERE client_id = ?1 ORDER BY visit_date ASC, visit_time ASC, id ASC")
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
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_client(&conn, visit.client_id)?;
    let timestamp = now();

    let visit_id = if let Some(id) = visit.id {
        conn.execute(
            "UPDATE visits SET visit_date=?1, visit_time=?2, status=?3, reason=?4, clinical_notes=?5, private_notes=?6, next_visit_enabled=?7, next_visit_date=?8, next_visit_time=?9, next_visit_status=?10, total_fee=?11, updated_at=?12 WHERE id=?13",
            params![
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
                timestamp,
                id
            ],
        )
        .map_err(|err| err.to_string())?;
        id
    } else {
        conn.execute(
            "INSERT INTO visits (client_id, visit_date, visit_time, status, reason, clinical_notes, private_notes, next_visit_enabled, next_visit_date, next_visit_time, next_visit_status, total_fee, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)",
            params![
                visit.client_id,
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
                timestamp
            ],
        )
        .map_err(|err| err.to_string())?;
        conn.last_insert_rowid()
    };

    if let Some(mut measurements) = measurements {
        measurements.visit_id = Some(visit_id);
        save_visit_measurements_inner(&conn, measurements)?;
    }

    get_visit_detail_inner(&conn, visit_id)
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

    conn.execute(
        "INSERT INTO client_records (client_id, record_date, weight_kg, height_cm, notes, created_at, updated_at)
         SELECT ?1, ?2, ?3, COALESCE(?4, 0), ?5, ?6, ?6
         WHERE NOT EXISTS (SELECT 1 FROM visits WHERE visits.legacy_record_id IS NOT NULL AND visits.id = ?7)",
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
    save_visit_measurements_inner(&conn, measurements)
}

fn row_to_visit_service(row: &rusqlite::Row<'_>) -> rusqlite::Result<VisitService> {
    Ok(VisitService {
        id: row.get(0)?,
        visit_id: row.get(1)?,
        service_id: row.get(2)?,
        service_name_snapshot: row.get(3)?,
        body_area: row.get(4)?,
        device_name: row.get(5)?,
        duration_minutes: row.get(6)?,
        price: row.get(7)?,
        quantity: row.get(8)?,
        total: row.get(9)?,
        notes: row.get(10)?,
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
            "UPDATE visit_services SET service_id=?1, service_name_snapshot=?2, body_area=?3, device_name=?4, duration_minutes=?5, price=?6, quantity=?7, total=?8, notes=?9, updated_at=?10 WHERE id=?11",
            params![service.service_id, service.service_name_snapshot, service.body_area, service.device_name, service.duration_minutes, service.price, service.quantity, total, service.notes, now(), id],
        )
        .map_err(|err| err.to_string())?;
        id
    } else {
        conn.execute(
            "INSERT INTO visit_services (visit_id, service_id, service_name_snapshot, body_area, device_name, duration_minutes, price, quantity, total, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)",
            params![service.visit_id, service.service_id, service.service_name_snapshot, service.body_area, service.device_name, service.duration_minutes, service.price, service.quantity.max(1.0), total, service.notes, now()],
        )
        .map_err(|err| err.to_string())?;
        conn.last_insert_rowid()
    };
    conn.query_row("SELECT id, visit_id, service_id, service_name_snapshot, body_area, device_name, duration_minutes, price, quantity, total, notes FROM visit_services WHERE id=?1", params![id], row_to_visit_service)
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn list_visit_services(state: tauri::State<'_, AppState>, visit_id: i64) -> Result<Vec<VisitService>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, visit_id, service_id, service_name_snapshot, body_area, device_name, duration_minutes, price, quantity, total, notes FROM visit_services WHERE visit_id=?1 ORDER BY id ASC")
        .map_err(|err| err.to_string())?;
    stmt.query_map(params![visit_id], row_to_visit_service)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())
}

fn row_to_attachment(row: &rusqlite::Row<'_>) -> rusqlite::Result<Attachment> {
    Ok(Attachment {
        id: row.get(0)?,
        client_id: row.get(1)?,
        visit_id: row.get(2)?,
        category: row.get(3)?,
        title: row.get(4)?,
        file_name: row.get(5)?,
        local_path: row.get(6)?,
        attachment_date: row.get(7)?,
        notes: row.get(8)?,
        created_at: row.get(9)?,
    })
}

fn client_folder(state: &AppState, client_id: i64) -> Result<PathBuf, String> {
    let base = state
        .db_path
        .parent()
        .ok_or_else(|| "مسیر داده‌های برنامه پیدا نشد.".to_string())?
        .join("DietoyData")
        .join("clients")
        .join(format!("client-{client_id:06}"));
    fs::create_dir_all(&base).map_err(|err| format!("ساخت پوشه مراجعه‌کننده انجام نشد: {err}"))?;
    Ok(base)
}

#[tauri::command]
fn import_visit_attachment(
    state: tauri::State<'_, AppState>,
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
        get_visit(&conn, visit_id)?;
    }
    let file_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "نام فایل معتبر نیست.".to_string())?
        .to_string();
    let target_dir = client_folder(&state, attachment.client_id)?.join("attachments");
    fs::create_dir_all(&target_dir).map_err(|err| err.to_string())?;
    let target = target_dir.join(&file_name);
    fs::copy(&source, &target).map_err(|err| format!("کپی فایل انجام نشد: {err}"))?;
    let timestamp = now();
    attachment.file_name = file_name;
    attachment.local_path = target.to_string_lossy().to_string();
    if attachment.attachment_date.is_empty() {
        attachment.attachment_date = Utc::now().date_naive().to_string();
    }
    conn.execute(
        "INSERT INTO attachments (client_id, visit_id, category, title, file_name, local_path, attachment_date, notes, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, 'local')",
        params![attachment.client_id, attachment.visit_id, attachment.category, attachment.title, attachment.file_name, attachment.local_path, attachment.attachment_date, attachment.notes, timestamp],
    )
    .map_err(|err| err.to_string())?;
    let id = conn.last_insert_rowid();
    conn.query_row("SELECT id, client_id, visit_id, category, title, file_name, local_path, attachment_date, notes, created_at FROM attachments WHERE id=?1", params![id], row_to_attachment)
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn list_client_attachments(state: tauri::State<'_, AppState>, client_id: i64) -> Result<Vec<Attachment>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, client_id, visit_id, category, title, file_name, local_path, attachment_date, notes, created_at FROM attachments WHERE client_id=?1 ORDER BY attachment_date DESC, id DESC")
        .map_err(|err| err.to_string())?;
    stmt.query_map(params![client_id], row_to_attachment)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())
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
    let file_name = format!("dietoy-client-{client_id}-{}.json", Utc::now().format("%Y%m%d-%H%M%S"));
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
fn dashboard_stats(state: tauri::State<'_, AppState>) -> Result<DashboardStats, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let total_clients: i64 = conn
        .query_row("SELECT COUNT(*) FROM clients", [], |row| row.get(0))
        .map_err(|err| err.to_string())?;
    let active_clients: i64 = conn
        .query_row("SELECT COUNT(*) FROM clients WHERE archived = 0", [], |row| row.get(0))
        .map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at, phone, email, profile_image_path FROM clients WHERE archived = 0 ORDER BY updated_at DESC LIMIT 5")
        .map_err(|err| err.to_string())?;
    let recent_clients = stmt
        .query_map([], row_to_client)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    Ok(DashboardStats {
        total_clients,
        active_clients,
        recent_clients,
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
    Ok(input.username.trim() == username && hash_password(&input.password) == password_hash)
}

#[tauri::command]
fn change_credentials(state: tauri::State<'_, AppState>, input: CredentialsInput) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let password_hash = read_setting(&conn, "password_hash")?;
    if hash_password(&input.current_password) != password_hash {
        return Err("رمز فعلی درست نیست.".to_string());
    }
    let username = input.username.trim();
    if username.is_empty() || input.password.len() < 4 {
        return Err("نام کاربری و رمز جدید را کامل وارد کنید.".to_string());
    }
    write_setting(&conn, "username", username)?;
    write_setting(&conn, "password_hash", &hash_password(&input.password))?;
    Ok(())
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
        .prepare("SELECT * FROM client_records ORDER BY client_id ASC, record_date ASC, id ASC")
        .map_err(|err| err.to_string())?;
    let records = records_stmt
        .query_map([], row_to_record)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    let mut visits_stmt = conn
        .prepare("SELECT id, client_id, visit_date, visit_time, status, reason, clinical_notes, private_notes, next_visit_enabled, next_visit_date, next_visit_time, next_visit_status, total_fee, created_at, updated_at FROM visits ORDER BY client_id ASC, visit_date ASC, visit_time ASC, id ASC")
        .map_err(|err| err.to_string())?;
    let visits = visits_stmt
        .query_map([], row_to_visit)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    let mut measurements_stmt = conn
        .prepare("SELECT id, visit_id, weight_kg, height_cm, bmi_snapshot, body_fat_percent, muscle_mass, visceral_fat, waist_cm, abdomen_cm, hip_cm, chest_cm, arm_cm, thigh_cm, calf_cm, neck_cm, custom_measurements_json, notes, created_at, updated_at FROM visit_measurements ORDER BY visit_id ASC, id ASC")
        .map_err(|err| err.to_string())?;
    let measurements = measurements_stmt
        .query_map([], row_to_measurements)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    let mut attachments_stmt = conn
        .prepare("SELECT id, client_id, visit_id, category, title, file_name, local_path, attachment_date, notes, created_at FROM attachments ORDER BY client_id ASC, attachment_date ASC, id ASC")
        .map_err(|err| err.to_string())?;
    let attachments = attachments_stmt
        .query_map([], row_to_attachment)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    let mut visit_services_stmt = conn
        .prepare("SELECT id, visit_id, service_id, service_name_snapshot, body_area, device_name, duration_minutes, price, quantity, total, notes FROM visit_services ORDER BY visit_id ASC, id ASC")
        .map_err(|err| err.to_string())?;
    let visit_services = visit_services_stmt
        .query_map([], row_to_visit_service)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    let backup = DataBackup {
        app: "dietoy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: now(),
        clients,
        records,
        visits,
        measurements,
        attachments,
        visit_services,
        settings,
    };
    let file_name = format!("dietoy-data-{}.json", Utc::now().format("%Y%m%d-%H%M%S"));
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
    if backup.app != "dietoy" && backup.app != "matab-taghzieh" {
        return Err("فایل پشتیبان مربوط به این برنامه نیست.".to_string());
    }

    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM visit_services", [])
        .map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM attachments", [])
        .map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM visit_measurements", [])
        .map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM visits", [])
        .map_err(|err| err.to_string())?;
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

    for visit in backup.visits {
        tx.execute(
            "INSERT INTO visits (id, client_id, visit_date, visit_time, status, reason, clinical_notes, private_notes, next_visit_enabled, next_visit_date, next_visit_time, next_visit_status, total_fee, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, COALESCE(?14, ?15), COALESCE(?16, ?15))",
            params![
                visit.id,
                visit.client_id,
                visit.visit_date,
                visit.visit_time,
                visit.status,
                visit.reason,
                visit.clinical_notes,
                visit.private_notes,
                if visit.next_visit_enabled { 1 } else { 0 },
                visit.next_visit_date,
                visit.next_visit_time,
                visit.next_visit_status,
                visit.total_fee,
                visit.created_at,
                now(),
                visit.updated_at,
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    for measurements in backup.measurements {
        tx.execute(
            "INSERT INTO visit_measurements (id, visit_id, weight_kg, height_cm, bmi_snapshot, body_fat_percent, muscle_mass, visceral_fat, waist_cm, abdomen_cm, hip_cm, chest_cm, arm_cm, thigh_cm, calf_cm, neck_cm, custom_measurements_json, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, COALESCE(?19, ?20), COALESCE(?21, ?20))",
            params![
                measurements.id,
                measurements.visit_id,
                measurements.weight_kg,
                measurements.height_cm,
                measurements.bmi_snapshot,
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
                measurements.custom_measurements_json,
                measurements.notes,
                measurements.created_at,
                now(),
                measurements.updated_at,
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    for attachment in backup.attachments {
        tx.execute(
            "INSERT INTO attachments (id, client_id, visit_id, category, title, file_name, local_path, attachment_date, notes, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, COALESCE(?10, ?11), COALESCE(?12, ?11), 'local')",
            params![
                attachment.id,
                attachment.client_id,
                attachment.visit_id,
                attachment.category,
                attachment.title,
                attachment.file_name,
                attachment.local_path,
                attachment.attachment_date,
                attachment.notes,
                attachment.created_at.clone(),
                now(),
                attachment.created_at,
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    for service in backup.visit_services {
        tx.execute(
            "INSERT INTO visit_services (id, visit_id, service_id, service_name_snapshot, body_area, device_name, duration_minutes, price, quantity, total, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)",
            params![
                service.id,
                service.visit_id,
                service.service_id,
                service.service_name_snapshot,
                service.body_area,
                service.device_name,
                service.duration_minutes,
                service.price,
                service.quantity,
                service.total,
                service.notes,
                now(),
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
            dashboard_stats,
            export_client_backup,
            export_data_backup,
            export_database,
            get_settings,
            get_visit_detail,
            import_brand_asset,
            import_visit_attachment,
            list_client_records,
            list_client_attachments,
            list_clients,
            list_client_visits,
            list_visit_services,
            login,
            open_attachment,
            open_client_folder,
            restore_data_backup,
            save_client,
            save_client_record,
            save_visit_measurements,
            save_visit_service,
            save_visit_with_measurements,
            save_settings,
            search_clients
        ])
        .run(tauri::generate_context!())
        .expect("failed to run app");
}
