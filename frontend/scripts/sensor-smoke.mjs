import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080}});
page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});
 await page.getByLabel('Active design').selectOption('team-ev-belt');
 await page.locator('nav').getByRole('button',{name:'3D Vehicle Viewer',exact:true}).click();
 const toolbar=page.locator('.sensor-toolbar');
 await toolbar.getByText('8 sensor types · 12 estimated mounts',{exact:true}).waitFor();
 const sensors=await (await page.request.get('http://127.0.0.1:8000/api/components')).json();
 const selected=sensors.filter(p=>p.custom_parameters.sensor_type);
 assert.equal(selected.length,8);
 assert.equal(await page.locator('.sensor-location').count(),8);
 assert.equal(await page.locator('.viewport .sensor-pin').count(),0,'Floating sensor numbers were removed');
 assert.equal(await page.getByRole('button',{name:'sensors / pending',exact:true}).count(),0);
 for(const sensor of selected){
  const cp=sensor.custom_parameters;
  await page.locator('.sensor-location').filter({has:page.locator('strong',{hasText:cp.sensor_short_name})}).click();
  const inspector=page.locator('.inspect');
  await inspector.getByText(sensor.name,{exact:true}).waitFor();
  assert.equal(await inspector.getByRole('link',{name:'Supplied reference',exact:true}).getAttribute('href'),sensor.datasheet);
  for(const mount of cp.sensor_mounts)await inspector.getByText(mount.label,{exact:true}).waitFor();
  await inspector.getByText('Installed mass unknown',{exact:false}).waitFor();
  if(cp.sensor_type==='force')assert.match(await inspector.innerText(),/does not measure tire pressure/);
  await inspector.getByRole('button',{name:'Close',exact:true}).click();
 }
 // Sensor meshes remain interactive without an overlaid button or locator.
 const canvas=page.locator('.viewport canvas');await canvas.scrollIntoViewIfNeeded();
 const viewport=await canvas.boundingBox();assert.ok(viewport);
 let picked=null;
 for(let y=viewport.height*.45;y<viewport.height*.65&&!picked;y+=5)for(let x=viewport.width*.54;x<viewport.width*.66&&!picked;x+=5){
  await page.mouse.move(viewport.x+x,viewport.y+y);
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  const tooltip=page.getByRole('tooltip');
  if(await tooltip.count()&&(await tooltip.locator('strong').innerText())==='Ultrasonic distance / RCWL-1601')picked={x:viewport.x+x,y:viewport.y+y};
 }
 assert.ok(picked,'The actual sensor geometry must support raycast hover');
 await page.mouse.click(picked.x,picked.y);
 await page.locator('.inspect').getByText('Ultrasonic distance / RCWL-1601',{exact:true}).waitFor();
 await page.locator('.inspect').getByRole('button',{name:'Close',exact:true}).click();
 await page.mouse.move(20,20);
 await mkdir('../docs/screenshots',{recursive:true});
 await page.locator('.viewer').screenshot({path:'../docs/screenshots/team-sensors.png'});
 for(const id of ['team-ev-differential','team-ev-dual-direct']){
  await page.getByLabel('Visualized vehicle').selectOption(id);
  await toolbar.getByText('8 sensor types · 12 estimated mounts',{exact:true}).waitFor();
 }
 await page.getByLabel('Visualized vehicle').selectOption('demo-student-ev');
 assert.equal(await page.locator('.sensor-location').count(),0);
 await page.getByLabel('Visualized vehicle').selectOption('team-ev-belt');
 await page.locator('.sensor-location').filter({hasText:'GPS'}).focus();await page.keyboard.press('Enter');
 await page.locator('.inspect').getByText('GPS / Adafruit Ultimate GPS Breakout',{exact:true}).waitFor();
 await page.locator('.inspect').getByRole('button',{name:'Close',exact:true}).click();
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('nav').getByRole('button',{name:'3D Vehicle Viewer',exact:true}).click();
 await toolbar.getByText('8 sensor types · 12 estimated mounts',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});
 await page.locator('.sensor-location').filter({hasText:'Contact force'}).click();
 await page.locator('.inspect').getByText('Contact force / Interlink FSR 402',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile horizontal overflow');
 await page.locator('.viewer').screenshot({path:'../docs/screenshots/team-sensors-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: 8 sensor products, 12 mounts, no floating numbers, all references/inspectors, sensor mesh hover/click, keyboard interaction, three persisted designs, unchanged demo and mobile layout.');
}finally{await browser.close()}
