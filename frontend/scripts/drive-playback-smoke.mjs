import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const base=process.env.EV_BASE_URL??'http://127.0.0.1:8000';
const browser=await chromium.launch({channel:process.env.EV_BROWSER??'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
page.setDefaultTimeout(20000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const snapshot=async()=>JSON.stringify(await Promise.all(['components','vehicles','results'].map(async path=>(await page.request.get(`${base}/api/${path}`)).json())));
const seek=async(locator,value)=>locator.evaluate((element,t)=>{
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,String(t));
 element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));
},value);
const state=async region=>region.locator('[data-run-id]').evaluateAll(elements=>elements.map(e=>({id:e.dataset.runId,distance:Number(e.dataset.distanceM),speed:Number(e.dataset.speedMps),angle:e.dataset.wheelRadians})));
function position(run,time){
 const rows=run.samples,start=rows[0].time_s,t=Math.min(rows.at(-1).time_s-start,time);
 let index=0;while(index+1<rows.length&&rows[index+1].time_s-start<=t)index++;
 if(rows[0].distance_m!==undefined){const a=rows[index],b=rows[Math.min(index+1,rows.length-1)];const u=a===b?0:(t+start-a.time_s)/(b.time_s-a.time_s);return a.distance_m+(b.distance_m-a.distance_m)*u-rows[0].distance_m;}
 let distance=0;for(let i=1;i<=index;i++)distance+=(rows[i].speed_mph+rows[i-1].speed_mph)*.44704/2*(rows[i].time_s-rows[i-1].time_s);
 const a=rows[index],b=rows[Math.min(index+1,rows.length-1)],dt=t+start-a.time_s;
 return distance+a.speed_mph*.44704*dt+(a===b?0:(b.speed_mph-a.speed_mph)*.44704*dt*dt/(2*(b.time_s-a.time_s)));
}
await mkdir('../docs/screenshots',{recursive:true});
try{
 const before=await snapshot();
 const runs=await (await page.request.get(`${base}/api/results`)).json();
 assert.ok(runs.length>=2,'Save at least two test drives before this read-only check.');
 const selected=[...runs].reverse().slice(0,3),full=await Promise.all(selected.map(async run=>(await page.request.get(`${base}/api/results/${run.id}`)).json()));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('nav').getByRole('button',{name:'Vehicle Comparison',exact:true}).click();
 const region=page.getByRole('region',{name:'Synchronized test-drive replay'});
 for(let i=0;i<selected.length;i++)await region.getByLabel(i?`Compare test drive ${i+1}`:'Reference test drive',{exact:true}).selectOption(selected[i].id);
 await page.waitForFunction(count=>document.querySelectorAll('.drive-playback [data-run-id]').length===count,selected.length);
 const time=Math.min(30,...full.map(run=>(run.samples.at(-1).time_s-run.samples[0].time_s)/2));
 const slider=region.getByLabel('Drive replay time',{exact:true});
 await seek(slider,time);
 await page.waitForFunction(t=>Math.abs(Number(document.querySelector('.drive-road svg').dataset.time)-t)<.011,time);
 const fixed=await state(region);
 for(let i=0;i<full.length;i++)assert.ok(Math.abs(fixed[i].distance-position(full[i],time))<.00001,'Each lane must follow its own achieved motion at the same second.');
 await region.getByRole('button',{name:'Play replay',exact:true}).click();await page.waitForTimeout(350);
 await region.getByRole('button',{name:'Pause replay',exact:true}).click();
 const paused=await state(region),pausedTime=await slider.inputValue();
 assert.ok(Number(pausedTime)>time);
 await page.waitForTimeout(300);
 assert.equal(await slider.inputValue(),pausedTime);assert.deepEqual(await state(region),paused,'Pause must freeze position and wheel angles.');
 await region.getByLabel('Replay speed',{exact:true}).selectOption('10');
 await region.getByRole('button',{name:'Play replay',exact:true}).click();await page.waitForTimeout(180);
 await region.getByRole('button',{name:'Pause replay',exact:true}).click();
 assert.ok(Number(await slider.inputValue())-Number(pausedTime)>1,'10× must advance simulation time, not change physics.');
 await seek(slider,time);await page.waitForTimeout(60);
 assert.deepEqual(await state(region),fixed,'Seeking back must reproduce all poses, regardless of playback rate.');
 await region.screenshot({path:'../docs/screenshots/drive-replay-comparison.png'});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Replay must fit a phone viewport.');
 await region.getByRole('button',{name:'Restart replay',exact:true}).click();
 assert.ok((await state(region)).every(item=>item.distance===0&&Number(item.angle)===0));
 await page.setViewportSize({width:1440,height:1100});
 await page.locator('nav').getByRole('button',{name:'Performance Results',exact:true}).click();
 await page.getByLabel('Saved result',{exact:true}).selectOption(selected[0].id);
 await page.getByRole('heading',{name:'Synchronized drive replay',exact:true}).waitFor();
 await page.locator('nav').getByRole('button',{name:'3D Vehicle Viewer',exact:true}).click();
 await page.getByLabel('Playback result',{exact:true}).selectOption(selected[0].id);
 const explorer=page.getByRole('region',{name:'Interactive vehicle explorer'}),canvas=explorer.locator('canvas');
 await canvas.waitFor();await seek(explorer.getByLabel('Simulation playback',{exact:true}),time);await page.waitForTimeout(100);
 const angle=await canvas.getAttribute('data-wheel-radians');
 const radius=full[0].assembly.specs.drivetrain.wheel_diameter_m/2;
 assert.ok(Math.abs(Number(angle)-position(full[0],time)/radius)<.00001,'3D wheels must use the saved wheel radius.');
 await page.waitForTimeout(300);assert.equal(await canvas.getAttribute('data-wheel-radians'),angle,'3D wheels must stop while paused.');
 assert.equal(await snapshot(),before,'Playback must preserve components, vehicles and saved result history.');
 assert.deepEqual(errors,[],'Browser runtime errors');
 console.log(`PASS: ${selected.length} synchronized saved drives, achieved positions, pause, scrubbing, 10× clock, mobile, result entry point, deterministic 3D wheels and unchanged saved records.`);
}catch(error){await page.screenshot({path:'../docs/screenshots/drive-replay-failure.png',fullPage:true}).catch(()=>{});throw error}
finally{await browser.close()}
