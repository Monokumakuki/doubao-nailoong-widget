const {test}=require('node:test');const assert=require('node:assert/strict');
const {ClickEffects}=require('../../src/domain/click-effects');
test('10% eligible click boundary, 3min cooldown, blocked states and form pool',()=>{
 let now=0;let rolls=[.1,.099,.4,0,0];const effect=new ClickEffects({now:()=>now,random:()=>rolls.shift()??0});
 assert.equal(effect.click('doubao'),false);assert.equal(effect.expression,null);
 assert.equal(effect.click('doubao'),true);assert.equal(effect.expression,'happy');effect.clear();
 assert.equal(effect.click('doubao'),false);now=180000;
 assert.equal(effect.click('doubao',true),false);assert.equal(effect.click('nailoong'),true);assert.equal(effect.expression,'proud');effect.destroy();
});
test('explicit dialogue clicks always change the phrase without repeating the last item',()=>{
 const {DialogueManager}=require('../../src/domain/dialogue-manager');const d=new DialogueManager();d.dialogues=[{id:'a',text:'a',condition:{},cooldown:0},{id:'b',text:'b',condition:{},cooldown:0}];d.currentDialogue=d.dialogues[0];
 assert.equal(d.nextDialogue().id,'b');assert.equal(d.nextDialogue().id,'a');
});
