import {useEffect,useRef,useState} from 'react';
import {playbackTime} from './playbackMotion';

/** One wall clock maps to one simulation clock; frame count never determines progress. */
export function usePlaybackClock(duration:number,identity:string){
 const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[rate,setRate]=useState(1);
 const current=useRef(0);current.current=time;
 useEffect(()=>{setPlaying(false);setTime(0);current.current=0},[identity,duration]);
 useEffect(()=>{
  if(!playing||duration<=0)return;
  const initial=current.current,start=performance.now();let animation=0;
  function tick(now:number){const next=playbackTime(initial,(now-start)/1000,rate,duration);setTime(next);if(next>=duration)setPlaying(false);else animation=requestAnimationFrame(tick)}
  animation=requestAnimationFrame(tick);
  const hide=()=>{if(document.hidden)setPlaying(false)};
  document.addEventListener('visibilitychange',hide);
  return()=>{cancelAnimationFrame(animation);document.removeEventListener('visibilitychange',hide)};
 },[playing,rate,duration,identity]);
 function seek(value:number){setPlaying(false);const next=playbackTime(value,0,1,duration);current.current=next;setTime(next)}
 function toggle(){if(playing)setPlaying(false);else{if(current.current>=duration){current.current=0;setTime(0)}setPlaying(true)}}
 return {time,playing,rate,setRate,seek,toggle};
}
