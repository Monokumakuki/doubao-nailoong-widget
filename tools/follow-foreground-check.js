const {_electron:electron}=require('playwright');const fs=require('fs');const path=require('path');const assert=require('assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),profile=path.join(root,'artifacts/foreground-profile');fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({hostWindowOnly:true,scale:1}));
 const env={...process.env,WIDGET_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({executablePath:require('electron'),args:[path.join(root,'src/main/index.js')],env});let cover;
 try{const page=await app.firstWindow();const [settings]=await Promise.all([app.waitForEvent('window'),page.evaluate(()=>widgetAPI.openSettings())]);await settings.waitForLoadState();
 const read=()=>settings.evaluate(()=>widgetAPI.getState());
 async function wait(predicate){let last;for(let i=0;i<100;i++){const s=await read();last=s.hostStatus;if(predicate(s.hostStatus))return s.hostStatus;await new Promise(r=>setTimeout(r,100));}throw new Error('Native layer condition timed out: '+JSON.stringify(last));}
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/settings.html'));w.show();w.focus();});
 const top=await wait(s=>s?.visible&&s.aboveHost&&!s.nativeTopmost);
 cover=await electron.launch({executablePath:require('electron'),args:[path.join(root,'tools/fixtures/cover-window.js')],env});const coverPage=await cover.firstWindow();await coverPage.bringToFront();
 const behind=await wait(s=>s?.visible&&!s.nativeTopmost&&s.behindForeground&&s.aboveHost);
 const stillVisible=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).isVisible());assert.equal(stillVisible,true);
 await cover.close();cover=null;
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/settings.html'));w.show();w.focus();});
 const restored=await wait(s=>s?.visible&&s.aboveHost&&!s.nativeTopmost);
 const result={otherForegroundOccludesWidget:true,widgetStaysAboveHost:true,neverTopmost:true,top,behind,restored};fs.writeFileSync(path.join(root,'artifacts/foreground-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{if(cover)await cover.close();await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
