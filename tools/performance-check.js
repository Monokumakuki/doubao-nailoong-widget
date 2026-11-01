const {_electron:electron}=require('playwright');
const path=require('node:path');const fs=require('node:fs');
(async()=>{
 const root=path.resolve(__dirname,'..'),env={...process.env,WIDGET_DATA_DIR:path.join(root,'artifacts/perf-profile')};delete env.ELECTRON_RUN_AS_NODE;
 const start=Date.now();const app=await electron.launch({executablePath:require('electron'),args:[path.join(root,'src/main/index.js')],env});
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('.character-image')?.naturalWidth>0);
  const startup=Date.now()-start;await app.evaluate(({app})=>app.getAppMetrics());
  await new Promise(r=>setTimeout(r,15000));
  const samples=[];
  for(let i=0;i<3;i++){
    samples.push(await app.evaluate(({app})=>app.getAppMetrics().map(m=>({type:m.type,cpu:m.cpu.percentCPUUsage,memory:m.memory}))));
    if(i<2)await new Promise(r=>setTimeout(r,5000));
  }
  const result={startupMs:startup,scope:'Windows Electron app only, no settings window; 15s warmup then three samples, no sustained stress/soak proof',samples};
  fs.writeFileSync(path.join(root,'artifacts/performance.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
