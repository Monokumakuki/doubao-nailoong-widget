const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { SettingsManager } = require('../../src/domain/settings-manager');
const { DialogueManager } = require('../../src/domain/dialogue-manager');
const { WidgetStateMachine } = require('../../src/domain/state-machine');
const { readQuotaFunction } = require('../../src/adapters/quota-adapter');
const { HostDiscoverService } = require('../../src/adapters/host-discover');
test('settings reject invalid input atomically and preserve zero after restart',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'doubao-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const manager=new SettingsManager({configPath:path.join(dir,'settings.json')});await manager.load();
  assert.throws(()=>manager.update({volume:0,scale:9}));assert.equal(manager.get('volume'),.5);
  assert.throws(()=>manager.update({unknown:true}));assert.throws(()=>manager.set('volume',NaN));
  manager.update({volume:0,warningThreshold:0,scale:.5,defaultForm:'nailoong'});assert.equal(await manager.save(),true);
  const restored=new SettingsManager({configPath:manager.configPath});await restored.load();assert.equal(restored.get('volume'),0);assert.equal(restored.get('warningThreshold'),0);assert.equal(restored.get('defaultForm'),'nailoong');
});
test('one depleted quota warns even if the other is full; unknown is not zero',()=>{
  const sm=new WidgetStateMachine();sm.updateByQuota({online:true,fiveHour:0,weekly:100});assert.equal(sm.getCurrentState(),'warning');
  sm.updateByQuota({online:true,fiveHour:null,weekly:null});assert.equal(sm.getCurrentState(),'idle');
  sm.updateByQuota({online:true,fiveHour:10,weekly:100},5);assert.equal(sm.getCurrentState(),'idle');sm.destroy();
});
test('older saved startup character migrates to a remembered manual selection',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'doubao-migrate-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const configPath=path.join(dir,'settings.json');fs.writeFileSync(configPath,JSON.stringify({defaultForm:'nailoong',autoSwitchForm:true}));
 const settings=new SettingsManager({configPath});await settings.load();assert.equal(settings.get('defaultForm'),'nailoong');assert.equal(settings.get('manualFormSelected'),true);
});
test('dialogues respect unknown quota, form, cooldown, and count',async()=>{
  const d=new DialogueManager();await d.load();assert.ok(d.dialogues.length>=50);assert.equal(new Set(d.dialogues.map(x=>x.id)).size,d.dialogues.length);
  d.dialogues=[{id:'quota',text:'low',condition:{quotaRange:[0,20]},cooldown:10000,weight:1}];
  assert.equal(d.selectDialogue({quota:null}).category,'fallback');assert.equal(d.getCurrentText(),'在这里等你哦~');
  assert.equal(d.selectDialogue({quota:{fiveHour:10,weekly:10}}).id,'quota');assert.equal(d.selectDialogue({quota:{fiveHour:10,weekly:10}}).category,'fallback');
});
test('quota reader validates partial data and explicit remaining labels',()=>{
  const run=(quota,elements=[])=>vm.runInNewContext('('+readQuotaFunction.toString()+')()', {window:{__DOUBAO_QUOTA__:quota},document:{querySelectorAll:s=>s.startsWith('#root')||s==='iframe'||s==='div,span'?[]:elements},Date,console});
  let q=run({fiveHour:0,weekly:NaN});assert.equal(q.fiveHour,0);assert.equal(q.weekly,null);
  q=run({fiveHour:-1,weekly:'70'});assert.equal(q.cacheAvailable,false);
  const el=text=>({textContent:text,title:'',getAttribute:()=>''});
  q=run(undefined,[el('五小时 已用 90%'),el('每周剩余 65%')]);assert.equal(q.fiveHour,null);assert.equal(q.weekly,65);
  q=run(undefined,[el('五小时剩余 20% 每周剩余 80%')]);assert.equal(q.cacheAvailable,false);
});
test('host discovery rejects unrelated or remote websocket targets',()=>{
  const d=new HostDiscoverService();const valid={type:'page',url:'https://www.doubao.com/chat/',webSocketDebuggerUrl:'ws://127.0.0.1:9222/devtools/page/x'};
  assert.equal(d._isDouBaoTarget(valid),true);
  for(const change of [{url:'https://doubao.com.evil.test'},{url:'file:///chat.html'},{webSocketDebuggerUrl:'ws://evil.test/x'},{type:'browser'}])assert.equal(d._isDouBaoTarget({...valid,...change}),false);
});

test('portable widget executable is not detected as the host',()=>{
  const {isDouBaoProcessName}=require('../../src/adapters/host-discover');
  assert.equal(isDouBaoProcessName('Doubao.exe'),true);
  assert.equal(isDouBaoProcessName('DouBao-Nailoong-Widget.exe'),false);
  assert.equal(isDouBaoProcessName('notdoubao.exe'),false);
});

test('verified official used/total markup is inverted independently, not confused with bonus credits',()=>{
 const rows=[{children:[],textContent:'当前时段',parentElement:{textContent:'当前时段已用 0 / 735'}},{children:[],textContent:'近 7 天',parentElement:{textContent:'近 7 天已用 1,317 / 2,100'}},{children:[],textContent:'活动赠送额度',parentElement:{textContent:'活动赠送额度已用 800 / 1,000'}}];
 const q=vm.runInNewContext('('+readQuotaFunction.toString()+')()', {window:{},document:{querySelectorAll:s=>s==='div,span'?rows:[]},Date,console});
 assert.equal(q.fiveHour,100);assert.ok(Math.abs(q.weekly-37.28571428571429)<1e-8);assert.equal(q.source,'official-quota-panel');
});

test('custom desktop scheme requires an observed Doubao-owned listening port',()=>{
 const d=new HostDiscoverService();const target={type:'page',url:'doubao://doubao-chat/chat',webSocketDebuggerUrl:'ws://127.0.0.1:9225/devtools/page/test'};
 assert.equal(d._isDouBaoTarget(target),false);assert.equal(d._isDouBaoTarget(target,true),true);assert.equal(d._isDouBaoTarget({...target,url:'doubao://doubao-background/'},true),false);
});
