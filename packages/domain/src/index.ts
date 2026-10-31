/** Initial design contract; no transport or UI implementation yet. */
export type DeviceId = string;
export type GroupId = string;
export type RGB = readonly [number, number, number];
export type Selection =
  | { kind: 'all' }
  | { kind: 'device'; deviceId: DeviceId }
  | { kind: 'group'; groupId: GroupId };

export interface DeviceRecord {
  id: DeviceId;
  name: string;
  address: string;
  identity?: string;
}
export interface GroupRecord {
  id: GroupId;
  name: string;
  deviceIds: DeviceId[];
}
export interface LightingPatch {
  on?: boolean;
  brightness?: number; // Internal WLED range 1..255; UI 0 becomes on=false.
  color?: RGB;
  effectName?: string; // Resolve against each device's catalog before writing.
  paletteName?: string;
  speed?: number;
  intensity?: number;
  segmentIds?: number[];
}
export type SceneTarget =
  | { deviceId: DeviceId; kind: 'preset'; presetId: number }
  | { deviceId: DeviceId; kind: 'state'; state: LightingPatch };
export interface SceneRecord { id: string; name: string; targets: SceneTarget[]; }
export interface QuickSlot { label: string; sceneId: string | null; }
export interface AppProfile {
  schemaVersion: 1;
  devices: DeviceRecord[];
  groups: GroupRecord[];
  scenes: SceneRecord[];
  quickSlots: QuickSlot[];
  ui: { locale: 'ru' | 'en'; alwaysOnTop: boolean; startOnLogin: boolean };
}
export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'stale' | 'restricted' | 'unsupported';
export interface DeviceCapabilities {
  firmware: string;
  ledCount: number;
  rgb: boolean;
  white: boolean;
  cct: boolean;
  effectMetadata: boolean;
}
export type OperationResult =
  | { deviceId: DeviceId; status: 'applied' }
  | { deviceId: DeviceId; status: 'skipped' | 'failed'; reason: string };
export interface CatalogEntry { id: number; name: string; }
export interface DeviceCatalog { deviceId: DeviceId; effects: CatalogEntry[]; palettes: CatalogEntry[]; }
