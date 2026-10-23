// Exercise the real WebGL raycaster with pointer movement, not mocked hover state.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});
 await page.getByLabel('Active design').selectOption('team-ev-belt');
 await page.locator('nav').getByRole('button',{name:'3D Vehicle Viewer',exact:true}).click();
 const viewport=page.locator('.viewport');
 const canvas=viewport.locator('canvas');await canvas.waitFor();
 const box=await canvas.boundingBox();
 assert.ok(box);
 const points=new Map();
 // Scan only the region occupied by the car, discovering projected mesh positions.
 for(let y=box.height*.34;y<box.height*.78;y+=14){
  for(let x=box.width*.28;x<box.width*.76;x+=14){
   await page.mouse.move(box.x+x,box.y+y);
   await page.evaluate(()=>new Promise(requestAnimationFrame));
   const tooltip=page.getByRole('tooltip');
   if(!await tooltip.count())continue;
   const title=await tooltip.locator('strong').innerText();
   if(!points.has(title))points.set(title,{x:box.x+x,y:box.y+y});
  }
  if([...points.keys()].some(s=>s.startsWith('Provisional traction motor'))&&[...points.keys()].some(s=>s.startsWith('Battery pack'))&&[...points.keys()].some(s=>s.startsWith('Wheels and tires')))break;
 }
 const find=prefix=>[...points].find(([name])=>name.startsWith(prefix))?.[1];
 const motor=find('Provisional traction motor'),battery=find('Battery pack'),tires=find('Wheels and tires');
 assert.ok(motor,'Motor surface not picked');assert.ok(battery,'Battery placeholder not picked');assert.ok(tires,'Wheel/hub surfaces not picked');
 await page.mouse.move(motor.x,motor.y);
 const tooltip=page.getByRole('tooltip');
 await tooltip.getByText('Converts electrical power into mechanical torque to drive the wheels.',{exact:true}).waitFor();
 await tooltip.getByText('48 V',{exact:true}).waitFor();
 await tooltip.getByText('2,000 W',{exact:true}).waitFor();
 assert.equal(await canvas.evaluate(e=>e.style.cursor),'pointer');
 const tipBox=await tooltip.boundingBox();
 assert.ok(tipBox.x>=box.x&&tipBox.x+tipBox.width<=box.x+box.width+1);
 assert.ok(tipBox.y>=box.y&&tipBox.y+tipBox.height<=box.y+box.height+1);
 await mkdir('../docs/screenshots',{recursive:true});
 await viewport.screenshot({path:'../docs/screenshots/team-hover.png'});
 await page.mouse.click(motor.x,motor.y);
 await page.locator('.inspect').getByText('Provisional traction motor / eBay 256877952903',{exact:true}).waitFor();
 await page.locator('.inspect').getByRole('button',{name:'Close',exact:true}).click();
 await page.mouse.move(battery.x,battery.y);
 await tooltip.getByText('Specifications pending',{exact:true}).waitFor();
 await tooltip.getByText('Not supplied',{exact:true}).waitFor();
 assert.ok(!(await tooltip.innerText()).includes('0 kg'),'Unknown mass shown as zero');
 await page.mouse.move(tires.x,tires.y);
 await page.evaluate(()=>new Promise(requestAnimationFrame));
 await tooltip.getByText('Wheels and tires / design pending',{exact:true}).waitFor();
 await page.mouse.move(box.x+5,box.y+5);
 await tooltip.waitFor({state:'hidden'});
 await page.mouse.move(motor.x,motor.y);await page.mouse.down();
 await page.mouse.move(motor.x+80,motor.y+20,{steps:8});
 await tooltip.waitFor({state:'hidden'});await page.mouse.up();
 assert.equal(await page.locator('.inspect').count(),0,'Orbit drag selected a part');
 await page.mouse.wheel(0,100);
 await page.locator('nav').getByRole('button',{name:'Home Dashboard',exact:true}).click();
 assert.equal(await page.getByRole('tooltip').count(),0,'Tooltip survived viewer navigation');
 assert.deepEqual(errors,[]);
 console.log('PASS: mesh hover descriptions, listed specs, unknown placeholders, wheel/hub picking, cursor feedback, tooltip bounds, click inspection, orbit/zoom and cleanup.');
}finally{await browser.close()}
