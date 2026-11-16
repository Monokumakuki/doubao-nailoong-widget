/** Thought bubble layout follows the three supplied widget references. */
(() => {
class BubbleUI {
  constructor(options={}) {
    this.visible=false;this.currentPage=0;this.pages=['quota','dialogue','usage'];
    this.autoHideDelay=options.autoHideDelay || 6000;this.state={};this.hovered=false;
  }
  initialize() {
    document.getElementById('bubble-close').onclick=()=>this.hide();
    document.getElementById('bubble-prev').onclick=()=>this.prevPage();
    document.getElementById('bubble-next').onclick=()=>this.nextPage();
    const bubble=document.getElementById('bubble');
    bubble.addEventListener('click',e=>{if(this.currentPage===1&&!e.target.closest('button,nav')){window.widgetAPI.nextDialogue();this._resetAutoHide();}});
    bubble.addEventListener('pointerenter',()=>{this.hovered=true;clearTimeout(this.autoHideTimer);});
    bubble.addEventListener('pointerleave',()=>{this.hovered=false;this._resetAutoHide();});
    bubble.addEventListener('pointerdown',()=>this._resetAutoHide());
  }
  show() {this.visible=true;document.getElementById('bubble').classList.replace('hidden','show');this.render();this._resetAutoHide();}
  hide() {this.visible=false;document.getElementById('bubble').classList.replace('show','hidden');clearTimeout(this.autoHideTimer);}
  toggle() {this.visible?this.hide():this.show();}
  prevPage() {this.currentPage=(this.currentPage+2)%3;this.render();this._resetAutoHide();}
  nextPage() {this.currentPage=(this.currentPage+1)%3;this.render();this._resetAutoHide();}
  /** Unknown values retain an empty, striped track and an explicit label. */
  render(state) {
    if(state)this.state=state;
    const page=this.pages[this.currentPage];
    const title=document.getElementById('bubble-title');
    const content=document.getElementById('bubble-content');
    title.textContent={quota:'豆包额度',dialogue:'豆包碎碎念',usage:'今日用量'}[page];
    content.replaceChildren();
    if(page==='quota') {
      const q=this.state.quota || {};
      const bars=Array.isArray(q.bars)&&q.bars.length?q.bars:[
        {key:'plan',label:'套餐额度',used:null,total:null,remainingPercent:null},
        {key:'activity',label:'活动赠送额度',used:null,total:null,remainingPercent:null}
      ];
      const fmt=n=>Number(n).toLocaleString('zh-CN');
      content.dataset.bars=String(bars.length);
      for(const bar of bars) {
        const hasNumbers=Number.isFinite(bar.used)&&Number.isFinite(bar.total)&&bar.total>0;
        const usedPercent=Number.isFinite(bar.usedPercent)?bar.usedPercent:hasNumbers?bar.used/bar.total*100:null;
        const remainingPercent=Number.isFinite(bar.remainingPercent)?bar.remainingPercent:usedPercent!==null?100-usedPercent:null;
        const known=hasNumbers||remainingPercent!==null;
        // Numeric bars fill by 已用; percentage-only fallbacks keep their remaining value.
        const fillPercent=hasNumbers?usedPercent:remainingPercent;
        const row=document.createElement('div');row.className='quota-item';
        row.innerHTML='<div class="quota-label"><span></span><strong class="quota-value"></strong></div><div class="quota-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div class="quota-fill"></div></div>';
        row.querySelector('span').textContent=bar.label || '额度';
        row.querySelector('strong').textContent=hasNumbers?`已用 ${fmt(bar.used)} / ${fmt(bar.total)}`:remainingPercent!==null?Math.round(remainingPercent)+'%':'未知';
        const track=row.querySelector('.quota-bar');track.setAttribute('aria-label',(bar.label||'额度')+'已用额度');
        if(known)track.setAttribute('aria-valuenow',Math.round(fillPercent));else track.setAttribute('aria-valuetext','未知');
        track.dataset.known=String(known);
        if(hasNumbers)track.setAttribute('aria-valuetext',`已用 ${fmt(bar.used)} / ${fmt(bar.total)}`);
        const fill=row.querySelector('.quota-fill');fill.style.width=known?fillPercent+'%':'100%';fill.dataset.level=!known?'unknown':remainingPercent<=20?'critical':remainingPercent<50?'low':'good';
        content.append(row);
      }
      const hint=document.createElement('div');hint.className='quota-hint';
      const status=!q.online?'未连接 · 额度未知':q.stale?'上次读取 · 已过期':q.cached?'上次读取 · 待更新':q.fetchedAt?'后台读取 · 官方额度':'等待额度数据';
      hint.textContent=(Number.isFinite(q.available)?`可用 ${fmt(q.available)} · `:'')+status;
      content.append(hint);
    } else if(page==='dialogue') {
      const phrase=document.createElement('p');phrase.className='dialogue-text';phrase.textContent=this.state.dialogue || '我用最简单最直接的话告诉你：我在呢。';content.append(phrase);
      const hint=document.createElement('button');hint.id='dialogue-next';hint.className='dialogue-next';hint.textContent='再说一句';hint.onclick=()=>{window.widgetAPI.nextDialogue();this._resetAutoHide();};content.append(hint);
    } else {
      const usage=this.state.usage || {};
      for(const [key,label] of [['todayTurns','对话轮数'],['todayTokens','Token 消耗']]) {
        const line=document.createElement('div');line.className='usage-item';
        const text=document.createElement('span');text.textContent=label;
        const value=document.createElement('strong');value.className='usage-value';value.textContent=Number.isFinite(usage[key])?usage[key].toLocaleString():'未知';
        line.append(text,value);content.append(line);
      }
      const hint=document.createElement('p');hint.className='quota-hint';hint.textContent='还没有读取到使用记录';content.append(hint);
    }
    document.getElementById('bubble-indicator').textContent=`${this.currentPage+1} / 3`;
  }
  _resetAutoHide() {clearTimeout(this.autoHideTimer);if(this.visible&&!this.hovered)this.autoHideTimer=setTimeout(()=>this.hide(),this.autoHideDelay);}
  destroy() {clearTimeout(this.autoHideTimer);}
}
window.BubbleUI=BubbleUI;
})();
