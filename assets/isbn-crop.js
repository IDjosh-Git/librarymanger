/* ISBN photo cropper. Original images are never replaced. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LibraryIsbnCrop=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
 function normalize(box){const x=clamp(Number(box.x)||0,0,.98),y=clamp(Number(box.y)||0,0,.98);return {x,y,w:clamp(Number(box.w)||.02,.02,1-x),h:clamp(Number(box.h)||.02,.02,1-y)}}
 function fromPoints(a,b){return normalize({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)})}
 function pixels(box,width,height){const b=normalize(box);return {x:b.x*width,y:b.y*height,w:b.w*width,h:b.h*height}}
 async function open({src,previewOnly=false,onScan}){
  const dialog=document.createElement('dialog');dialog.className='isbn-crop-dialog';dialog.setAttribute('aria-labelledby','isbnCropHeading');
  dialog.innerHTML='<h2 id="isbnCropHeading">Crop and zoom ISBN</h2><p>Drag a box around the barcode or printed ISBN. Include a little space around all its edges. You can also adjust the sliders.</p><p class="isbn-crop-note"></p><canvas class="isbn-crop-source" aria-label="Photo: drag to select the ISBN area"></canvas><div class="isbn-crop-sliders"></div><p>Enlarged selection</p><canvas class="isbn-crop-preview" aria-label="Enlarged selected area"></canvas><p class="isbn-crop-status" role="status">Loading photo…</p><div class="isbn-crop-actions"><button type="button" data-crop="reset" class="light">Reset selection</button><button type="button" data-crop="cancel" class="light">Cancel</button><button type="button" data-crop="scan" class="green" disabled>Scan selected area</button></div>';
  document.body.append(dialog);dialog.showModal();
  const source=dialog.querySelector('.isbn-crop-source'),preview=dialog.querySelector('.isbn-crop-preview'),status=dialog.querySelector('.isbn-crop-status'),scan=dialog.querySelector('[data-crop="scan"]'),controls=dialog.querySelector('.isbn-crop-sliders');
  dialog.querySelector('.isbn-crop-note').textContent=previewOnly?'This is a saved preview. For a sharper crop, cancel and use Replace photo to select the original from your phone.':'Your original photo and shelf will be kept.';
  let box={x:0,y:0,w:1,h:1},image=null,start=null,pointer=null,busy=false,closed=false;
  const sliders={};
  for(const [key,label] of [['x','Left position'],['y','Top position'],['w','Selection width'],['h','Selection height']]){
   const wrapper=document.createElement('label'),text=document.createElement('span'),input=document.createElement('input');text.textContent=label;input.type='range';input.min=key==='x'||key==='y'?'0':'2';input.max=key==='x'||key==='y'?'98':'100';input.step='1';input.setAttribute('aria-label',label);sliders[key]=input;wrapper.append(text,input);controls.append(wrapper);
   input.oninput=()=>{if(busy||!image)return;box=normalize({...box,[key]:Number(input.value)/100});draw()};
  }
  function close(){if(busy)return;closed=true;dialog.close();dialog.remove();image=null}
  dialog.querySelector('[data-crop="cancel"]').onclick=close;
  dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
  function draw(){
   if(!image||closed)return;
   const ctx=source.getContext('2d');ctx.clearRect(0,0,source.width,source.height);ctx.drawImage(image,0,0,source.width,source.height);
   const r=pixels(box,source.width,source.height);ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,0,source.width,source.height);ctx.drawImage(image,...Object.values(pixels(box,image.naturalWidth,image.naturalHeight)),r.x,r.y,r.w,r.h);ctx.strokeStyle='#ffdf32';ctx.lineWidth=3;ctx.strokeRect(r.x,r.y,r.w,r.h);
   const original=pixels(box,image.naturalWidth,image.naturalHeight),scale=Math.min(1000/original.w,450/original.h);
   preview.width=Math.max(1,Math.round(original.w*scale));preview.height=Math.max(1,Math.round(original.h*scale));preview.getContext('2d').drawImage(image,original.x,original.y,original.w,original.h,0,0,preview.width,preview.height);
   for(const key of Object.keys(sliders))sliders[key].value=String(Math.round(box[key]*100));
  }
  function point(e){const r=source.getBoundingClientRect();return {x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)}}
  source.onpointerdown=e=>{if(busy||!image||pointer!==null)return;e.preventDefault();pointer=e.pointerId;start=point(e);source.setPointerCapture(pointer)};
  source.onpointermove=e=>{if(e.pointerId!==pointer||!start)return;box=fromPoints(start,point(e));draw()};
  source.onpointerup=e=>{if(e.pointerId!==pointer)return;if(start){box=fromPoints(start,point(e));draw()}start=null;pointer=null};
  source.onpointercancel=()=>{start=null;pointer=null};
  dialog.querySelector('[data-crop="reset"]').onclick=()=>{if(busy)return;box={x:0,y:0,w:1,h:1};draw()};
  scan.onclick=async()=>{
   if(busy||!image)return;busy=true;status.textContent='Scanning the selected area…';dialog.querySelectorAll('button,input').forEach(el=>el.disabled=true);
   try{
    const r=pixels(box,image.naturalWidth,image.naturalHeight),scale=Math.min(2,2400/Math.max(r.w,r.h)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(r.w*scale));canvas.height=Math.max(1,Math.round(r.h*scale));canvas.getContext('2d').drawImage(image,r.x,r.y,r.w,r.h,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not prepare this selection.');
    await onScan(new File([blob],'isbn-crop.png',{type:'image/png'}));busy=false;close();
   }catch(error){status.textContent='Could not scan this selection. Try again or cancel and enter the ISBN manually.';busy=false;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=false)}
  };
  try{
   const loaded=new Image();loaded.src=src;await loaded.decode();if(closed)return;image=loaded;const scale=Math.min(1,1000/image.naturalWidth,650/image.naturalHeight);source.width=Math.max(1,Math.round(image.naturalWidth*scale));source.height=Math.max(1,Math.round(image.naturalHeight*scale));draw();scan.disabled=false;status.textContent='Select the ISBN area, then scan.';
  }catch(error){if(!closed)status.textContent='Photo unavailable. Cancel and choose Replace photo to load the original.'}
 }
 return {normalize,fromPoints,pixels,open};
});
