const {EventEmitter}=require('events');
/** A 10% roll per eligible short click; rare expressions last 3.2s and cool down 3min. */
class ClickEffects extends EventEmitter {
  constructor({random=Math.random,now=Date.now}={}) {super();this.random=random;this.now=now;this.lastAt=-Infinity;this.expression=null;}
  click(form,blocked=false) {
    if(blocked||this.expression||this.now()-this.lastAt<180000||this.random()>=.1)return false;
    const list=form==='doubao'?['thinking','happy','warning']:['proud','angry','crying'];
    this.expression=list[Math.floor(this.random()*list.length)];this.lastAt=this.now();this.emit('change');
    this.timer=setTimeout(()=>this.clear(),3200);return true;
  }
  clear() {clearTimeout(this.timer);if(this.expression){this.expression=null;this.emit('change');}}
  destroy(){clearTimeout(this.timer);this.removeAllListeners();}
}
module.exports={ClickEffects};
