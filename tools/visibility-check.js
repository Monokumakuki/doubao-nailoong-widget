const {_electron:electron}=require('playwright');const {execFileSync,spawn}=require('child_process');const fs=require('fs');const path=require('path');const assert=require('assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),dir=path.join(root,'artifacts/visibility-test');fs.mkdirSync(dir,{recursive:true});const command=path.join(dir,'command.txt');fs.writeFileSync(command,'show');
 const exe=path.join(dir,'Doubao.exe');execFileSync(path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/target:winexe','/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/out:'+exe,path.join(root,'tools/fixtures/HostWindow.cs')]);
 const host=spawn(exe,[command],{windowsHide:true});let app,cover;
 const env={...process.env,WIDGET_DATA_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;fs.writeFileSync(path.join(dir,'settings.json'),JSON.stringify({hostWindowOnly:true}));
 try {
 app=await electron.launch({executablePath:require('electron'),args:[path.join(root,'src/main/index.js')],env});const page=await app.firstWindow();const [settings]=await Promise.all([app.waitForEvent('window'),page.evaluate(()=>widgetAPI.openSettings())]);await settings.waitForLoadState();
 async function wait(predicate){let state;for(let i=0;i<100;i++){state=await settings.evaluate(()=>widgetAPI.getState());if(predicate(state.hostStatus))return state.hostStatus;await settings.waitForTimeout(100);}throw Error(JSON.stringify(state.hostStatus));}
 const visible=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).isVisible());
 await settings.bringToFront();await wait(s=>s?.available&&s.visible);assert.equal(await visible(),true);
 fs.writeFileSync(command,'hide');await wait(s=>!s?.available&&!s?.visible);assert.equal(await visible(),false);
 fs.writeFileSync(command,'show');await settings.bringToFront();await wait(s=>s?.available&&s.visible);assert.equal(await visible(),true);
 fs.writeFileSync(command,'minimize');await wait(s=>!s?.available&&!s?.visible);assert.equal(await visible(),false);
 fs.writeFileSync(command,'show');await settings.bringToFront();await wait(s=>s?.available&&s.visible);
 cover=await electron.launch({executablePath:require('electron'),args:[path.join(root,'tools/fixtures/cover-window.js')],env});await (await cover.firstWindow()).bringToFront();await wait(s=>s?.available&&!s.visible&&!s.nativeTopmost);assert.equal(await visible(),false);
 await cover.close();cover=null;await settings.bringToFront();await wait(s=>s?.visible);assert.equal(await visible(),true);
 const result={hostHide:true,hostMinimize:true,otherAppHides:true,returnShows:true};fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result));console.log(result);
 }finally{if(cover)await cover.close();if(app)await app.close();fs.writeFileSync(command,'exit');setTimeout(()=>{if(host.exitCode===null)host.kill();},500).unref();}
})().catch(e=>{console.error(e);process.exitCode=1;});
