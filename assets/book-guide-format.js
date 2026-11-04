/* Accessible, safe, lightweight Markdown for Book Guide responses.
   All content is built with text nodes; user/model HTML is never executed. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.LibraryBookGuideFormat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function inline(target,source){
  const text=String(source??'');
  // Short, controlled formatting subset: **bold**, *italic*, `code`, https links.
  const patterns=/(\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_|`([^`\n]+)`|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let last=0,match;
  while((match=patterns.exec(text))){
   if(match.index>last)target.appendChild(document.createTextNode(text.slice(last,match.index)));
   let node;
   if(match[2]||match[3]){node=document.createElement('strong');node.textContent=match[2]||match[3];}
   else if(match[4]||match[5]){node=document.createElement('em');node.textContent=match[4]||match[5];}
   else if(match[6]){node=document.createElement('code');node.textContent=match[6];}
   else if(match[7]&&match[8]){
    try{const url=new URL(match[8]);if(!['https:','http:'].includes(url.protocol))throw Error('Unsupported URL');node=document.createElement('a');node.href=url.href;node.rel='noopener noreferrer';node.target='_blank';node.textContent=match[7];}
    catch{node=document.createTextNode(match[7]);}
   }
   target.appendChild(node||document.createTextNode(match[0]));last=patterns.lastIndex;
  }
  if(last<text.length)target.appendChild(document.createTextNode(text.slice(last)));
 }
 function render(target,source){
  if(!target)return;
  const text=String(source??'').replace(/\r\n?/g,'\n').slice(0,12000);
  target.replaceChildren();
  let list=null,code=null;
  function clearList(){list=null}
  function lineElement(tag,value){const node=document.createElement(tag);inline(node,value);target.appendChild(node);return node}
  for(const line of text.split('\n')){
   const raw=line.trim();
   if(/^```/.test(raw)){
    clearList();
    if(code){code=null;continue}
    const pre=document.createElement('pre');code=document.createElement('code');pre.appendChild(code);target.appendChild(pre);continue;
   }
   if(code){code.textContent+=(code.textContent?'\n':'')+line;continue}
   if(!raw){clearList();continue}
   const heading=raw.match(/^(#{1,4})\s+(.+)$/);
   if(heading){clearList();lineElement('h3',heading[2]);continue}
   const bullet=raw.match(/^(?:[-*•]|\u2022)\s+(.+)$/);
   const numbered=raw.match(/^(\d{1,3})[.)]\s+(.+)$/);
   if(bullet||numbered){
    const tag=numbered?'ol':'ul';
    if(!list||list.tagName.toLowerCase()!==tag){list=document.createElement(tag);target.appendChild(list)}
    const item=document.createElement('li');inline(item,numbered?numbered[2]:bullet[1]);list.appendChild(item);continue;
   }
   if(raw.startsWith('> ')){clearList();lineElement('blockquote',raw.slice(2));continue}
   clearList();lineElement('p',raw);
  }
  if(!target.children.length)lineElement('p',text);
 }
 return {render,inline};
});
