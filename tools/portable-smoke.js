const {_electron:electron}=require('playwright');const path=require('node:path');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');const folder=fs.readdirSync(path.join(root,'dist')).filter(n=>fs.existsSync(path.join(root,'dist',n,'SHA256.json'))).sort().at(-1);
 const env={...process.env,WIDGET_DATA_DIR:path.join(root,'artifacts/portable-profile')};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({executablePath:path.join(root,'dist',folder,'DouBao-Nailoong-Widget.exe'),args:[],env});
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('.character-image')?.naturalWidth>0);
  await page.locator('#character').click();await page.waitForTimeout(650);assert.match(await page.locator('.quota-value').first().innerText(),/^(未知|\d{1,3}%)$/);
  await page.screenshot({path:path.join(root,'artifacts/portable-widget.png')});
  const state=await page.evaluate(()=>widgetAPI.getState());assert.equal(state.form,'doubao');
  const [settings]=await Promise.all([app.waitForEvent('window'),page.evaluate(()=>widgetAPI.openSettings())]);await settings.waitForLoadState();assert.ok(await settings.locator('#saveSettings').isVisible());
  const result={package:folder,launched:true,characterLoaded:true,unknownQuota:true,settingsOpened:true};fs.writeFileSync(path.join(root,'artifacts/portable-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
