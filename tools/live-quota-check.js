const {QuotaAdapter}=require('../src/adapters/quota-adapter');
const {CdpClient}=require('../src/shared/cdp-client');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const adapter=new QuotaAdapter();const results=[];
 try {
  const host=await adapter.discoverService.discover();assert.ok(host?.ownedPort,'Host-owned local CDP required');
  const targets=()=>adapter.discoverService._probeCdpPort(host.cdpPort);
  const before=await targets();
  const main=before.find(t=>t.webSocketDebuggerUrl===host.wsUrl)||before.find(t=>t.url.startsWith('doubao://doubao-chat/chat'));
  assert.ok(main);const front=new CdpClient(main.webSocketDebuggerUrl);
  try {
   await front.connect();
   const state=()=>front.evaluate(`JSON.stringify({url:location.href,panels:Array.from(document.querySelectorAll('iframe')).map(e=>e.src).filter(s=>s.includes('/member/quota-management')),menu:document.querySelector('[data-testid="chat_header_avatar_button"]')?.getAttribute('aria-expanded')})`);
   const initial=await state();
   for(let i=0;i<3;i++){
    await adapter.refresh();const snapshot=adapter.getSnapshot();
    assert.equal(snapshot.source,'official-hidden-quota-page');assert.equal(snapshot.cached,false);
    assert.ok(snapshot.fiveHour>=0&&snapshot.fiveHour<=100);assert.ok(snapshot.weekly>=0&&snapshot.weekly<=100);
    assert.equal(await state(),initial,'Foreground page must remain unchanged');
    const after=await targets();assert.deepEqual(after.map(t=>t.id).sort(),before.map(t=>t.id).sort(),'No leaked hidden pages');
    results.push({check:'background quota read without changing foreground or leaking targets',pass:true,source:snapshot.source});
   }
  }finally{front.close();}
  fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/live-quota-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{adapter.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
