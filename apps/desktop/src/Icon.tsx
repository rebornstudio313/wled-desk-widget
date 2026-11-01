import type {ReactNode} from 'react';

// Selected family 05: Compact Balance, 24-unit grid, 1.65-unit rounded outlines.
const drawings={
 'close':<><path d="m5 5 14 14m0-14L5 19"/></>,
 'pin':<><path d="M8.5 4h7l-1 5.5 3 3H6.5l3-3ZM12 12.5V20"/></>,
 'collapse':<><path d="m5 5 5 5M10 6v4H6m13 9-5-5m0 4v-4h4"/></>,
 'expand':<><path d="M5 9V5h4m10 10v4h-4M5 5l5 5m9 9-5-5"/></>,
 'hide':<><rect x="5" y="5" width="14" height="14" rx="1.5"/><path d="M8.5 15.5h7"/></>,
 'power':<><path d="M12 5v6M7.4 7.4a6.5 6.5 0 1 0 9.2 0"/></>,
 'settings':<><path d="M17.233 9.670L18.997 10.125L18.997 13.875L17.233 14.330L16.634 15.367L17.122 17.122L13.875 18.997L12.599 17.697L11.401 17.697L10.125 18.997L6.878 17.122L7.366 15.367L6.767 14.330L5.003 13.875L5.003 10.125L6.767 9.670L7.366 8.633L6.878 6.878L10.125 5.003L11.401 6.303L12.599 6.303L13.875 5.003L17.122 6.878L16.634 8.633Z"/><circle cx="12" cy="12" r="2.6"/></>,
 'effects':<><path d="m13 4 2 5 5 2-5 2-2 5-2-5-5-2 5-2ZM5 4v4M3 6h4m12 10v4m-2-2h4"/></>,
 'color':<><circle cx="12" cy="12" r="7.5"/><circle cx="15.5" cy="8.5" r="2"/><path d="M7 12h.01M10 7.5h.01M8.5 16h.01M14 17h.01"/></>,
 'work':<><circle cx="12" cy="12" r="3.5"/><path d="M12 3.5v2m0 13v2M3.5 12h2m13 0h2M6 6l1.4 1.4m9.2 9.2L18 18M6 18l1.4-1.4m9.2-9.2L18 6"/></>,
 'evening':<><path d="M7 13.5a5 5 0 0 1 10 0M4 14h16M7 17.5h10M10 20h4M12 4v2M6 7l1.5 1.5M18 7l-1.5 1.5"/></>,
 'cinema':<><path d="M5 11h14v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1ZM5 7l13-3 1 4-13 3Z"/><path d="m9 6.2 1.5 2.8m4-4.1 1.5 2.8"/></>,
 'peek':<><path d="M3.5 12c2-3.8 4.8-5.5 8.5-5.5s6.5 1.7 8.5 5.5c-2 3.8-4.8 5.5-8.5 5.5S5.5 15.8 3.5 12Z"/><circle cx="12" cy="12" r="2.7"/></>,
 'lamp':<><path d="M9 5h6l3 7H6ZM12 12v7M8.5 19h7"/></>,
 'link':<><path d="m10 8 2.5-2.5a3.2 3.2 0 0 1 4.5 4.5l-2.5 2.5m-1 3L11 18a3.2 3.2 0 0 1-4.5-4.5L9 11m0 4 6-6"/></>,
} satisfies Record<string,ReactNode>;
export type IconName=keyof typeof drawings;
export function Icon({kind}:{kind:IconName}){
 return <svg className={'app-icon app-icon--'+kind} data-icon={kind} data-family="compact-balance-05" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{drawings[kind]}</svg>;
}
