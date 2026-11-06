import {useEffect,useMemo,useRef} from 'react';
import type {MutableRefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {CuboidCollider} from '@react-three/rapier';
import {useRapier} from '@react-three/rapier';
import {EcctrlVehicle,ShapeCastWheel,type EcctrlVehicleHandle,type VehicleInput} from 'ecctrl/vehicle';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three';
import {createVehicleModel,disposeModel} from '../visualization/vehicleModel';
import {advanceEnergy,electricalPower,ecctrlCarConfig,roadResistance,STEP} from './driveModel';
import type {DriveConfig} from './driveModel';

export type CameraMode='driver'|'chase'|'free';
export type CameraSettings={eyeHeight:number;distance:number;height:number};
export type DriveInput={forward:boolean;backward:boolean;left:boolean;right:boolean;brake:boolean};
export const emptyInput=():DriveInput=>({forward:false,backward:false,left:false,right:false,brake:false});
export type Telemetry={speed:number;acceleration:number;rpm:number;torque:number;shaftW:number;terminalW:number;storedW:number;soc:number;energyWh:number;distance:number;slope:number;slip:number;contacts:number;braking:boolean;throttle:number;time:number;position:[number,number,number];wheelSpeed:number[];contactMu:number;mass:number;stalled:boolean};
export function initialTelemetry(config:DriveConfig):Telemetry{return {speed:0,acceleration:0,rpm:0,torque:0,shaftW:0,terminalW:0,storedW:0,soc:config.p.maxSoc,energyWh:0,distance:0,slope:0,slip:0,contacts:0,braking:false,throttle:0,time:0,position:[0,0,0],wheelSpeed:[],contactMu:0,mass:config.mass,stalled:false};}

// Ecctrl 2.0.2's controllers use useFrame, so advancing the entire R3F root at
// fixed cadence is essential. Hidden-tab time and >100ms stalls are discarded.
// Rapier is stepped manually once per advance, after Ecctrl's wheel impulses.
export function FixedFrameDriver(){
  const advance=useThree(s=>s.advance);
  useEffect(()=>{
    let frame=0,last=performance.now(),accumulator=0,tick=0;
    const loop=(now:number)=>{
      accumulator+=Math.min(.1,(now-last)/1000);last=now;
      if(document.hidden)accumulator=0;
      while(accumulator>=STEP){advance(++tick*STEP);accumulator-=STEP;}
      frame=requestAnimationFrame(loop);
    };
    frame=requestAnimationFrame(loop);return()=>cancelAnimationFrame(frame);
  },[advance]);
  return null;
}

export function GraphicsGuard({onFault}:{onFault:(message:string)=>void}){
  const gl=useThree(s=>s.gl);
  useEffect(()=>{
    const lost=(event:Event)=>{event.preventDefault();onFault('Graphics context was lost. Reset the drive to reload it.');};
    gl.domElement.addEventListener('webglcontextlost',lost);
    return()=>gl.domElement.removeEventListener('webglcontextlost',lost);
  },[gl,onFault]);
  return null;
}

export function DrivingVehicle({config,paused,input,cameraMode,cameraSettings,onTelemetry,onFault}:{config:DriveConfig;paused:boolean;input:MutableRefObject<DriveInput>;cameraMode:CameraMode;cameraSettings:CameraSettings;onTelemetry:(t:Telemetry)=>void;onFault:(message:string)=>void}){
  const vehicle=useRef<EcctrlVehicleHandle>(null);
  const {p}=config,baseHeight=p.radius+p.travel*.68;
  const carConfig=useMemo(()=>ecctrlCarConfig(config),[config]);
  const model=useMemo(()=>{
    const shared=createVehicleModel(config.parts,config.parts,{length:p.length,width:p.width,wb:p.wheelbase,track:p.track,r:p.radius});
    const visibleWheels=shared.wheels.filter(w=>w.parent?.parent===shared.exterior);
    // The explorer faces -X. Ecctrl drives +Z. The exact same chassis and wheel
    // geometry is reparented to the rigid body and four suspension pivots.
    visibleWheels.forEach((w,i)=>{w.name=`drive-wheel-${i}`;w.removeFromParent();w.position.set(0,0,0);w.rotation.y=Math.PI/2;});
    shared.root.rotation.y=Math.PI/2;shared.root.position.y=-baseHeight-.04;
    return {...shared,visibleWheels};
  },[config,baseHeight]);
  useEffect(()=>()=>{
    model.visibleWheels.forEach(disposeModel);model.dispose();
  },[model]);
  const state=useRef(initialTelemetry(config)),throttle=useRef(0);
  const {world,rapier,step}=useRapier();
  const {camera,gl,scene}=useThree();
  const vectors=useMemo(()=>({forward:new THREE.Vector3(),velocity:new THREE.Vector3(),normal:new THREE.Vector3(),target:new THREE.Vector3(),desired:new THREE.Vector3(),up:new THREE.Vector3(),ray:new THREE.Vector3(),quat:new THREE.Quaternion(),lastPosition:new THREE.Vector3()}),[]);
  const orbit=useRef<OrbitControls|null>(null);
  const cameraInitialized=useRef(false);
  useEffect(()=>{
    const controls=new OrbitControls(camera,gl.domElement);controls.enabled=false;
    controls.enableDamping=true;controls.minDistance=.3;controls.maxDistance=80;controls.maxPolarAngle=Math.PI*.49;
    orbit.current=controls;return()=>{controls.dispose();orbit.current=null;};
  },[camera,gl]);
  useEffect(()=>{if(orbit.current)orbit.current.enabled=cameraMode==='free';cameraInitialized.current=false;return()=>{if(orbit.current)orbit.current.enabled=false;}},[cameraMode,camera,gl]);
  useEffect(()=>{if(paused){throttle.current=0;vehicle.current?.setMovement({forward:false,backward:false,brake:false,joystickL:{x:0,y:0}});}},[paused]);

  // The public VehicleInput has digital throttle only. This small, version-pinned
  // bridge uses documented wheel demand setters solely for smooth EV throttle.
  // Ecctrl retains suspension, wheel rotation, slip, steering, brakes and impulses.
  useFrame(()=>{
    const car=vehicle.current;if(!car||paused)return;
    world.timestep=STEP;
    const keys=input.current;
    const target=keys.brake?0:Number(keys.forward)-Number(keys.backward);
    throttle.current+=THREE.MathUtils.clamp(target-throttle.current,-STEP*2.5,STEP*2.5);
    if(Math.abs(throttle.current)<1e-6)throttle.current=0;
    const remainingWh=(state.current.soc-config.socFloor)*config.capacityWh;
    const maximumStepWh=electricalPower(config,config.shaftPowerW,1)*STEP/3600/p.batteryEfficiency;
    const energized=remainingWh>maximumStepWh;
    const demand=energized?throttle.current:0;
    const movement:VehicleInput={forward:demand>0,backward:demand<0,brake:keys.brake,joystickL:{x:Number(keys.right)-Number(keys.left),y:0}};
    car.setMovement(movement);
    if(demand||keys.brake||keys.left||keys.right)car.body.wakeUp();
    car.wheelsInfo.forEach(w=>{if(w.current.driveWheel)w.current.setDriveDemand?.(demand);});
    scene.updateMatrixWorld(true);
    const vel=car.body.linvel(),q=car.body.rotation();
    vectors.forward.set(0,0,1).applyQuaternion(q);vectors.velocity.set(vel.x,vel.y,vel.z);
    const signedSpeed=vectors.velocity.dot(vectors.forward);
    const wheels=[...car.wheelsInfo.values()].map(w=>w.current),contact=wheels.filter(w=>w.rayHit);
    // Ecctrl's built-in rolling term is viscous and only active when coasting.
    // Disable it and use the saved Crr once, as a force opposing road velocity.
    if(contact.length&&Math.abs(signedSpeed)>1e-5){
      vectors.normal.set(0,0,0);contact.forEach(w=>vectors.normal.add(w.rayHitNormal));vectors.normal.normalize();
      vectors.velocity.projectOnPlane(vectors.normal);
      const speed=vectors.velocity.length();
      if(speed>1e-5){
        const normalFraction=Math.max(0,vectors.normal.y);
        const impulse=Math.min(config.mass*speed,roadResistance(config,speed,normalFraction)*STEP);
        vectors.velocity.multiplyScalar(-impulse/speed);car.body.applyImpulse(vectors.velocity,true);
      }
    }
  },-10);

  // Positive priority owns rendering; all upstream Ecctrl callbacks at 0 have
  // completed before the single physics step and telemetry sample below.
  useFrame(()=>{
    const car=vehicle.current;if(!car)return;
    if(!paused){
      step(STEP);
      const t=state.current,vel=car.body.linvel(),pos=car.body.translation(),q=car.body.rotation();
      if(![vel.x,vel.y,vel.z,pos.x,pos.y,pos.z,q.w].every(Number.isFinite)||pos.y < -15){onFault('Vehicle left the test area or physics became unstable. Reset the drive to recover.');return;}
      vectors.quat.set(q.x,q.y,q.z,q.w);vectors.forward.set(0,0,1).applyQuaternion(vectors.quat);
      const speed=new THREE.Vector3(vel.x,vel.y,vel.z).dot(vectors.forward);
      const wheels=[...car.wheelsInfo.values()].map(w=>w.current),driven=wheels.filter(w=>w.driveWheel),contacts=wheels.filter(w=>w.rayHit);
      const torques=driven.map(w=>input.current.brake?0:Math.abs(w.driveTorque)/(p.ratio*p.driveEfficiency));
      const torque=torques.reduce((a,b)=>a+b,0);
      const shaftW=driven.reduce((sum,w,i)=>sum+Math.max(0,(input.current.brake?0:w.driveTorque)*w.wheelAngVel/p.driveEfficiency),0);
      const terminalW=Math.min(electricalPower(config,shaftW,torque/config.shaftTorque),Math.max(0,(t.soc-config.socFloor)*config.capacityWh)*3600*p.batteryEfficiency/STEP);
      const energy=advanceEnergy(config,t.energyWh,terminalW,STEP);
      vectors.normal.set(0,0,0);contacts.forEach(w=>vectors.normal.add(w.rayHitNormal));vectors.normal.normalize();
      vectors.ray.copy(vectors.forward).setY(0).normalize();
      const acceleration=THREE.MathUtils.lerp(t.acceleration,(speed-t.speed)/STEP,.12);
      t.time+=STEP;t.distance+=Math.hypot(vel.x,vel.y,vel.z)*STEP;
      Object.assign(t,{speed,acceleration,rpm:driven.length?driven.reduce((sum,w)=>sum+Math.abs(w.wheelAngVel)*p.ratio*60/(2*Math.PI),0)/driven.length:0,torque,shaftW,terminalW,storedW:terminalW/p.batteryEfficiency,...energy,
        slope:contacts.length?Math.atan2(-vectors.normal.dot(vectors.ray),Math.max(.001,vectors.normal.y))*180/Math.PI:0,
        slip:Math.max(0,...contacts.map(w=>Math.min(10,w.slipStrength))),contacts:contacts.length,
        braking:input.current.brake,throttle:throttle.current,position:[pos.x,pos.y,pos.z],wheelSpeed:wheels.map(w=>w.wheelAngVel),
        contactMu:contacts.length?contacts.reduce((sum,w)=>sum+w.rayHitFriciton*.5,0)/contacts.length:0,mass:car.body.mass(),
        stalled:Math.abs(speed)<.15&&Math.abs(throttle.current)>.7&&t.time>2});
      if(Math.floor(t.time/STEP)%6===0)onTelemetry({...t,position:[...t.position],wheelSpeed:[...t.wheelSpeed]});
    }
    const pos=car.body.translation(),q=car.body.rotation();
    vectors.quat.set(q.x,q.y,q.z,q.w);vectors.forward.set(0,0,1).applyQuaternion(vectors.quat);
    const localToWorld=(v:THREE.Vector3)=>v.applyQuaternion(vectors.quat).add(new THREE.Vector3(pos.x,pos.y,pos.z));
    vectors.target.copy(localToWorld(new THREE.Vector3(0,.8-baseHeight,0)));
    if(cameraMode==='driver'){
      camera.position.copy(localToWorld(new THREE.Vector3(0,cameraSettings.eyeHeight-baseHeight,.04)));
      camera.up.set(0,1,0).applyQuaternion(vectors.quat);
      vectors.desired.copy(camera.position).addScaledVector(vectors.forward,8);camera.lookAt(vectors.desired);
    }else if(cameraMode==='chase'){
      vectors.desired.copy(localToWorld(new THREE.Vector3(0,cameraSettings.height,-cameraSettings.distance)));
      vectors.ray.copy(vectors.desired).sub(vectors.target);
      const length=vectors.ray.length();vectors.ray.normalize();
      const hit=world.castRay(new rapier.Ray(vectors.target,vectors.ray),length,true,undefined,undefined,undefined,car.body);
      if(hit)vectors.desired.copy(vectors.target).addScaledVector(vectors.ray,Math.max(.3,hit.timeOfImpact-.25));
      if(!cameraInitialized.current)camera.position.copy(vectors.desired);else camera.position.lerp(vectors.desired,1-Math.exp(-5*STEP));
      camera.up.set(0,1,0);camera.lookAt(vectors.target);
    }else{
      if(!cameraInitialized.current){camera.position.copy(vectors.target).add(new THREE.Vector3(6,4,-6));orbit.current?.target.copy(vectors.target);camera.up.set(0,1,0);}
      orbit.current?.update();
    }
    cameraInitialized.current=true;
    gl.render(scene,camera);
  },2);

  const colliderY=.56-baseHeight-.04;
  const massProperties=useMemo(()=>({mass:config.mass,centerOfMass:{x:0,y:p.cgHeight-baseHeight-colliderY,z:p.wheelbase*(.5-p.rearWeight)},principalAngularInertia:{x:config.mass*(p.length*p.length+.7*.7)/12,y:config.mass*(p.width*p.width+p.length*p.length)/12,z:config.mass*(p.width*p.width+.7*.7)/12},angularInertiaLocalFrame:{x:0,y:0,z:0,w:1}}),[config,baseHeight,colliderY]);
  const wheelDensity=2*p.inertia/(Math.PI*p.radius**4*.16);
  return <EcctrlVehicle ref={vehicle} position={[0,baseHeight+.04,0]} colliders={false} carConfig={carConfig} enable={!paused} canSleep ccd linearDamping={0} angularDamping={.1}>
    <CuboidCollider args={[p.width*.37,.14,p.length*.46]} position={[0,colliderY,0]} massProperties={massProperties} friction={.4} restitution={0}/>
    <primitive object={model.root} dispose={null}/>
    {[-1,1].flatMap(axle=>[-1,1].map((side,si)=>{
      const driven=config.driven==='AWD'||(config.driven==='RWD'?axle===-1:axle===1);
      const visual=model.visibleWheels[(axle===1?0:2)+si];
      return <ShapeCastWheel key={`${axle}-${side}`} position={[side*p.track/2,0,axle*p.wheelbase/2]} name={`${axle===1?'Front':'Rear'} ${side===1?'left':'right'}`} enable={!paused} rayShapeR={p.radius} rayShapeH={.08} rayLength={p.travel} springK={p.springK} dampingC={p.dampingC} driveWheel={driven} driveTorqueWeight={1} steerWheel={axle===1} brakeWheel maxBrakeTorque={p.brakeNm} rollingResistanceCoef={0} tireGripFactor={0} wheelModelRadius={p.radius} wheelModelDensity={wheelDensity} wheelModelLerpPosRate={35}>
        {visual&&<primitive object={visual} dispose={null}/>}
      </ShapeCastWheel>;
    }))}
  </EcctrlVehicle>;
}
