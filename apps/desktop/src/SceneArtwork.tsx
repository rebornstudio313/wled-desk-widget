import type {SceneSlot} from './model';

// Scene cards 05: optically aligned, scalable 32-unit artwork.
export function SceneArtwork({slot}:{slot:SceneSlot}){
 const gradient='scene-icon-'+slot;
 return <svg className="scene-artwork" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
 <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffffff" stopOpacity=".95"/><stop offset=".3" stopColor="currentColor" stopOpacity=".95"/><stop offset="1" stopColor="currentColor" stopOpacity=".65"/></linearGradient></defs>
 {slot==='work'?<>
  <rect x="5" y="6.5" width="22" height="16" rx="1" fill="currentColor" fillOpacity=".12"/>
  <path d="M7 8.5h18" stroke="#fff3d9" strokeOpacity=".5" strokeWidth=".65"/>
  <path d="M13.5 22.5 12 26h8l-1.5-3.5M10 26h12"/>
 </>:slot==='evening'?<>
  <rect x="4.5" y="9" width="15.5" height="14.5" rx="1.3" fill={'url(#'+gradient+')'}/>
  <path d="m20 13 7.5-4v15L20 20Z" fill={'url(#'+gradient+')'}/>
  <path d="M7.5 12v8.5" stroke="#fff" strokeOpacity=".65" strokeWidth="1"/>
 </>:<>
  <rect x="4.5" y="6.5" width="23" height="16" rx=".9" fill={'url(#'+gradient+')'}/>
  <path d="M14 22.5 12 26h8l-2-3.5M10 26h12"/>
  <path d="M7 9v10m0-10h3" stroke="#efffff" strokeOpacity=".8" strokeWidth=".9"/>
 </>}
 <ellipse cx="16" cy="28" rx="7" ry=".7" fill="currentColor" fillOpacity=".22" stroke="none"/>
 </svg>;
}
