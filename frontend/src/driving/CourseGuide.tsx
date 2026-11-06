import {useEffect,useMemo,useState} from 'react';
import {COURSES,coursePoints} from './courses';
import type {CourseDefinition,EnvironmentId,CoursePoint} from './courses';

export function CourseGuide({id,position}:{id:EnvironmentId;position:[number,number,number]}){
  const [expanded,setExpanded]=useState(()=>window.innerWidth>700);
  useEffect(()=>{
    const media=window.matchMedia('(max-width:700px)');
    const change=()=>setExpanded(!media.matches);media.addEventListener('change',change);
    return()=>media.removeEventListener('change',change);
  },[]);
  const course:CourseDefinition=COURSES[id];
  const map=useMemo(()=>{
    const points=coursePoints(id),branches=course.branches??[],all=[...points,...branches.flat()];
    const minX=Math.min(...all.map(p=>p[0]))-12,maxX=Math.max(...all.map(p=>p[0]))+12;
    const minZ=Math.min(...all.map(p=>p[2]))-12,maxZ=Math.max(...all.map(p=>p[2]))+12;
    const scale=Math.min(164/(maxX-minX),112/(maxZ-minZ));
    // The driver starts looking along +Z, with +X on their left. Keep the map
    // aligned with that initial view so its bends match the driving scene.
    const project=(p:CoursePoint)=>[90-(p[0]-(minX+maxX)/2)*scale,64-(p[2]-(minZ+maxZ)/2)*scale];
    const path=(route:CoursePoint[])=>route.map((p,i)=>`${i?'L':'M'}${project(p).map(v=>v.toFixed(2)).join(',')}`).join(' ');
    const length=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1],p[2]-points[i][2]),0);
    return {project,route:path(points),branches:branches.map(path),length};
  },[id,course]);
  const [x,y]=map.project(position),[startX,startY]=map.project([0,0,0]);
  return <details className="drive-course-guide" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)} data-course={id}>
    <summary>Course guide <span>{expanded?'−':'+'}</span></summary>
    <div className="drive-course-content"><strong>{course.name}</strong><p>{course.description}</p>
      <svg viewBox="0 0 180 128" role="img" aria-label={`${course.name} route map. Orange dot is your vehicle.`}>
        <rect width="180" height="128" rx="5" fill="#e6ece4"/>
        {[map.route,...map.branches].map((d,i)=><path key={i} d={d} fill="none" stroke={id==='rally'?'#a38c65':'#829790'} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>)}
        <circle cx={startX} cy={startY} r="3.7" fill="#f7faf5" stroke="#355d51" strokeWidth="1.5"><title>Start</title></circle>
        <circle cx={Math.max(4,Math.min(176,x))} cy={Math.max(4,Math.min(124,y))} r="4" fill="#e4a15c" stroke="#314d43" strokeWidth="1.4"><title>Your vehicle</title></circle>
      </svg>
      <div className="drive-route-meta"><span>{Math.round(map.length)} m {course.closed?'loop':'route'}</span><span><i/> You</span></div>
      <p className="drive-route-tip">{course.tip}</p>
    </div>
  </details>;
}
