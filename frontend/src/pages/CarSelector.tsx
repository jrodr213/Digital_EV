import {useState} from 'react';
import {ArrowRight,Zap} from 'lucide-react';
import type {Part,Vehicle} from '../types';
import {fmt} from '../api';
import {vehicleFacts} from '../vehicleFacts';
import {Skeleton} from '../components/ui';
import './carSelector.css';

export function CarSelector({vehicles,parts,loading,error,onChoose,onRetry,onCreate}:{vehicles:Vehicle[];parts:Part[];loading:boolean;error:string;onChoose:(id:string)=>void;onRetry:()=>void;onCreate:()=>void}){
 const [selectedId,setSelectedId]=useState('');
 const ordered=[...vehicles].sort((a,b)=>Number(!!b.custom_parameters?.selection_featured)-Number(!!a.custom_parameters?.selection_featured)||Number(!!b.custom_parameters?.preferred_draft)-Number(!!a.custom_parameters?.preferred_draft));
 const selected=ordered.find(vehicle=>vehicle.id===selectedId);
 const installed=parts.filter(part=>selected?.component_ids.includes(part.id!));
 const {motor,motorCount:count,voltage,capacity,energyWh:energy,driveLabel}=vehicleFacts(installed);
 const watts=motor?.specs.listed_power_per_motor_w??motor?.specs.listed_power_w;
 const title=(vehicle:Vehicle)=>vehicle.custom_parameters?.selection_title??(vehicle.id==='team-ev-belt'?'Original two-motor car':vehicle.name);
 return <main className="car-selector">
  <div className="car-selector-brand"><Zap size={23}/><strong>EV / TWIN</strong><span>LOCAL WORKSPACE</span></div>
  <div className="car-selector-intro"><span className="eyebrow">YOUR GARAGE</span><h1>Choose your car.</h1><p>Open a saved setup to explore its parts, edit the build, or run a simulation.</p></div>
  {error&&<div className="error-box" role="alert">{error}<button onClick={onRetry}>Reconnect</button></div>}
  {loading?<div className="garage-loading"><Skeleton rows={3} label="Loading your cars"/></div>:ordered.length>0&&<form className="garage-picker" onSubmit={event=>{event.preventDefault();if(selected)onChoose(selected.id!)}}>
   <label htmlFor="garage-vehicle">Choose a car</label>
   <div className="garage-picker-controls"><select id="garage-vehicle" required value={selected?.id??''} onChange={event=>setSelectedId(event.target.value)}><option value="" disabled>Select a car…</option>{ordered.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{title(vehicle)}</option>)}</select><button className="primary" type="submit" disabled={!selected}>Open car<ArrowRight size={17}/></button></div>
   {selected&&<div className="garage-selection" data-vehicle-id={selected.id}><p>{selected.name}</p><dl><div><dt>Motors</dt><dd>{count?`${count} motor${count===1?'':'s'}`:'Not selected'}{watts!=null?` · ${fmt(watts,0)} W each (listed)`:motor?.specs.rated_power_kw!=null?` · ${fmt(motor.specs.rated_power_kw)} kW total`:''}</dd></div><div><dt>Battery</dt><dd>{voltage!=null?`${fmt(voltage,0)} V`:'Voltage unknown'} · {capacity!=null?`${fmt(capacity)} Ah`:'Capacity unknown'}{energy!=null?` · ${fmt(energy,0)} Wh`:''}</dd></div><div><dt>Drive layout</dt><dd>{driveLabel}</dd></div></dl></div>}
  </form>}
  {!loading&&!error&&vehicles.length===0&&<div className="panel padded"><p>No saved cars yet.</p><button className="primary" onClick={onCreate}>Create a car</button></div>}
  <p className="car-selector-footnote">Your selection follows you into the builder, viewer and Simulation Lab. Switch cars at any time.</p>
 </main>;
}
