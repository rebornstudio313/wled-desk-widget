# Desktop frontend

main.tsx wires selection, state subscriptions and lamp commands. Components are grouped by function: Scenes, SyncTargets, LampPicker/LampName, Peek, Discovery, AppearanceSettings, StartupSettings, hotkeys and About. bridge.ts maps the same contracts to Tauri IPC or loopback preview HTTP. Device settings live on the controller; local device names and scene associations live in the profile. Only the first segment is edited by the main controls. All dropdowns and inputs keep their own interaction when dragging the window.
