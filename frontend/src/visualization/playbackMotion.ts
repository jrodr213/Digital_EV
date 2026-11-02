import type {Result} from '../types';

export const MPS_PER_MPH = .44704;
export type DriveTrace = {
 times:number[]; speeds:number[]; distances:number[]; samples:Record<string,number>[];
 duration:number; totalDistance:number; nativeDistance:boolean; wheelRadius:number|null;
};
export type DriveFrame = {time:number; speedMps:number; distance:number; wheelAngle:number|null; soc:number|null; ended:boolean};

/** Prepare saved data once. Playback never consults or changes the live parts library. */
export function prepareDriveTrace(result:Result):DriveTrace {
 const samples=result.samples;
 if(!samples?.length)throw Error('This result has no recorded motion samples.');
 const start=samples[0].time_s;
 const times=samples.map(s=>s.time_s-start),speeds=samples.map(s=>s.speed_mph*MPS_PER_MPH);
 if(times.some((t,i)=>!Number.isFinite(t)||(i>0&&t<=times[i-1]))||!Number.isFinite(start))throw Error('Playback requires finite, increasing sample times.');
 if(speeds.some(v=>!Number.isFinite(v)||v<0))throw Error('Playback requires finite, nonnegative achieved speeds.');
 const nativeDistance=samples.every(s=>s.distance_m!==undefined);
 if(!nativeDistance&&samples.some(s=>s.distance_m!==undefined))throw Error('The saved distance trace is incomplete.');
 const distances=[0];
 for(let i=1;i<samples.length;i++)distances.push(nativeDistance?samples[i].distance_m-samples[0].distance_m:
  distances[i-1]+(speeds[i-1]+speeds[i])/2*(times[i]-times[i-1]));
 if(nativeDistance&&(!Number.isFinite(samples[0].distance_m)||distances.some((d,i)=>!Number.isFinite(d)||(i>0&&d<distances[i-1]))))throw Error('Playback requires a finite, nondecreasing saved distance trace.');
 const diameter=result.assembly?.specs?.drivetrain?.wheel_diameter_m;
 const wheelRadius=typeof diameter==='number'&&Number.isFinite(diameter)&&diameter>0?diameter/2:null;
 return {times,speeds,distances,samples,duration:times.at(-1)!,totalDistance:distances.at(-1)!,nativeDistance,wheelRadius};
}

/** Absolute position at a simulation time, independent of frame rate, seeking or playback speed. */
export function driveFrame(trace:DriveTrace,elapsed:number):DriveFrame {
 const t=Math.max(0,Math.min(trace.duration,Number.isFinite(elapsed)?elapsed:0));
 let lo=0,hi=trace.times.length-1;
 while(lo<hi){const middle=Math.ceil((lo+hi)/2);if(trace.times[middle]<=t)lo=middle;else hi=middle-1;}
 const next=Math.min(lo+1,trace.times.length-1),dt=trace.times[next]-trace.times[lo],u=dt?(t-trace.times[lo])/dt:0;
 const speedMps=trace.speeds[lo]+(trace.speeds[next]-trace.speeds[lo])*u;
 const distance=trace.nativeDistance?trace.distances[lo]+(trace.distances[next]-trace.distances[lo])*u:
  trace.distances[lo]+trace.speeds[lo]*(t-trace.times[lo])+(dt?(trace.speeds[next]-trace.speeds[lo])*(t-trace.times[lo])**2/(2*dt):0);
 const firstSoc=trace.samples[lo].soc,lastSoc=trace.samples[next].soc;
 const soc=Number.isFinite(firstSoc)&&Number.isFinite(lastSoc)?firstSoc+(lastSoc-firstSoc)*u:null;
 return {time:t,speedMps,distance,wheelAngle:trace.wheelRadius==null?null:distance/trace.wheelRadius,soc,ended:t>=trace.duration};
}

export function playbackTime(initial:number,wallSeconds:number,rate:number,duration:number){
 return Math.max(0,Math.min(duration,initial+Math.max(0,wallSeconds)*rate));
}

export function sameDriveConditions(first:Result,other:Result):boolean {
 const keys=['test','cycle','grade','extra_payload_kg','target_mph','duration_s'];
 return keys.every(key=>first.request[key]===other.request[key])&&
  first.samples.length===other.samples.length&&first.samples.every((sample,i)=>
   sample.time_s-first.samples[0].time_s===other.samples[i].time_s-other.samples[0].time_s&&sample.target_mph===other.samples[i].target_mph);
}
