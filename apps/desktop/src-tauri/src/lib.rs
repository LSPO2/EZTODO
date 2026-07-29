use std::time::Duration;
use tauri::Manager;

mod credentials;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiApiRequest {
    url: String,
    api_key: String,
    body: serde_json::Value,
}

#[derive(serde::Serialize)]
struct AiApiResponse {
    status: u16,
    body: serde_json::Value,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiModelsRequest {
    url: String,
    api_key: String,
}

fn parse_ai_url(value: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(value).map_err(|_| "AI API 地址无效".to_string())?;
    let is_local_http =
        url.scheme() == "http" && matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1"));
    if url.scheme() != "https" && !is_local_http {
        return Err("AI API 必须使用 HTTPS；仅本机地址允许 HTTP".to_string());
    }
    Ok(url)
}

fn ai_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "无法初始化 AI 网络客户端".to_string())
}

#[tauri::command]
async fn call_ai_api(request: AiApiRequest) -> Result<AiApiResponse, String> {
    let url = parse_ai_url(&request.url)?;
    let client = ai_http_client()?;

    let response = client
        .post(url)
        .bearer_auth(request.api_key)
        .json(&request.body)
        .send()
        .await
        .map_err(|_| "无法连接 AI 服务".to_string())?;

    let status = response.status().as_u16();
    let body = response
        .json::<serde_json::Value>()
        .await
        .unwrap_or_else(|_| serde_json::json!({}));

    Ok(AiApiResponse { status, body })
}

#[tauri::command]
async fn list_ai_models(request: AiModelsRequest) -> Result<AiApiResponse, String> {
    let url = parse_ai_url(&request.url)?;
    let response = ai_http_client()?
        .get(url)
        .bearer_auth(request.api_key)
        .send()
        .await
        .map_err(|_| "无法连接 AI 服务".to_string())?;

    let status = response.status().as_u16();
    let body = response
        .json::<serde_json::Value>()
        .await
        .unwrap_or_else(|_| serde_json::json!({}));

    Ok(AiApiResponse { status, body })
}

#[tauri::command]
fn store_ai_api_key(api_key: String) -> Result<(), String> {
    credentials::store_ai_api_key(&api_key)
}

#[tauri::command]
fn load_ai_api_key() -> Result<Option<String>, String> {
    credentials::load_ai_api_key()
}

#[tauri::command]
fn delete_ai_api_key() -> Result<(), String> {
    credentials::delete_ai_api_key()
}

#[tauri::command]
fn play_reminder_sound() {
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::System::Diagnostics::Debug::MessageBeep;
        use windows_sys::Win32::UI::WindowsAndMessaging::MB_ICONEXCLAMATION;
        MessageBeep(MB_ICONEXCLAMATION);
    }
}
// Learn more about Tauri commands at https://tauri.app/v1/guides/commands
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to EZTODO.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            call_ai_api,
            list_ai_models,
            store_ai_api_key,
            load_ai_api_key,
            delete_ai_api_key,
            play_reminder_sound
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                let window = _app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
