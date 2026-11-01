const {test}=require('node:test');const assert=require('assert/strict');
const {artGeometry,characterPlacement,snapToEdges}=require('../../src/domain/placement');
const area={x:100,y:50,width:1200,height:800},dimensions={width:340,height:500};
test('visual character docks flush while full bubble window stays inside client',()=>{
 for(const form of ['doubao','nailoong'])for(const side of ['left','right']){
  const g=artGeometry(form,side,1),x=side==='left'?area.x:area.x+area.width-g.width;
  const p=characterPlacement(area,dimensions,x,350,form,side,1);
  assert.ok(p.bounds.x>=100&&p.bounds.x+340<=1300);assert.ok(Math.abs(p.bounds.x+g.left+p.artShift-x)<.001);
  assert.equal(p.bounds.y+p.bounds.height,850);
 }
});
test('Gemini corner threshold snaps by visible edge, supports left and right',()=>{
 const width=artGeometry().width;
 assert.deepEqual(snapToEdges(area,width,500,area.x+90,300),{visualX:area.x,y:350});
 const p=snapToEdges(area,width,500,area.x+area.width-width-90,300);assert.equal(p.visualX,area.x+area.width-width);assert.equal(p.y,350);
});
