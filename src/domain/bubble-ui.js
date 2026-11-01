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
      for(const [key,label] of [['fiveHour','5 小时'],['weekly','1 周']]) {
        const known=Number.isFinite(q[key]) && q[key]>=0 && q[key]<=100;
        const row=document.createElement('div');row.className='quota-item';
        row.innerHTML='<div class="quota-label"><span></span><strong class="quota-value"></strong></div><div class="quota-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div class="quota-fill"></div></div>';
        row.querySelector('span').textContent=label;
        row.querySelector('strong').textContent=known ? Math.round(q[key])+'%' : '未知';
        const track=row.querySelector('.quota-bar');track.setAttribute('aria-label',label+'剩余额度');
        if(known)track.setAttribute('aria-valuenow',q[key]);else track.setAttribute('aria-valuetext','未知');
        track.dataset.known=String(known);
        const fill=row.querySelector('.quota-fill');fill.style.width=known?q[key]+'%':'100%';fill.dataset.level=!known?'unknown':q[key]<=20?'critical':q[key]<50?'low':'good';
        content.append(row);
      }
      const hint=document.createElement('div');hint.className='quota-hint';
      hint.textContent=!q.online?'未连接 · 额度未知':q.stale?'上次读取 · 已过期':q.cached?'上次读取 · 待更新':q.fetchedAt?'后台读取 · 官方额度':'等待额度数据';content.append(hint);
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
