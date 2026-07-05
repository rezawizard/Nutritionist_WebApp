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

fn init_db(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
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
        ",
    )
    .map_err(|err| err.to_string())?;

    write_default_setting(conn, "dietitian_name", "")?;
    write_default_setting(conn, "clinic_name", "")?;
    write_default_setting(conn, "primary_color", "#0f5b46")?;
    write_default_setting(conn, "background_color", "#f7f3ea")?;
    write_default_setting(conn, "username", "admin")?;
    write_default_setting(conn, "password_hash", &hash_password("admin"))?;
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
    })
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
    conn.query_row("SELECT * FROM clients WHERE id = ?1", params![id], row_to_client)
        .optional()
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "Client was not found.".to_string())
}

#[tauri::command]
fn list_clients(state: tauri::State<'_, AppState>, include_archived: bool) -> Result<Vec<Client>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let sql = if include_archived {
        "SELECT * FROM clients ORDER BY archived ASC, updated_at DESC"
    } else {
        "SELECT * FROM clients WHERE archived = 0 ORDER BY updated_at DESC"
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
        .prepare("SELECT * FROM clients WHERE archived = 0 AND full_name LIKE ?1 ORDER BY updated_at DESC LIMIT 20")
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
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let timestamp = now();

    if let Some(id) = client.id {
        conn.execute(
            "UPDATE clients SET full_name=?1, gender=?2, age=?3, height_cm=?4, weight_kg=?5, activity_level=?6, goal=?7, notes=?8, archived=?9, updated_at=?10 WHERE id=?11",
            params![client.full_name, client.gender, client.age, client.height_cm, client.weight_kg, client.activity_level, client.goal, client.notes, if client.archived { 1 } else { 0 }, timestamp, id],
        )
        .map_err(|err| err.to_string())?;
        get_client(&conn, id)
    } else {
        conn.execute(
            "INSERT INTO clients (full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?9)",
            params![client.full_name, client.gender, client.age, client.height_cm, client.weight_kg, client.activity_level, client.goal, client.notes, timestamp],
        )
        .map_err(|err| err.to_string())?;
        get_client(&conn, conn.last_insert_rowid())
    }
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
        .prepare("SELECT * FROM clients WHERE archived = 0 ORDER BY updated_at DESC LIMIT 5")
        .map_err(|err| err.to_string())?;
    let recent_clients = stmt
        .query_map([], row_to_client)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(DashboardStats { total_clients, active_clients, recent_clients })
}

#[tauri::command]
fn get_settings(state: tauri::State<'_, AppState>) -> Result<Settings, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    Ok(Settings {
        dietitian_name: read_setting(&conn, "dietitian_name")?,
        clinic_name: read_setting(&conn, "clinic_name")?,
        primary_color: read_setting(&conn, "primary_color")?,
        background_color: read_setting(&conn, "background_color")?,
        username: read_setting(&conn, "username")?,
    })
}

#[tauri::command]
fn save_settings(state: tauri::State<'_, AppState>, settings: Settings) -> Result<Settings, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    write_setting(&conn, "dietitian_name", &settings.dietitian_name)?;
    write_setting(&conn, "clinic_name", &settings.clinic_name)?;
    write_setting(&conn, "primary_color", &settings.primary_color)?;
    write_setting(&conn, "background_color", &settings.background_color)?;
    write_setting(&conn, "username", &settings.username)?;
    Ok(settings)
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
        return Err("Current password is not correct.".to_string());
    }
    let username = input.username.trim();
    if username.is_empty() || input.password.len() < 4 {
        return Err("Username and password are required.".to_string());
    }
    write_setting(&conn, "username", username)?;
    write_setting(&conn, "password_hash", &hash_password(&input.password))?;
    Ok(())
}

#[tauri::command]
fn export_database(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let file_name = format!("nutritionist-backup-{}.sqlite", Utc::now().format("%Y%m%d-%H%M%S"));
    let base_dir = dirs_next::document_dir().or_else(dirs_next::desktop_dir).ok_or_else(|| "Could not find a backup folder.".to_string())?;
    let target = base_dir.join(file_name);
    fs::copy(&state.db_path, &target).map_err(|err| err.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn export_data_backup(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut clients_stmt = conn.prepare("SELECT * FROM clients ORDER BY id ASC").map_err(|err| err.to_string())?;
    let clients = clients_stmt
        .query_map([], row_to_client)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    let mut records_stmt = conn.prepare("SELECT * FROM client_records ORDER BY client_id ASC, record_date ASC, id ASC").map_err(|err| err.to_string())?;
    let records = records_stmt
        .query_map([], row_to_record)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    let mut settings_stmt = conn.prepare("SELECT key, value FROM settings ORDER BY key ASC").map_err(|err| err.to_string())?;
    let settings = settings_stmt
        .query_map([], |row| Ok(SettingEntry { key: row.get(0)?, value: row.get(1)? }))
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    let backup = DataBackup { app: "matab-taghzieh".to_string(), version: env!("CARGO_PKG_VERSION").to_string(), exported_at: now(), clients, records, settings };
    let file_name = format!("matab-taghzieh-data-{}.json", Utc::now().format("%Y%m%d-%H%M%S"));
    let base_dir = dirs_next::document_dir().or_else(dirs_next::desktop_dir).ok_or_else(|| "Could not find a backup folder.".to_string())?;
    let target = base_dir.join(file_name);
    let json = serde_json::to_string_pretty(&backup).map_err(|err| err.to_string())?;
    fs::write(&target, json).map_err(|err| err.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn restore_data_backup(state: tauri::State<'_, AppState>, path: String) -> Result<(), String> {
    let content = fs::read_to_string(path).map_err(|err| err.to_string())?;
    let backup: DataBackup = serde_json::from_str(&content).map_err(|err| err.to_string())?;
    if backup.app != "matab-taghzieh" {
        return Err("Backup file does not belong to this app.".to_string());
    }
    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM client_records", []).map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM clients", []).map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM settings", []).map_err(|err| err.to_string())?;
    for setting in backup.settings {
        tx.execute("INSERT INTO settings (key, value) VALUES (?1, ?2)", params![setting.key, setting.value]).map_err(|err| err.to_string())?;
    }
    for client in backup.clients {
        tx.execute(
            "INSERT INTO clients (id, full_name, gender, age, height_cm, weight_kg, activity_level, goal, notes, archived, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![client.id, client.full_name, client.gender, client.age, client.height_cm, client.weight_kg, client.activity_level, client.goal, client.notes, if client.archived { 1 } else { 0 }, client.created_at.unwrap_or_else(now), client.updated_at.unwrap_or_else(now)],
        ).map_err(|err| err.to_string())?;
    }
    for record in backup.records {
        tx.execute(
            "INSERT INTO client_records (id, client_id, record_date, weight_kg, height_cm, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![record.id, record.client_id, record.record_date, record.weight_kg, record.height_cm, record.notes, record.created_at.unwrap_or_else(now), record.updated_at.unwrap_or_else(now)],
        ).map_err(|err| err.to_string())?;
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
            app.manage(AppState { conn: Mutex::new(conn), db_path: path });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            archive_client,
            change_credentials,
            dashboard_stats,
            export_data_backup,
            export_database,
            get_settings,
            list_client_records,
            list_clients,
            login,
            restore_data_backup,
            save_client,
            save_client_record,
            save_settings,
            search_clients
        ])
        .run(tauri::generate_context!())
        .expect("failed to run app");
}
