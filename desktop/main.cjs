const {app, BrowserWindow, dialog, Menu, session, shell} = require('electron');
const {appendFileSync, existsSync, mkdirSync, renameSync, statSync} = require('node:fs');
const path = require('node:path');
const {startBackend, isLocalURL, isExternalURL} = require('./backend.cjs');

app.setName('EV Twin');
if (process.env.EV_DESKTOP_DATA_DIR) app.setPath('userData', path.resolve(process.env.EV_DESKTOP_DATA_DIR));
let backend, window, origin, shuttingDown = false;
const dataDirectory = app.getPath('userData');
mkdirSync(dataDirectory, {recursive: true});
const logFile = path.join(dataDirectory, 'desktop.log');
if (existsSync(logFile) && statSync(logFile).size > 2_000_000) renameSync(logFile, logFile + '.previous');
const log = message => appendFileSync(logFile, message);

function external(url) {if (isExternalURL(url)) void shell.openExternal(url);}

async function createWindow() {
  window = new BrowserWindow({
    title: 'EV Twin', width: 1440, height: 980, minWidth: 800, minHeight: 600,
    backgroundColor: '#f4f6f7', show: false,
    webPreferences: {nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false},
  });
  window.webContents.setWindowOpenHandler(({url}) => {external(url); return {action: 'deny'};});
  window.webContents.on('will-navigate', (event, url) => {
    if (!isLocalURL(url, origin)) {event.preventDefault(); external(url);}
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.on('closed', () => {window = undefined;});
  window.once('ready-to-show', () => window?.show());
  await window.loadURL(origin);
}

function installMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{role: 'appMenu'}] : []),
    {label: 'File', submenu: [
      {label: 'Open data folder', click: () => void shell.openPath(dataDirectory)},
      {label: 'Open log file', click: () => void shell.openPath(logFile)},
      {type: 'separator'}, {role: 'quit'},
    ]},
    {role: 'editMenu'},
    {label: 'View', submenu: [{role: 'reload'}, {role: 'resetZoom'}, {role: 'zoomIn'}, {role: 'zoomOut'}, {type: 'separator'}, {role: 'togglefullscreen'}]},
    {role: 'windowMenu'},
    {role: 'help', submenu: [{label: 'About EV Twin', click: () => dialog.showMessageBox({
      type: 'info', title: 'EV Twin', message: `EV Twin ${app.getVersion()}`,
      detail: 'Local EV engineering workbench. FASTSim 3.1.0.\nDesigns and simulations stay in your application-data folder.\nPreliminary engineering estimates; component specifications may be unverified.',
    })}]},
  ]));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {if (window) {if (window.isMinimized()) window.restore(); window.focus();}});
  app.whenReady().then(async () => {
    installMenu();
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    backend = startBackend({packaged: app.isPackaged, resourcesPath: process.resourcesPath,
      projectRoot: path.resolve(__dirname, '..'), dataDirectory, log});
    const ready = await backend.ready;
    origin = ready.url;
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const requestHeaders = {...details.requestHeaders};
      // API requests from this local app carry a per-launch secret; external pages never receive it.
      if (isLocalURL(details.url, origin)) requestHeaders['X-EV-Twin-Token'] = ready.token;
      callback({requestHeaders});
    });
    backend.child.once('exit', () => {
      if (!shuttingDown) {dialog.showErrorBox('EV Twin engine stopped', `The simulation engine closed unexpectedly. Restart the app.\nLog: ${logFile}`); app.quit();}
    });
    await createWindow();
    app.on('activate', () => {if (!window) void createWindow();});
  }).catch(error => {
    log(error.stack + '\n');
    dialog.showErrorBox('EV Twin could not start', `${error.message}\n\nLog: ${logFile}`);
    app.quit();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (!backend || shuttingDown) return;
    event.preventDefault(); shuttingDown = true;
    void backend.stop().finally(() => app.quit());
  });
}
