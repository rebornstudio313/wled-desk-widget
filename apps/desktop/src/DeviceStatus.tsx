import type {Entry} from './model';
import {Icon} from './Icon';

export function DeviceStatus({entries}:{entries:Entry[]}){
 if(!entries.length)return <span className="no-devices-status">Нет подключённых ламп</span>;
 return <span className="device-status-list" aria-label="Состояние выбранных ламп">{entries.map(entry=>{
  const state=entry.error?'offline':!entry.snapshot?'connecting':entry.snapshot.state.on&&entry.snapshot.state.bri>0?'on':'off';
  const description={on:'Включена',off:'Подсветка выключена',offline:'Нет связи',connecting:'Подключение'}[state];
  const host=entry.device.address.replace(/^https?:\/\//,'').split('/')[0].split(':')[0];
  const duplicate=entries.filter(e=>e.device.name===entry.device.name).length>1;
  const suffix=/^\d+\.\d+\.\d+\.\d+$/.test(host)?host.split('.').at(-1):host;
  return <span className="device-status" data-state={state} key={entry.device.id} title={`${entry.device.name} · ${entry.device.address}: ${description}`} aria-label={`${entry.device.name}: ${description}`}><Icon kind="lamp"/><i aria-hidden="true"/><span>{entry.device.name}{duplicate?` · ${suffix}`:''}</span></span>;
 })}</span>;
}
