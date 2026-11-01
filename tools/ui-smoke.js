const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = path.join(root,'artifacts','ui-profile');
const results=[];const errors=[];
async function launch() {
 const started=Date.now();
 const env={...process.env,WIDGET_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:[path.join(root,'src/main/index.js')],executablePath:require('electron'),env,timeout:30000});
 app.process().stderr.on('data',d=>fs.appendFileSync(path.join(root,'artifacts/ui-stderr.log'),d));
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 await page.waitForFunction(()=>document.querySelector('.character-image')?.naturalWidth>0);
 results.push({check:'launch to character',ms:Date.now()-started});return {app,page};
}
(async()=>{
 fs.mkdirSync(data,{recursive:true});fs.writeFileSync(path.join(data,'settings.json'),JSON.stringify({defaultForm:'doubao',scale:1}));let instance=await launch();let {app,page}=instance;
 try {
  async function finishNormalClick(){
   // A real random easter egg is allowed; after it expires the next click is in cooldown.
   if((await page.evaluate(()=>widgetAPI.getState())).easterExpression){
    await page.waitForFunction(async()=>!(await widgetAPI.getState()).easterExpression);
    await page.locator('#character').click();await page.waitForTimeout(650);
   }
  }
  assert.equal(await page.evaluate(()=>typeof require),'undefined');
  const idleSrc=await page.locator('.character-image').getAttribute('src');
  const light=await page.locator('.character-image').evaluate(e=>getComputedStyle(e).filter);
  await page.locator('#character').click();await page.locator('#bubble.show').waitFor();
  await page.waitForTimeout(650);await finishNormalClick();assert.equal(await page.locator('.character-image').getAttribute('src'),idleSrc);assert.equal(await page.locator('.character-image').evaluate(e=>getComputedStyle(e).filter),light);
  results.push({check:'ordinary DouBao click preserves expression and lighting',pass:true});
  assert.match(await page.locator('.quota-value').first().innerText(),/^(未知|\d{1,3}%)$/);
  await page.waitForTimeout(600);await page.screenshot({path:path.join(root,'artifacts/widget-doubao.png')});
  results.push({check:'transparent window, character, quota labels',pass:true});
  await page.locator('#bubble-next').click();assert.ok(await page.locator('.dialogue-text').innerText());
  const phraseBefore=await page.locator('.dialogue-text').innerText();
  await page.locator('#character').click();
  await page.waitForFunction(old=>document.querySelector('.dialogue-text')?.textContent!==old,phraseBefore);
  assert.ok(await page.locator('#bubble.show').isVisible());
  const phraseSecond=await page.locator('.dialogue-text').innerText();await page.locator('.dialogue-text').click();
  await page.waitForFunction(old=>document.querySelector('.dialogue-text')?.textContent!==old,phraseSecond);
  assert.ok(await page.locator('#bubble.show').isVisible());
  results.push({check:'character or phrase click changes dialogue while keeping bubble open',pass:true});
  await page.locator('#dialogue-next').click();
  await page.locator('#bubble-next').click();assert.equal(await page.locator('.usage-value').first().innerText(),'未知');
  await page.locator('#bubble-prev').click();assert.ok(await page.locator('.dialogue-text').innerText());
  await page.mouse.move(2,495);
  await page.waitForFunction(()=>document.getElementById('bubble').classList.contains('hidden'),{},{timeout:8000});
  results.push({check:'pagination, next dialogue, unknown usage, 6s auto hide',pass:true});
  await page.evaluate(()=>widgetAPI.switchForm('nailoong'));
  await page.waitForFunction(()=>document.querySelector('.character-image').src.includes('nailoong/'));
  await page.waitForTimeout(700);
  const nailSrc=await page.locator('.character-image').getAttribute('src');const nailLight=await page.locator('.character-image').evaluate(e=>getComputedStyle(e).filter);
  await page.locator('#character').click();await page.waitForTimeout(650);
  await finishNormalClick();assert.equal(await page.locator('.character-image').getAttribute('src'),nailSrc);assert.equal(await page.locator('.character-image').evaluate(e=>getComputedStyle(e).filter),nailLight);
  results.push({check:'ordinary DouNai click preserves expression and lighting',pass:true});
  await page.screenshot({path:path.join(root,'artifacts/widget-nailoong.png')});
  const [settings]=await Promise.all([app.waitForEvent('window'),page.evaluate(()=>widgetAPI.openSettings())]);await settings.waitForLoadState();await settings.locator('#volume').waitFor();
  await settings.evaluate(()=>widgetAPI.updateSettings({volume:0,warningThreshold:0,scale:1.2}));
  await page.waitForFunction(()=>document.getElementById('app').style.transform==='scale(1.2)');
  await settings.reload();assert.equal(await settings.locator('#volume').inputValue(),'0');assert.equal(await settings.locator('#warningThreshold').inputValue(),'0');
  await settings.screenshot({path:path.join(root,'artifacts/settings.png'),fullPage:true});
  await assert.rejects(()=>settings.evaluate(()=>widgetAPI.updateSettings({scale:99})),/Invalid settings/);
  results.push({check:'form switch, settings, scale, zero values, validation',pass:true});
  const start=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).getBounds());
  await page.evaluate(()=>widgetAPI.dragStart({x:100,y:100}));await page.evaluate(()=>widgetAPI.dragMove({x:-100,y:-70}));await page.evaluate(()=>widgetAPI.dragEnd({x:-100,y:-70}));
  const end=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).getBounds());assert.notEqual(start.x,end.x);
  results.push({check:'drag IPC moves native window',pass:true});
  await page.evaluate(()=>widgetAPI.resetPosition());
  const area=await page.locator('#character').boundingBox();
  await page.mouse.move(area.x+area.width/2,area.y+area.height/2);await page.mouse.down();await page.mouse.move(area.x+area.width/2-190,area.y+area.height/2-170,{steps:10});await page.mouse.up();
  const draggedBounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).getBounds());
  assert.ok(draggedBounds.x < start.x);results.push({check:'pointer capture drag through renderer and native window',pass:true});
  await settings.evaluate(()=>widgetAPI.updateSettings({scale:2}));
  const fit=await page.evaluate(()=>widgetAPI.getState());assert.ok(fit.displayScale<=2);
  const inside=await page.locator('#character').boundingBox();const viewport=page.viewportSize() || await page.evaluate(()=>({width:innerWidth,height:innerHeight}));const padding=await page.evaluate(()=>parseFloat(getComputedStyle(document.getElementById('app')).getPropertyValue('--art-bottom')));assert.ok(inside.y+inside.height-padding*fit.displayScale<=viewport.height+2);
  await settings.evaluate(()=>widgetAPI.updateSettings({scale:1.2}));
  results.push({check:'maximum scale fits screen work area',pass:true});
  const metrics=await app.evaluate(({app})=>app.getAppMetrics().map(m=>({type:m.type,cpu:m.cpu.percentCPUUsage,memoryKB:m.memory.workingSetSize})));
  results.push({check:'one resource sample (not sustained performance acceptance)',metrics});
  await app.close();instance=await launch();app=instance.app;page=instance.page;
  const restored=await page.evaluate(()=>widgetAPI.getSettings());assert.equal(restored.volume,0);assert.equal(restored.defaultForm,'nailoong');assert.equal(restored.scale,1.2);
  results.push({check:'settings survive actual process restart',pass:true});
  // Restore a friendly first-run state for the separate test profile.
  await page.evaluate(()=>widgetAPI.resetSettings());
  assert.deepEqual(errors,[]);results.push({check:'renderer errors',errors});
 }finally{await app.close();fs.writeFileSync(path.join(root,'artifacts/ui-results.json'),JSON.stringify(results,null,2));}
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
