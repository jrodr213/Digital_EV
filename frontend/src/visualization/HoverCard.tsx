import {useLayoutEffect,useRef,useState} from 'react';
import type {Part} from '../types';
import {describePart} from './partDescription';

export type HoveredPart={part:Part;x:number;y:number;width:number;height:number};
export function HoverCard({hover}:{hover:HoveredPart}){
 const ref=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState({left:12,top:12});
 const info=describePart(hover.part);
 useLayoutEffect(()=>{
  const el=ref.current;if(!el)return;
  const left=Math.max(12,Math.min(hover.x+18,hover.width-el.offsetWidth-12));
  const top=Math.max(12,Math.min(hover.y+18,hover.height-el.offsetHeight-12));
  setPosition({left,top});
 },[hover]);
 return <div className="part-hover-card" role="tooltip" ref={ref} style={position}>
  <span className="part-hover-status">{info.status}</span>
  <strong>{hover.part.name}</strong>
  <p className="part-hover-role">{info.role}</p>
  <dl>{info.facts.map(f=><div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
  {hover.part.notes&&<p className="part-hover-notes">{hover.part.notes}</p>}
  <small>Click for full component details</small>
 </div>;
}
