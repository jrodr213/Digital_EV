import {useEffect,useMemo,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {ArrowLeft,ArrowUpRight,Battery,CircleDot,Cog,Cpu,ExternalLink,Gauge,Info,Layers,Maximize2,ScanLine,SquareStack} from 'lucide-react';
import type {Part,Result} from '../types';
import {fmt} from '../api';
import {assemblyDefinitions,assemblyForPart,assemblyParts,partChildren,partLabel,visualParts} from './assemblyNavigation';
import type {AssemblyId} from './assemblyNavigation';
import {createVehicleScene} from './vehicleScene';
import type {SceneHit,SceneView,VehicleScene} from './vehicleScene';
import {describePart} from './partDescription';
import './vehicleExplorer.css';

const assemblyIcons={powertrain:Cog,battery:Battery,electronics:Cpu,frame:SquareStack,steering:Gauge,wheels:CircleDot,sensors:ScanLine};
const unitsToHide=['text','count','dimensionless','boolean'];
const readable=(key:string)=>key.replace(/^listed_/,'').replaceAll('_',' ');

export function VehicleViewer({parts,libraryParts=parts,result,compact=false}:{parts:Part[];libraryParts?:Part[];result?:Result;compact?:boolean}){
 const mount=useRef<HTMLDivElement>(null),sidebar=useRef<HTMLElement>(null),scene=useRef<VehicleScene|null>(null),speed=useRef(0);
 const [activeAssembly,setActiveAssembly]=useState<AssemblyId|null>(null),[trail,setTrail]=useState<string[]>([]),[exploded,setExploded]=useState(true);
 const [hover,setHover]=useState<{hit:SceneHit;x:number;y:number}|null>(null),[failure,setFailure]=useState('');
 const [playing,setPlaying]=useState(false),[cursor,setCursor]=useState(0);
 const all=useMemo(()=>visualParts(parts,libraryParts),[parts,libraryParts]);
 const byId=useMemo(()=>new Map(all.map(p=>[p.id??p.name,p])),[all]);
 const selected=trail.length?byId.get(trail[trail.length-1])??null:null;
 const definition=assemblyDefinitions.find(a=>a.id===activeAssembly);
 const available=assemblyDefinitions.filter(a=>assemblyParts(a.id,parts).length>0);
 const focusedParts=activeAssembly?assemblyParts(activeAssembly,parts):[];
 const children=selected?partChildren(selected,libraryParts):[];
 const samples=result?.samples??[];
 const title=selected?partLabel(selected):definition?.name??'Your EV, assembled.';
 const identity=parts.map(p=>p.id??p.name).sort().join('|');
 const view=useRef<SceneView>({assembly:null,part:null,exploded:true});view.current={assembly:activeAssembly,part:selected,exploded};

 function openAssembly(id:AssemblyId){setActiveAssembly(id);setTrail([]);setExploded(true);setHover(null)}
 function openPart(part:Part){const id=part.id??part.name;if(!activeAssembly)setActiveAssembly(assemblyForPart(part));setTrail(previous=>previous[previous.length-1]===id?previous:[...previous,id]);setHover(null)}
 function fullCar(){setActiveAssembly(null);setTrail([]);setHover(null)}
 function back(){if(trail.length)setTrail(previous=>previous.slice(0,-1));else fullCar();setHover(null)}
 const actions=useRef({pick:(hit:SceneHit)=>{},back:()=>{}});
 actions.current={pick:hit=>{if(!activeAssembly)openAssembly(hit.assembly);else if(hit.part)openPart(hit.part)},back};

 useEffect(()=>{fullCar();setPlaying(false);setCursor(0)},[identity]);
 useEffect(()=>{setPlaying(false);setCursor(0)},[result?.id]);
 useEffect(()=>{speed.current=(samples[cursor]?.speed_mph??0)*.44704},[cursor,samples]);
 useEffect(()=>{
  if(!playing||samples.length<2)return;
  const start=performance.now(),initial=samples[cursor]?.time_s??0;
  const timer=setInterval(()=>{const t=initial+(performance.now()-start)/1000,j=samples.findIndex(s=>s.time_s>=t);if(j<0){setPlaying(false);setCursor(samples.length-1)}else setCursor(j)},33);
  return()=>clearInterval(timer);
 },[playing,samples]);
 useEffect(()=>{
  const host=mount.current;if(!host)return;setFailure('');setHover(null);
  try{
   const controller=createVehicleScene(host,parts,all,{pick:hit=>actions.current.pick(hit),hover:(hit,x,y)=>setHover(hit?{hit,x,y}:null),speed:()=>speed.current});
   scene.current=controller;controller.setView(view.current);
   return()=>{controller.dispose();scene.current=null};
  }catch{setFailure('The 3D preview needs WebGL. You can still explore every assembly using the buttons below.');}
 },[parts,all]);
 useEffect(()=>{scene.current?.setView(view.current)},[activeAssembly,selected,exploded]);
 useEffect(()=>{if(sidebar.current)sidebar.current.scrollTop=0},[activeAssembly,selected]);
 useEffect(()=>{
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!['INPUT','TEXTAREA','SELECT'].includes((event.target as HTMLElement)?.tagName))actions.current.back()};
  window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
 },[]);

 const motor=parts.find(p=>p.category==='motor'),battery=parts.find(p=>p.category==='battery'),drive=parts.find(p=>p.category==='drivetrain');
 const motorQuantity=motor?.custom_parameters.installed_quantity??(motor?1:0);
 const voltage=battery?.specs.listed_nominal_voltage_v??(battery?.specs.cell_voltage_v!=null&&battery?.specs.series!=null?battery.specs.cell_voltage_v*battery.specs.series:null);
 const previousPart=trail.length>1?byId.get(trail[trail.length-2]):undefined;
 const backLabel=trail.length>1&&previousPart?partLabel(previousPart):trail.length?definition?.name:'full car';

 return <section className={`panel vehicle-explorer${compact?' is-compact':''}`} aria-label="Interactive vehicle explorer" data-view={selected?'component':activeAssembly?'assembly':'full'}>
  <div className="explorer-heading">
   <div><span className="explorer-eyebrow">EV / TWIN <i/> DESIGN EXPLORER</span><h2>{title}</h2><p>{selected?'A closer look at your selected component.':definition?.description??'Start with the whole car. Discover what makes it yours.'}</p></div>
   <span className="explorer-concept"><span/> {activeAssembly?'INSIDE THE BUILD':'FINISHED CONCEPT'}</span>
  </div>
  <div className="explorer-navigation">
   <div className="explorer-breadcrumb" aria-label="Vehicle navigation">
    {activeAssembly&&<button className="explorer-back" onClick={back} aria-label={`Back to ${backLabel}`}><ArrowLeft size={15}/><span>Back</span></button>}
    <button onClick={fullCar} aria-current={!activeAssembly?'page':undefined}>Full car</button>
    {definition&&<><span className="breadcrumb-separator">/</span><button onClick={()=>{setTrail([]);setHover(null)}} aria-current={!selected?'page':undefined}>{definition.name}</button></>}
    {trail.map((id,index)=>{const part=byId.get(id);return part&&<span className="explorer-crumb-part" key={id}><span className="breadcrumb-separator">/</span><button onClick={()=>{setTrail(previous=>previous.slice(0,index+1));setHover(null)}} aria-current={index===trail.length-1?'page':undefined}>{partLabel(part)}</button></span>})}
   </div>
   <div className="explorer-tools">
    {activeAssembly&&!selected&&<button aria-pressed={exploded} onClick={()=>setExploded(!exploded)} title="Separate the assembly parts"><Layers size={14}/><span>Exploded</span></button>}
    <button onClick={()=>scene.current?.fit()} aria-label="Fit model to view" title="Fit model to view"><Maximize2 size={15}/><span>Fit view</span></button>
   </div>
  </div>
  <div className={`explorer-workspace${activeAssembly?' is-focused':''}`}>
   <div className="explorer-stage">
    <div className="viewport explorer-viewport" ref={mount}>
     <div className="explorer-stage-label"><span>{selected?'COMPONENT STUDY':activeAssembly?'ASSEMBLY STUDY':'ELECTRIC / TEAM CONCEPT'}</span><small>{activeAssembly?'Drag to orbit. Click a component to inspect it.':'Click a panel, wheel or system to look inside.'}</small></div>
     {failure&&<div className="explorer-failure"><Info size={22}/><p>{failure}</p></div>}
     {hover&&!failure&&<div className="explorer-hover" role="tooltip" style={{left:Math.max(12,Math.min(hover.x+16,(mount.current?.clientWidth??300)-230)),top:Math.max(12,Math.min(hover.y+14,(mount.current?.clientHeight??400)-80))}}><span>{activeAssembly?'INSPECT COMPONENT':'LOOK INSIDE'}</span><strong>{activeAssembly&&hover.hit.part?partLabel(hover.hit.part):assemblyDefinitions.find(a=>a.id===hover.hit.assembly)?.name}<ArrowUpRight size={14}/></strong></div>}
     {!activeAssembly&&<div className="explorer-stage-footer"><b>EV—01</b><span>TEAM BUILD / CONCEPT BODYWORK</span><small>Drag to orbit · Scroll to zoom</small></div>}
    </div>
    {!activeAssembly&&<div className="explorer-spec-strip"><span><b>{motorQuantity}</b> {motorQuantity===1?'motor':'motors'}</span><span><b>{voltage==null?'—':fmt(voltage,0)}</b> V selected pack</span><span><b>{drive?.specs.drive_type==='direct'?'Direct · 2WD':drive?.specs.drive_type==='chain'?'Chain':drive?.specs.drive_type==='belt'?'Belt':'Rear'}</b> drive concept</span><span className="explorer-strip-note">Your parts. One possible finished form.</span></div>}
   </div>
   {activeAssembly&&<aside className="explorer-sidebar" ref={sidebar} aria-label="Assembly components">
    {selected?<>
     <span className="explorer-detail-kicker">{selected.custom_parameters.reference_only||selected.category==='chassis_material'?'REFERENCE DETAIL':'SAVED COMPONENT'}</span>
     <h3>{partLabel(selected)}</h3><p className="explorer-component-name">{selected.name}</p>
     <span className={`explorer-part-status${selected.custom_parameters.placeholder?' is-pending':''}`}>{selected.custom_parameters.placeholder?'Design details pending':selected.custom_parameters.reference_only?'Estimated bundle item':'Product / specifications to verify'}</span>
     <p className="explorer-component-role">{describePart(selected).role}</p>
     <dl className="explorer-part-facts">
      <div><dt>{selected.category==='chassis_material'?'Stock quantity':'Recorded quantity'}</dt><dd>{selected.custom_parameters.installed_quantity??selected.custom_parameters.purchase_quantity??'Unknown'}</dd></div>
      <div><dt>Installed mass</dt><dd>{selected.mass_kg==null?'Unknown':`${fmt(selected.mass_kg)} kg`}</dd></div>
      <div><dt>Recorded line amount</dt><dd>{selected.price==null?'Unknown':`${selected.custom_parameters.price_qualifier?'~':''}$${fmt(selected.price,2)}${selected.custom_parameters.price_qualifier?'+':''}`}</dd></div>
     </dl>
     {children.length>0&&<div className="explorer-child-parts"><h4>Inside this component <span>{children.length}</span></h4>{children.map(part=><button key={part.id??part.name} onClick={()=>openPart(part)}><SquareStack size={16}/><span><b>{part.category==='chassis_material'?part.name:partLabel(part)}</b><small>{part.category==='chassis_material'?'Material reference':'Explore subcomponent'}</small></span><ArrowUpRight size={14}/></button>)}</div>}
     {Object.entries(selected.specs).length>0&&<div className="explorer-recorded-specs"><h4>Recorded specifications</h4><dl>{Object.entries(selected.specs).filter(([,value])=>value!=null&&(typeof value!=='object'||Array.isArray(value))).map(([key,value])=><div key={key}><dt>{readable(key)}</dt><dd>{Array.isArray(value)?value.join(' / '):String(value)}{selected.units[key]&&!unitsToHide.includes(selected.units[key])?` ${selected.units[key]}`:''}</dd></div>)}</dl></div>}
     {selected.datasheet&&<a className="explorer-source" href={selected.datasheet} target="_blank" rel="noreferrer">Open supplied product reference <ExternalLink size={14}/></a>}
     {selected.custom_parameters.sensor_mounts&&<details className="explorer-detail-notes" open><summary>Estimated mounting locations</summary><ul>{selected.custom_parameters.sensor_mounts.map((site:any)=><li key={site.site}>{site.label}</li>)}</ul></details>}
     {selected.notes&&<details className="explorer-detail-notes"><summary>Notes & fit checks</summary><p>{selected.notes}</p></details>}
     <details className="explorer-detail-notes"><summary>Source record</summary><pre>{JSON.stringify({specifications:selected.specs,units:selected.units,source:selected.custom_parameters.source_references,status:selected.custom_parameters.part_status},null,2)}</pre></details>
    </>:<>
     <span className="explorer-detail-kicker">{definition?.eyebrow}</span><h3>{definition?.name}</h3><p className="explorer-component-role">{focusedParts.length} component groups in your saved build. Select one here or click its shape.</p>
     <div className="explorer-component-list">{focusedParts.map((part,index)=>{const nested=partChildren(part,libraryParts),mounts=part.custom_parameters.sensor_mounts;return <button className={mounts?'sensor-location':''} key={part.id??part.name} onClick={()=>openPart(part)} aria-label={`Inspect ${partLabel(part)}`}><span className="explorer-component-index">{String(index+1).padStart(2,'0')}</span><span><b>{partLabel(part)}</b><small>{nested.length?`${nested.length} subcomponents`:mounts?`${mounts.length} estimated ${mounts.length===1?'mount':'mounts'}`:part.custom_parameters.placeholder?'Design details pending':part.custom_parameters.installed_quantity?`Quantity ${part.custom_parameters.installed_quantity}`:'Saved component'}</small></span><ArrowUpRight size={14}/></button>})}</div>
     <p className="explorer-sidebar-note"><Info size={13}/> Shapes and spacing are illustrative. Review the source record for known and missing specifications.</p>
    </>}
   </aside>}
  </div>
  {!activeAssembly&&<div className="explorer-assemblies"><div className="explorer-assemblies-heading"><span>CHOOSE A SYSTEM TO EXPLORE</span><small>{parts.length} saved component groups</small></div><div className="explorer-assembly-grid">{available.map((assembly,index)=>{const Icon=assemblyIcons[assembly.id];return <button key={assembly.id} onClick={()=>openAssembly(assembly.id)} aria-label={`Explore ${assembly.name}`} style={{'--assembly-color':assembly.color} as CSSProperties}><div className="explorer-assembly-icon"><Icon size={19}/><span>{String(index+1).padStart(2,'0')}</span></div><div><b>{assembly.name}</b><small>{assemblyParts(assembly.id,parts).length} component groups</small></div><ArrowUpRight size={16}/></button>})}</div></div>}
  <div className="explorer-disclaimer"><Info size={14}/><span>Finished concept only. Bodywork, seating, part shapes and packaging illustrate a possible design; they do not establish structural or mechanical readiness.</span></div>
  {samples.length>0&&!compact&&<div className="playback"><button onClick={()=>setPlaying(!playing)}>{playing?'Pause':'Play cycle'}</button><input aria-label="Simulation playback" type="range" min="0" max={Math.max(0,samples.length-1)} value={cursor} onChange={e=>{setPlaying(false);setCursor(+e.target.value)}}/><span>{fmt(samples[cursor]?.time_s)} s / {fmt(samples[cursor]?.speed_mph)} mph</span></div>}
  <span className="explorer-sr-only" role="status" aria-live="polite">{activeAssembly?`Viewing ${title}`:'Viewing full car'}</span>
 </section>;
}
