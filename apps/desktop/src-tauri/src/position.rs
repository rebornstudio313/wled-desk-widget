use serde::{Deserialize, Serialize};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
};
use tauri::Manager;
#[derive(Clone, Serialize, Deserialize)]
struct Saved {
    version: u32,
    x: i32,
    y: i32,
    monitor: Option<String>,
    dx: f64,
    dy: f64,
    #[serde(default = "default_height")]
    height: f64,
}
fn default_height() -> f64 {
    470.
}
#[derive(Clone)]
struct Screen {
    name: Option<String>,
    x: i32,
    y: i32,
    w: u32,
    h: u32,
    scale: f64,
}
struct Pending {
    latest: Option<Saved>,
}
struct PositionStore {
    file: PathBuf,
    state: Arc<Mutex<Pending>>,
    generation: Arc<AtomicU64>,
    scheduled: Arc<AtomicBool>,
}
fn screens(window: &tauri::WebviewWindow) -> Vec<Screen> {
    window
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| {
            let a = m.work_area();
            Screen {
                name: m.name().cloned(),
                x: a.position.x,
                y: a.position.y,
                w: a.size.width,
                h: a.size.height,
                scale: m.scale_factor(),
            }
        })
        .collect()
}
fn clamp(x: i64, y: i64, width: u32, height: u32, screen: &Screen) -> (i32, i32) {
    let min_x = screen.x as i64;
    let min_y = screen.y as i64;
    (
        x.clamp(min_x, min_x + (screen.w as i64 - width as i64).max(0)) as i32,
        y.clamp(min_y, min_y + (screen.h as i64 - height as i64).max(0)) as i32,
    )
}
fn restore(
    saved: &Saved,
    screens: &[Screen],
    primary: Option<&str>,
    width: u32,
    height: u32,
) -> Option<(i32, i32)> {
    if saved.version != 1
        || !saved.dx.is_finite()
        || !saved.dy.is_finite()
        || saved.dx.abs() > 1e7
        || saved.dy.abs() > 1e7
    {
        return None;
    }
    let same = screens
        .iter()
        .find(|s| saved.monitor.is_some() && s.name == saved.monitor);
    let screen = same
        .or_else(|| {
            screens.iter().find(|s| {
                saved.x as i64 >= s.x as i64
                    && (saved.x as i64) < (s.x as i64 + s.w as i64)
                    && saved.y as i64 >= s.y as i64
                    && (saved.y as i64) < (s.y as i64 + s.h as i64)
            })
        })
        .or_else(|| screens.iter().find(|s| s.name.as_deref() == primary))
        .or_else(|| screens.first())?;
    let (x, y) = if same.is_some() {
        (
            screen.x as i64 + (saved.dx * screen.scale).round() as i64,
            screen.y as i64 + (saved.dy * screen.scale).round() as i64,
        )
    } else {
        (saved.x as i64, saved.y as i64)
    };
    Some(clamp(x, y, width, height, screen))
}
fn write(file: &std::path::Path, saved: &Saved) {
    if let Ok(data) = serde_json::to_vec(saved) {
        let temp = file.with_extension("tmp");
        if std::fs::write(&temp, data).is_ok() {
            let _ = std::fs::rename(temp, file);
        }
    }
}
fn capture(window: &tauri::WebviewWindow) -> Option<Saved> {
    if window.is_minimized().unwrap_or(false) {
        return None;
    }
    let point = window.outer_position().ok()?;
    let monitor = window.current_monitor().ok().flatten()?;
    let origin = monitor.work_area().position;
    let scale = monitor.scale_factor();
    Some(Saved {
        version: 1,
        x: point.x,
        y: point.y,
        monitor: monitor.name().cloned(),
        dx: (point.x as f64 - origin.x as f64) / scale,
        dy: (point.y as f64 - origin.y as f64) / scale,
        height: window.inner_size().ok()?.height as f64 / scale,
    })
}
pub fn record(app: &tauri::AppHandle) {
    let Some(store) = app.try_state::<PositionStore>() else {
        return;
    };
    store.generation.fetch_add(1, Ordering::Relaxed);
    if store.scheduled.swap(true, Ordering::AcqRel) {
        return;
    }
    let generation = store.generation.clone();
    let scheduled = store.scheduled.clone();
    let app = app.clone();
    std::thread::spawn(move || {
        loop {
            let before = generation.load(Ordering::Relaxed);
            std::thread::sleep(std::time::Duration::from_millis(350));
            if generation.load(Ordering::Relaxed) == before {
                break;
            }
        }
        let handle = app.clone();
        let _ = app.run_on_main_thread(move || {
            scheduled.store(false, Ordering::Release);
            let Some(store) = handle.try_state::<PositionStore>() else {
                return;
            };
            let Some(window) = handle.get_webview_window("main") else {
                return;
            };
            let Some(saved) = capture(&window) else {
                return;
            };
            if let Ok(mut state) = store.state.lock() {
                state.latest = Some(saved.clone());
            }
            let file = store.file.clone();
            let generation = store.generation.clone();
            let epoch = generation.load(Ordering::Relaxed);
            let pending = store.state.clone();
            std::thread::spawn(move || {
                if let Ok(_guard) = pending.lock() {
                    if generation.load(Ordering::Relaxed) == epoch {
                        write(&file, &saved);
                    }
                }
            });
        });
    });
}
pub fn flush(app: &tauri::AppHandle) {
    let Some(store) = app.try_state::<PositionStore>() else {
        return;
    };
    store.generation.fetch_add(1, Ordering::Relaxed);
    let saved = app.get_webview_window("main").and_then(|w| capture(&w));
    if let Ok(mut state) = store.state.lock() {
        if let Some(saved) = saved {
            state.latest = Some(saved)
        }
        if let Some(saved) = &state.latest {
            write(&store.file, saved);
        }
    };
}
pub fn ensure_visible(window: &tauri::WebviewWindow) {
    let Some(saved) = capture(window) else { return };
    let areas = screens(window);
    let primary = window
        .primary_monitor()
        .ok()
        .flatten()
        .and_then(|m| m.name().cloned());
    let Ok(size) = window.outer_size() else {
        return;
    };
    if let Some((x, y)) = restore(&saved, &areas, primary.as_deref(), size.width, size.height) {
        if x != saved.x || y != saved.y {
            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
        }
    }
}
pub fn setup(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let file = app.path().app_data_dir()?.join("window-position.json");
    if let Some(window) = app.get_webview_window("main") {
        if let Some(saved) = std::fs::read(&file)
            .ok()
            .and_then(|data| serde_json::from_slice::<Saved>(&data).ok())
        {
            if saved.height.is_finite() && (180.0..=920.0).contains(&saved.height) {
                let _ = window.set_size(tauri::LogicalSize::new(320.0, saved.height));
            }
            let areas = screens(&window);
            let primary = window
                .primary_monitor()
                .ok()
                .flatten()
                .and_then(|m| m.name().cloned());
            if let Ok(size) = window.outer_size() {
                if let Some((x, y)) =
                    restore(&saved, &areas, primary.as_deref(), size.width, size.height)
                {
                    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                }
            }
        }
        app.manage(PositionStore {
            file,
            state: Arc::new(Mutex::new(Pending { latest: None })),
            generation: Arc::new(AtomicU64::new(0)),
            scheduled: Arc::new(AtomicBool::new(false)),
        });
        if !crate::startup::should_hide(app) {
            window.show()?;
        } else {
            let _ = window.set_skip_taskbar(true);
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn screen(name: &str, x: i32, y: i32, w: u32, h: u32, scale: f64) -> Screen {
        Screen {
            name: Some(name.into()),
            x,
            y,
            w,
            h,
            scale,
        }
    }
    fn saved() -> Saved {
        Saved {
            version: 1,
            x: 100,
            y: 200,
            monitor: Some("a".into()),
            dx: 100.,
            dy: 200.,
            height: 470.,
        }
    }
    #[test]
    fn exact_position_and_dpi() {
        let a = screen("a", 0, 0, 1920, 1040, 1.);
        assert_eq!(
            restore(&saved(), &[a], Some("a"), 320, 470),
            Some((100, 200))
        );
        let a = screen("a", 0, 0, 2560, 1400, 1.5);
        assert_eq!(
            restore(&saved(), &[a], Some("a"), 480, 705),
            Some((150, 300))
        );
    }
    #[test]
    fn negative_screen_and_missing_monitor() {
        let mut s = saved();
        s.monitor = Some("left".into());
        s.x = -1800;
        s.dx = 120.;
        s.dy = 40.;
        let left = screen("left", -1920, 0, 1920, 1040, 1.);
        assert_eq!(restore(&s, &[left], None, 320, 470), Some((-1800, 40)));
        let a = screen("a", 0, 0, 1920, 1040, 1.);
        assert_eq!(restore(&s, &[a], Some("a"), 320, 470), Some((0, 200)));
    }
    #[test]
    fn clamps_edges_taskbar_and_tall_window() {
        let mut s = saved();
        s.dx = 1900.;
        s.dy = 1000.;
        let a = screen("a", 0, 40, 1920, 1000, 1.);
        assert_eq!(
            restore(&s, &[a.clone()], Some("a"), 320, 470),
            Some((1600, 570))
        );
        assert_eq!(restore(&s, &[a], None, 320, 1200), Some((1600, 40)));
        assert_eq!(restore(&s, &[], None, 320, 470), None);
        s.dx = f64::NAN;
        assert_eq!(
            restore(&s, &[screen("a", 0, 0, 1920, 1040, 1.)], None, 320, 470),
            None
        );
    }
    #[test]
    fn stores_position_between_reads() {
        let path =
            std::env::temp_dir().join(format!("wled-position-{}.json", uuid::Uuid::new_v4()));
        write(&path, &saved());
        let loaded: Saved = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!((loaded.x, loaded.y), (100, 200));
        let mut next = saved();
        next.x = 250;
        write(&path, &next);
        let loaded: Saved = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!(loaded.x, 250);
        let _ = std::fs::remove_file(path);
    }
}
