import type {ReactNode} from 'react';

// Original outline family, selected concept 01. All icons share a 24-unit grid.
const drawings={
 pin:<><path d="m8 3 8 0-1 6 4 4H5l4-4ZM12 13v8"/></>,
 collapse:<><path d="M5 9V4h5m9 11v5h-5M5 4l6 6m8 10-6-6"/></>,
 expand:<><path d="M4 4l6 6M10 5v5H5m15 10-6-6m0 5v-5h5"/></>,
 hide:<><path d="M4 5h16v14H4ZM8 15h8"/></>,
 'power':<><path d="M12 2.5v8.2M6.7 5.1a8.4 8.4 0 1 0 10.6 0"/></>,
 'effects':<><path d="m12.5 2 1.6 4.9L19 8.5l-4.9 1.6-1.6 4.9-1.6-4.9L6 8.5l4.9-1.6Z"/><path d="m5 12 1.1 3.4L9.5 16.5l-3.4 1.1L5 21l-1.1-3.4L.5 16.5l3.4-1.1Zm14 2 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/></>,
 'color':<><g transform="translate(.65 -.8)"><path d="M10.500 4.800A8 8 0 0 1 17.428 8.800" stroke="#ff6559" strokeWidth="2.8" strokeLinecap="butt"/><path d="M17.428 8.800A8 8 0 0 1 17.428 16.800" stroke="#ffdc63" strokeWidth="2.8" strokeLinecap="butt"/><path d="M17.428 16.800A8 8 0 0 1 10.500 20.800" stroke="#50ec91" strokeWidth="2.8" strokeLinecap="butt"/><path d="M10.500 20.800A8 8 0 0 1 3.572 16.800" stroke="#36d9ef" strokeWidth="2.8" strokeLinecap="butt"/><path d="M3.572 16.800A8 8 0 0 1 3.572 8.800" stroke="#7488ff" strokeWidth="2.8" strokeLinecap="butt"/><path d="M3.572 8.800A8 8 0 0 1 10.500 4.800" stroke="#e976ff" strokeWidth="2.8" strokeLinecap="butt"/><circle cx="17.5" cy="7.5" r="2.7" fill="#173e65" stroke="#f3fbff" strokeWidth="1.8"/></g></>,
 'settings':<><path d="M9.17 5.16L10.08 4.85L10.33 2.55L13.67 2.55L13.92 4.85L14.83 5.16L14.83 5.16L15.70 5.59L17.51 4.14L19.86 6.49L18.41 8.30L18.84 9.17L18.84 9.17L19.15 10.08L21.45 10.33L21.45 13.67L19.15 13.92L18.84 14.83L18.84 14.83L18.41 15.70L19.86 17.51L17.51 19.86L15.70 18.41L14.83 18.84L14.83 18.84L13.92 19.15L13.67 21.45L10.33 21.45L10.08 19.15L9.17 18.84L9.17 18.84L8.30 18.41L6.49 19.86L4.14 17.51L5.59 15.70L5.16 14.83L5.16 14.83L4.85 13.92L2.55 13.67L2.55 10.33L4.85 10.08L5.16 9.17L5.16 9.17L5.59 8.30L4.14 6.49L6.49 4.14L8.30 5.59L9.17 5.16Z"/><circle cx="12" cy="12" r="3.2"/></>,
 'work':<><circle cx="12" cy="12" r="4.4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
 'evening':<><path d="M6 14a6 6 0 0 1 12 0" fill="currentColor" fillOpacity=".14"/><path d="M2 14.5h20M5.5 18h13M9 21h6M12 2v2M4.5 5.5 6 7m12 0 1.5-1.5"/></>,
 'cinema':<><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm0-4 17-4 1 4-17 4Z"/><path d="m8 6 2 3m4-4.5 2 3"/></>,
 'peek':<><path d="M2 12c2.2-4.6 5.5-7 10-7s7.8 2.4 10 7c-2.2 4.6-5.5 7-10 7S4.2 16.6 2 12Z"/><circle cx="12" cy="12" r="3.2"/><circle cx="13" cy="11" r=".65" fill="currentColor" stroke="none"/></>,
 'lamp':<><path d="M8.5 3.5h7l3.5 8H5Z" fill="currentColor" fillOpacity=".12"/><path d="M12 11.5v8M7.5 21h9M7 14.5l-1 1.5m11-1.5 1 1.5"/></>,
 'link':<><path d="m10.5 8.5 3.5-3.5a3.5 3.5 0 0 1 5 5l-3.5 3.5m-2 2L10 19a3.5 3.5 0 0 1-5-5l3.5-3.5M8.5 15.5l7-7"/></>,
} satisfies Record<string,ReactNode>;
export type IconName=keyof typeof drawings;
export function Icon({kind}:{kind:IconName}){
 return <svg className={'app-icon app-icon--'+kind} data-icon={kind} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{drawings[kind]}</svg>;
}
