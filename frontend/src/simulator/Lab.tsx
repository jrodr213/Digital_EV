import {useEffect,useState} from 'react';
import {ArrowUpRight,CheckCircle2,Clock3,FlaskConical,LoaderCircle,Play,RotateCcw,Upload} from 'lucide-react';
import {api,fmt} from '../api';
import type {Vehicle,Result,Assembly} from '../types';
import {Alert,Busy,Field,Messages,Metric,Panel,StatusPill} from '../components/ui';
import {DemoAssumptions} from './DemoAssumptions';

export function Lab({vehicles,cycles,selected,onSelect,onResult,reload,runs,onOpenResult,onBusy}:{vehicles:Vehicle[];cycles:{id:string;name:string}[];selected:string;onSelect:(id:string)=>void;onResult:(r:Result)=>void;reload:()=>Promise<void>;runs:Result[];onOpenResult:(id:string)=>void;onBusy:(busy:boolean)=>void}){
 const vehicle=selected;
 const [cycle,setCycle]=useState('udds'),[test,setTest]=useState('cycle'),[payload,setPayload]=useState('0'),[grade,setGrade]=useState('5'),[speed,setSpeed]=useState('30'),[duration,setDuration]=useState('120'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[importStatus,setImportStatus]=useState('');
 const [demo,setDemo]=useState(false),[previewError,setPreviewError]=useState('');
 const [preview,setPreview]=useState<{vehicle:string;demo:boolean;assembly:Assembly}>();
 const readiness=preview?.vehicle===vehicle&&preview.demo===demo?preview.assembly:undefined;
 const latest=[...runs].reverse().find(run=>run.request.vehicle_id===vehicle);
 useEffect(()=>{
  setPreview(undefined);setPreviewError('');setError('');let active=true;
  if(vehicle)api<Assembly>('/runs/preview',{vehicle_id:vehicle,demo_mode:demo}).then(assembly=>{if(active)setPreview({vehicle,demo,assembly})}).catch(e=>{if(active)setPreviewError(String(e))});
  return()=>{active=false};
 },[vehicle,vehicles,demo]);
 function reset(){setCycle('udds');setTest('cycle');setPayload('0');setGrade('5');setSpeed('30');setDuration('120');setDemo(false);setError('');setImportStatus('')}
 async function run(){
  setBusy(true);onBusy(true);setError('');
  try{onResult(await api<Result>('/runs',{vehicle_id:vehicle,demo_mode:demo,cycle,test,extra_payload_kg:Number(payload),grade:Number(grade)/100,target_mph:Number(speed),duration_s:Number(duration)}))}
  catch(e){setError(String(e))}finally{setBusy(false);onBusy(false)}
 }
 const blocked=!!readiness?.errors.length;
 return <div className="simulation-layout">
  <div><Panel title="Test setup" description="Configure the conditions for this saved vehicle."><form className="padded" onSubmit={e=>{e.preventDefault();void run()}}><fieldset disabled={busy}>
   <Field label="Vehicle design"><select value={vehicle} onChange={e=>onSelect(e.target.value)}>{vehicles.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
   <label className="mode-switch"><input type="checkbox" aria-label="Demo mode — fill missing inputs" checked={demo} onChange={e=>{setDemo(e.target.checked);setCycle(e.target.checked?'demo-cart':'udds')}}/><span><strong>Demo mode — fill missing inputs</strong><small>Use temporary, visible assumptions without changing saved specifications.</small></span></label>
   <div className="test-types" aria-label="Test type">{[['cycle','Drive cycle'],['acceleration','Acceleration'],['hill','Hill climbing'],['load','Load testing']].map(([key,label])=><button type="button" key={key} className={test===key?'active':''} aria-pressed={test===key} onClick={()=>setTest(key)}>{label}</button>)}</div>
   {(test==='cycle'||test==='load')&&<Field label="Driving cycle" hint={cycle==='demo-cart'?'Gentle 0–10 mph trace for provisional low-power builds.':'The requested speed trace may exceed the vehicle’s capabilities.'}><select value={cycle} onChange={e=>setCycle(e.target.value)}>{cycles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
   <div className="form-grid"><Field label="Additional passenger / cargo mass / kg" hint="Added to the payload already saved with this vehicle."><input required type="number" step="any" min="0" max="5000" value={payload} onChange={e=>setPayload(e.target.value)}/></Field>
    {test==='hill'&&<><Field label="Road grade / %" hint="Positive values are uphill."><input required type="number" step="any" min="-50" max="50" value={grade} onChange={e=>setGrade(e.target.value)}/></Field><Field label="Target speed / mph"><input required type="number" step="any" min=".1" max="150" value={speed} onChange={e=>setSpeed(e.target.value)}/></Field></>}
    {['hill','acceleration'].includes(test)&&<Field label="Duration / s" hint="Between 10 and 3,600 seconds."><input required type="number" min="10" max="3600" step="1" value={duration} onChange={e=>setDuration(e.target.value)}/></Field>}
   </div>
   {error&&<Alert tone="error" title="Simulation failed">{error}</Alert>}
   <div className="simulation-controls"><button className="primary" type="submit" disabled={busy||!vehicle||!readiness||blocked}>{busy?<><LoaderCircle size={16} className="spin"/>Running FASTSim…</>:<><Play size={15}/>{demo?'Run demo simulation':'Run simulation'}</>}</button><button type="button" title="Restore the default test parameters" onClick={reset}><RotateCcw size={15}/>Reset</button></div>
   {busy&&<p className="workspace-note" role="status">Computing the recorded test. Live progress and cancellation are unavailable for this run.</p>}
  </fieldset></form></Panel>
  <Panel><details className="padded"><summary>Import a custom drive cycle</summary><p className="muted">CSV columns: time_s, speed_mps, grade. Time starts at zero and increases; grade is a decimal fraction.</p><label className="button"><Upload size={15}/>Upload cycle CSV<input disabled={busy} hidden type="file" accept=".csv" aria-label="Upload cycle CSV" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const form=new FormData();form.append('file',file);const saved=await api<{id:string}>('/cycles/import',form);await reload();setCycle(saved.id);setImportStatus('Cycle imported and selected.');setError('')}catch(e){setError(String(e))}e.target.value=''}}/></label>{importStatus&&<p className="status" role="status">{importStatus}</p>}</details></Panel></div>
  <div className="simulation-output"><Panel><div className="simulation-state">{busy?<LoaderCircle size={24} className="spin"/>:blocked?<FlaskConical size={24}/>:<CheckCircle2 size={24}/>}<div><h3>{busy?'Simulation running':previewError?'Preview unavailable':!readiness?'Checking model inputs':blocked?'Inputs need attention':'Ready to run'}</h3><p>{busy?'Results will open when the calculation finishes.':blocked?'Complete the required inputs or enable Demo mode.':demo?'Temporary demo assumptions are included.':'Standard simulation uses saved specifications.'}</p></div></div><div className="padded">
   {previewError?<Alert tone="error">{previewError}</Alert>:!readiness?<Busy>Validating the selected vehicle…</Busy>:<>
    <div className="metrics"><Metric label="Model mass" value={readiness.mass_kg} unit="kg" detail={demo?'Includes demo assumptions':'Saved components + payload'}/><Metric label="Nominal pack" value={readiness.nominal_energy_kwh==null?null:readiness.nominal_energy_kwh*1000} unit="Wh" detail={readiness.nominal_voltage_v==null?'Pack inputs incomplete':fmt(readiness.nominal_voltage_v)+' V nominal'}/></div>
    {blocked?<><Alert tone="warning" title={`${demo?'Demo needs attention':'Simulation unavailable'}: ${readiness.errors.length} input issues.`}>Review the missing inputs below. Demo mode can fill unknown values, but conflicting specifications still need correction.</Alert><details><summary>Show input issues</summary><Messages errors={readiness.errors}/></details></>:<StatusPill tone="success">Model inputs accepted</StatusPill>}
    {demo&&<div className="draft-banner"><b>Demo estimate using your selected parts</b><p>{fmt(readiness.nominal_voltage_v)} V / {fmt(readiness.nominal_energy_kwh==null?null:readiness.nominal_energy_kwh*1000,0)} Wh</p><p>Listed ratings, inferred gearing, charge limits and regen may be assumptions. Structural and electrical hardware validation are separate.</p><DemoAssumptions items={readiness.demo_assumptions??[]}/></div>}
    {readiness.warnings.length>0&&<details><summary>Model notes ({readiness.warnings.length})</summary><Messages warnings={readiness.warnings}/></details>}
   </>}
  </div></Panel>
  <Panel title="Latest recorded test"><div className="padded">{latest?<><div className="run-context"><span><Clock3 size={14}/>{new Date(latest.created_at).toLocaleDateString()}</span><span>{String(latest.request.cycle).toUpperCase()}</span></div><h3>{latest.request.demo_mode?'Demo estimate':'Saved simulation'}</h3><dl><div><dt>Projected range</dt><dd>{fmt(latest.summary.range_miles)} mi</dd></div><div><dt>Cycle energy</dt><dd>{fmt(latest.summary.wh_per_mile)} Wh/mi</dd></div></dl><button className="text-link" onClick={()=>onOpenResult(latest.id)} disabled={busy}>Open recorded results <ArrowUpRight size={14}/></button></>:<><p className="muted">No completed test for this configuration. A successful run will save its inputs, trace and results here.</p><StatusPill>No recorded output</StatusPill></>}</div></Panel>
  <Panel><details className="padded"><summary>What this model measures</summary><p className="muted">FASTSim calculates longitudinal speed, power flow, battery state of charge and energy use. Torque, gearing, RPM and steady-speed constraints are separate analytical estimates. Range extrapolates the selected cycle; it is conditional on component feasibility.</p><p className="muted">No structural, handling, thermal or mechanical-braking validation is performed. Review limitations and assumptions with each result.</p></details></Panel>
  </div>
 </div>;
}
