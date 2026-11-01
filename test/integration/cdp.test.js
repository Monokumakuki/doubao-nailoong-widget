const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {WebSocketServer}=require('ws');
const {CdpClient}=require('../../src/shared/cdp-client');
const {QuotaAdapter}=require('../../src/adapters/quota-adapter');
test('real local CDP transport: partial quota, cache, reconnect, host change',async t=>{
 const server=http.createServer();const wss=new WebSocketServer({server});let data={fiveHour:0,weekly:65,fetchedAt:Date.now(),cacheAvailable:true};
 wss.on('connection',socket=>socket.on('message',raw=>{const m=JSON.parse(raw);socket.send(JSON.stringify({id:m.id,result:{result:{value:data}}}));}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const host={wsUrl:`ws://127.0.0.1:${port}/a`};let current=host;
 const a=new QuotaAdapter({discoverService:{discover:async()=>current}});
 t.after(async()=>{a.stop();a.cdpClient?.close();for(const s of wss.clients)s.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));});
 await a.tick();assert.equal(a.getSnapshot().fiveHour,0);assert.equal(a.getSnapshot().weekly,65);
 data={fiveHour:15,weekly:65,cacheAvailable:true,fetchedAt:Date.now()-600000};await a.tick();assert.equal(a.getSnapshot().stale,true);
 data={cacheAvailable:false};await a.tick();assert.equal(a.getSnapshot().stale,true);assert.equal(a.getSnapshot().cached,true);assert.equal(a.getSnapshot().fiveHour,15);
 current=null;await a.tick();assert.equal(a.getSnapshot().online,false);assert.equal(a.getSnapshot().stale,true);
 current={wsUrl:`ws://127.0.0.1:${port}/b`};await a.tick();assert.equal(a.getSnapshot().fiveHour,null);assert.equal(a.getSnapshot().online,true);
});
test('CDP pending command rejects promptly on close',async t=>{
 const wss=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>wss.on('listening',r));const c=new CdpClient(`ws://127.0.0.1:${wss.address().port}`,{timeout:500});
 t.after(()=>{for(const s of wss.clients)s.terminate();wss.close();});await c.connect();const p=c.send('Runtime.evaluate');c.close();await assert.rejects(p,/closed/);
});

test('hidden quota page is created without foreground UI and always closed',async t=>{
 const commands=[];let fail=false;
 const wss=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>wss.on('listening',r));
 wss.on('connection',socket=>socket.on('message',raw=>{
  const m=JSON.parse(raw);commands.push(m);
  const result=m.method==='Target.createTarget'?{targetId:'hidden-quota'}:m.method==='Runtime.evaluate'?{result:{value:{cacheAvailable:true,fiveHour:75,weekly:50}}}:{};
  socket.send(JSON.stringify(fail&&m.method==='Runtime.evaluate'?{id:m.id,error:{message:'read failed'}}:{id:m.id,result}));
 }));
 const port=wss.address().port;
 const a=new QuotaAdapter({discoverService:{_probeCdpPort:async()=>({webSocketDebuggerUrl:`ws://127.0.0.1:${port}/browser`})}});
 t.after(()=>{a.stop();for(const s of wss.clients)s.terminate();wss.close();});
 assert.equal((await a._readHiddenQuota({cdpPort:port})).source,'official-hidden-quota-page');
 assert.deepEqual(commands.find(m=>m.method==='Target.createTarget').params.hidden,true);
 assert.equal(commands.find(m=>m.method==='Target.createTarget').params.background,true);
 assert.ok(commands.some(m=>m.method==='Target.closeTarget'&&m.params.targetId==='hidden-quota'));
 assert.ok(!commands.some(m=>m.method==='Input.dispatchMouseEvent'||m.method==='Target.activateTarget'));
 commands.length=0;fail=true;await assert.rejects(()=>a._readHiddenQuota({cdpPort:port}));
 assert.ok(commands.some(m=>m.method==='Target.closeTarget'),'cleanup also runs after read failure');
});
