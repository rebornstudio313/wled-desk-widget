export interface PeekFrame {colors:string[];width?:number;height?:number}
export function decodePeekFrame(input:unknown):PeekFrame|null;
