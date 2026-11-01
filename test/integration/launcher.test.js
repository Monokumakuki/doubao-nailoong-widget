const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {execFileSync,spawnSync}=require('node:child_process');
test('taskbar GUI launcher starts both programs, forwards quoted args, binds CDP locally',{skip:process.platform!=='win32'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dafeidou-launcher-'));
 const compiler=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
 try{
  const exe=path.join(dir,'launcher.exe');execFileSync(compiler,['/nologo','/target:winexe','/out:'+exe,path.resolve('src/native/DoubaoLauncher.cs')]);
  const recorder=path.join(dir,'recorder.cs');fs.writeFileSync(recorder,'using System;using System.IO;using System.Diagnostics;using System.Linq;class Recorder{static void Main(){File.WriteAllLines(Path.ChangeExtension(Process.GetCurrentProcess().MainModule.FileName,".args"),Environment.GetCommandLineArgs().Skip(1));}}');
  const host=path.join(dir,'host.exe'),widget=path.join(dir,'widget.exe');execFileSync(compiler,['/nologo','/target:winexe','/out:'+host,recorder]);fs.copyFileSync(host,widget);
  const xml=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');fs.writeFileSync(path.join(dir,'launcher.xml'),`<launcher host="${xml(host)}" widget="${xml(widget)}" port="9225"/>`);
  const forwarded=['space value','quoted"value','tail with space\\'];const result=spawnSync(exe,[...forwarded,'--remote-debugging-port=9999']);assert.equal(result.status,0);
  for(let i=0;i<100&&(!fs.existsSync(path.join(dir,'host.args'))||!fs.existsSync(path.join(dir,'widget.args')));i++)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20);
  const args=fs.readFileSync(path.join(dir,'host.args'),'utf8').trim().split(/\r?\n/);assert.deepEqual(args,['--remote-debugging-address=127.0.0.1','--remote-debugging-port=9225',...forwarded]);assert.equal(fs.readFileSync(path.join(dir,'widget.args'),'utf8'),'');
  assert.equal(fs.readFileSync(exe).readUInt16LE(fs.readFileSync(exe).readUInt32LE(0x3c)+24+68),2,'Windows GUI subsystem has no console');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
