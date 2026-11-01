export interface Device { id:string; name:string; address:string; identity?:string }
export interface Snapshot { info:{name:string;ver:string;leds:{count:number};live?:boolean}; state:{on:boolean;bri:number;seg:Array<{id:number;col:number[][];fx:number;sx:number;ix:number;pal?:number}>}; effects:string[];palettes?:string[];presets:Record<string,{n?:string}> }
export type Patch={on?:boolean;bri?:number;ps?:number;seg?:Array<{id:number;col?:number[][];fx?:number;sx?:number;ix?:number;pal?:number}>};
export type Entry={device:Device;snapshot?:Snapshot;error?:string};

export type SceneSlot='work'|'evening'|'cinema';
export type SceneAction={kind:'preset';presetId:number}|{kind:'custom';on:boolean;bri:number;color:string;effect:string;speed:number;intensity:number};
export interface SceneTarget {deviceId:string;action:SceneAction}
export interface Scene {slot:SceneSlot;targets:SceneTarget[]}
