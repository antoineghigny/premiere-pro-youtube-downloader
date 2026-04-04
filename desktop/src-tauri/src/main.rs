#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

mod cors;
mod models;
mod rate_limit;
mod request_logger;
mod routes;
mod server;
mod services;
mod utils;
mod websocket;

use std::sync::atomic::Ordering;

use tauri::{
    async_runtime,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WindowEvent,
};

fn init_tracing() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter("info")
        .with_target(false)
        .compact()
        .try_init();
}

#[tauri::command]
fn get_server_port(state: tauri::State<'_, server::AppState>) -> u16 {
    state.server_port()
}

#[tauri::command]
fn get_desktop_auth_token(state: tauri::State<'_, server::AppState>) -> String {
    state.auth.desktop_token().to_string()
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Open YT2Premiere", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::AssetNotFound("Default window icon missing".to_string()))?;

    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("YT2Premiere")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "quit" => {
                let state = app.state::<server::AppState>().inner().clone();
                state.quit_requested.store(true, Ordering::SeqCst);
                async_runtime::block_on(async {
                    state.kill_all_child_processes().await;
                });
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn attach_window_guards(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let guarded_window = window.clone();
    let state = app.state::<server::AppState>().inner().clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            if !state.quit_requested.load(Ordering::SeqCst) {
                api.prevent_close();
                let _ = guarded_window.hide();
            }
        }
    });
}

fn main() {
    init_tracing();

    let args: Vec<String> = std::env::args().collect();
    let background = args.iter().any(|arg| arg == "--background");

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let background_request = args.iter().any(|arg| arg == "--background");
            if !background_request {
                show_main_window(app);
            }
        }))
        .invoke_handler(tauri::generate_handler![
            get_server_port,
            get_desktop_auth_token
        ])
        .setup(move |app| {
            let state = server::AppState::bootstrap(app.path().resource_dir().ok())?;
            app.manage(state.clone());

            async_runtime::spawn(async move {
                if let Err(error) = server::serve(state).await {
                    tracing::error!("HTTP server stopped: {}", error);
                }
            });

            let integration_state = app.state::<server::AppState>().inner().clone();
            async_runtime::spawn(async move {
                if let Err(error) = services::integrations::run_startup_setup(&integration_state) {
                    tracing::warn!("Could not finish integration setup: {}", error);
                }
            });

            setup_tray(&app.handle())?;
            attach_window_guards(&app.handle());

            if background {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            } else {
                show_main_window(&app.handle());
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Tauri application");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
            let state = app_handle.state::<server::AppState>().inner().clone();
            state.quit_requested.store(true, Ordering::SeqCst);
            async_runtime::block_on(async {
                state.kill_all_child_processes().await;
            });
        }
    });
}
