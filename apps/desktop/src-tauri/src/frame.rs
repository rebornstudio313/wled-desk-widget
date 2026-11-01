// Keep the fixed, transparent widget borderless before Tao applies new styles.
// A one-shot SetWindowLong is insufficient: restoring/focusing the window
// causes Tao to rebuild WS_CAPTION. Never call Tauri's synchronous size getters
// from a native window event; use Win32 directly for clipping instead.
#[cfg(windows)]
mod windows {
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM},
        Graphics::Gdi::{CreateRoundRectRgn, DeleteObject, SetWindowRgn},
        UI::{
            HiDpi::GetDpiForWindow,
            Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
            WindowsAndMessaging::{
                GetWindowLongPtrW, GetWindowRect, IsIconic, SetWindowLongPtrW, SetWindowPos,
                GWL_EXSTYLE, GWL_STYLE, STYLESTRUCT, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE,
                SWP_NOSIZE, SWP_NOZORDER, WM_NCDESTROY, WM_STYLECHANGING, WS_CAPTION,
                WS_EX_CLIENTEDGE, WS_EX_DLGMODALFRAME, WS_EX_STATICEDGE, WS_EX_WINDOWEDGE,
                WS_THICKFRAME,
            },
        },
    };
    const SUBCLASS_ID: usize = 0x574c4544;
    const FRAME: u32 = WS_CAPTION | WS_THICKFRAME;
    const EDGE: u32 = WS_EX_CLIENTEDGE | WS_EX_DLGMODALFRAME | WS_EX_STATICEDGE | WS_EX_WINDOWEDGE;

    unsafe extern "system" fn procedure(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        id: usize,
        _data: usize,
    ) -> LRESULT {
        if message == WM_STYLECHANGING && lparam != 0 {
            let change = &mut *(lparam as *mut STYLESTRUCT);
            if wparam as i32 == GWL_STYLE {
                change.styleNew &= !FRAME;
            }
            if wparam as i32 == GWL_EXSTYLE {
                change.styleNew &= !EDGE;
            }
        }
        if message == WM_NCDESTROY {
            RemoveWindowSubclass(hwnd, Some(procedure), id);
        }
        DefSubclassProc(hwnd, message, wparam, lparam)
    }

    pub fn install(window: &tauri::WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
        let hwnd = window.hwnd()?.0 as HWND;
        unsafe {
            // Called once from setup on the HWND's owning thread.
            if SetWindowSubclass(hwnd, Some(procedure), SUBCLASS_ID, 0) == 0 {
                return Err(std::io::Error::last_os_error().into());
            }
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
            SetWindowLongPtrW(hwnd, GWL_STYLE, style & !(FRAME as isize));
            let exstyle = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, exstyle & !(EDGE as isize));
            SetWindowPos(
                hwnd,
                std::ptr::null_mut(),
                0,
                0,
                0,
                0,
                SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
            );
        }
        Ok(())
    }
    pub fn round(window: &tauri::WebviewWindow) {
        let Ok(handle) = window.hwnd() else { return };
        let hwnd = handle.0 as HWND;
        unsafe {
            if IsIconic(hwnd) != 0 {
                return;
            }
            let mut rect = RECT::default();
            if GetWindowRect(hwnd, &mut rect) == 0 {
                return;
            }
            let dpi = GetDpiForWindow(hwnd).max(96);
            // Native regions have binary edges. Keep their coarse clipping outside
            // the 16px CSS curve; WebView's alpha blending draws the smooth edge.
            let diameter = (16 * dpi / 96) as i32;
            let region = CreateRoundRectRgn(
                0,
                0,
                rect.right - rect.left,
                rect.bottom - rect.top,
                diameter,
                diameter,
            );
            if !region.is_null() && SetWindowRgn(hwnd, region, 1) == 0 {
                DeleteObject(region);
            }
        }
    }
}
pub fn install(window: &tauri::WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(windows)]
    windows::install(window)?;
    Ok(())
}
pub fn round(window: &tauri::WebviewWindow) {
    #[cfg(windows)]
    windows::round(window);
}
