import {useEffect,useState} from 'react';
import type {Part,Vehicle,Assembly} from '../types';
import {api,fmt} from '../api';
import {Field,Messages,Metric} from '../components/ui';

export const emptyVehicle:Vehicle={name:'Untitled vehicle',component_ids:[],payload_kg:null,auxiliary_w:null,notes:''};
const coreCategories=['battery','motor','inverter','drivetrain','chassis','tires'];
export function Builder({parts,vehicles,onSave}:{parts:Part[];vehicles:Vehicle[];onSave:()=>void}){
 const [draft,setDraft]=useState<Vehicle>(vehicles.find(v=>v.custom_parameters?.preferred_draft)??vehicles[0]??emptyVehicle);
 const [assembly,setAssembly]=useState<Assembly>(),[status,setStatus]=useState('');
 useEffect(()=>{
  let active=true;
  api<Assembly>('/vehicles/validate',draft).then(a=>{if(active)setAssembly(a)}).catch(e=>{if(active)setStatus(e.message)});
  return()=>{active=false};
 },[draft]);
 function set(key:string,value:any){setDraft({...draft,[key]:value});setStatus('')}
 const categories=[...new Set(parts.map(p=>p.category))];
 return <>
  <div className="toolbar"><select aria-label="Load design" value={draft.id??''} onChange={e=>setDraft(vehicles.find(v=>v.id===e.target.value)??emptyVehicle)}><option value="">New vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select><button onClick={()=>setDraft({...draft,id:undefined,name:draft.name+' / copy'})}>Duplicate design</button><button className="primary" onClick={async()=>{try{const v=await api<Vehicle>('/vehicles',draft);setDraft(v);setStatus('Design saved.');onSave()}catch(e){setStatus(String(e))}}}>Save design</button></div>
  {status&&<p role="status">{status}</p>}
  {draft.custom_parameters?.document_project&&<p className="draft-banner">Document-sourced draft. Missing values stay unknown; performance simulation requires complete inputs.</p>}
  <div className="metrics"><Metric label="Assembly mass" value={assembly?.mass_kg} unit="kg" detail={assembly?.mass_complete===false?'Unknown until all installed masses and payload are supplied':'Parts + passenger / cargo'}/><Metric label="Usable pack energy" value={assembly?.usable_energy_kwh} unit="kWh" detail="Cell configuration × usable fraction"/><Metric label="Nominal bus voltage" value={assembly?.nominal_voltage_v} unit="V" detail="Series cells × nominal cell voltage"/><Metric label="Continuous system limit" value={assembly?.mechanical_power_kw} unit="kW" detail="Motor, inverter and battery constrained"/></div>
  <div className="two-col"><section className="panel padded"><h3>Vehicle definition</h3><Field label="Design name"><input value={draft.name} onChange={e=>set('name',e.target.value)}/></Field><div className="form-grid"><Field label="Passenger + cargo / kg"><input type="number" min="0" placeholder="Unknown" value={draft.payload_kg??''} onChange={e=>set('payload_kg',e.target.value===''?null:+e.target.value)}/></Field><Field label="Auxiliary load / W"><input type="number" min="0" placeholder="Unknown" value={draft.auxiliary_w??''} onChange={e=>set('auxiliary_w',e.target.value===''?null:+e.target.value)}/></Field></div><Field label="Engineering notes"><textarea value={draft.notes} onChange={e=>set('notes',e.target.value)}/></Field><h3>Component assemblies</h3><p className="muted">Select one complete assembly per core system. Other systems may contain several installed parts. Procurement spares and off-vehicle items stay in the project purchase plan.</p>
   {categories.map(category=>coreCategories.includes(category)?<Field key={category} label={category.replaceAll('_',' ')}><select value={draft.component_ids.find(id=>parts.find(p=>p.id===id)?.category===category)??''} onChange={e=>{const ids=draft.component_ids.filter(id=>parts.find(p=>p.id===id)?.category!==category);set('component_ids',e.target.value?[...ids,e.target.value]:ids)}}><option value="">Not installed</option>{parts.filter(p=>p.category===category).map(p=><option key={p.id} value={p.id}>{p.name} · {p.mass_kg==null?'mass unknown':fmt(p.mass_kg)+' kg'}</option>)}</select></Field>:<details className="component-checklist" key={category} open={parts.some(p=>p.category===category&&draft.component_ids.includes(p.id!))}><summary>{category.replaceAll('_',' ')}</summary>{parts.filter(p=>p.category===category).map(p=><label className="check" key={p.id}><input type="checkbox" checked={draft.component_ids.includes(p.id!)} onChange={e=>set('component_ids',e.target.checked?[...draft.component_ids,p.id!]:draft.component_ids.filter(id=>id!==p.id))}/><span>{p.name}<small>{p.mass_kg==null?'Installed mass unknown':fmt(p.mass_kg)+' kg'}</small></span></label>)}</details>)}
  </section><section className="panel padded"><h3>Compatibility & model readiness</h3><span className={'badge '+(assembly?.errors.length?'amber':'green')}>{assembly?.errors.length??0} blocking issues</span><Messages errors={assembly?.errors} warnings={assembly?.warnings}/></section></div>
 </>
}
