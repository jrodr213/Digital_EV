import {Component,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {ErrorInfo,ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Canvas} from '@react-three/fiber';
import {Physics} from '@react-three/rapier';
import {ArrowLeft,Camera,ChevronRight,Info,Pause,Play,RotateCcw,Settings2,RefreshCw,X} from 'lucide-react';
import type {Part,Vehicle} from '../types';
import {api,fmt} from '../api';
import {resolveDriveConfig,ecctrlCarConfig,MPS_PER_MPH} from './driveModel';
import type {Assumptions,DriveConfig,ParameterKey} from './driveModel';
import {DrivingEnvironment,ENVIRONMENTS} from './Environments';
import {CourseGuide} from './CourseGuide';
import type {EnvironmentId} from './Environments';
import {DrivingVehicle,FixedFrameDriver,GraphicsGuard,emptyInput,initialTelemetry} from './DrivingScene';
import type {CameraMode,DriveInput} from './DrivingScene';
import './driving.css';

const CAMERAS:CameraMode[]=['driver','chase','free'];
const CAMERA_NAMES={driver:'Driver POV',chase:'Third person',free:'Free camera'};
const drivingKeys=new Set(['KeyW','ArrowUp','KeyS','ArrowDown','KeyA','ArrowLeft','KeyD','ArrowRight','Space']);

class DriveBoundary extends Component<{children:ReactNode;onExit:()=>void},{error:string}>{
  state={error:''};
  static getDerivedStateFromError(error:Error){return {error:error.message};}
  componentDidCatch(_error:Error,_info:ErrorInfo){}
  render(){return this.state.error?<div className="drive-failure" role="alert"><h2>Driving view could not load</h2><p>{this.state.error}</p><p>This mode requires WebGL 2 and the installed physics packages.</p><button onClick={this.props.onExit}>Return to vehicle</button></div>:this.props.children;}
}

export function TestDrive({vehicle,parts,onExit}:{vehicle:Vehicle;parts:Part[];onExit:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),input=useRef<DriveInput>(emptyInput()),pressed=useRef(new Set<string>());
  const [snapshot,setSnapshot]=useState(()=>({vehicle:structuredClone(vehicle),parts:structuredClone(parts)}));
  const [assumptions,setAssumptions]=useState<Assumptions>({});
  const candidate=useMemo(()=>resolveDriveConfig(snapshot.vehicle,snapshot.parts,assumptions),[snapshot,assumptions]);
  const [config,setConfig]=useState<DriveConfig>(candidate),[generation,setGeneration]=useState(0);
  const [environment,setEnvironment]=useState<EnvironmentId>('track'),[camera,setCamera]=useState<CameraMode>('driver');
  const [cameraSettings,setCameraSettings]=useState({eyeHeight:1.2,distance:6,height:2.5});
  const [paused,setPaused]=useState(true),[details,setDetails]=useState(true),[fault,setFault]=useState(''),[refreshing,setRefreshing]=useState(false);
  const [telemetry,setTelemetry]=useState(()=>initialTelemetry(config));
  const pending=JSON.stringify(config.parameters)!==JSON.stringify(candidate.parameters)||config.parts!==snapshot.parts||config.driven!==candidate.driven;
  const clearInput=useCallback(()=>{pressed.current.clear();input.current=emptyInput();},[]);
  const pause=useCallback(()=>{clearInput();setPaused(true);},[clearInput]);
  const reset=useCallback(()=>{clearInput();setPaused(true);setFault('');setTelemetry(initialTelemetry(config));setGeneration(v=>v+1);},[config,clearInput]);
  const cycleCamera=useCallback(()=>setCamera(c=>CAMERAS[(CAMERAS.indexOf(c)+1)%CAMERAS.length]),[]);
  const toggle=useCallback(()=>{clearInput();setPaused(v=>!v);},[clearInput]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';dialog.current?.showModal();
    return()=>{document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  const updateInput=useCallback(()=>{
    const has=(...codes:string[])=>codes.some(c=>pressed.current.has(c));
    input.current={forward:has('KeyW','ArrowUp'),backward:has('KeyS','ArrowDown'),left:has('KeyA','ArrowLeft'),right:has('KeyD','ArrowRight'),brake:has('Space')};
  },[]);
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{
      if(e.code==='Escape'){e.preventDefault();e.stopPropagation();onExit();return;}
      if((e.target as HTMLElement).closest('input,select,textarea,[contenteditable="true"]'))return;
      if(drivingKeys.has(e.code)){e.preventDefault();if(!paused){pressed.current.add(e.code);updateInput();}}
      else if(!e.repeat){
        if(e.code==='KeyC'){e.preventDefault();cycleCamera();}
        if(e.code==='KeyP'){e.preventDefault();if(!pending&&!fault&&config.errors.length===0)toggle();}
        if(e.code==='KeyR'){e.preventDefault();reset();}
      }
    };
    const up=(e:KeyboardEvent)=>{if(drivingKeys.has(e.code)){pressed.current.delete(e.code);updateInput();}};
    const visibility=()=>{if(document.hidden)pause();};
    window.addEventListener('keydown',down,true);window.addEventListener('keyup',up);window.addEventListener('blur',pause);document.addEventListener('visibilitychange',visibility);
    return()=>{window.removeEventListener('keydown',down,true);window.removeEventListener('keyup',up);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',visibility);};
  },[onExit,paused,updateInput,cycleCamera,pause,reset,toggle,pending,fault,config.errors.length]);
  useEffect(()=>{if(paused)clearInput();},[paused,clearInput]);
  const physicsFault=useCallback((message:string)=>{setFault(message);pause();},[pause]);
  function apply(){
    if(candidate.errors.length)return;
    clearInput();setConfig(candidate);setPaused(true);setFault('');setGeneration(v=>v+1);setTelemetry(initialTelemetry(candidate));
  }
  async function refresh(){
    pause();setRefreshing(true);setFault('');
    try{
      const [vehicles,library]=await Promise.all([api<Vehicle[]>('/vehicles'),api<Part[]>('/components')]);
      const current=vehicles.find(v=>v.id===vehicle.id);if(!current)throw Error('The selected saved vehicle no longer exists. Exit and choose a car.');
      setAssumptions({});setSnapshot({vehicle:current,parts:library.filter(p=>current.component_ids.includes(p.id!))});setDetails(true);
    }catch(e){setFault(String(e));}finally{setRefreshing(false);}
  }
  const touch=(code:string,label:string)=> <button aria-label={label} disabled={paused||pending||!!fault} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pressed.current.add(code);updateInput();}} onPointerUp={e=>{pressed.current.delete(code);updateInput();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{pressed.current.delete(code);updateInput();}} onLostPointerCapture={()=>{pressed.current.delete(code);updateInput();}}>{label}</button>;
  const startDisabled=!!fault||refreshing||candidate.errors.length>0||config.errors.length>0||pending;
  const ready=()=>{if(startDisabled)return;clearInput();setPaused(false);setDetails(false);dialog.current?.focus();};
  const hp=ecctrlCarConfig(config).engineHorsepower;
  return createPortal(<dialog className="test-drive" ref={dialog} aria-label="Interactive test drive" tabIndex={-1} onCancel={e=>{e.preventDefault();onExit();}}>
    <header className="drive-header"><button onClick={onExit} aria-label="Exit driving mode"><ArrowLeft size={17}/><span>Exit</span></button><div className="drive-title"><span>EV / TWIN · TEST DRIVE</span><strong>{snapshot.vehicle.name}</strong></div><span className="drive-model-tag">Uncalibrated physics</span><button aria-label="Engineering details" aria-expanded={details} onClick={()=>{pause();setDetails(v=>!v);}}><Settings2 size={17}/><span>Engineering</span></button></header>
    <div className="drive-toolbar">
      <label><span>Course</span><select aria-label="Driving environment" value={environment} onChange={e=>{setEnvironment(e.target.value as EnvironmentId);reset();}}>{Object.entries(ENVIRONMENTS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label><span><Camera size={13}/> Camera · C</span><select aria-label="Driving camera" value={camera} onChange={e=>setCamera(e.target.value as CameraMode)}>{CAMERAS.map(id=><option key={id} value={id}>{CAMERA_NAMES[id]}</option>)}</select></label>
      <div className="drive-play-controls"><button className="primary" aria-label={paused?'Start / resume':'Pause drive'} disabled={startDisabled} onClick={paused?ready:pause}>{paused?<Play size={15}/>:<Pause size={15}/>} {paused?'Start / resume':'Pause'} <kbd>P</kbd></button><button aria-label="Reset drive" onClick={reset}><RotateCcw size={15}/><span>Reset</span><kbd>R</kbd></button></div>
    </div>
    <div className="drive-scene-layout">
      <div className="drive-viewport">
        <DriveBoundary key={`${generation}-${environment}`} onExit={onExit}><Suspense fallback={<div className="drive-loading">Loading vehicle physics…</div>}>
          {config.errors.length===0&&<Canvas frameloop="never" dpr={[1,1.5]} camera={{fov:68,near:.025,far:700,position:[0,2,-5]}} gl={{antialias:true}} fallback={<div className="drive-failure">WebGL 2 is unavailable. Exit to continue editing this vehicle.</div>} onCreated={({gl})=>{gl.setClearColor('#c6d4d7');gl.domElement.setAttribute('aria-label','First-person driving simulator');}}>
            <FixedFrameDriver/><GraphicsGuard onFault={physicsFault}/>
            <Physics gravity={[0,-9.80665,0]} timeStep={1/60} paused interpolate={false} numSolverIterations={8}>
              <DrivingEnvironment id={environment} grip={config.p.grip}/>
              <DrivingVehicle config={config} paused={paused||!!fault||pending} input={input} cameraMode={camera} cameraSettings={cameraSettings} onTelemetry={setTelemetry} onFault={physicsFault}/>
            </Physics>
          </Canvas>}
        </Suspense></DriveBoundary>
        <div className="drive-scene-caption"><span><i className={paused?'':'running'}/>{paused?'PAUSED':'DRIVING'}</span><span>{ENVIRONMENTS[environment]}</span></div>
        <CourseGuide id={environment} position={telemetry.position}/>
        <div className="drive-speed" aria-label="Live driving telemetry" data-testid="drive-telemetry" data-speed={telemetry.speed} data-distance={telemetry.distance} data-soc={telemetry.soc} data-energy={telemetry.energyWh} data-time={telemetry.time} data-position={telemetry.position.join(',')} data-mass={telemetry.mass} data-contacts={telemetry.contacts} data-mu={telemetry.contactMu} data-wheel-speed={telemetry.wheelSpeed.join(',')}>
          <span>{telemetry.speed<-.05?'REVERSE':'SPEED · PHYSICS'}</span><strong>{fmt(Math.abs(telemetry.speed)/MPS_PER_MPH,1)}<small>mph</small></strong>
          <div><span>{telemetry.braking?'BRAKING':telemetry.stalled?'TORQUE / LOAD LIMITED':telemetry.contacts===0?'AIRBORNE':telemetry.slip>.3&&Math.abs(telemetry.speed)>.5?'TIRE SLIP':'CONTACT GRIP'}</span><b>{telemetry.contacts}/4 wheels</b></div>
        </div>
        {paused&&!fault&&!details&&<div className="drive-paused"><button className="primary" disabled={startDisabled} onClick={ready}><Play size={16}/>Resume driving</button><span>WASD / arrows to drive · Space to brake</span></div>}
        {fault&&<div className="drive-alert" role="alert"><b>Drive paused</b><p>{fault}</p><button onClick={reset}>Reset drive</button></div>}
        <div className="drive-touch" aria-label="Touch driving controls"><div>{touch('KeyA','← Left')}{touch('KeyD','Right →')}</div><div>{touch('KeyS','Reverse')}{touch('Space','Brake')}{touch('KeyW','Accelerate')}</div></div>
        <div className="drive-controls-hint"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows</span><span><kbd>Space</kbd> brake</span><span><kbd>C</kbd> camera</span><span><kbd>Esc</kbd> exit</span></div>
      </div>
      {details&&<aside className="drive-details" aria-label="Driving engineering settings">
        <div className="drive-details-heading"><div><span>ENGINEERING SETUP</span><h2>Selected build, explicit inputs.</h2></div><button aria-label="Close engineering details" onClick={()=>setDetails(false)}><X size={16}/></button></div>
        <p className="drive-assumption-note"><Info size={16}/><span>{candidate.parameters.filter(p=>p.assumed).length} editable assumptions. Values below affect this drive session only. Saved parts and FASTSim results stay in the existing workspace.</span></p>
        <div className="drive-config-summary"><span>{config.motorCount} motor{config.motorCount!==1?'s':''} · {config.driven} · {fmt(config.p.ratio,2)}:1</span><span>{fmt(config.mass)} kg · {fmt(config.shaftPowerW)} W shaft limit</span></div>
        {candidate.errors.length>0&&<div className="drive-input-errors" role="alert">{candidate.errors.map(e=><p key={e}>{e}</p>)}</div>}
        {pending&&<p className="drive-pending" role="status">Inputs changed. Apply and reset before resuming.</p>}
        <div className="drive-apply"><button className="primary" disabled={candidate.errors.length>0||refreshing} onClick={apply}>Apply inputs & reset</button><button disabled={refreshing} onClick={()=>void refresh()}><RefreshCw size={14}/>{refreshing?'Reading…':'Refresh saved build'}</button></div>
        <details open><summary>Editable assumptions ({candidate.parameters.filter(p=>p.assumed).length})</summary>
          {!snapshot.parts.find(p=>p.category==='drivetrain')?.specs.driven_wheels&&<label className="drive-parameter"><span>Driven-wheel assignment<small>ASSUMPTION</small></span><select aria-label="Assumed driven wheels" value={candidate.driven} onChange={e=>{pause();setAssumptions(a=>({...a,driven:e.target.value as DriveConfig['driven']}));}}><option>RWD</option><option>FWD</option><option>AWD</option></select></label>}
          {candidate.parameters.filter(p=>p.assumed).map(parameter=><label className="drive-parameter" key={parameter.key}><span>{parameter.label}<small>{parameter.unit} · ASSUMPTION</small></span><input aria-label={parameter.label} type="number" step="any" min={parameter.min} max={parameter.max} value={Number.isNaN(parameter.value)?'':parameter.value} onChange={e=>{pause();setAssumptions(a=>({...a,[parameter.key as ParameterKey]:e.target.value===''?NaN:Number(e.target.value)}));}}/><small>{parameter.basis}</small></label>)}
        </details>
        <details><summary>Saved engineering values</summary><dl>{candidate.parameters.filter(p=>!p.assumed).map(parameter=><div key={parameter.key}><dt>{parameter.label}</dt><dd>{fmt(parameter.value,3)} {parameter.unit}</dd></div>)}</dl><p>Saved inputs may be unverified listing claims. Use Component Library to edit their source records, then refresh this build.</p></details>
        <details><summary>Camera settings</summary><label className="drive-parameter">Driver eye height / m<input aria-label="Driver eye height" type="range" min="1.05" max="1.8" step=".01" value={cameraSettings.eyeHeight} onChange={e=>setCameraSettings(s=>({...s,eyeHeight:+e.target.value}))}/></label><label className="drive-parameter">Chase distance / m<input aria-label="Chase distance" type="range" min="3" max="12" step=".1" value={cameraSettings.distance} onChange={e=>setCameraSettings(s=>({...s,distance:+e.target.value}))}/></label><label className="drive-parameter">Chase height / m<input aria-label="Chase height" type="range" min="1" max="6" step=".1" value={cameraSettings.height} onChange={e=>setCameraSettings(s=>({...s,height:+e.target.value}))}/></label><p>Free camera: drag to orbit, right-drag to pan, scroll/pinch to zoom. It stays at the inspection location while the car moves.</p></details>
        <details><summary>Physics mapping & limits</summary><p>60 Hz Ecctrl wheel contacts and Rapier rigid-body dynamics. Mass, gravity, suspension, torque, collisions and surface friction drive motion.</p><p>Ecctrl torque normalization: {fmt(hp,3)} hp-equivalent. This is not the vehicle horsepower. Fixed ratio {fmt(config.p.ratio,2)}:1; shaft torque {fmt(config.shaftTorque)} N m; steering radius ≈ {fmt(config.p.wheelbase/Math.tan(config.p.steerDeg*Math.PI/180))} m.</p><p>Speed, contact, slope, slip and distance come from physics. Motor RPM/torque and shaft power are derived from the wheel solver. Battery SOC, current, losses and energy are estimates using nominal voltage and scalar efficiencies.</p><p>Friction braking only. No regen, thermal model, voltage sag, motor electromagnetic transients, suspension linkages or calibrated tire model. Parallel front steering and approximate center of mass/load transfer. No validated performance predictions.</p>{config.notes.map((n,i)=><p key={i}>{n}</p>)}</details>
        <details><summary>Installed parts</summary>{snapshot.parts.map(part=><p key={part.id}><b>{part.category}</b> · {part.name}</p>)}</details>
        <button className="primary drive-start" disabled={startDisabled} onClick={ready}><Play size={15}/>Start driving<ChevronRight size={15}/></button>
      </aside>}
    </div>
    <footer className="drive-dashboard" aria-label="Engineering telemetry">
      {[
        ['Acceleration',`${fmt(telemetry.acceleration,2)} m/s²`,'Physics derivative'],
        ['Motor speed',`${fmt(telemetry.rpm,0)} rpm`,'Derived · mean driven wheels'],
        ['Motor torque',`${fmt(telemetry.torque,2)} N m`,'Derived · aggregate shaft'],
        ['Shaft / electrical',`${fmt(telemetry.shaftW,0)} / ${fmt(telemetry.terminalW,0)} W`,'Derived shaft / estimated DC'],
        ['Battery SOC',`${fmt(telemetry.soc*100,1)}%`,'Estimated stored energy'],
        ['Energy / distance',`${fmt(telemetry.energyWh,2)} Wh / ${fmt(telemetry.distance,1)} m`,'Estimated energy · physics distance'],
        ['Slope / grip',`${fmt(telemetry.slope,1)}° / μ ${fmt(telemetry.contactMu,2)}`,'Contact normal / surface model'],
      ].map(([label,value,basis])=><div key={label}><span>{label}</span><strong>{value}</strong><small>{basis}</small></div>)}
    </footer>
  </dialog>,document.body);
}
