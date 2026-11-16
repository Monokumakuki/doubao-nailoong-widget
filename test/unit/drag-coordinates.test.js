const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');

test('native cursor controls drag direction despite stale renderer coordinates and window movement',()=>{
 const file=path.resolve(__dirname,'../../src/main/window-manager.js'),localRequire=createRequire(file);
 for(const hostMode of [false,true])for(const form of ['doubao','nailoong']){
  let cursor={x:0,y:0},bounds={x:100,y:100,width:340,height:500};
  const area={x:-300,y:-100,width:1800,height:1200};
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,__dirname:path.dirname(file),require:name=>name==='electron'?{screen:{getCursorScreenPoint:()=>({...cursor}),getDisplayMatching:()=>({workArea:area})}}:localRequire(name)});
  const wm=new module.exports.WindowManager();wm.hostWindowOnly=hostMode;wm.hostBounds=area;wm.currentForm=form;
  wm.mainWindow={isDestroyed:()=>false,getBounds:()=>({...bounds}),setBounds:b=>{bounds={...b,width:b.width+1,height:b.height+1};},setIgnoreMouseEvents:()=>{}};
  const stale={x:999,y:999};wm.handleDragStart(stale);
  for(const [x,y] of [[0,80],[0,140],[80,140],[-80,140],[-80,-40]]){
   cursor={x,y};wm.handleDragMove({x:-999,y:-999});assert.equal(bounds.y,100+y);assert.equal(bounds.width,341);assert.equal(bounds.height,501);
   const stable={...bounds};wm.handleDragMove(stale);assert.deepEqual(bounds,stable,'stationary cursor must not feed window movement back into drag');
  }
  const result=wm.handleDragEnd(stale,{clickThrough:false});assert.equal(wm.isDragging,false);
  if(hostMode)assert.equal(result.hostOffsetY,area.y+area.height-bounds.y-bounds.height);else assert.equal(result.y,bounds.y);
 }
});
