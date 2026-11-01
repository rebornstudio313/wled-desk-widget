use serde::Deserialize;
use std::sync::Mutex;
#[derive(Clone, Deserialize)]
pub struct Binding {
    id: String,
    action: String,
    code: String,
    mods: u32,
}
fn virtual_key(code: &str) -> Option<u32> {
    let bytes = code.as_bytes();
    if bytes.len() == 4 && code.starts_with("Key") && bytes[3].is_ascii_uppercase() {
        return Some(bytes[3] as u32);
    }
    if bytes.len() == 6 && code.starts_with("Digit") && bytes[5].is_ascii_digit() {
        return Some(bytes[5] as u32);
    }
    if let Some(n) = code.strip_prefix('F').and_then(|n| n.parse::<u32>().ok()) {
        if (1..=24).contains(&n) {
            return Some(0x6f + n);
        }
    }
    if bytes.len() == 7 && code.starts_with("Numpad") && bytes[6].is_ascii_digit() {
        return Some(0x60 + (bytes[6] - b'0') as u32);
    }
    Some(match code {
        "ArrowUp" => 0x26,
        "ArrowDown" => 0x28,
        "ArrowLeft" => 0x25,
        "ArrowRight" => 0x27,
        "Space" => 0x20,
        "Enter" => 0x0d,
        "Backspace" => 8,
        "Tab" => 9,
        "Delete" => 0x2e,
        "Insert" => 0x2d,
        "Home" => 0x24,
        "End" => 0x23,
        "PageUp" => 0x21,
        "PageDown" => 0x22,
        "Minus" => 0xbd,
        "Equal" => 0xbb,
        "BracketLeft" => 0xdb,
        "BracketRight" => 0xdd,
        "Backslash" => 0xdc,
        "Semicolon" => 0xba,
        "Quote" => 0xde,
        "Comma" => 0xbc,
        "Period" => 0xbe,
        "Slash" => 0xbf,
        "Backquote" => 0xc0,
        "NumpadAdd" => 0x6b,
        "NumpadSubtract" => 0x6d,
        "NumpadMultiply" => 0x6a,
        "NumpadDivide" => 0x6f,
        "NumpadDecimal" => 0x6e,
        _ => return None,
    })
}
fn validate(bindings: &[Binding]) -> Result<(), String> {
    if bindings.len() > 0xbfff {
        return Err("Достигнут лимит сочетаний Windows".into());
    }
    let mut keys = std::collections::HashSet::new();
    let mut ids = std::collections::HashSet::new();
    for b in bindings {
        if ![
            "visibility",
            "power",
            "brighter",
            "dimmer",
            "compact",
            "settings",
            "work",
            "evening",
            "cinema",
        ]
        .contains(&b.action.as_str())
            || b.mods > 15
            || b.id.is_empty()
            || b.id.len() > 100
            || !ids.insert(&b.id)
        {
            return Err("Неверное назначение клавиш".into());
        }
        let key = virtual_key(&b.code).ok_or("Неподдерживаемая клавиша")?;
        if !keys.insert((key, b.mods)) {
            return Err("Это сочетание уже назначено".into());
        }
    }
    Ok(())
}
#[cfg(windows)]
mod platform {
    use super::Binding;
    use windows_sys::Win32::{
        System::Threading::GetCurrentThreadId,
        UI::{
            Input::KeyboardAndMouse::{RegisterHotKey, UnregisterHotKey, MOD_NOREPEAT},
            WindowsAndMessaging::{
                GetMessageW, PeekMessageW, PostThreadMessageW, MSG, PM_NOREMOVE, WM_HOTKEY, WM_QUIT,
            },
        },
    };
    pub struct Session {
        pub id: u32,
        pub thread: std::thread::JoinHandle<()>,
    }
    pub fn stop(session: Session) {
        unsafe {
            PostThreadMessageW(session.id, WM_QUIT, 0, 0);
        }
        let _ = session.thread.join();
    }
    pub fn start(
        bindings: Vec<Binding>,
        dispatch: impl Fn(&str) + Send + 'static,
    ) -> Result<(Session, Vec<String>), String> {
        let (tx, rx) = std::sync::mpsc::sync_channel(1);
        let thread = std::thread::spawn(move || unsafe {
            let mut msg: MSG = std::mem::zeroed();
            PeekMessageW(&mut msg, std::ptr::null_mut(), 0, 0, PM_NOREMOVE);
            let mut registered = std::collections::HashSet::new();
            let mut failures = Vec::new();
            for (index, b) in bindings.iter().enumerate() {
                let id = index as i32 + 1;
                if RegisterHotKey(
                    std::ptr::null_mut(),
                    id,
                    b.mods | MOD_NOREPEAT,
                    super::virtual_key(&b.code).unwrap(),
                ) != 0
                {
                    registered.insert(id);
                } else {
                    failures.push(b.id.clone());
                }
            }
            let _ = tx.send((GetCurrentThreadId(), failures));
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                if msg.message == WM_HOTKEY && registered.contains(&(msg.wParam as i32)) {
                    if let Some(b) = msg.wParam.checked_sub(1).and_then(|i| bindings.get(i)) {
                        dispatch(&b.action);
                    }
                }
            }
            for id in registered {
                UnregisterHotKey(std::ptr::null_mut(), id);
            }
        });
        let (id, failed) = rx.recv().map_err(|e| e.to_string())?;
        Ok((Session { id, thread }, failed))
    }
    #[cfg(test)]
    mod tests {
        use super::*;
        fn binding(id: &str, action: &str, code: &str, mods: u32) -> Binding {
            Binding {
                id: id.into(),
                action: action.into(),
                code: code.into(),
                mods,
            }
        }
        #[test]
        fn registers_dispatches_and_releases() {
            let bindings = vec![
                binding("a", "power", "F19", 7),
                binding("b", "power", "F20", 7),
                binding("c", "dimmer", "F21", 0),
            ];
            super::super::validate(&bindings).unwrap();
            let (tx, rx) = std::sync::mpsc::channel();
            let (session, failed) = start(bindings.clone(), move |action| {
                let _ = tx.send(action.to_string());
            })
            .unwrap();
            for (index, id, action) in [(1, "a", "power"), (2, "b", "power"), (3, "c", "dimmer")] {
                if !failed.iter().any(|v| v == id) {
                    unsafe {
                        assert_ne!(PostThreadMessageW(session.id, WM_HOTKEY, index, 0), 0);
                    }
                    assert_eq!(
                        rx.recv_timeout(std::time::Duration::from_secs(2)).unwrap(),
                        action
                    );
                }
            }
            let available = bindings
                .iter()
                .find(|b| !failed.contains(&b.id))
                .expect("At least one test key is available");
            stop(session);
            unsafe {
                assert_ne!(
                    RegisterHotKey(
                        std::ptr::null_mut(),
                        101,
                        available.mods | MOD_NOREPEAT,
                        super::super::virtual_key(&available.code).unwrap()
                    ),
                    0
                );
                UnregisterHotKey(std::ptr::null_mut(), 101);
            }
        }
        #[test]
        fn rejects_duplicate_keys_and_invalid_actions() {
            assert!(super::super::validate(&[
                binding("a", "power", "F8", 0),
                binding("b", "work", "F8", 0)
            ])
            .is_err());
            assert!(super::super::validate(&[binding("a", "unknown", "F8", 0)]).is_err());
            assert!(super::super::validate(&[binding("a", "power", "Unknown", 0)]).is_err());
        }
    }
}
#[derive(Default)]
pub struct Hotkeys(#[cfg(windows)] Mutex<Option<platform::Session>>);
#[tauri::command]
pub fn configure_hotkeys(
    enabled: bool,
    bindings: Vec<Binding>,
    app: tauri::AppHandle,
    state: tauri::State<Hotkeys>,
) -> Result<Vec<String>, String> {
    validate(&bindings)?;
    #[cfg(windows)]
    {
        let mut session = state.0.lock().map_err(|_| "Горячие клавиши заняты")?;
        if let Some(old) = session.take() {
            platform::stop(old);
        }
        if enabled {
            let (new, failures) = platform::start(bindings, move |action| {
                use tauri::{Emitter, Manager};
                if action == "visibility" {
                    if let Some(w) = app.get_webview_window("main") {
                        let handle = app.clone();
                        let visible = w.is_visible().unwrap_or(false);
                        let _ = app.run_on_main_thread(move || {
                            if visible {
                                let _ = crate::shell::hide_widget(handle);
                            } else {
                                crate::shell::show(&handle);
                            }
                        });
                    }
                } else {
                    let _ = app.emit("widget-hotkey", action);
                }
            })?;
            *session = Some(new);
            return Ok(failures);
        }
        Ok(Vec::new())
    }
    #[cfg(not(windows))]
    {
        let _ = (enabled, bindings, app, state);
        Err("Глобальные сочетания доступны в Windows".into())
    }
}
