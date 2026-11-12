const {_electron:electron}=require('playwright');const {execFileSync,spawn}=require('child_process');const fs=require('fs');const path=require('path');const assert=require('assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),dir=path.join(root,'artifacts/visibility-test');fs.mkdirSync(dir,{recursive:true});const command=path.join(dir,'command.txt');fs.writeFileSync(command,'show');
 const exe=path.join(dir,'LayerDoubaoFixture.exe');execFileSync(path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/target:winexe','/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/out:'+exe,path.join(root,'tools/fixtures/HostWindow.cs')]);
 try{fs.unlinkSync(command+'.ready');}catch{}
 const host=spawn(exe,[command],{windowsHide:true});host.on('exit',(code,signal)=>console.log('Fixture exit',code,signal));let app,cover;
 for(let i=0;i<100&&!fs.existsSync(command+'.ready');i++)await new Promise(r=>setTimeout(r,50));
 assert.ok(fs.existsSync(command+'.ready'),'Fixture host is ready before discovery');
 const fixtureHandle=fs.readFileSync(command+'.ready','utf8');
 const env={...process.env,WIDGET_DATA_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;fs.writeFileSync(path.join(dir,'settings.json'),JSON.stringify({hostWindowOnly:true}));
 const nativeSource=path.join(dir,'WindowFollower.cs'),nativeExe=path.join(dir,'WindowFollower.exe'),bootstrap=path.join(dir,'bootstrap.cjs');
 fs.writeFileSync(nativeSource,fs.readFileSync(path.join(root,'src/native/WindowFollower.cs'),'utf8').replace('p.ProcessName,"Doubao"','p.ProcessName,"LayerDoubaoFixture"'));
 execFileSync(path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/out:'+nativeExe,nativeSource]);
 fs.writeFileSync(bootstrap,`const cp=require('node:child_process'),spawn=cp.spawn;cp.spawn=function(file,...a){return spawn.call(this,file.endsWith('WindowFollower.exe')?${JSON.stringify(nativeExe)}:file,...a);};require(${JSON.stringify(path.join(root,'src/main/index.js'))});`);
 try {
 app=await electron.launch({executablePath:require('electron'),args:[bootstrap],env});const page=await app.firstWindow();const [settings]=await Promise.all([app.waitForEvent('window'),page.evaluate(()=>widgetAPI.openSettings())]);await settings.waitForLoadState();
 async function wait(predicate){let state;for(let i=0;i<100;i++){state=await settings.evaluate(()=>widgetAPI.getState());if(predicate(state.hostStatus))return state.hostStatus;await settings.waitForTimeout(100);}throw Error(JSON.stringify(state.hostStatus)+' fixtureExit='+host.exitCode+' command='+fs.readFileSync(command,'utf8'));}
 const visible=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).isVisible());
 await settings.bringToFront();await wait(s=>s?.available&&s.visible&&s.hostId===fixtureHandle);assert.equal(await visible(),true);
 fs.writeFileSync(command,'hide');await wait(s=>!s?.available&&!s?.visible);assert.equal(await visible(),false);
 fs.writeFileSync(command,'show');await settings.bringToFront();await wait(s=>s?.available&&s.visible&&s.hostId===fixtureHandle);assert.equal(await visible(),true);
 fs.writeFileSync(command,'minimize');await wait(s=>!s?.available&&!s?.visible);assert.equal(await visible(),false);
 fs.writeFileSync(command,'show');await settings.bringToFront();await wait(s=>s?.available&&s.visible);
 cover=await electron.launch({executablePath:require('electron'),args:[path.join(root,'tools/fixtures/cover-window.js')],env});await (await cover.firstWindow()).bringToFront();await wait(s=>s?.available&&s.visible&&!s.nativeTopmost&&s.behindForeground&&s.aboveHost);assert.equal(await visible(),true);
 await cover.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setAlwaysOnTop(true);w.focus();});
 await wait(s=>s?.available&&s.visible&&!s.nativeTopmost&&s.behindForeground&&s.aboveHost);assert.equal(await visible(),true);
 await cover.close();cover=null;await settings.bringToFront();await wait(s=>s?.visible);assert.equal(await visible(),true);
 await app.evaluate(({BrowserWindow})=>{
  global.visibilityTransitions=[];
  const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));
  w.on('show',()=>global.visibilityTransitions.push('show'));w.on('hide',()=>global.visibilityTransitions.push('hide'));
 });
 cover=await electron.launch({executablePath:require('electron'),args:[path.join(root,'tools/fixtures/cover-window.js')],env});
 for(let i=0;i<4;i++){
  await (await cover.firstWindow()).bringToFront();await wait(s=>s?.visible&&s.behindForeground&&s.ownedByHost);
  await settings.bringToFront();await wait(s=>s?.visible&&s.aboveHost&&s.ownedByHost);
 }
 assert.deepEqual(await app.evaluate(()=>global.visibilityTransitions),[],'Switching never hides or re-shows the pet');
 await cover.close();cover=null;
 fs.writeFileSync(command,'exit');await wait(s=>s?.hostId!==fixtureHandle);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'))?.isDestroyed()),false);
 const result={ownedByHost:true,repeatedSwitchesWithoutShowHide:true,hostClosePreservesWidget:true,hostHide:true,hostMinimize:true,otherAppOccludesWithoutHiding:true,widgetImmediatelyAboveHost:true,otherTopmostOccludesWithoutHiding:true,returnShows:true};fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result));console.log(result);
 }finally{if(cover)await cover.close();if(app)await app.close();fs.writeFileSync(command,'exit');setTimeout(()=>{if(host.exitCode===null)host.kill();},500).unref();}
})().catch(e=>{console.error(e);process.exitCode=1;});
