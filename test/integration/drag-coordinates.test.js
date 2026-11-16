const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {_electron}=require('playwright');
test('long press drag uses native DIP cursor through IPC and persists final position',{timeout:30000},async t=>{
 const root=path.resolve(__dirname,'../..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'doubao-drag-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(path.join(dir,'settings.json'),JSON.stringify({hostWindowOnly:false,sound:false,scale:.5,desktopDock:''}));
 const bootstrap=path.join(dir,'main.cjs');
 fs.writeFileSync(bootstrap,`const {app}=require('electron');global.dragCursor={x:100,y:100};app.whenReady().then(()=>{require('electron').screen.getCursorScreenPoint=()=>global.dragCursor;});const {QuotaAdapter}=require(${JSON.stringify(path.join(root,'src/adapters/quota-adapter'))});QuotaAdapter.prototype.start=function(){};require(${JSON.stringify(path.join(root,'src/main/index.js'))});`);
 const env={...process.env,WIDGET_DATA_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[bootstrap],env});
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>window.widgetAPI);
  const start=await app.evaluate(({BrowserWindow,screen})=>{const win=BrowserWindow.getAllWindows()[0],area=screen.getPrimaryDisplay().workArea;win.setBounds({x:area.x+200,y:area.y+50});return win.getBounds();});
  const character=page.locator('#character');
  const box=await character.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.waitForTimeout(850);
  await page.mouse.move(box.x+box.width/2+10,box.y+box.height/2);await page.waitForTimeout(80);
  for(const y of [125,150,130]){
   await app.evaluate(({},y)=>{global.dragCursor={x:100,y};},y);
   await page.mouse.move(box.x+box.width/2+10,box.y+box.height/2+(150-y)/2);await page.waitForTimeout(80);
   const b=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());assert.equal(b.y,start.y+y-100);
  }
  await page.mouse.up();await page.waitForTimeout(200);
  const end=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());assert.equal(end.y,start.y+30);
  const saved=JSON.parse(fs.readFileSync(path.join(dir,'settings.json'),'utf8'));assert.equal(saved.y,end.y);
 }finally{await app.close();}
});
