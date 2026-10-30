import {useEffect,useState} from 'react';
import {Play,Upload} from 'lucide-react';
import {api,fmt} from '../api';
import type {Vehicle,Result,Assembly} from '../types';
import {Field,Messages} from '../components/ui';
import {DemoAssumptions} from './DemoAssumptions';

export function Lab({vehicles,cycles,onResult,reload}:{vehicles:Vehicle[];cycles:{id:string;name:string}[];onResult:(r:Result)=>void;reload:()=>void}){
 const [vehicle,setVehicle]=useState(vehicles.find(v=>v.custom_parameters?.preferred_draft)?.id??vehicles[0]?.id??'');
 const [cycle,setCycle]=useState('udds'),[test,setTest]=useState('cycle'),[payload,setPayload]=useState(0),[grade,setGrade]=useState(5),[speed,setSpeed]=useState(30),[duration,setDuration]=useState(120),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [demo,setDemo]=useState(false);
 const [preview,setPreview]=useState<{vehicle:string;demo:boolean;assembly:Assembly}>();
 const readiness=preview?.vehicle===vehicle&&preview.demo===demo?preview.assembly:undefined;

 useEffect(()=>{
  setPreview(undefined);setError('');let active=true;
  if(vehicle)api<Assembly>('/runs/preview',{vehicle_id:vehicle,demo_mode:demo})
   .then(assembly=>{if(active)setPreview({vehicle,demo,assembly})})
   .catch(e=>{if(active)setError(String(e))});
  return()=>{active=false};
 },[vehicle,vehicles,demo]);

 async function run(){
  setBusy(true);setError('');
  try{onResult(await api<Result>('/runs',{vehicle_id:vehicle,demo_mode:demo,cycle,test,extra_payload_kg:payload,grade:grade/100,target_mph:speed,duration_s:duration}))}
  catch(e){setError(String(e))}finally{setBusy(false)}
 }

 return <div className="two-col">
  <section className="panel padded">
   <h3>Configure a test</h3>
   <p className="muted">Test a saved assembly, or try Demo mode while required specifications are still missing.</p>
   <Field label="Vehicle design"><select disabled={busy} value={vehicle} onChange={e=>setVehicle(e.target.value)}>{vehicles.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
   <label className="check"><input type="checkbox" checked={demo} disabled={busy} onChange={e=>{setDemo(e.target.checked);if(e.target.checked)setCycle('demo-cart');else if(cycle==='demo-cart')setCycle('udds')}}/>Demo mode — fill missing inputs</label>
   {demo&&<div className="draft-banner" role="status">
    <b>Demo estimate using your selected parts</b>
    <p>Missing values use demo assumptions. Existing specifications stay in use, and your saved build is unchanged. Listing claims are unverified.</p>
    <p>Regen and charge limits may be assumed for this model. Frame strength, joints, steering, braking and custom circuitry are outside this simulation.</p>
    <p>Demo mode starts with a gentle 0–10 mph cycle. Standard road cycles can exceed this low-power model's solver limits.</p>
    {readiness&&<>
     <dl className="demo-metrics"><div><dt>Mass including base payload</dt><dd>{fmt(readiness.mass_kg)} kg</dd></div><div><dt>Nominal battery</dt><dd>{fmt(readiness.nominal_voltage_v)} V / {fmt(readiness.nominal_energy_kwh==null?null:readiness.nominal_energy_kwh*1000)} Wh</dd></div><div><dt>Usable battery</dt><dd>{fmt(readiness.usable_energy_kwh==null?null:readiness.usable_energy_kwh*1000)} Wh</dd></div><div><dt>Continuous mechanical power</dt><dd>{fmt(readiness.mechanical_power_kw,3)} kW</dd></div></dl>
     <p>The test's additional passenger / cargo mass is added to the base mass above.</p>
     <DemoAssumptions items={readiness.demo_assumptions??[]}/>
    </>}
   </div>}
   <div className="test-types">{[['cycle','Drive cycle'],['acceleration','Acceleration'],['hill','Hill climbing'],['load','Load testing']].map(([key,label])=><button key={key} className={test===key?'active':''} onClick={()=>setTest(key)}>{label}</button>)}</div>
   {(test==='cycle'||test==='load')&&<Field label="Driving cycle"><select value={cycle} onChange={e=>setCycle(e.target.value)}>{cycles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
   <div className="form-grid">
    <Field label="Additional passenger / cargo mass / kg"><input type="number" min="0" value={payload} onChange={e=>setPayload(+e.target.value)}/></Field>
    {test==='hill'&&<><Field label="Road grade / %"><input type="number" value={grade} onChange={e=>setGrade(+e.target.value)}/></Field><Field label="Target speed / mph"><input type="number" value={speed} onChange={e=>setSpeed(+e.target.value)}/></Field></>}
    {['hill','acceleration'].includes(test)&&<Field label="Duration / s"><input type="number" min="10" max="3600" value={duration} onChange={e=>setDuration(+e.target.value)}/></Field>}
   </div>
   {readiness?.errors.length?<div className="draft-banner">
    <b>{demo?'Demo needs attention':'Simulation unavailable'}: {readiness.errors.length} input issues.</b>
    <p>{demo?'Review the issues below. Demo mode fills missing values; conflicting specifications and unsupported assemblies still need correction.':'Turn on Demo mode to try your current parts with estimated inputs, or enter the required specifications in Vehicle Builder.'}</p>
    <details><summary>Show input issues</summary><Messages errors={readiness.errors}/></details>
   </div>:null}
   <button className="primary wide" disabled={busy||!vehicle||!readiness||!!readiness.errors.length} onClick={run}><Play size={17}/>{busy?'Running FASTSim…':demo?'Run demo simulation':'Run simulation'}</button>
   {error&&<pre role="alert" className="error-box">{error}</pre>}
  </section>
  <section className="panel padded">
   <span className="eyebrow">MODEL CONTRACT</span><h3>Know what your test measures.</h3>
   <p>FASTSim simulates longitudinal power flow, achieved speed, battery SOC, and energy use. A requested trace can exceed your design’s capabilities.</p>
   <div className="note"><b>Acceleration & top speed</b><p>Torque, RPM, gearing and road-load estimates are computed by a separate quasi-static extension. The FASTSim acceleration trace is power limited and may violate these component limits.</p></div>
   <div className="note"><b>Range extrapolation</b><p>Usable battery energy divided by measured cycle energy per mile. This assumes repeating those conditions; temperature, aging and voltage sag are excluded.</p></div>
   <h3>Custom drive cycle</h3><p className="muted">CSV columns: time_s, speed_mps, grade. Grade is a decimal fraction. Time starts at zero and strictly increases.</p>
   <label className="button"><Upload size={16}/> Upload cycle CSV<input hidden type="file" accept=".csv" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const form=new FormData();form.append('file',file);const c=await api('/cycles/import',form);reload();setCycle(c.id);setError('Cycle imported.')}catch(e){setError(String(e))}e.target.value=''}}/></label>
  </section>
 </div>
}
