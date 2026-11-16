const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),gemini=path.resolve(root,'../Gemini-Antigravity-Plugin');
const dir=path.join(root,'artifacts/native-follow-check');fs.mkdirSync(dir,{recursive:true});
const csc=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
const compile=(file,out,extra=[])=>execFileSync(csc,['/nologo','/optimize+','/out:'+out,...extra,file],{windowsHide:true});
const fixture=path.join(dir,'FollowFixture.exe');compile(path.join(__dirname,'fixtures/native-follow.cs'),fixture,['/r:System.Windows.Forms.dll']);
const latest=(folder,prefix)=>fs.readdirSync(folder).filter(n=>n.startsWith(prefix)).sort().at(-1);
const results={checkedAt:new Date().toISOString(),scope:'isolated native windows; 180 forward/reverse moves at 8ms cadence; not compositor or physical-drag frame latency'};
for(const [name,current,backupRoot,file] of [
 ['doubao',path.join(root,'src/native/WindowFollower.cs'),path.join(root,'artifacts'),'WindowFollower.cs'],
 ['gemini',path.join(gemini,'Antigravity-Cat-Widget/src/native/ForegroundHost.cs'),path.join(gemini,'evidence'),'ForegroundHost.cs']
]){
 results[name]={};
 for(const [version,source] of [['before',path.join(backupRoot,latest(backupRoot,'pre-follow-'),file)],['after',current]]){
  const cs=path.join(dir,name+'-'+version+'.cs'),exe=path.join(dir,name+'-'+version+'.exe');
  // Only the test copy discovers our fixture; production process filters stay intact.
  fs.writeFileSync(cs,fs.readFileSync(source,'utf8').replaceAll('p.ProcessName,"Doubao"','p.ProcessName,"FollowFixture"').replaceAll('p.ProcessName,"Antigravity"','p.ProcessName,"FollowFixture"'));
  compile(cs,exe);const output=execFileSync(fixture,[exe],{encoding:'utf8',windowsHide:true,timeout:15000});
  results[name][version]=JSON.parse(output.trim());
 }
 assert.equal(results[name].after.settledPx,0);assert.equal(results[name].after.petDragOffsetErrorPx,0);
}
fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
