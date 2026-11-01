const { app, ipcMain, Tray, Menu, nativeImage, screen, globalShortcut } = require('electron');
const path = require('path');
const os = require('os');
const { WindowManager } = require('./window-manager');
const { SettingsManager } = require('../domain/settings-manager');
const { WidgetStateMachine } = require('../domain/state-machine');
const { DialogueManager } = require('../domain/dialogue-manager');
const { NativeFollower } = require('../adapters/native-follower');
const { ClickEffects } = require('../domain/click-effects');
const { QuotaAdapter } = require('../adapters/quota-adapter');
const { Logger } = require('../shared/logger');
const logger = new Logger('Main');
const dataDir = process.env.WIDGET_DATA_DIR || path.join(os.homedir(), '.doubao-nailoong-widget');
app.disableHardwareAcceleration();
app.setName('大肥豆插件');
app.setPath('userData', path.join(dataDir, 'runtime'));
let wm, settings, machine, dialogues, adapter, tray, timer, effects, follower;
let desktopBounds, hostStatus=null, followerRetry;
let followerWanted=false;
let form = 'doubao';
let manualForm = false;
let quitting = false;

/** Current state is produced in the main process, never accepted from renderer. */
function snapshot() {
  return {artShift:wm.artShift,facing:wm.facing,dockSide:wm.dockSide,settings: settings.getAll(), displayScale: wm.effectiveScale || settings.get('scale'), quota: adapter.getSnapshot(), form,
    easterExpression: effects?.expression || null, hostStatus, state: machine.getCurrentState(), stateSnapshot: machine.getSnapshot(), currentDialogue: dialogues.getCurrentText()};
}
function broadcast() {
  for (const win of [wm?.getMainWindow(), wm?.getSettingsWindow()]) {
    if (win && !win.isDestroyed()) win.webContents.send('widget:state-update', snapshot());
  }
}
function chooseDialogue(extra = {}) {
  const text = dialogues.selectDialogue({state: machine.getCurrentState(), quota: adapter.getSnapshot(), form, ...extra}).text;
  broadcast();
  return text;
}
/** Persist before reporting success. */
async function applySettings(updates) {
  const oldHostMode=settings.get('hostWindowOnly');
  const oldForm=settings.get('defaultForm');
  settings.update(updates);
  if (!await settings.save()) throw new Error('设置写入失败');
  if (Object.hasOwn(updates, 'defaultForm') && updates.defaultForm!==oldForm) { form = settings.get('defaultForm'); manualForm = true; }
  adapter.discoverService.manualPort = settings.get('cdpPort');
  adapter.discoverService.clearCache();
  wm.currentForm=form;
  wm.layoutSettings=settings.getAll();
  wm.hostWindowOnly=settings.get('hostWindowOnly');
  if(oldHostMode!==settings.get('hostWindowOnly'))await syncFollower();
  if(!settings.get('hostWindowOnly'))wm.setAlwaysOnTop(settings.get('alwaysOnTop'));
  wm.setClickThrough(settings.get('clickThrough'));
  wm.applyScale(settings.get('scale'));
  machine.updateByQuota(adapter.getSnapshot(), settings.get('warningThreshold'));
  updateTray(); broadcast();
  return settings.getAll();
}
function updateTray() {
  tray?.setContextMenu(Menu.buildFromTemplate([
    {label:'大肥豆插件', enabled:false},
    {label:'显示挂件', click:()=>{if(settings.get('hostWindowOnly')){followerWanted=true;if(!follower.child)follower.start(wm.getMainWindow());}else wm.showMainWindow();}},
    {label:'隐藏挂件', click:async()=>{followerWanted=false;clearTimeout(followerRetry);await follower.stop();wm.hideMainWindow();}},
    {label:'仅在豆包窗口内显示',type:'checkbox',checked:settings.get('hostWindowOnly'),click:item=>applySettings({hostWindowOnly:item.checked}).catch(e=>logger.error(e.message))},
    {label:'设置', click:()=>wm.createSettingsWindow()},
    {label:'切换形态', click:()=>switchForm(form === 'doubao' ? 'nailoong' : 'doubao')},
    {type:'separator'},
    ...['alwaysOnTop','clickThrough'].map((key,i)=>({label:['始终置顶','鼠标穿透'][i], type:'checkbox', checked:settings.get(key), click:item=>applySettings({[key]:item.checked}).catch(e=>logger.error(e.message))})),
    {label:'停靠左下角',click:()=>dock('left')},{label:'停靠右下角',click:()=>dock('right')},
    {label:'重置位置', click:resetPosition},
    {label:'退出', click:()=>app.quit()}
  ]));
}
async function switchForm(next) {
  if (!['doubao','nailoong'].includes(next)) throw new Error('未知形态');
  effects.clear();
  await applySettings({defaultForm:next});
  chooseDialogue({formChange:next});
  sound('switch');
}
async function dock(side){const patch=wm.dock(side);if(patch){settings.update(patch);wm.layoutSettings=settings.getAll();await settings.save();broadcast();}}
function resetPosition() {
  if(settings.get('hostWindowOnly')){const area=wm.hostBounds,w=wm.getWindowBounds();if(area&&w)wm.moveWindow(Math.round(area.x+area.width-w.width-6),Math.round(area.y+area.height-w.height-6));return;}
  const pos = wm.resetPosition();
  if (pos) { settings.update(pos); settings.save(); }
}
function sound(kind) {
  if (settings.get('sound') && ['press','release','switch','notification','success'].includes(kind))
    wm.getMainWindow()?.webContents.send('widget:sound', {kind, volume:settings.get('volume')});
}
/** Preserve desktop position separately from the host-relative placement. */
async function syncFollower() {
  clearTimeout(followerRetry);
  if(settings.get('hostWindowOnly')) {
    followerWanted=true;
    if(!desktopBounds)desktopBounds=wm.getWindowBounds();
    wm.hideMainWindow();wm.setAlwaysOnTop(false);follower.start(wm.getMainWindow());
  } else {
    followerWanted=false;
    await follower.stop();clearTimeout(followerRetry);wm.hostBounds=null;hostStatus=null;
    if(desktopBounds)wm.getMainWindow().setBounds(desktopBounds);
    desktopBounds=null;wm.applyScale(settings.get('scale'));wm.setAlwaysOnTop(settings.get('alwaysOnTop'));wm.showMainWindow();
  }
}

/** IPC allowlist with sender and data validation. */
function setupIpc() {
  const handle = (name, fn) => ipcMain.handle('widget:'+name, (event, ...args) => {
    const valid = [wm?.getMainWindow(), wm?.getSettingsWindow()].some(w=>w && w.webContents === event.sender);
    if (!valid || event.senderFrame !== event.sender.mainFrame) throw new Error('Invalid sender');
    return fn(...args);
  });
  handle('get-state', snapshot);
  handle('dock', dock);
  handle('get-settings', ()=>settings.getAll());
  handle('update-settings', applySettings);
  handle('reset-settings', async()=>{ settings.reset(); form=settings.get('defaultForm'); const saved=await applySettings(settings.getAll());await syncFollower(); manualForm=false; return saved; });
  handle('open-settings', ()=>{wm.createSettingsWindow();});
  handle('reset-position', resetPosition);
  handle('quit', ()=>app.quit());
  handle('refresh-quota', ()=>adapter.refresh());
  handle('switch-form', switchForm);
  handle('next-dialogue', ()=>chooseDialogue({force:true}));
  handle('character-click', ()=>{effects.click(form,['thinking','warning','error'].includes(machine.getPersistentState()));});
  handle('get-dialogue', ()=>dialogues.getCurrentText());
  handle('play-sound', sound);
  handle('clear-cache', ()=>{
    adapter.snapshot={fiveHour:null,weekly:null,fetchedAt:null,online:false,cached:false,stale:false};
    adapter.lastSampleTime=null; adapter.discoverService.clearCache(); dialogues.clearHistory();
    machine.updateByQuota(adapter.getSnapshot()); broadcast();
  });
  for (const [name,fn] of [['trigger-pointer-down',()=>{machine.handlePointerDown();sound('press');}],['trigger-pointer-up',()=>{machine.handlePointerUp();sound('release');}],['trigger-petting',()=>machine.handlePetting()],['trigger-success',()=>machine.handleSuccess()]]) handle(name,fn);
  const point = p => { if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x)>100000 || Math.abs(p.y)>100000) throw new Error('Invalid point'); return {x:Math.round(p.x),y:Math.round(p.y)}; };
  handle('drag-start', p=>{wm.handleDragStart(point(p));machine.handleDragStart();});
  handle('drag-move', p=>{wm.handleDragMove(point(p));broadcast();});
  handle('drag-end', async p=>{const pos=wm.handleDragEnd(point(p),settings.getAll());logger.info('Drag end',p,pos);machine.handleDragEnd();if(pos){settings.update(pos);wm.layoutSettings=settings.getAll();await settings.save();}broadcast();return pos;});
  handle('hit-test', interactive=>{if(typeof interactive !== 'boolean') throw new Error('Invalid hit test');wm.setClickThrough(wm.isDragging||machine.getCurrentState()==='pressed'?false:settings.get('clickThrough') || !interactive);});
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>wm?.showMainWindow());
  app.whenReady().then(async()=>{
    settings=new SettingsManager({configPath:path.join(dataDir,'settings.json')}); await settings.load();
    wm=new WindowManager(); wm.layoutSettings=settings.getAll();wm.hostWindowOnly=settings.get('hostWindowOnly'); effects=new ClickEffects(); effects.on('change',broadcast); follower=new NativeFollower(); machine=new WidgetStateMachine(); dialogues=new DialogueManager(); await dialogues.load();
    adapter=new QuotaAdapter(); adapter.discoverService.manualPort=settings.get('cdpPort'); form=settings.get('defaultForm');
    setupIpc();
    let lastPersistent=machine.getPersistentState();
    machine.on('state-change',()=>{if(machine.getPersistentState()!==lastPersistent){lastPersistent=machine.getPersistentState();chooseDialogue();}else broadcast();});
    follower.on('message',message=>{
      hostStatus=message;
      const widget=wm.getMainWindow();
      if(settings.get('hostWindowOnly')&&followerWanted){
        if(message.available&&message.fits){if(!widget.isVisible()){widget.showInactive();widget.webContents.invalidate();}}
        else if(widget.isVisible())widget.hide();
      }
      if(message.bounds){const next=screen.screenToDipRect(wm.getMainWindow(),message.bounds);const old=wm.hostBounds;wm.hostBounds=next;if(!old||old.width!==next.width||old.height!==next.height){wm.applyScale(settings.get('scale'));broadcast();}}
    });
    follower.on('failure',message=>logger.error('Window follower:',message));
    follower.on('exit',()=>{if(settings.get('hostWindowOnly')&&followerWanted&&!quitting){wm.hideMainWindow();clearTimeout(followerRetry);followerRetry=setTimeout(()=>{if(settings.get('hostWindowOnly')&&followerWanted&&!quitting)follower.start(wm.getMainWindow());},2000);}});
    adapter.on('change',q=>{
      machine.updateByQuota(q,settings.get('warningThreshold'));
      if (!manualForm && settings.get('autoSwitchForm') && q.online && !q.stale) {
        const known=[q.fiveHour,q.weekly].filter(Number.isFinite);
        const next=known.some(n=>n<=settings.get('warningThreshold')) ? 'nailoong' : known.length===2 && known.every(n=>n>50) ? 'doubao' : form;
        if(next!==form){form=next;wm.currentForm=form;wm.restoreLayout();chooseDialogue({formChange:form});sound('switch');}
      }
      broadcast();
    });
    const win=wm.createMainWindow(settings.getAll());
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    app.on('web-contents-created',(_e,contents)=>{
      contents.on('will-navigate',event=>event.preventDefault());
      contents.setWindowOpenHandler(()=>({action:'deny'}));
    });
    wm.applyScale(settings.get('scale')); wm.setClickThrough(settings.get('clickThrough'));
    const icon=nativeImage.createFromPath(path.join(__dirname,'../../assets/ui/icon.png'));
    tray=new Tray(icon.resize({width:24,height:24})); tray.setToolTip('大肥豆插件'); tray.on('double-click',()=>wm.showMainWindow());updateTray();
    globalShortcut.register('CommandOrControl+Shift+S',()=>wm.createSettingsWindow());
    globalShortcut.register('CommandOrControl+Shift+R',()=>{applySettings({clickThrough:false});resetPosition();wm.showMainWindow();});
    if(settings.get('hostWindowOnly'))await syncFollower();
    adapter.start();
    let lastDialogue=Date.now();
    timer=setInterval(()=>{
      machine.checkIdle();
      const interval={high:30000,medium:90000,low:300000}[settings.get('dialogueFrequency')];
      if(Date.now()-lastDialogue>=interval){lastDialogue=Date.now();chooseDialogue();}
    },10000);
    screen.on('display-removed',resetPosition);
    logger.info('Application initialized');
  }).catch(e=>{logger.error(e.stack);app.exit(1);});
  app.on('window-all-closed',()=>{if(!tray)app.quit();});
  app.on('before-quit',()=>{
    if(quitting)return;quitting=true;clearInterval(timer);clearTimeout(followerRetry);follower?.stop();effects?.destroy();adapter?.stop();machine?.destroy();globalShortcut.unregisterAll();
    const bounds=settings?.get('hostWindowOnly')?desktopBounds:wm?.getWindowBounds();if(bounds){settings.update({x:bounds.x,y:bounds.y});settings.save();}
    wm?.destroyAll();tray?.destroy();
  });
}
