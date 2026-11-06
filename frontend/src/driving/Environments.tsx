import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {RigidBody,CuboidCollider,TrimeshCollider} from '@react-three/rapier';
import * as THREE from 'three';

import {COURSES,roadStrip} from './courses';
import type {EnvironmentId} from './courses';
export {ENVIRONMENTS} from './courses';
export type {EnvironmentId} from './courses';
export const SURFACE={pavement:1,grass:.55,gravel:.32};
type V3=[number,number,number];

// Ecctrl averages collider friction and tireGripFactor. Setting the latter to 0
// and collider friction to 2 * tireMu * surfaceFactor gives mu=tireMu*surfaceFactor.
function Solid({position,size,rotation=[0,0,0],color='#424c51',mu=1,grip}:{position:V3;size:V3;rotation?:V3;color?:string;mu?:number;grip:number}){
  return <RigidBody type="fixed" colliders={false} position={position} rotation={rotation}>
    <CuboidCollider args={[size[0]/2,size[1]/2,size[2]/2]} friction={2*grip*mu} restitution={0}/>
    <mesh receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.95}/></mesh>
  </RigidBody>;
}

export function RoadLabel({text,position,color='#e9eeee'}:{text:string;position:V3;color?:string}){
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const c=canvas.getContext('2d')!;c.fillStyle='#213138';c.fillRect(0,0,512,128);
    c.fillStyle=color;c.font='bold 42px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,64);
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
  },[text,color]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <sprite position={position} scale={[5,1.25,1]}><spriteMaterial map={texture} depthWrite={false}/></sprite>;
}
function Stripe({position,size=[.12,.012,4]}:{position:V3;size?:V3}){
  return <mesh position={position} receiveShadow><boxGeometry args={size}/><meshStandardMaterial color="#e2dec5" roughness={1}/></mesh>;
}

function Track({grip}:{grip:number}){
  return <>
    {[0,70].map(x=><Solid key={x} position={[x,-.1,125]} size={[12,.2,250]} grip={grip}/>)}
    {[0,250].flatMap((z,index)=>Array.from({length:32},(_,i)=>{
      const angle=(index?0:Math.PI)+(i+.5)/32*Math.PI;
      return <Solid key={`${z}-${i}`} position={[35+35*Math.cos(angle),-.1,z+35*Math.sin(angle)]} size={[12,.2,3.65]} rotation={[0,-angle,0]} grip={grip}/>;
    }))}
    {Array.from({length:25},(_,i)=><Stripe key={i} position={[0,.012,5+i*10]}/>)}
    {[-5.6,5.6,64.4,75.6].map(x=><Stripe key={x} position={[x,.014,125]} size={[.12,.012,250]}/>)}
    {[0,25,50,100,150,200,250].map(z=><group key={z}><RoadLabel text={`${z} m`} position={[-9,1.8,z]}/><Solid position={[-9,.5,z]} size={[.12,1,.12]} grip={grip}/></group>)}
    <Solid position={[0,.006,205]} size={[11,.012,30]} color="#646257" grip={grip}/>
    <RoadLabel text="BRAKING ZONE" position={[9,2,190]} color="#ffce8b"/>
    <RoadLabel text="250 m STRAIGHT" position={[-9,2,8]}/>
    <RoadLabel text="RETURN STRAIGHT" position={[79,2,220]}/>
    {[-1,1].flatMap(side=>Array.from({length:12},(_,i)=><Solid key={`${side}-${i}`} position={[side*7,.28,20+i*18]} size={[.25,.56,.25]} color="#b88a53" grip={grip}/>))}
  </>;
}

function Ramp({x,start,end,height,grade,grip}:{x:number;start:number;end:number;height:number;grade:number;grip:number}){
  const angle=Math.atan(grade),length=(end-start)/Math.cos(angle);
  return <Solid position={[x,height+(end-start)*grade/2-.12*Math.cos(angle), (start+end)/2+.12*Math.sin(angle)]} size={[12,.24,length]} rotation={[-angle,0,0]} grip={grip}/>;
}
function Hills({grip}:{grip:number}){
  return <>
    <Solid position={[0,-.1,0]} size={[70,.2,40]} grip={grip}/>
    {[-18,0,18].map((x,i)=>{const grade=[.05,.1,.2][i],height=45*grade;return <group key={x}>
      <Ramp x={x} start={20} end={65} height={0} grade={grade} grip={grip}/>
      <Solid position={[x,height-.12,72.5]} size={[12,.24,15]} grip={grip}/>
      <Ramp x={x} start={80} end={125} height={height} grade={-grade} grip={grip}/>
      <Solid position={[x,-.12,140]} size={[12,.24,30]} grip={grip}/>
      <RoadLabel text={`${grade*100}% INCLINE`} position={[x,2,18]}/>
      <RoadLabel text="DESCENT" position={[x,height+2,79]}/>
      <Stripe position={[x,.012,10]} size={[.16,.012,8]}/>
    </group>})}
    <RoadLabel text="CENTER LANE: 10%" position={[-9,2,-7]}/>
  </>;
}

function Bumps({grip}:{grip:number}){
  const geometry=useMemo(()=>{
    const g=new THREE.PlaneGeometry(14,28,14,112);g.rotateX(-Math.PI/2);
    const p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const z=p.getZ(i)+26,x=p.getX(i),fade=Math.min(1,(z-12)/2,(40-z)/2);
      p.setY(i,Math.max(0,fade)*(.11+.09*Math.sin(z*2.2)+.025*Math.cos(x*2+z)));
      p.setZ(i,z);
    }
    g.computeVertexNormals();return g;
  },[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const vertices=useMemo(()=>new Float32Array(geometry.attributes.position.array),[geometry]);
  const indices=useMemo(()=>new Uint32Array(geometry.index!.array),[geometry]);
  return <RigidBody type="fixed" colliders={false}>
    <TrimeshCollider args={[vertices,indices]} friction={2*grip}/>
    <mesh geometry={geometry} receiveShadow><meshStandardMaterial color="#6a6b62" roughness={1}/></mesh>
  </RigidBody>;
}
function Terrain({grip}:{grip:number}){
  return <>
    <Solid position={[0,-.1,0]} size={[14,.2,24]} grip={grip}/><Bumps grip={grip}/>
    <Solid position={[0,-.1,75]} size={[14,.2,70]} grip={grip} mu={SURFACE.gravel} color="#a2947c"/>
    <Solid position={[0,-.1,135]} size={[14,.2,50]} grip={grip}/>
    <RoadLabel text="SUSPENSION BUMPS" position={[-9,2,12]}/>
    <RoadLabel text="GRAVEL · 32% GRIP" position={[-9,2,42]} color="#ffce8b"/>
    <RoadLabel text="PAVED SURFACE" position={[-9,2,112]}/>
    {[-3,3].map((x,i)=><Solid key={x} position={[x,.07,122+i*8]} size={[1.2,.14,.5]} rotation={[0,.15,0]} color="#a3a8a1" grip={grip}/>)}
  </>;
}

function StartLine({position=[0,0,0],width=10}:{position?:V3;width?:number}){
  return <group position={position}>{[0,1].flatMap(row=>Array.from({length:10},(_,i)=><mesh key={`${row}-${i}`} position={[-width/2+(i+.5)*width/10,.014,row*.6]}><boxGeometry args={[width/10,.012,.6]}/><meshStandardMaterial color={(i+row)%2?'#f0eee1':'#263739'}/></mesh>))}</group>;
}

function RoadEdges({edges}:{edges:[V3[],V3[]]}){
  const mesh=useRef<THREE.InstancedMesh>(null);
  const count=edges.reduce((n,edge)=>n+edge.length-1,0);
  useLayoutEffect(()=>{
    const dummy=new THREE.Object3D(),forward=new THREE.Vector3(0,0,1);let index=0;
    edges.forEach(edge=>edge.slice(0,-1).forEach((point,i)=>{
      const a=new THREE.Vector3(...point),b=new THREE.Vector3(...edge[i+1]),delta=b.clone().sub(a);
      dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.scale.set(.12,.012,delta.length()+.015);
      dummy.quaternion.setFromUnitVectors(forward,delta.normalize());dummy.updateMatrix();mesh.current?.setMatrixAt(index++,dummy.matrix);
    }));
    if(mesh.current){mesh.current.instanceMatrix.needsUpdate=true;mesh.current.computeBoundingSphere();}
  },[edges]);
  return <instancedMesh ref={mesh} args={[undefined,undefined,count]}><boxGeometry args={[1,1,1]}/><meshStandardMaterial color="#e5e6d7" roughness={1}/></instancedMesh>;
}

function CurvedRoad({id,grip}:{id:'circuit'|'rally';grip:number}){
  const road=useMemo(()=>roadStrip(id),[id]);
  const surfaces=useMemo(()=>[
    {indices:road.paved,color:'#46545a',mu:SURFACE.pavement},
    {indices:road.gravel,color:'#af9b78',mu:SURFACE.gravel},
  ].filter(s=>s.indices.length).map(surface=>{
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(road.vertices,3));geometry.setIndex(new THREE.BufferAttribute(surface.indices,1));geometry.computeVertexNormals();
    return {...surface,geometry};
  }),[road]);
  useEffect(()=>()=>surfaces.forEach(s=>s.geometry.dispose()),[surfaces]);
  return <>
    {surfaces.map((surface,i)=><RigidBody key={i} type="fixed" colliders={false}>
      <TrimeshCollider args={[road.vertices,surface.indices]} friction={2*grip*surface.mu} restitution={0}/>
      <mesh geometry={surface.geometry} receiveShadow><meshStandardMaterial color={surface.color} roughness={1}/></mesh>
    </RigidBody>)}
    <RoadEdges edges={road.edges}/>
    <StartLine width={COURSES[id].width}/>
    <RoadLabel text={id==='circuit'?'START / FINISH':'RALLY START'} position={[-8,1.8,1]}/>
    {road.centers.filter((_,i)=>i%24===12).map((center,i)=>{
      const edge=road.edges[0][i*24+12],dx=edge[0]-center.x,dz=edge[2]-center.z;
      return <Solid key={i} position={[center.x+dx*1.2,center.y+.18,center.z+dz*1.2]} size={[.45,.36,1.2]} color={id==='circuit'?(i%2?'#c27d6c':'#e4e6d6'):'#827568'} grip={grip}/>;
    })}
    {id==='rally'&&<>
      <Solid position={[0,-.1,0]} size={[10,.2,16]} grip={grip}/>
      <RoadLabel text="GRAVEL AHEAD" position={[-10,1.8,22]} color="#ffce8b"/>
      <RoadLabel text="FINISH / TURN AROUND" position={[52,1.8,188]}/>
      <Solid position={[52,-.1,180]} size={[22,.2,22]} color="#af9b78" mu={SURFACE.gravel} grip={grip}/>
      <StartLine position={[52,0,182]}/>
    </>}
  </>;
}

function Cone({x,z,grip}:{x:number;z:number;grip:number}){
  return <RigidBody type="fixed" colliders={false} position={[x,.3,z]}>
    <CuboidCollider args={[.2,.3,.2]} friction={2*grip}/>
    <mesh><coneGeometry args={[.23,.6,12]}/><meshStandardMaterial color="#d99552" roughness={.8}/></mesh>
    <mesh position={[0,.04,0]}><cylinderGeometry args={[.078,.14,.16,12]}/><meshStandardMaterial color="#f3e9d5"/></mesh>
    <mesh position={[0,-.27,0]}><boxGeometry args={[.5,.06,.5]}/><meshStandardMaterial color="#354346"/></mesh>
  </RigidBody>;
}
function Slalom({grip}:{grip:number}){
  return <>
    <Solid position={[0,-.1,54]} size={[24,.2,144]} grip={grip}/>
    <StartLine width={12}/>
    {Array.from({length:6},(_,i)=>{const x=i%2?4:-4,z=18+i*16;return <group key={i}>
      <Cone x={x-3} z={z} grip={grip}/><Cone x={x+3} z={z} grip={grip}/>
      <RoadLabel text={`GATE ${i+1}`} position={[x+5,1.3,z]}/>
      <Stripe position={[x,.014,z]} size={[5.8,.012,.12]}/>
    </group>})}
    {[-11.5,11.5].map(x=><Stripe key={x} position={[x,.014,54]} size={[.12,.012,142]}/>)}
    <Solid position={[0,-.005,116]} size={[16,.01,16]} color="#66756e" grip={grip}/>
    <StartLine position={[0,0,108]} width={16}/><RoadLabel text="FINISH / BRAKE" position={[-10,1.8,112]}/>
    <RoadLabel text="6 GATES / WEAVE" position={[-9,1.8,4]}/>
    {[-8,8].map(x=><Cone key={x} x={x} z={125} grip={grip}/>)}
  </>;
}

function City({grip}:{grip:number}){
  return <>
    {[0,40,80].map(x=><Solid key={`ns-${x}`} position={[x,-.1,60]} size={[10,.2,140]} grip={grip}/>)}
    {[0,40,80,120].map(z=><Solid key={`ew-${z}`} position={[40,-.1,z]} size={[100,.2,10]} grip={grip}/>)}
    {[20,60].flatMap((x,xi)=>[20,60,100].map((z,zi)=>{
      const height=5+(xi*3+zi)%4*2;
      return <group key={`${x}-${z}`}>
        <Solid position={[x,.055,z]} size={[29,.11,29]} color="#bcc1b7" grip={grip}/>
        <Solid position={[x,height/2+.11,z]} size={[20,height,21]} color={['#b5b5a6','#99aeaa','#bdaa96'][(xi+zi)%3]} grip={grip}/>
        <mesh position={[x,height+.18,z]}><boxGeometry args={[21,.15,22]}/><meshStandardMaterial color="#748580"/></mesh>
        {[0,1,2].map(row=>[-6,0,6].map(offset=><mesh key={`${row}-${offset}`} position={[x+offset,1.4+row*1.35,z-10.52]}><boxGeometry args={[2,.75,.04]}/><meshStandardMaterial color="#3e6064" roughness={.35}/></mesh>))}
      </group>;
    }))}
    {[0,40,80].flatMap(x=>[40,80,120].map(z=><group key={`${x}-${z}`}>
      {Array.from({length:6},(_,i)=><Stripe key={i} position={[x-3.5+i*1.4,.014,z-7]} size={[.7,.012,2.5]}/>)}
      <Solid position={[x+6,.9,z-7]} size={[.1,1.8,.1]} color="#596d6a" grip={grip}/>
    </group>))}
    <Solid position={[94,-.1,40]} size={[22,.2,10]} grip={grip}/>
    <Solid position={[110,-.1,40]} size={[26,.2,50]} grip={grip}/>
    {[18,28,38,48,58].map(z=><Stripe key={z} position={[117,.014,z]} size={[10,.012,.1]}/>)}
    {[23,53].map((z,i)=><Solid key={z} position={[118,.65,z]} size={[4,1.3,1.8]} color={i?'#a5ac9e':'#526e70'} grip={grip}/>)}
    <RoadLabel text="PARKING PRACTICE" position={[110,2,15]}/>
    <RoadLabel text="CITY / EXPLORE" position={[-8,2,12]}/>
    <RoadLabel text="INTERSECTION" position={[-8,2,34]}/>
    <StartLine width={10}/>
  </>;
}

export function DrivingEnvironment({id,grip}:{id:EnvironmentId;grip:number}){
  return <>
    <color attach="background" args={[id==='rally'?'#d9d5c1':'#c6d4d7']}/><fog attach="fog" args={[id==='rally'?'#d9d5c1':'#c6d4d7',160,500]}/>
    <hemisphereLight args={['#f5fbff','#6e7a62',2.1]}/>
    <directionalLight position={[-35,65,-20]} intensity={2.8}/>
    <Solid position={[0,-.23,100]} size={[600,.3,650]} color="#7d8b71" mu={SURFACE.grass} grip={grip}/>
    {id==='track'?<Track grip={grip}/>:id==='hills'?<Hills grip={grip}/>:id==='terrain'?<Terrain grip={grip}/>:id==='city'?<City grip={grip}/>:id==='slalom'?<Slalom grip={grip}/>:<CurvedRoad id={id} grip={grip}/>}
    {[-180,180].map(x=><Solid key={x} position={[x,1,125]} size={[.6,2,470]} color="#8b9895" grip={grip}/>)}
    {[-110,360].map(z=><Solid key={z} position={[0,1,z]} size={[360,2,.6]} color="#8b9895" grip={grip}/>)}
    {(id==='city'?[-50,150]:[-60,110]).flatMap(x=>Array.from({length:12},(_,i)=><group key={`${x}-${i}`} position={[x,0,-40+i*32]}>
      <mesh position={[0,1.8,0]}><cylinderGeometry args={[.22,.32,3.6,6]}/><meshStandardMaterial color="#716654"/></mesh>
      <mesh position={[0,5,0]}><coneGeometry args={[2.5,6,7]}/><meshStandardMaterial color="#526b5c"/></mesh>
    </group>))}
  </>;
}
