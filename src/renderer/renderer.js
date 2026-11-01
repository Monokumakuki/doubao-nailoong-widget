let state, characterRenderer, bubbleUI, press = null, pressTimer, dragged = false, petted = false;
let audio;
/** Keep rendering modules in the sandboxed page. */
async function init() {
  state = await widgetAPI.getState();
  characterRenderer = new CharacterRenderer({defaultForm:state.form});
  await characterRenderer.preloadImages();
  bubbleUI = new BubbleUI();bubbleUI.initialize();
  widgetAPI.onStateUpdate(next=>{state=next;render();});
  widgetAPI.onSound(({kind,volume})=>playSound(kind,volume));
  const character=document.getElementById('character');
  character.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    character.setPointerCapture(e.pointerId);press={x:e.screenX,y:e.screenY};dragged=false;petted=false;
    widgetAPI.triggerPointerDown();
    pressTimer=setTimeout(()=>{petted=true;widgetAPI.triggerPetting();},800);
  });
  character.addEventListener('pointermove',e=>{
    if(!press)return;
    const p={x:e.screenX,y:e.screenY};
    if(!dragged && Math.hypot(p.x-press.x,p.y-press.y)>5){clearTimeout(pressTimer);dragged=true;widgetAPI.dragStart(press);}
    if(dragged)widgetAPI.dragMove(p);
  });
  const release=e=>{
    if(!press)return;clearTimeout(pressTimer);press=null;
    if(dragged)widgetAPI.dragEnd({x:e.screenX,y:e.screenY});
    else {widgetAPI.triggerPointerUp();if(!petted){widgetAPI.characterClick();if(state.settings.bubbleOn){if(bubbleUI.visible&&bubbleUI.currentPage===1){widgetAPI.nextDialogue();bubbleUI._resetAutoHide();}else bubbleUI.toggle();}}}
    dragged=false;
  };
  character.addEventListener('pointerup',release);
  character.addEventListener('pointercancel',e=>{petted=true;release(e);});
  character.addEventListener('contextmenu',e=>{e.preventDefault();widgetAPI.openSettings();});
  character.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(state.settings.bubbleOn)bubbleUI.toggle();}});
  document.getElementById('toggle-bubble').onclick=()=>{if(state.settings.bubbleOn)bubbleUI.toggle();};
  document.getElementById('pet').onclick=()=>widgetAPI.triggerPetting();
  document.getElementById('switch-form').onclick=()=>widgetAPI.switchForm(state.form==='doubao'?'nailoong':'doubao');
  document.getElementById('settings').onclick=()=>widgetAPI.openSettings();
  document.getElementById('refresh').onclick=()=>widgetAPI.refreshQuota();
  let interactive;
  document.addEventListener('mousemove',e=>{
    const next=!!e.target.closest('#character,#bubble:not(.hidden),.widget-tools') || !!press;
    if(interactive!==next){interactive=next;widgetAPI.hitTest(next);}
  });
  window.addEventListener('unload',()=>{characterRenderer.destroy();bubbleUI.destroy();});
  render();
}
/** Web Audio tones are generated locally; no third-party audio dependency. */
function playSound(kind, volume) {
  if(!state.settings.sound)return;
  audio ||= new AudioContext();audio.resume();
  const oscillator=audio.createOscillator(), gain=audio.createGain();
  oscillator.type='sine';oscillator.frequency.value={press:440,release:660,switch:880,notification:330,success:990}[kind] || 440;
  gain.gain.setValueAtTime(Math.max(.001,volume*.12),audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.16);
  oscillator.connect(gain).connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.18);
}
async function render() {
  const desired=state.form;
  if(characterRenderer.getCurrentForm()!==desired && !characterRenderer.transitioning) {
    await characterRenderer.switchForm(desired);
    if(state.form!==desired){render();return;}
  }
  characterRenderer.updateByState(state.state,state.quota,state.easterExpression);
  const appEl=document.getElementById('app');
  appEl.dataset.form=state.form;appEl.dataset.facing=state.facing||'right';
  appEl.style.setProperty('--art-shift',`${state.artShift||0}px`);
  const g=state.form==='doubao'?{l:92,r:1269,b:1139}:{l:107,r:1253,b:1112};
  const left=(state.facing==='left'?1337-g.r:g.l)*254/1337;
  const width=(g.r-g.l)*254/1337;
  appEl.style.setProperty('--art-bottom',`${(1177-g.b)*254/1337}px`);
  appEl.style.setProperty('--thought-x',`${43+left+(state.artShift||0)+width/2-12}px`);
  document.getElementById('character').dataset.state=state.state;
  document.getElementById('app').style.transform=`scale(${state.displayScale || state.settings.scale})`;
  document.getElementById('caption').textContent=state.currentDialogue;
  if(!state.settings.bubbleOn)bubbleUI.hide();
  bubbleUI.render({quota:state.quota,dialogue:state.currentDialogue,usage:{}});
}
init().catch(err=>{console.error(err);document.getElementById('caption').textContent='加载失败，请查看日志';});
