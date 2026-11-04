import {useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,Copy,Save} from 'lucide-react';
import type {Part,Vehicle,Assembly} from '../types';
import {api,fmt} from '../api';
import {Alert,Busy,Field,Messages,Metric,Panel,StatusPill} from '../components/ui';

export const emptyVehicle:Vehicle={name:'Untitled vehicle',component_ids:[],payload_kg:null,auxiliary_w:null,notes:''};
const sessionDrafts=new Map<string,Vehicle>();
const coreCategories=['battery','motor','inverter','drivetrain','chassis','tires'];
const groups=[
 {id:'definition',name:'Vehicle',description:'Define the vehicle and its operating load.',categories:[]},
 {id:'powertrain',name:'Powertrain',description:'Select the complete battery, motor, controller and drive assemblies.',categories:['motor','battery','inverter','drivetrain','motor_mounts','drive_chain','rear_sprockets','motor_sprockets','chain_protection']},
 {id:'chassis',name:'Chassis & wheels',description:'Configure the frame, wheels, suspension and braking assemblies.',categories:['chassis','tires','suspension','brakes']},
 {id:'controls',name:'Controls & sensors',description:'Review steering, driver inputs and onboard sensing.',categories:['steering','throttle_control','sensors','vision','embedded_controllers','signal_interface','safety_controls']},
 {id:'additional',name:'Other systems',description:'Auxiliary power, cooling and additional installed hardware.',categories:[]},
];
const names:Record<string,string>={motor:'Traction motor',inverter:'Motor controller / power stage',battery:'Battery pack',drivetrain:'Drivetrain',chassis:'Frame & dimensions',tires:'Wheels & tires',motor_mounts:'Motor mounts',sensors:'Sensors',embedded_controllers:'Embedded controllers'};
export function Builder({parts,vehicles,selected,onSelect,onSave,onLibrary}:{parts:Part[];vehicles:Vehicle[];selected:string;onSelect:(id:string)=>void;onSave:(id:string)=>Promise<void>;onLibrary:(id?:string)=>void}){
 const [draft,setDraft]=useState<Vehicle>(()=>sessionDrafts.get(selected)??vehicles.find(v=>v.id===selected)??emptyVehicle);
 const [assembly,setAssembly]=useState<Assembly>(),[status,setStatus]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false),[tab,setTab]=useState('definition');
 const baseline=vehicles.find(v=>v.id===draft.id),dirty=JSON.stringify(draft)!==JSON.stringify(baseline??emptyVehicle);
 const installed=useMemo(()=>parts.filter(p=>draft.component_ids.includes(p.id!)),[parts,draft.component_ids]);
 useEffect(()=>{
  setAssembly(undefined);let active=true;
  const timer=setTimeout(()=>{if(!draft.name.trim())return;api<Assembly>('/vehicles/validate',draft).then(a=>{if(active)setAssembly(a)}).catch(e=>{if(active)setError(String(e))})},180);
  return()=>{active=false;clearTimeout(timer)};
 },[draft,parts]);
 function set<K extends keyof Vehicle>(key:K,value:Vehicle[K]){setDraft({...draft,[key]:value});setStatus('');setError('')}
 async function save(){setSaving(true);setStatus('');setError('');try{if(!draft.name.trim())throw Error('A design name is required.');if([draft.payload_kg,draft.auxiliary_w].some(value=>value!=null&&(!Number.isFinite(value)||value<0)))throw Error('Payload and auxiliary load must be nonnegative numbers or left blank.');const saved=await api<Vehicle>('/vehicles',draft);setDraft(saved);await onSave(saved.id!);sessionDrafts.delete(selected);setStatus('Configuration saved. Future simulations will use these inputs.')}catch(e){setError(String(e))}finally{setSaving(false)}}
 function duplicate(){setDraft({...draft,id:undefined,name:(draft.name+' / copy').slice(0,160),custom_parameters:{...draft.custom_parameters,preferred_draft:false,selection_featured:false,selection_title:undefined}});setStatus('Copy created. Save to add it to your garage.')}
 useEffect(()=>{sessionDrafts.set(selected,draft)},[selected,draft]);
 const categories=[...new Set(parts.map(p=>p.category))],group=groups.find(g=>g.id===tab)!;
 const visibleCategories=tab==='additional'?categories.filter(category=>!groups.some(g=>g.categories.includes(category))):group.categories.filter(category=>categories.includes(category));
 function choice(category:string){
  const chosen=installed.find(p=>p.category===category);
  return <div className="component-choice" key={category}><Field label={names[category]??category.replaceAll('_',' ')}><select value={chosen?.id??''} onChange={e=>{const ids=draft.component_ids.filter(id=>parts.find(p=>p.id===id)?.category!==category);set('component_ids',e.target.value?[...ids,e.target.value]:ids)}}><option value="">Not installed</option>{parts.filter(p=>p.category===category).map(part=><option key={part.id} value={part.id}>{part.name}</option>)}</select></Field>{chosen&&<div className="component-choice-info"><div className="component-facts"><span>Assembly mass <b>{chosen.mass_kg==null?'unknown':fmt(chosen.mass_kg)+' kg'}</b></span><span>Quantity <b>{chosen.custom_parameters.installed_quantity??'not supplied'}</b></span>{['wheelbase_m','wheel_diameter_m','gear_ratio','rated_power_kw','listed_capacity_ah'].filter(key=>chosen.specs[key]!=null).map(key=><span key={key}>{key.replaceAll('_',' ')} <b>{fmt(chosen.specs[key])} {chosen.units[key]}</b></span>)}</div><button type="button" className="text-link" onClick={()=>onLibrary(chosen.id)}>Edit component specifications <ArrowUpRight size={13}/></button></div>}</div>;
 }
 return <>
  <div className="toolbar"><select aria-label="Load design" value={draft.id??''} disabled={saving} onChange={e=>{setDraft(vehicles.find(v=>v.id===e.target.value)??emptyVehicle);setStatus('');onSelect(e.target.value)}}><option value="">New vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select><button onClick={duplicate} disabled={saving}><Copy size={15}/>Duplicate design</button><span className="push-right"><StatusPill tone={dirty?'warning':'neutral'}>{dirty?'Unsaved changes':'Saved configuration'}</StatusPill></span><button className="primary" type="submit" form="vehicle-definition" disabled={saving}>{saving?<Busy>Saving…</Busy>:<><Save size={15}/>Save design</>}</button></div>
  {status&&<Alert tone="success">{status}</Alert>}{error&&<Alert tone="error" title="Could not update configuration">{error}</Alert>}
  <div className="configuration-layout"><form id="vehicle-definition" onSubmit={e=>{e.preventDefault();void save()}}>
   <Panel><div className="section-tabs" aria-label="Configuration sections">{groups.map(g=><button type="button" key={g.id} className={tab===g.id?'active':''} aria-pressed={tab===g.id} onClick={()=>setTab(g.id)}>{g.name}</button>)}</div><fieldset disabled={saving} className="field-group"><h3>{group.name==='Vehicle'?'Vehicle definition':group.name}</h3><p>{group.description}</p>
    {tab==='definition'?<>
     <Field label="Design name" hint="Use a name that makes this configuration easy to identify."><input required maxLength={160} value={draft.name} onChange={e=>set('name',e.target.value)}/></Field>
     <div className="form-grid"><Field label="Passenger + cargo / kg" hint="Enter zero for an unmanned vehicle; leave blank if unknown."><input type="number" step="any" min="0" placeholder="Unknown" value={draft.payload_kg??''} onChange={e=>set('payload_kg',e.target.value===''?null:+e.target.value)}/></Field><Field label="Auxiliary load / W" hint="Power used by controls, sensors and other auxiliary systems."><input type="number" step="any" min="0" placeholder="Unknown" value={draft.auxiliary_w??''} onChange={e=>set('auxiliary_w',e.target.value===''?null:+e.target.value)}/></Field></div>
     <Field label="Engineering notes"><textarea rows={5} value={draft.notes} onChange={e=>set('notes',e.target.value)}/></Field>
     <Alert title="Mass is calculated from the assembly">Total vehicle mass is the sum of installed component masses and passenger/cargo load. Enter component masses in their specification records.</Alert>
    </>:<>
     {visibleCategories.map(category=>coreCategories.includes(category)?choice(category):<details className="component-checklist" key={category} open={installed.some(p=>p.category===category)}><summary>{names[category]??category.replaceAll('_',' ')} <span className="muted">· {installed.filter(p=>p.category===category).length} selected</span></summary>{parts.filter(p=>p.category===category).map(part=><label className="check" key={part.id}><input type="checkbox" checked={draft.component_ids.includes(part.id!)} onChange={e=>set('component_ids',e.target.checked?[...draft.component_ids,part.id!]:draft.component_ids.filter(id=>id!==part.id))}/><span>{part.name}<small>{part.mass_kg==null?'Installed mass unknown':fmt(part.mass_kg)+' kg'}</small></span></label>)}</details>)}
     {tab==='chassis'&&<p className="workspace-note">Wheel dimensions and vehicle geometry belong to the selected drivetrain, chassis and tire records. Use “Edit component specifications” to review their values and units.</p>}
    </>}
   </fieldset></Panel>
  </form><aside className="configuration-rail"><Panel title="Assembly summary"><div className="metrics"><Metric label="Total mass" value={assembly?.mass_kg} unit="kg" detail={assembly?.mass_complete?'Includes payload':'Missing mass inputs'}/><Metric label="Usable energy" value={assembly?.usable_energy_kwh} unit="kWh" detail="Validated pack inputs"/><Metric label="Bus voltage" value={assembly?.nominal_voltage_v} unit="V" detail="Nominal pack"/><Metric label="System limit" value={assembly?.mechanical_power_kw} unit="kW" detail="Continuous output"/></div><div className="padded"><p className="muted">{installed.length} installed component groups. Unknown values remain blank and do not become assumed engineering ratings.</p></div></Panel>
   <Panel title="Model readiness"><div className="padded">{!assembly?<Busy>Checking configuration…</Busy>:<><StatusPill tone={assembly.errors.length?'warning':'success'}>{assembly.errors.length?assembly.errors.length+' inputs to review':'Ready for simulation'}</StatusPill><Messages errors={assembly.errors.slice(0,3)}/>{assembly.errors.length>3&&<details><summary>View all {assembly.errors.length} input issues</summary><Messages errors={assembly.errors.slice(3)}/></details>}{assembly.warnings.length>0&&<details><summary>Model notes ({assembly.warnings.length})</summary><Messages warnings={assembly.warnings}/></details>}</>}</div></Panel></aside></div>
 </>;
}
