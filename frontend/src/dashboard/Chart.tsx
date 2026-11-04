import {useEffect,useRef,useState} from 'react';
import {Alert,Busy} from '../components/ui';
type Series={name:string;y:(number|null)[];color?:string};
let plotlyPromise:Promise<any>|undefined;
const loadPlotly=()=>plotlyPromise??=(import('plotly.js-dist-min').then(module=>module.default).catch(error=>{plotlyPromise=undefined;throw error}));
export function Chart({title,unit,series,x}:{title:string;unit:string;series:Series[];x:number[]}){
 const ref=useRef<HTMLDivElement>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  const element=ref.current;if(!element)return;let active=true,observer:ResizeObserver|undefined,plotly:any;
  setError('');setLoading(true);
  loadPlotly().then(async library=>{
   if(!active)return;plotly=library;
   await library.react(element,series.map((s,index)=>({x,y:s.y,name:s.name,type:'scatter',mode:'lines',connectgaps:false,line:{color:s.color??['#256b5f','#82929e','#384c5d'][index%3],width:2,dash:index===1?'dot':'solid'},hovertemplate:`%{y:.2f} ${unit}<br>%{x:.1f} s<extra>%{fullData.name}</extra>`})),{
    paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{family:'Segoe UI, Arial, sans-serif',color:'#63717a',size:11},
    margin:{l:60,r:22,t:30,b:45},xaxis:{title:{text:'Elapsed time · s',standoff:10},gridcolor:'#eef1f3',zeroline:false,tickfont:{size:10},showline:false},yaxis:{title:{text:unit,standoff:8},gridcolor:'#e7ecef',zerolinecolor:'#b5c3cb',tickfont:{size:10}},
    legend:{orientation:'h',x:0,y:1.16,font:{size:10}},hovermode:'x unified',hoverlabel:{bgcolor:'#fff',bordercolor:'#d9e2e6',font:{size:11,color:'#24343b'}},autosize:true,uirevision:title
   },{responsive:false,displaylogo:false,displayModeBar:'hover',scrollZoom:false,modeBarButtonsToRemove:['select2d','lasso2d'],toImageButtonOptions:{filename:title.toLowerCase().replaceAll(' ','-'),format:'png',scale:2}});
   if(!active){library.purge(element);return}
   setLoading(false);observer=new ResizeObserver(()=>{if(active&&element.clientWidth>0)void library.Plots.resize(element)});observer.observe(element);
  }).catch(e=>{if(active){setLoading(false);setError(String(e))}});
  return()=>{active=false;observer?.disconnect();if(plotly)plotly.purge(element)};
 },[series,x,unit,title]);
 return <section className="panel chart" aria-label={title}><div className="panel-title">{title}<span>{unit}</span></div><div className="chart-container">{loading&&<div className="chart-loading"><Busy>Loading chart…</Busy></div>}{error&&<div className="chart-error"><Alert tone="error" title="Chart unavailable">{error}</Alert></div>}<div ref={ref} className="chart-host" role="img" aria-label={`${title}. ${series.map(s=>s.name).join(', ')} in ${unit}, over ${x.length} recorded samples. Use the chart toolbar to zoom or export.`}/></div></section>;
}
