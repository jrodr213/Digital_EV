import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const base=process.env.EV_BASE_URL??'http://127.0.0.1:8000';
const browser=await chromium.launch({channel:process.env.EV_BROWSER??'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();page.setDefaultTimeout(30000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(base);
  await page.evaluate(async()=>{
    document.getElementById('root')?.remove();
    window.physicsFixture=await import('/scripts/drive-physics-fixture.tsx');
    const [vehicles,library]=await Promise.all(['vehicles','components'].map(async name=>(await fetch('/api/'+name)).json()));
    window.fixtureVehicle=vehicles.find(v=>v.id==='team-ev-belt');
    window.fixtureParts=library.filter(p=>window.fixtureVehicle.component_ids.includes(p.id));
  });
  async function setup(options={}){
    await page.evaluate(options=>{
      const vehicle=structuredClone(window.fixtureVehicle),parts=structuredClone(window.fixtureParts);
      vehicle.payload_kg=0;vehicle.auxiliary_w=0;
      const motor=parts.find(p=>p.category==='motor'),drive=parts.find(p=>p.category==='drivetrain');
      // Canonical values here are deliberately synthetic calibration fixtures,
      // not promoted to the user's motor specifications or saved records.
      motor.custom_parameters.installed_quantity=options.motors??2;
      motor.specs={rated_power_kw:(options.motors??2)*2,rated_torque_nm:(options.motors??2)*25,max_rpm:options.rpm??3000,efficiency:.9};
      motor.units={rated_power_kw:'kW',rated_torque_nm:'N m',max_rpm:'rpm',efficiency:'fraction'};
      drive.specs.gear_ratio=options.ratio??1;drive.specs.wheel_diameter_m=2*(options.radius??.28);drive.units.wheel_diameter_m='m';
      window.physicsFixture.mount(vehicle,parts,{dryMass:options.mass??250,payload:0,batteryA:300,controllerA:300,controllerW:20000,stallLossW:100,grip:options.grip??.85,rolling:0,dragArea:0},options.environment??'track');
    },options);
    await page.waitForFunction(()=>window.physicsFixture.ready());
    return await step(180);
  }
  const step=(n,input={})=>page.evaluate(({n,input})=>window.physicsFixture.advance(n,input),{n,input});
  let rest=await setup();assert.ok(Math.abs(rest.speed)<.02);assert.equal(rest.contacts,4);assert.ok(Math.abs(rest.mass-250)<.01);
  const light=await step(360,{forward:true});
  await setup({mass:500});const heavy=await step(360,{forward:true});
  assert.ok(light.speed>heavy.speed*1.4,`Mass response: ${light.speed} vs ${heavy.speed}`);
  await setup();const forward=await step(360,{forward:true}),braked=await step(240,{brake:true});
  assert.ok(Math.abs(braked.speed)<Math.abs(forward.speed)*.2,`Braking: ${forward.speed} → ${braked.speed}`);
  await setup({radius:.56});const large=await step(240,{forward:true});
  await setup({radius:.28});const small=await step(240,{forward:true});
  assert.ok(small.speed>large.speed*1.3,`Wheel-radius force: ${small.speed} vs ${large.speed}`);
  await setup({ratio:2});const geared=await step(240,{forward:true});
  assert.ok(geared.speed>small.speed*1.2,`Ratio torque: ${geared.speed} vs ${small.speed}`);
  await setup({motors:1});const one=await step(240,{forward:true});
  assert.ok(small.speed>one.speed*1.4,`Both motors: ${small.speed} vs ${one.speed}`);
  await setup({grip:.08});const slippery=await step(360,{forward:true});
  assert.ok(slippery.speed<light.speed*.9,`Low grip: ${slippery.speed} vs ${light.speed}`);
  await setup();const reverse=await step(240,{backward:true});assert.ok(reverse.speed<-.1,'Reverse is torque-driven');
  await setup({ratio:3});await step(240,{forward:true});const turned=await step(240,{forward:true,left:true});
  assert.ok(Math.abs(turned.position[0])>1,'Steering changes the real rigid-body path');
  await setup({environment:'hills',ratio:4});let uphill;
  for(let i=0;i<30;i++){uphill=await step(60,{forward:true});if(uphill.position[2]>40)break;}
  assert.ok(uphill.position[1]>.7&&uphill.slope>3,`Real hill contact ${JSON.stringify(uphill)}`);
  await step(150,{brake:true});const rollback=await step(480);assert.ok(rollback.speed<0,'Gravity produces rollback with no throttle');
  await setup({environment:'terrain',ratio:4});let gravel;
  for(let i=0;i<40;i++){gravel=await step(60,{forward:true});if(gravel.position[2]>50)break;}
  assert.ok(gravel.position[2]>40&&gravel.contactMu<.4,`Gravel collider grip ${JSON.stringify(gravel)}`);
  assert.ok(gravel.energyWh>0&&gravel.soc<.9,'Integrated battery use');
  for(const environment of ['circuit','city','slalom','rally']){
    const resting=await setup({environment});assert.equal(resting.contacts,4,`${environment}: four wheel contacts at spawn`);
    const courseProbes=await page.evaluate(async id=>{
      const {coursePoints}=await import('/src/driving/courses.ts');
      const points=coursePoints(id);
      return [.04,.2,.5,.75,.95].map(t=>{
        const point=points[Math.round(t*(points.length-1))];return {t,point,hit:window.physicsFixture.probe(point)};
      });
    },environment);
    if(['circuit','rally'].includes(environment))for(const {t,point,hit} of courseProbes){
      assert.ok(hit,`${environment}: real road contact at ${t}`);
      assert.ok(Math.abs(hit.height-point[1])<.025,`${environment}: collider matches visible road at ${t}`);
      const mu=environment==='rally'&&((t>.1&&t<.68)||t>.82)?.85*.32:.85;
      assert.ok(Math.abs(hit.mu-mu)<.001,`${environment}: actual road grip at ${t}: ${hit.mu}`);
    }
    if(environment==='city'){
      const [street,building,parking]=await page.evaluate(()=>[[0,0,20],[20,0,20],[110,0,40]].map(p=>window.physicsFixture.probe(p)));
      assert.ok(Math.abs(street.height)<.01&&Math.abs(parking.height)<.01,'City roads and parking have level colliders');
      assert.ok(building.height>3,'City buildings are collision obstacles');
    }
    if(environment==='slalom'){
      const cone=await page.evaluate(()=>window.physicsFixture.probe([-7,0,18]));assert.ok(cone.height>.5,'Slalom cones are collision obstacles');
    }
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: real Ecctrl/Rapier fixed-step stationary, selected mass, braking, wheel radius, ratio, both motors, low grip, reverse, hill ascent/rollback, battery consumption, all seven course spawns, curved road contact heights, rally grip changes, and city/cone collision obstacles.',{light:light.speed,heavy:heavy.speed,small:small.speed,large:large.speed,geared:geared.speed,one:one.speed,slippery:slippery.speed,uphill:uphill.slope,rollback:rollback.speed,gravel:gravel.contactMu});
}finally{await browser.close();}
