// Prevents an extra console window from popping up on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Deliberately thin: this app has no #[tauri::command] handlers yet because
// every data operation (notes, links, auth) goes over the network to the same
// Express API the web app calls — see IMPLEMENTATION_PLAN.md §1. Rust's job
// here is the native window and, later, local file/OS integration (offline
// cache, OS keychain for the refresh token) — not business logic.
fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running VaultVista");
}
