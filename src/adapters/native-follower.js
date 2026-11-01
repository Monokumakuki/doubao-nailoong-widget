const {spawn}=require('child_process');
const {EventEmitter}=require('events');
const path=require('path');
/** Buffered JSON-lines transport. Helper owns physical-pixel following and foreground z-order. */
class NativeFollower extends EventEmitter {
  start(window) {
    if(this.child)return;
    const handle=window.getNativeWindowHandle();
    const hwnd=handle.length===8?handle.readBigUInt64LE().toString():String(handle.readUInt32LE());
    const child=spawn(path.join(__dirname,'../native/WindowFollower.exe'),[String(process.pid),hwnd],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    this.child=child;let buffer='';
    child.stdout.on('data',chunk=>{
      buffer+=chunk.toString();if(buffer.length>65536){child.kill();return;}
      let newline;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);try{this.emit('message',JSON.parse(line));}catch{}}
    });
    child.stderr.on('data',chunk=>this.emit('failure',chunk.toString().trim()));
    child.stdin.on('error',()=>{});
    child.on('error',err=>{this.emit('failure',err.message);if(this.child===child){this.child=null;this.emit('exit');}});
    child.on('exit',()=>{if(this.child===child)this.child=null;this.emit('exit');});
  }
  async stop() {
    const child=this.child;if(!child)return;this.child=null;
    await new Promise(resolve=>{const timeout=setTimeout(()=>{child.kill();resolve();},500);child.once('exit',()=>{clearTimeout(timeout);resolve();});child.stdin.end('\n');});
  }
}
module.exports={NativeFollower};
