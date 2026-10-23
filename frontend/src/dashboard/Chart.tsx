import {useEffect,useRef} from 'react';
import Plotly from 'plotly.js-dist-min';
export function Chart({title,unit,series,x}:{title:string;unit:string;series:{name:string;y:number[];color?:string}[];x:number[]}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!ref.current)return; const el=ref.current;Plotly.react(el,series.map(s=>({x,y:s.y,name:s.name,type:'scatter',mode:'lines',line:{color:s.color,width:2}})),{paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:'#8b9aa5',size:11},margin:{l:55,r:15,t:12,b:45},xaxis:{title:{text:'Time / s'},gridcolor:'#263139',zeroline:false},yaxis:{title:{text:unit},gridcolor:'#263139',zeroline:false},legend:{orientation:'h',y:1.18},autosize:true},{responsive:true,displaylogo:false});const ro=new ResizeObserver(()=>Plotly.Plots.resize(el));ro.observe(el);return()=>{ro.disconnect();Plotly.purge(el)}},[series,x,unit]);
 return <section className="panel chart"><div className="panel-title">{title}<span>{unit}</span></div><div ref={ref} style={{height:265,width:'100%'}}/></section>
}
