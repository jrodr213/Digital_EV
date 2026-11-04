const {spawn} = require('node:child_process');
const {randomBytes} = require('node:crypto');
const {createInterface} = require('node:readline');
const path = require('node:path');

function backendCommand({packaged, resourcesPath, projectRoot, platform = process.platform}) {
  if (packaged) return {command: path.join(resourcesPath, 'backend', platform === 'win32' ? 'ev-twin-backend.exe' : 'ev-twin-backend'), args: []};
  return {command: path.join(projectRoot, '.venv', platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'), args: [path.join(projectRoot, 'desktop/backend_entry.py')]};
}

function startBackend({packaged, resourcesPath, projectRoot, dataDirectory, log}) {
  const token = randomBytes(32).toString('hex');
  const {command, args} = backendCommand({packaged, resourcesPath, projectRoot});
  const child = spawn(command, args, {
    cwd: packaged ? resourcesPath : projectRoot,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {...process.env, PYTHONPATH: packaged ? '' : projectRoot, PYTHONUNBUFFERED: '1',
      EV_DB: path.join(dataDirectory, 'ev.sqlite'), EV_DESKTOP_TOKEN: token, EV_PREVIEW_MODE: 'desktop'},
  });
  let stopping = false, exited = false;
  const stopped = new Promise(resolve => child.once('exit', () => {exited = true; resolve();}));
  child.stderr.on('data', data => log(data.toString()));
  child.stdin.on('error', () => {});
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('The simulation engine did not start within 90 seconds.')), 90000);
    const lines = createInterface({input: child.stdout});
    function finish(error, value) {clearTimeout(timer); error ? reject(error) : resolve(value);}
    child.once('error', error => finish(error));
    child.once('exit', (code, signal) => {
      lines.close();
      if (!stopping) finish(Error(`The simulation engine stopped (${signal ?? code}). See desktop.log in the data folder.`));
    });
    lines.on('line', line => {
      if (!line.startsWith('EV_TWIN_READY ')) {log(line + '\n'); return;}
      try {
        const {url} = JSON.parse(line.slice('EV_TWIN_READY '.length));
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || !parsed.port) throw Error('Invalid engine address.');
        finish(null, {url: parsed.origin, token});
      } catch (error) {finish(error);}
    });
  });
  async function stop() {
    stopping = true;
    if (exited || !child.pid) return;
    child.stdin.end();
    let timer;
    await Promise.race([stopped, new Promise(resolve => {timer = setTimeout(resolve, 12000);})]);
    clearTimeout(timer);
    if (!exited) {child.kill('SIGKILL'); await stopped;}
  }
  return {child, ready, stop};
}

function isLocalURL(value, origin) {
  try {return new URL(value).origin === origin;} catch {return false;}
}

function isExternalURL(value) {
  try {return ['http:', 'https:'].includes(new URL(value).protocol);} catch {return false;}
}

module.exports = {backendCommand, startBackend, isLocalURL, isExternalURL};
