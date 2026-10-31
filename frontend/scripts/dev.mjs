// One localhost address for the source frontend and automatically reloaded API.
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,watch} from 'node:fs';
import {createServer as createNetServer} from 'node:net';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from 'vite';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const frontend=join(root,'frontend');
const address='http://127.0.0.1:8000';
const apiAddress='http://127.0.0.1:8001';
const windows=process.platform==='win32';
const python=join(root,'.venv',windows?'Scripts':'bin',windows?'python.exe':'python');
let api,server,stopping=false,reloading=false,reloadPending=false,reloadTimer;
const watchers=[];

async function readHealth(base){
 const response=await fetch(`${base}/api/health`,{cache:'no-store',signal:AbortSignal.timeout(1000)});
 if(!response.ok)throw Error(`Health check returned ${response.status}`);
 return response.json();
}

function ownLiveApi(health){
 const normalize=value=>windows?resolve(value).toLowerCase():resolve(value);
 return health.status==='ok'&&health.fastsim&&health.preview_mode==='live'&&
  typeof health.workspace==='string'&&normalize(health.workspace)===normalize(root);
}

async function assertPortFree(port){
 const probe=createNetServer();
 await new Promise((accept,reject)=>{
  probe.once('error',()=>reject(Error(`Port ${port} is already in use. Stop the existing server before starting this live preview.`)));
  probe.listen(port,'127.0.0.1',accept);
 });
 await new Promise((accept,reject)=>probe.close(error=>error?reject(error):accept()));
}

function stopApi(){
 const child=api;
 api=undefined;
 if(child?.pid&&child.exitCode===null){
  if(windows){
   // Include the virtualenv launcher and its Python process, without sending
   // Windows console signals to Vite or the terminal running this launcher.
   const result=spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
   if(result.error)throw result.error;
   if(result.status!==0)throw Error('Could not stop the previous Python API process.');
  }else{
   try{process.kill(-child.pid,'SIGTERM')}catch(error){if(error.code!=='ESRCH')throw error}
  }
 }
}

function startApi(){
 const child=spawn(python,['-m','uvicorn','backend.api.main:app','--host','127.0.0.1','--port','8001'],{
  cwd:root,env:{...process.env,EV_PREVIEW_MODE:'live'},stdio:'inherit',windowsHide:true,detached:!windows,
 });
 api=child;
 child.once('error',error=>{console.error(`API startup failed: ${error.message}`);void shutdown(1)});
 child.once('exit',(code,signal)=>{
  if(!stopping&&api===child){
   api=undefined;
   console.error(`API stopped (${signal??code}).`);
   if(!server)void shutdown(code||1);
  }
 });
}

async function waitForApi(){
 for(let attempt=0;attempt<100&&!stopping;attempt++){
  if(!api)throw Error('API stopped before it became ready.');
  try{if(ownLiveApi(await readHealth(apiAddress)))return}catch{/* Wait for API startup. */}
  await delay(200);
 }
 if(!stopping)throw Error('API did not become ready; check its output above.');
}

async function reloadApi(){
 reloadPending=true;
 if(reloading||stopping)return;
 reloading=true;
 try{
  do{
   reloadPending=false;
   console.log('Project source changed; updating the car and restarting the API.');
   stopApi();
   startApi();
   await waitForApi();
   server?.ws.send({type:'full-reload'});
  }while(reloadPending&&!stopping);
 }catch(error){console.error(`${error.message} Save corrected source to retry the update.`)}
 finally{reloading=false}
}

async function shutdown(code){
 if(stopping)return;
 stopping=true;
 clearTimeout(reloadTimer);
 for(const watcher of watchers)watcher.close();
 if(server){
  try{await server.close()}catch(error){console.error(`Preview shutdown: ${error.message}`)}
 }
 try{stopApi()}catch(error){console.error(`API shutdown: ${error.message}`);code=1}
 process.exit(code);
}

process.on('SIGINT',()=>void shutdown(0));
process.on('SIGTERM',()=>void shutdown(0));

async function main(){
 // A live preview already follows file changes, so it is safe to reuse.
 try{
  if(ownLiveApi(await readHealth(address))){
   const page=await fetch(address,{cache:'no-store',signal:AbortSignal.timeout(1000)});
   if(page.ok&&(await page.text()).includes('/@vite/client')){
    console.log(`EV / Twin ready: ${address} (live source; already running)`);
    return;
   }
  }
 }catch{/* No reusable live preview. Port checks below diagnose conflicts. */}

 if(!existsSync(python))throw Error('Python environment missing. Run scripts/Setup.ps1 first.');
 await assertPortFree(8000);
 await assertPortFree(8001);
 startApi();
 await waitForApi();
 for(const directory of ['backend','scripts','data/components','data/vehicles']){
  const watcher=watch(join(root,directory),{recursive:true},(event,filename)=>{
   if(filename?.endsWith('.py')||filename?.endsWith('.json')){
    clearTimeout(reloadTimer);
    reloadTimer=setTimeout(()=>void reloadApi(),500);
   }
  });
  watcher.on('error',error=>{console.error(`Source watcher failed: ${error.message}`);void shutdown(1)});
  watchers.push(watcher);
 }
 server=await createServer({root:frontend,configFile:join(frontend,'vite.config.ts')});
 await server.listen();
 console.log(`EV / Twin ready: ${address} (live source; Ctrl+C to stop)`);
 console.log(`API docs: ${address}/docs | Frontend and Python edits reload automatically.`);
}

main().catch(error=>{console.error(error.message);void shutdown(1)});
