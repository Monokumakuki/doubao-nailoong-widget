const metadata=require('../../assets/characters/geometry.json');
/** Same visual-edge geometry as Gemini; alpha metadata adapts it to the supplied DouBao images. */
function artGeometry(form='doubao',facing='right',scale=1){
 const m=metadata[form]||metadata.doubao,[left,,right,bottom]=m.alpha;
 const width=254,height=width*m.height/m.width;
 const alphaLeft=(facing==='left'?m.width-right:left)*width/m.width;
 return {left:(43+alphaLeft)*scale,width:(right-left)*width/m.width*scale,bottom:(m.height-bottom)*height/m.height,canvasHeight:height};
}
function characterPlacement(area,dimensions,visualX,y,form,facing,scale){
 const g=artGeometry(form,facing,scale);
 visualX=Math.max(area.x,Math.min(area.x+area.width-g.width,visualX));
 const x=Math.round(Math.max(area.x,Math.min(area.x+area.width-dimensions.width,visualX-g.left)));
 y=Math.round(Math.max(area.y,Math.min(area.y+area.height-dimensions.height,y)));
 return {bounds:{...dimensions,x,y},artShift:(visualX-x-g.left)/scale,visualX};
}
function snapToEdges(area,width,height,visualX,y){
 const left=visualX-area.x,right=area.x+area.width-visualX-width,bottom=area.y+area.height-y-height;
 if(bottom<=120&&Math.min(left,right)<=120)return {visualX:left<right?area.x:area.x+area.width-width,y:area.y+area.height-height};
 return {visualX:left<40?area.x:right<40?area.x+area.width-width:visualX,y:bottom<40?area.y+area.height-height:y};
}
module.exports={artGeometry,characterPlacement,snapToEdges};
