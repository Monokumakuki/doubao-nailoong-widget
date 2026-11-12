const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {_electron}=require('playwright');
test('manual character survives fresh launches and quota refresh, automatic mode can be resumed',{timeout:40000},async t=>{
 const root=path.resolve(__dirname,'../..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'doubao-form-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bootstrap=path.join(dir,'main.cjs');
 fs.writeFileSync(bootstrap,`const {QuotaAdapter}=require(${JSON.stringify(path.join(root,'src/adapters/quota-adapter'))});QuotaAdapter.prototype.start=function(){global.testQuota=this;};require(${JSON.stringify(path.join(root,'src/main/index.js'))});`);
 const env={...process.env,WIDGET_DATA_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;
 async function launch(){const app=await _electron.launch({executablePath:require('electron'),args:[bootstrap],env});const page=await app.firstWindow();await page.waitForFunction(()=>window.widgetAPI);return{app,page};}
 const quota=async(app,percent)=>app.evaluate(({},percent)=>global.testQuota.emit('change',{online:true,stale:false,fiveHour:percent,weekly:percent}),percent);
 let current=await launch();
 try{await current.page.evaluate(()=>widgetAPI.switchForm('nailoong'));assert.equal((await current.page.evaluate(()=>widgetAPI.getState())).form,'nailoong');}finally{await current.app.close();}
 current=await launch();
 try{
  await quota(current.app,100);assert.equal((await current.page.evaluate(()=>widgetAPI.getState())).form,'nailoong');
  await current.page.evaluate(()=>widgetAPI.switchForm('doubao'));
 }finally{await current.app.close();}
 current=await launch();
 try{
  await quota(current.app,0);assert.equal((await current.page.evaluate(()=>widgetAPI.getState())).form,'doubao');
  await current.page.evaluate(async()=>{await widgetAPI.updateSettings({autoSwitchForm:false});await widgetAPI.updateSettings({autoSwitchForm:true});});
  await quota(current.app,0);assert.equal((await current.page.evaluate(()=>widgetAPI.getState())).form,'nailoong');
 }finally{await current.app.close();}
});
