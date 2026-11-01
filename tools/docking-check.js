const {_electron:electron}=require('playwright');const fs=require('fs'),path=require('path'),assert=require('assert/strict');const {artGeometry}=require('../src/domain/placement');
(async()=>{
 const root=path.resolve(__dirname,'..'),profile=path.join(root,'artifacts/dock-profile');fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({hostWindowOnly:false,scale:1}));
 const env={...process.env,WIDGET_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({executablePath:require('electron'),args:[path.join(root,'src/main/index.js')],env});const results=[];
 try{const page=await app.firstWindow();page.on('pageerror',e=>console.log('RENDERER ERROR',e.message));app.process().stderr.on('data',b=>console.log(String(b)));await page.evaluate(()=>{window.testDragEvents=[];for(const type of ['pointerdown','pointerup','pointercancel'])document.addEventListener(type,e=>window.testDragEvents.push({type,x:e.screenX,y:e.screenY,target:e.target.id}),true);});await page.waitForFunction(()=>document.querySelector('.character-image')?.naturalWidth);
 async function check(side,mode){await page.evaluate(side=>widgetAPI.dock(side),side);await page.waitForFunction(side=>document.getElementById('app').dataset.facing===side,side);await page.waitForTimeout(350);
 const s=await page.evaluate(()=>widgetAPI.getState());const layout=await app.evaluate(({BrowserWindow,screen})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));return {bounds:w.getBounds(),area:screen.getDisplayMatching(w.getBounds()).workArea};});
 const area=mode==='host'?await app.evaluate(({screen,BrowserWindow},r)=>screen.screenToDipRect(BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')),r),s.hostStatus.bounds):layout.area;
 const g=artGeometry(s.form,side,s.displayScale),visualX=layout.bounds.x+g.left+s.artShift*s.displayScale;
 assert.ok(Math.abs(visualX-(side==='left'?area.x:area.x+area.width-g.width))<3);assert.ok(Math.abs(layout.bounds.y+layout.bounds.height-area.y-area.height)<3);
 const matrix=await page.locator('.character-face').evaluate(e=>getComputedStyle(e).transform);if(side==='left')assert.ok(matrix.includes('-1'));else assert.ok(matrix==='none'||!matrix.includes('-1'));
 if(!await page.locator('#bubble.show').isVisible())await page.evaluate(()=>{document.getElementById('toggle-bubble').click();});await page.waitForTimeout(300);
 await page.screenshot({path:path.join(root,`artifacts/dock-${mode}-${side}.png`)});results.push({mode,side,visualX,area,artShift:s.artShift,pass:true});}
 await check('right','desktop');await check('left','desktop');
 await page.evaluate(()=>widgetAPI.dock('right'));const area=await app.evaluate(({screen})=>screen.getPrimaryDisplay().workArea);
 await page.evaluate(()=>widgetAPI.dragStart({x:1000,y:500}));await page.evaluate(x=>widgetAPI.dragMove({x,y:500}),1000-area.width);await page.evaluate(x=>widgetAPI.dragEnd({x,y:500}),1000-area.width);
 const moved=await page.evaluate(()=>widgetAPI.getState());assert.equal(moved.facing,'left');assert.equal(moved.dockSide,'left');results.push({check:'drag across midpoint turns and snaps to left bottom corner',pass:true});
 await page.evaluate(()=>widgetAPI.updateSettings({hostWindowOnly:true}));for(let i=0;i<100;i++){const s=await page.evaluate(()=>widgetAPI.getState());if(s.hostStatus?.available)break;await page.waitForTimeout(100);}
 await check('right','host');
 const before=await page.evaluate(()=>widgetAPI.getState());const box=await page.locator('#character').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-200,box.y+box.height/2-160,{steps:12});
 const during=await page.evaluate(()=>widgetAPI.getState());assert.equal(during.state,'dragged');assert.notEqual(during.artShift,before.artShift);
 await page.waitForTimeout(250);assert.equal((await page.evaluate(()=>widgetAPI.getState())).state,'dragged');await page.mouse.up();await page.waitForFunction(async()=>{const s=await widgetAPI.getState();return s.state!=='dragged';});
 const dragged=await page.evaluate(()=>widgetAPI.getSettings());console.log(await page.evaluate(()=>window.testDragEvents));console.log(JSON.stringify({before:{shift:before.artShift,side:before.dockSide},during:{shift:during.artShift,side:during.dockSide},after:dragged},null,2));assert.equal(dragged.hostDock,'');results.push({check:'host mode pointer capture moves continuously and native layer does not reset the drag',pass:true});
 await check('left','host');
 const saved=await page.evaluate(()=>widgetAPI.getSettings());assert.equal(saved.hostDock,'left');assert.equal(saved.desktopDock,'left');
 fs.writeFileSync(path.join(root,'artifacts/docking-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
