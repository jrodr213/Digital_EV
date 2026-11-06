// Browser-only validation fixture, served by Vite during tests; never imported by
// the application or production bundle. Uses the production vehicle and terrain.
import {Suspense,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import type {Root} from 'react-dom/client';
import {Canvas,useThree} from '@react-three/fiber';
import {Physics,useRapier} from '@react-three/rapier';
import {DrivingVehicle,emptyInput} from '../src/driving/DrivingScene';
import type {DriveInput,Telemetry} from '../src/driving/DrivingScene';
import {resolveDriveConfig,STEP} from '../src/driving/driveModel';
import type {DriveConfig} from '../src/driving/driveModel';
import type {Part,Vehicle} from '../src/types';
import {DrivingEnvironment} from '../src/driving/Environments';
import type {EnvironmentId} from '../src/driving/Environments';

let root:Root|undefined,stepper:((n:number)=>void)|undefined,keys=emptyInput(),telemetry:Telemetry|undefined,tick=0;
let probeCollider:((point:[number,number,number])=>{height:number;mu:number}|null)|undefined;
function Ready(){
  const {advance,gl}=useThree();const {world,rapier}=useRapier();
  useEffect(()=>{
    const render=gl.render;gl.render=()=>{};stepper=(n:number)=>{for(let i=0;i<n;i++)advance(++tick*STEP);};
    probeCollider=point=>{
      let vehicleHandle:number|undefined;world.forEachRigidBody(body=>{if(body.isDynamic())vehicleHandle=body.handle;});
      const vehicleBody=vehicleHandle===undefined?undefined:world.getRigidBody(vehicleHandle)??undefined;
      const hit=world.castRay(new rapier.Ray({x:point[0],y:20,z:point[2]},{x:0,y:-1,z:0}),40,true,undefined,undefined,undefined,vehicleBody);
      return hit?{height:20-hit.timeOfImpact,mu:hit.collider.friction()*.5}:null;
    };
    return()=>{stepper=undefined;probeCollider=undefined;gl.render=render;};
  },[advance,gl,world,rapier]);
  return null;
}
function Fixture({config,environment}:{config:DriveConfig;environment:EnvironmentId}){
  const input=useRef(keys);input.current=keys;
  useEffect(()=>{Object.defineProperty(input,'current',{get:()=>keys,set:(v:DriveInput)=>{keys=v;},configurable:true});},[]);
  return <Canvas frameloop="never" dpr={.5} camera={{position:[0,3,-6]}}><Suspense fallback={null}>
    <Physics paused timeStep={STEP} interpolate={false} gravity={[0,-9.80665,0]} numSolverIterations={8}>
      <DrivingEnvironment id={environment} grip={config.p.grip}/>
      <DrivingVehicle config={config} paused={false} input={input} cameraMode="chase" cameraSettings={{eyeHeight:1.2,distance:6,height:2.5}} onTelemetry={t=>{telemetry=t;}} onFault={message=>{throw Error(message);}}/>
      <Ready/>
    </Physics>
  </Suspense></Canvas>;
}
export function mount(vehicle:Vehicle,parts:Part[],overrides:Record<string,number>={},environment:EnvironmentId='track'){
  root?.unmount();stepper=undefined;tick=0;telemetry=undefined;keys=emptyInput();
  const element=document.getElementById('fixture')??document.body.appendChild(Object.assign(document.createElement('div'),{id:'fixture'}));
  element.style.cssText='width:640px;height:360px';
  const config=resolveDriveConfig(vehicle,parts,overrides);
  if(config.errors.length)throw Error(config.errors.join('\n'));
  root=createRoot(element);root.render(<Fixture config={config} environment={environment}/>);
}
export const ready=()=>!!stepper;
export function advance(n:number,input:Partial<DriveInput>={}){keys={...emptyInput(),...input};stepper?.(n);return telemetry;}
export function probe(point:[number,number,number]){return probeCollider?.(point);}
