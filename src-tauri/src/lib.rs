use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
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
    #[serde(default)] phone: String,
    #[serde(default)] email: String,
    #[serde(default)] profile_image_path: String,
    #[serde(default)] next_visit_date: String,
    #[serde(default = "default_visit_status")] next_visit_status: String,
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

#[derive(Debug, Serialize, Deserialize)]
struct Attachment {
    id: Option<i64>,
    client_id: i64,
    #[serde(default)] visit_id: Option<i64>,
    category: String,
    title: String,
    file_name: String,
    local_path: String,
    attachment_date: String,
    notes: String,
    created_at: Option<String>,
    updated_at: Option<String>,
    #[serde(default)] sync_id: String,
    #[serde(default = "default_local_sync_status")] sync_status: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Visit {
    id: Option<i64>,
    client_id: i64,
    visit_date: String,
    status: String,
    notes: String,
    total_fee: f64,
    created_at: Option<String>,
    updated_at: Option<String>,
    #[serde(default)] sync_id: String,
    #[serde(default = "default_local_sync_status")] sync_status: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ServiceCatalogItem {
    id: Option<i64>,
    name: String,
    default_price: f64,
    active: bool,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct VisitService {
    id: Option<i64>,
    visit_id: i64,
    #[serde(default)] service_id: Option<i64>,
    service_name_snapshot: String,
    price: f64,
    quantity: f64,
    total: f64,
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
    #[serde(default = "default_ibw_factor")] calc_ibw_bmi_factor: f64,
    #[serde(default = "default_abw_divisor")] calc_abw_divisor: f64,
    #[serde(default = "default_bmr_base")] calc_bmr_base: f64,
    #[serde(default = "default_male_factor")] calc_male_factor: f64,
    #[serde(default = "default_female_factor")] calc_female_factor: f64,
    #[serde(default = "default_bmr_adjustment")] calc_bmr_adjustment: f64,
    #[serde(default = "default_activity_factor")] calc_activity_sedentary: f64,
    #[serde(default = "default_activity_factor")] calc_activity_light: f64,
    #[serde(default = "default_activity_factor")] calc_activity_moderate: f64,
    #[serde(default = "default_activity_factor")] calc_activity_active: f64,
    #[serde(default = "default_activity_factor")] calc_activity_very_active: f64,
    #[serde(default = "default_goal_loss")] calc_goal_loss: f64,
    #[serde(default = "default_goal_maintain")] calc_goal_maintain: f64,
    #[serde(default = "default_goal_gain")] calc_goal_gain: f64,
    #[serde(default = "default_protein_percent")] macro_protein_percent: f64,
    #[serde(default = "default_carb_percent")] macro_carb_percent: f64,
    #[serde(default = "default_fat_percent")] macro_fat_percent: f64,
}

#[derive(Debug, Serialize, Deserialize)]
struct SettingEntry { key: String, value: String }

#[derive(Debug, Serialize, Deserialize)]
struct DataBackup {
    app: String,
    version: String,
    exported_at: String,
    clients: Vec<Client>,
    #[serde(default)] records: Vec<ClientRecord>,
    #[serde(default)] attachments: Vec<Attachment>,
    #[serde(default)] visits: Vec<Visit>,
    #[serde(default)] service_catalog: Vec<ServiceCatalogItem>,
    #[serde(default)] visit_services: Vec<VisitService>,
    settings: Vec<SettingEntry>,
}

#[derive(Debug, Deserialize)]
struct LoginInput { username: String, password: String }
#[derive(Debug, Deserialize)]
struct CredentialsInput { current_password: String, username: String, password: String }

fn default_visit_status() -> String { "tentative".to_string() }
fn default_local_sync_status() -> String { "local".to_string() }
fn default_ibw_factor() -> f64 { 22.0 }
fn default_abw_divisor() -> f64 { 4.0 }
fn default_bmr_base() -> f64 { 24.0 }
fn default_male_factor() -> f64 { 1.0 }
fn default_female_factor() -> f64 { 0.95 }
fn default_bmr_adjustment() -> f64 { 1.1 }
fn default_activity_factor() -> f64 { 1.3 }
fn default_goal_loss() -> f64 { -500.0 }
fn default_goal_maintain() -> f64 { 0.0 }
fn default_goal_gain() -> f64 { 300.0 }
fn default_protein_percent() -> f64 { 20.0 }
fn default_carb_percent() -> f64 { 50.0 }
fn default_fat_percent() -> f64 { 30.0 }
fn now() -> String { Utc::now().to_rfc3339() }

fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn read_setting(conn: &Connection, key: &str) -> Result<String, String> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |row| row.get(0)).map_err(|err| err.to_string())
}
fn read_number_setting(conn: &Connection, key: &str, fallback: f64) -> Result<f64, String> {
    Ok(read_setting(conn, key).unwrap_or_else(|_| fallback.to_string()).parse::<f64>().unwrap_or(fallback))
}
fn write_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute("INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value", params![key, value]).map_err(|err| err.to_string())?;
    Ok(())
}
fn write_default_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    let exists: Option<String> = conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |row| row.get(0)).optional().map_err(|err| err.to_string())?;
    if exists.is_none() { write_setting(conn, key, value)?; }
    Ok(())
}
fn ensure_column(conn: &Connection, table: &str, column: &str, definition: &str) -> Result<(), String> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table)).map_err(|err| err.to_string())?;
    let columns = stmt.query_map([], |row| row.get::<_, String>(1)).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?;
    if !columns.iter().any(|name| name == column) {
        conn.execute(&format!("ALTER TABLE {} ADD COLUMN {}", table, definition), []).map_err(|err| err.to_string())?;
    }
    Ok(())
}
fn client_columns() -> &'static str {
    "id, full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at, phone, email, profile_image_path, next_visit_date, next_visit_status"
}

fn init_db(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, gender TEXT NOT NULL, age INTEGER NOT NULL, height_cm REAL NOT NULL, weight_kg REAL NOT NULL, activity_level TEXT NOT NULL, goal TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS client_records (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, record_date TEXT NOT NULL, weight_kg REAL NOT NULL, height_cm REAL NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, visit_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'done', notes TEXT NOT NULL DEFAULT '', total_fee REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, sync_id TEXT NOT NULL DEFAULT '', sync_status TEXT NOT NULL DEFAULT 'local', FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, visit_id INTEGER, category TEXT NOT NULL, title TEXT NOT NULL, file_name TEXT NOT NULL, local_path TEXT NOT NULL, attachment_date TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, sync_id TEXT NOT NULL DEFAULT '', sync_status TEXT NOT NULL DEFAULT 'local', FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE, FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE SET NULL);
        CREATE TABLE IF NOT EXISTS service_catalog (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, default_price REAL NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS visit_services (id INTEGER PRIMARY KEY AUTOINCREMENT, visit_id INTEGER NOT NULL, service_id INTEGER, service_name_snapshot TEXT NOT NULL, price REAL NOT NULL DEFAULT 0, quantity REAL NOT NULL DEFAULT 1, total REAL NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE CASCADE, FOREIGN KEY(service_id) REFERENCES service_catalog(id) ON DELETE SET NULL);
    ").map_err(|err| err.to_string())?;

    ensure_column(conn, "clients", "phone", "phone TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "clients", "email", "email TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "clients", "profile_image_path", "profile_image_path TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "clients", "next_visit_date", "next_visit_date TEXT NOT NULL DEFAULT ''")?;
    ensure_column(conn, "clients", "next_visit_status", "next_visit_status TEXT NOT NULL DEFAULT 'tentative'")?;

    for (key, value) in [
        ("dietitian_name", ""), ("clinic_name", ""), ("primary_color", "#0f5b46"), ("background_color", "#10517A"), ("text_color", "#f7f3ea"), ("logo_path", ""), ("background_image_path", ""), ("username", "admin"),
        ("calc_ibw_bmi_factor", "22"), ("calc_abw_divisor", "4"), ("calc_bmr_base", "24"), ("calc_male_factor", "1"), ("calc_female_factor", "0.95"), ("calc_bmr_adjustment", "1.1"),
        ("calc_activity_sedentary", "1.3"), ("calc_activity_light", "1.3"), ("calc_activity_moderate", "1.3"), ("calc_activity_active", "1.3"), ("calc_activity_very_active", "1.3"),
        ("calc_goal_loss", "-500"), ("calc_goal_maintain", "0"), ("calc_goal_gain", "300"), ("macro_protein_percent", "20"), ("macro_carb_percent", "50"), ("macro_fat_percent", "30")
    ] { write_default_setting(conn, key, value)?; }
    write_default_setting(conn, "password_hash", &hash_password("admin"))?;
    Ok(())
}

fn row_to_client(row: &rusqlite::Row<'_>) -> rusqlite::Result<Client> {
    Ok(Client { id: row.get(0)?, full_name: row.get(1)?, gender: row.get(2)?, age: row.get(3)?, height_cm: row.get(4)?, weight_kg: row.get(5)?, activity_level: row.get(6)?, goal: row.get(7)?, notes: row.get(8)?, archived: row.get::<_, i64>(9)? == 1, created_at: row.get(10)?, updated_at: row.get(11)?, phone: row.get(12)?, email: row.get(13)?, profile_image_path: row.get(14)?, next_visit_date: row.get(15)?, next_visit_status: row.get(16)? })
}
fn row_to_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<ClientRecord> { Ok(ClientRecord { id: row.get(0)?, client_id: row.get(1)?, record_date: row.get(2)?, weight_kg: row.get(3)?, height_cm: row.get(4)?, notes: row.get(5)?, created_at: row.get(6)?, updated_at: row.get(7)? }) }
fn row_to_attachment(row: &rusqlite::Row<'_>) -> rusqlite::Result<Attachment> { Ok(Attachment { id: row.get(0)?, client_id: row.get(1)?, visit_id: row.get(2)?, category: row.get(3)?, title: row.get(4)?, file_name: row.get(5)?, local_path: row.get(6)?, attachment_date: row.get(7)?, notes: row.get(8)?, created_at: row.get(9)?, updated_at: row.get(10)?, sync_id: row.get(11)?, sync_status: row.get(12)? }) }
fn row_to_visit(row: &rusqlite::Row<'_>) -> rusqlite::Result<Visit> { Ok(Visit { id: row.get(0)?, client_id: row.get(1)?, visit_date: row.get(2)?, status: row.get(3)?, notes: row.get(4)?, total_fee: row.get(5)?, created_at: row.get(6)?, updated_at: row.get(7)?, sync_id: row.get(8)?, sync_status: row.get(9)? }) }
fn row_to_service(row: &rusqlite::Row<'_>) -> rusqlite::Result<ServiceCatalogItem> { Ok(ServiceCatalogItem { id: row.get(0)?, name: row.get(1)?, default_price: row.get(2)?, active: row.get::<_, i64>(3)? == 1, created_at: row.get(4)?, updated_at: row.get(5)? }) }
fn row_to_visit_service(row: &rusqlite::Row<'_>) -> rusqlite::Result<VisitService> { Ok(VisitService { id: row.get(0)?, visit_id: row.get(1)?, service_id: row.get(2)?, service_name_snapshot: row.get(3)?, price: row.get(4)?, quantity: row.get(5)?, total: row.get(6)?, notes: row.get(7)?, created_at: row.get(8)? }) }

#[tauri::command]
fn list_clients(state: tauri::State<'_, AppState>, include_archived: bool) -> Result<Vec<Client>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let sql = if include_archived { format!("SELECT {} FROM clients ORDER BY archived ASC, updated_at DESC", client_columns()) } else { format!("SELECT {} FROM clients WHERE archived = 0 ORDER BY updated_at DESC", client_columns()) };
    let mut stmt = conn.prepare(&sql).map_err(|err| err.to_string())?;
    stmt.query_map([], row_to_client).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())
}
#[tauri::command]
fn search_clients(state: tauri::State<'_, AppState>, query: String) -> Result<Vec<Client>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let like_query = format!("%{}%", query.trim());
    let sql = format!("SELECT {} FROM clients WHERE archived = 0 AND (full_name LIKE ?1 OR phone LIKE ?1 OR email LIKE ?1) ORDER BY updated_at DESC LIMIT 20", client_columns());
    let mut stmt = conn.prepare(&sql).map_err(|err| err.to_string())?;
    stmt.query_map(params![like_query], row_to_client).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())
}
fn get_client(conn: &Connection, id: i64) -> Result<Client, String> {
    let sql = format!("SELECT {} FROM clients WHERE id = ?1", client_columns());
    conn.query_row(&sql, params![id], row_to_client).optional().map_err(|err| err.to_string())?.ok_or_else(|| "مراجع پیدا نشد.".to_string())
}
#[tauri::command]
fn save_client(state: tauri::State<'_, AppState>, client: Client) -> Result<Client, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let timestamp = now();
    let status = if ["confirmed", "done", "cancelled"].contains(&client.next_visit_status.as_str()) { client.next_visit_status.as_str() } else { "tentative" };
    if let Some(id) = client.id {
        conn.execute("UPDATE clients SET full_name=?1, gender=?2, age=?3, height_cm=?4, weight_kg=?5, activity_level=?6, goal=?7, notes=?8, archived=?9, updated_at=?10, phone=?11, email=?12, profile_image_path=?13, next_visit_date=?14, next_visit_status=?15 WHERE id=?16", params![client.full_name, client.gender, client.age, client.height_cm, client.weight_kg, client.activity_level, client.goal, client.notes, if client.archived { 1 } else { 0 }, timestamp, client.phone, client.email, client.profile_image_path, client.next_visit_date, status, id]).map_err(|err| err.to_string())?;
        get_client(&conn, id)
    } else {
        conn.execute("INSERT INTO clients (full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at, phone, email, profile_image_path, next_visit_date, next_visit_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?9, ?10, ?11, ?12, ?13, ?14)", params![client.full_name, client.gender, client.age, client.height_cm, client.weight_kg, client.activity_level, client.goal, client.notes, timestamp, client.phone, client.email, client.profile_image_path, client.next_visit_date, status]).map_err(|err| err.to_string())?;
        get_client(&conn, conn.last_insert_rowid())
    }
}
#[tauri::command]
fn archive_client(state: tauri::State<'_, AppState>, id: i64, archived: bool) -> Result<(), String> { let conn = state.conn.lock().map_err(|err| err.to_string())?; conn.execute("UPDATE clients SET archived = ?1, updated_at = ?2 WHERE id = ?3", params![if archived { 1 } else { 0 }, now(), id]).map_err(|err| err.to_string())?; Ok(()) }
#[tauri::command]
fn list_client_records(state: tauri::State<'_, AppState>, client_id: i64) -> Result<Vec<ClientRecord>, String> { let conn = state.conn.lock().map_err(|err| err.to_string())?; let mut stmt = conn.prepare("SELECT * FROM client_records WHERE client_id = ?1 ORDER BY record_date ASC, id ASC").map_err(|err| err.to_string())?; stmt.query_map(params![client_id], row_to_record).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string()) }
#[tauri::command]
fn save_client_record(state: tauri::State<'_, AppState>, record: ClientRecord) -> Result<ClientRecord, String> { let conn = state.conn.lock().map_err(|err| err.to_string())?; let timestamp = now(); if let Some(id) = record.id { conn.execute("UPDATE client_records SET record_date=?1, weight_kg=?2, height_cm=?3, notes=?4, updated_at=?5 WHERE id=?6", params![record.record_date, record.weight_kg, record.height_cm, record.notes, timestamp, id]).map_err(|err| err.to_string())?; conn.query_row("SELECT * FROM client_records WHERE id = ?1", params![id], row_to_record).map_err(|err| err.to_string()) } else { conn.execute("INSERT INTO client_records (client_id, record_date, weight_kg, height_cm, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)", params![record.client_id, record.record_date, record.weight_kg, record.height_cm, record.notes, timestamp]).map_err(|err| err.to_string())?; let id = conn.last_insert_rowid(); conn.query_row("SELECT * FROM client_records WHERE id = ?1", params![id], row_to_record).map_err(|err| err.to_string()) } }

#[tauri::command]
fn save_visit(state: tauri::State<'_, AppState>, visit: Visit) -> Result<Visit, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let timestamp = now();
    if let Some(id) = visit.id {
        conn.execute("UPDATE visits SET visit_date=?1, status=?2, notes=?3, total_fee=?4, updated_at=?5, sync_status='dirty' WHERE id=?6", params![visit.visit_date, visit.status, visit.notes, visit.total_fee, timestamp, id]).map_err(|err| err.to_string())?;
        conn.query_row("SELECT * FROM visits WHERE id=?1", params![id], row_to_visit).map_err(|err| err.to_string())
    } else {
        conn.execute("INSERT INTO visits (client_id, visit_date, status, notes, total_fee, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, 'local')", params![visit.client_id, visit.visit_date, visit.status, visit.notes, visit.total_fee, timestamp]).map_err(|err| err.to_string())?;
        let id = conn.last_insert_rowid();
        conn.query_row("SELECT * FROM visits WHERE id=?1", params![id], row_to_visit).map_err(|err| err.to_string())
    }
}
#[tauri::command]
fn list_visits(state: tauri::State<'_, AppState>, client_id: i64) -> Result<Vec<Visit>, String> { let conn = state.conn.lock().map_err(|err| err.to_string())?; let mut stmt = conn.prepare("SELECT * FROM visits WHERE client_id=?1 ORDER BY visit_date DESC, id DESC").map_err(|err| err.to_string())?; stmt.query_map(params![client_id], row_to_visit).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string()) }

#[tauri::command]
fn save_service_catalog_item(state: tauri::State<'_, AppState>, item: ServiceCatalogItem) -> Result<ServiceCatalogItem, String> { let conn = state.conn.lock().map_err(|err| err.to_string())?; let timestamp = now(); if let Some(id) = item.id { conn.execute("UPDATE service_catalog SET name=?1, default_price=?2, active=?3, updated_at=?4 WHERE id=?5", params![item.name, item.default_price, if item.active { 1 } else { 0 }, timestamp, id]).map_err(|err| err.to_string())?; conn.query_row("SELECT * FROM service_catalog WHERE id=?1", params![id], row_to_service).map_err(|err| err.to_string()) } else { conn.execute("INSERT INTO service_catalog (name, default_price, active, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)", params![item.name, item.default_price, if item.active { 1 } else { 0 }, timestamp]).map_err(|err| err.to_string())?; let id = conn.last_insert_rowid(); conn.query_row("SELECT * FROM service_catalog WHERE id=?1", params![id], row_to_service).map_err(|err| err.to_string()) } }
#[tauri::command]
fn list_service_catalog(state: tauri::State<'_, AppState>, active_only: bool) -> Result<Vec<ServiceCatalogItem>, String> { let conn = state.conn.lock().map_err(|err| err.to_string())?; let sql = if active_only { "SELECT * FROM service_catalog WHERE active=1 ORDER BY name ASC" } else { "SELECT * FROM service_catalog ORDER BY active DESC, name ASC" }; let mut stmt = conn.prepare(sql).map_err(|err| err.to_string())?; stmt.query_map([], row_to_service).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string()) }
#[tauri::command]
fn save_visit_service(state: tauri::State<'_, AppState>, item: VisitService) -> Result<VisitService, String> { let conn = state.conn.lock().map_err(|err| err.to_string())?; let total = item.price * item.quantity; let timestamp = now(); conn.execute("INSERT INTO visit_services (visit_id, service_id, service_name_snapshot, price, quantity, total, notes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)", params![item.visit_id, item.service_id, item.service_name_snapshot, item.price, item.quantity, total, item.notes, timestamp]).map_err(|err| err.to_string())?; let id = conn.last_insert_rowid(); conn.execute("UPDATE visits SET total_fee=(SELECT COALESCE(SUM(total),0) FROM visit_services WHERE visit_id=?1), updated_at=?2 WHERE id=?1", params![item.visit_id, timestamp]).map_err(|err| err.to_string())?; conn.query_row("SELECT * FROM visit_services WHERE id=?1", params![id], row_to_visit_service).map_err(|err| err.to_string()) }
#[tauri::command]
fn list_visit_services(state: tauri::State<'_, AppState>, visit_id: i64) -> Result<Vec<VisitService>, String> { let conn = state.conn.lock().map_err(|err| err.to_string())?; let mut stmt = conn.prepare("SELECT * FROM visit_services WHERE visit_id=?1 ORDER BY id ASC").map_err(|err| err.to_string())?; stmt.query_map(params![visit_id], row_to_visit_service).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string()) }

#[tauri::command]
fn import_attachment(state: tauri::State<'_, AppState>, client_id: i64, visit_id: Option<i64>, path: String, category: String, title: String, attachment_date: String, notes: String) -> Result<Attachment, String> {
    let source = PathBuf::from(path);
    if !source.exists() { return Err("فایل پیدا نشد.".to_string()); }
    let file_name = source.file_name().and_then(|v| v.to_str()).unwrap_or("attachment").to_string();
    let extension = source.extension().and_then(|v| v.to_str()).unwrap_or("file").to_lowercase();
    let app_dir = state.db_path.parent().ok_or_else(|| "مسیر ذخیره‌سازی برنامه پیدا نشد.".to_string())?.join("attachments").join(format!("client-{}", client_id));
    fs::create_dir_all(&app_dir).map_err(|err| err.to_string())?;
    let safe_category = if ["body_analysis", "lab", "medical_report", "other"].contains(&category.as_str()) { category } else { "other".to_string() };
    let target = app_dir.join(format!("{}-{}.{}", safe_category, Utc::now().timestamp_millis(), extension));
    fs::copy(&source, &target).map_err(|err| err.to_string())?;
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let timestamp = now();
    let final_title = if title.trim().is_empty() { file_name.clone() } else { title };
    conn.execute("INSERT INTO attachments (client_id, visit_id, category, title, file_name, local_path, attachment_date, notes, created_at, updated_at, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, 'local')", params![client_id, visit_id, safe_category, final_title, file_name, target.to_string_lossy().to_string(), attachment_date, notes, timestamp]).map_err(|err| err.to_string())?;
    let id = conn.last_insert_rowid();
    conn.query_row("SELECT * FROM attachments WHERE id=?1", params![id], row_to_attachment).map_err(|err| err.to_string())
}
#[tauri::command]
fn list_attachments(state: tauri::State<'_, AppState>, client_id: i64, category: Option<String>) -> Result<Vec<Attachment>, String> { let conn = state.conn.lock().map_err(|err| err.to_string())?; if let Some(category) = category { let mut stmt = conn.prepare("SELECT * FROM attachments WHERE client_id=?1 AND category=?2 ORDER BY attachment_date DESC, id DESC").map_err(|err| err.to_string())?; stmt.query_map(params![client_id, category], row_to_attachment).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string()) } else { let mut stmt = conn.prepare("SELECT * FROM attachments WHERE client_id=?1 ORDER BY attachment_date DESC, id DESC").map_err(|err| err.to_string())?; stmt.query_map(params![client_id], row_to_attachment).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string()) } }

#[tauri::command]
fn dashboard_stats(state: tauri::State<'_, AppState>) -> Result<DashboardStats, String> { let conn = state.conn.lock().map_err(|err| err.to_string())?; let total_clients: i64 = conn.query_row("SELECT COUNT(*) FROM clients", [], |row| row.get(0)).map_err(|err| err.to_string())?; let active_clients: i64 = conn.query_row("SELECT COUNT(*) FROM clients WHERE archived = 0", [], |row| row.get(0)).map_err(|err| err.to_string())?; let sql = format!("SELECT {} FROM clients WHERE archived = 0 ORDER BY updated_at DESC LIMIT 5", client_columns()); let mut stmt = conn.prepare(&sql).map_err(|err| err.to_string())?; let recent_clients = stmt.query_map([], row_to_client).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?; Ok(DashboardStats { total_clients, active_clients, recent_clients }) }

#[tauri::command]
fn get_settings(state: tauri::State<'_, AppState>) -> Result<Settings, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    Ok(Settings { dietitian_name: read_setting(&conn, "dietitian_name")?, clinic_name: read_setting(&conn, "clinic_name")?, primary_color: read_setting(&conn, "primary_color")?, background_color: read_setting(&conn, "background_color")?, text_color: read_setting(&conn, "text_color")?, logo_path: read_setting(&conn, "logo_path")?, background_image_path: read_setting(&conn, "background_image_path")?, username: read_setting(&conn, "username")?, calc_ibw_bmi_factor: read_number_setting(&conn, "calc_ibw_bmi_factor", 22.0)?, calc_abw_divisor: read_number_setting(&conn, "calc_abw_divisor", 4.0)?, calc_bmr_base: read_number_setting(&conn, "calc_bmr_base", 24.0)?, calc_male_factor: read_number_setting(&conn, "calc_male_factor", 1.0)?, calc_female_factor: read_number_setting(&conn, "calc_female_factor", 0.95)?, calc_bmr_adjustment: read_number_setting(&conn, "calc_bmr_adjustment", 1.1)?, calc_activity_sedentary: read_number_setting(&conn, "calc_activity_sedentary", 1.3)?, calc_activity_light: read_number_setting(&conn, "calc_activity_light", 1.3)?, calc_activity_moderate: read_number_setting(&conn, "calc_activity_moderate", 1.3)?, calc_activity_active: read_number_setting(&conn, "calc_activity_active", 1.3)?, calc_activity_very_active: read_number_setting(&conn, "calc_activity_very_active", 1.3)?, calc_goal_loss: read_number_setting(&conn, "calc_goal_loss", -500.0)?, calc_goal_maintain: read_number_setting(&conn, "calc_goal_maintain", 0.0)?, calc_goal_gain: read_number_setting(&conn, "calc_goal_gain", 300.0)?, macro_protein_percent: read_number_setting(&conn, "macro_protein_percent", 20.0)?, macro_carb_percent: read_number_setting(&conn, "macro_carb_percent", 50.0)?, macro_fat_percent: read_number_setting(&conn, "macro_fat_percent", 30.0)? })
}
#[tauri::command]
fn save_settings(state: tauri::State<'_, AppState>, settings: Settings) -> Result<Settings, String> { let conn = state.conn.lock().map_err(|err| err.to_string())?; write_setting(&conn, "dietitian_name", &settings.dietitian_name)?; write_setting(&conn, "clinic_name", &settings.clinic_name)?; write_setting(&conn, "primary_color", &settings.primary_color)?; write_setting(&conn, "background_color", &settings.background_color)?; write_setting(&conn, "text_color", &settings.text_color)?; write_setting(&conn, "logo_path", &settings.logo_path)?; write_setting(&conn, "background_image_path", &settings.background_image_path)?; write_setting(&conn, "username", &settings.username)?; for (key, value) in [("calc_ibw_bmi_factor", settings.calc_ibw_bmi_factor), ("calc_abw_divisor", settings.calc_abw_divisor), ("calc_bmr_base", settings.calc_bmr_base), ("calc_male_factor", settings.calc_male_factor), ("calc_female_factor", settings.calc_female_factor), ("calc_bmr_adjustment", settings.calc_bmr_adjustment), ("calc_activity_sedentary", settings.calc_activity_sedentary), ("calc_activity_light", settings.calc_activity_light), ("calc_activity_moderate", settings.calc_activity_moderate), ("calc_activity_active", settings.calc_activity_active), ("calc_activity_very_active", settings.calc_activity_very_active), ("calc_goal_loss", settings.calc_goal_loss), ("calc_goal_maintain", settings.calc_goal_maintain), ("calc_goal_gain", settings.calc_goal_gain), ("macro_protein_percent", settings.macro_protein_percent), ("macro_carb_percent", settings.macro_carb_percent), ("macro_fat_percent", settings.macro_fat_percent)] { write_setting(&conn, key, &value.to_string())?; } Ok(settings) }
#[tauri::command]
fn import_brand_asset(state: tauri::State<'_, AppState>, path: String, kind: String) -> Result<String, String> { let source = PathBuf::from(path); if !source.exists() { return Err("فایل تصویر پیدا نشد.".to_string()); } let extension = source.extension().and_then(|value| value.to_str()).unwrap_or("png").to_lowercase(); let allowed = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "svg"]; if !allowed.contains(&extension.as_str()) { return Err("فرمت تصویر پشتیبانی نمی‌شود.".to_string()); } let file_stem = match kind.as_str() { "logo" => "dietoy-logo".to_string(), "background" => "dietoy-background".to_string(), "client-profile" => format!("client-profile-{}", Utc::now().timestamp_millis()), _ => return Err("نوع تصویر نامعتبر است.".to_string()), }; let app_dir = state.db_path.parent().ok_or_else(|| "مسیر ذخیره‌سازی برنامه پیدا نشد.".to_string())?.join("assets"); fs::create_dir_all(&app_dir).map_err(|err| err.to_string())?; let target = app_dir.join(format!("{}.{}", file_stem, extension)); fs::copy(&source, &target).map_err(|err| err.to_string())?; Ok(target.to_string_lossy().to_string()) }
#[tauri::command]
fn login(state: tauri::State<'_, AppState>, input: LoginInput) -> Result<bool, String> { let conn = state.conn.lock().map_err(|err| err.to_string())?; let username = read_setting(&conn, "username")?; let password_hash = read_setting(&conn, "password_hash")?; Ok(input.username.trim() == username && hash_password(&input.password) == password_hash) }
#[tauri::command]
fn change_credentials(state: tauri::State<'_, AppState>, input: CredentialsInput) -> Result<(), String> { let conn = state.conn.lock().map_err(|err| err.to_string())?; let password_hash = read_setting(&conn, "password_hash")?; if hash_password(&input.current_password) != password_hash { return Err("رمز فعلی درست نیست.".to_string()); } let username = input.username.trim(); if username.is_empty() || input.password.len() < 4 { return Err("نام کاربری و رمز جدید را کامل وارد کنید.".to_string()); } write_setting(&conn, "username", username)?; write_setting(&conn, "password_hash", &hash_password(&input.password))?; Ok(()) }

#[tauri::command]
fn export_database(state: tauri::State<'_, AppState>) -> Result<String, String> { let file_name = format!("dietoy-database-backup-{}.sqlite", Utc::now().format("%Y%m%d-%H%M%S")); let base_dir = dirs_next::document_dir().or_else(dirs_next::desktop_dir).ok_or_else(|| "مسیر مناسب برای ذخیره پشتیبان پیدا نشد.".to_string())?; let target = base_dir.join(file_name); fs::copy(&state.db_path, &target).map_err(|err| err.to_string())?; Ok(target.to_string_lossy().to_string()) }

#[tauri::command]
fn export_data_backup(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut clients_stmt = conn.prepare(&format!("SELECT {} FROM clients ORDER BY id ASC", client_columns())).map_err(|err| err.to_string())?;
    let clients = clients_stmt.query_map([], row_to_client).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?;
    let mut settings_stmt = conn.prepare("SELECT key, value FROM settings ORDER BY key ASC").map_err(|err| err.to_string())?;
    let settings = settings_stmt.query_map([], |row| Ok(SettingEntry { key: row.get(0)?, value: row.get(1)? })).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?;
    let mut records_stmt = conn.prepare("SELECT * FROM client_records ORDER BY client_id ASC, record_date ASC, id ASC").map_err(|err| err.to_string())?;
    let records = records_stmt.query_map([], row_to_record).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?;
    let mut attachments_stmt = conn.prepare("SELECT * FROM attachments ORDER BY client_id ASC, attachment_date ASC, id ASC").map_err(|err| err.to_string())?;
    let attachments = attachments_stmt.query_map([], row_to_attachment).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?;
    let mut visits_stmt = conn.prepare("SELECT * FROM visits ORDER BY client_id ASC, visit_date ASC, id ASC").map_err(|err| err.to_string())?;
    let visits = visits_stmt.query_map([], row_to_visit).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?;
    let mut catalog_stmt = conn.prepare("SELECT * FROM service_catalog ORDER BY id ASC").map_err(|err| err.to_string())?;
    let service_catalog = catalog_stmt.query_map([], row_to_service).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?;
    let mut visit_services_stmt = conn.prepare("SELECT * FROM visit_services ORDER BY visit_id ASC, id ASC").map_err(|err| err.to_string())?;
    let visit_services = visit_services_stmt.query_map([], row_to_visit_service).map_err(|err| err.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())?;
    let backup = DataBackup { app: "dietoy".to_string(), version: env!("CARGO_PKG_VERSION").to_string(), exported_at: now(), clients, records, attachments, visits, service_catalog, visit_services, settings };
    let file_name = format!("dietoy-data-{}.json", Utc::now().format("%Y%m%d-%H%M%S"));
    let base_dir = dirs_next::document_dir().or_else(dirs_next::desktop_dir).ok_or_else(|| "مسیر مناسب برای ذخیره پشتیبان پیدا نشد.".to_string())?;
    let target = base_dir.join(file_name);
    fs::write(&target, serde_json::to_string_pretty(&backup).map_err(|err| err.to_string())?).map_err(|err| err.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn restore_data_backup(state: tauri::State<'_, AppState>, path: String) -> Result<(), String> {
    let content = fs::read_to_string(path).map_err(|err| err.to_string())?;
    let backup: DataBackup = serde_json::from_str(&content).map_err(|err| err.to_string())?;
    if backup.app != "dietoy" && backup.app != "matab-taghzieh" { return Err("فایل پشتیبان مربوط به این برنامه نیست.".to_string()); }
    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM visit_services", []).map_err(|err| err.to_string())?; tx.execute("DELETE FROM attachments", []).map_err(|err| err.to_string())?; tx.execute("DELETE FROM visits", []).map_err(|err| err.to_string())?; tx.execute("DELETE FROM client_records", []).map_err(|err| err.to_string())?; tx.execute("DELETE FROM clients", []).map_err(|err| err.to_string())?; tx.execute("DELETE FROM service_catalog", []).map_err(|err| err.to_string())?; tx.execute("DELETE FROM settings", []).map_err(|err| err.to_string())?;
    for setting in backup.settings { tx.execute("INSERT INTO settings (key, value) VALUES (?1, ?2)", params![setting.key, setting.value]).map_err(|err| err.to_string())?; }
    for client in backup.clients { let status = if ["confirmed", "done", "cancelled"].contains(&client.next_visit_status.as_str()) { client.next_visit_status } else { "tentative".to_string() }; tx.execute("INSERT INTO clients (id, full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at, phone, email, profile_image_path, next_visit_date, next_visit_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)", params![client.id, client.full_name, client.gender, client.age, client.height_cm, client.weight_kg, client.activity_level, client.goal, client.notes, if client.archived { 1 } else { 0 }, client.created_at.unwrap_or_else(now), client.updated_at.unwrap_or_else(now), client.phone, client.email, client.profile_image_path, client.next_visit_date, status]).map_err(|err| err.to_string())?; }
    for record in backup.records { tx.execute("INSERT INTO client_records (id, client_id, record_date, weight_kg, height_cm, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)", params![record.id, record.client_id, record.record_date, record.weight_kg, record.height_cm, record.notes, record.created_at.unwrap_or_else(now), record.updated_at.unwrap_or_else(now)]).map_err(|err| err.to_string())?; }
    for item in backup.service_catalog { tx.execute("INSERT INTO service_catalog (id, name, default_price, active, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)", params![item.id, item.name, item.default_price, if item.active { 1 } else { 0 }, item.created_at.unwrap_or_else(now), item.updated_at.unwrap_or_else(now)]).map_err(|err| err.to_string())?; }
    for visit in backup.visits { tx.execute("INSERT INTO visits (id, client_id, visit_date, status, notes, total_fee, created_at, updated_at, sync_id, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)", params![visit.id, visit.client_id, visit.visit_date, visit.status, visit.notes, visit.total_fee, visit.created_at.unwrap_or_else(now), visit.updated_at.unwrap_or_else(now), visit.sync_id, visit.sync_status]).map_err(|err| err.to_string())?; }
    for attachment in backup.attachments { tx.execute("INSERT INTO attachments (id, client_id, visit_id, category, title, file_name, local_path, attachment_date, notes, created_at, updated_at, sync_id, sync_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)", params![attachment.id, attachment.client_id, attachment.visit_id, attachment.category, attachment.title, attachment.file_name, attachment.local_path, attachment.attachment_date, attachment.notes, attachment.created_at.unwrap_or_else(now), attachment.updated_at.unwrap_or_else(now), attachment.sync_id, attachment.sync_status]).map_err(|err| err.to_string())?; }
    for item in backup.visit_services { tx.execute("INSERT INTO visit_services (id, visit_id, service_id, service_name_snapshot, price, quantity, total, notes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)", params![item.id, item.visit_id, item.service_id, item.service_name_snapshot, item.price, item.quantity, item.total, item.notes, item.created_at.unwrap_or_else(now)]).map_err(|err| err.to_string())?; }
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
            app.manage(AppState { conn: Mutex::new(conn), db_path: path });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![archive_client, change_credentials, dashboard_stats, export_data_backup, export_database, get_settings, import_attachment, import_brand_asset, list_attachments, list_client_records, list_clients, list_service_catalog, list_visit_services, list_visits, login, restore_data_backup, save_client, save_client_record, save_service_catalog_item, save_settings, save_visit, save_visit_service, search_clients])
        .run(tauri::generate_context!())
        .expect("failed to run app");
}
