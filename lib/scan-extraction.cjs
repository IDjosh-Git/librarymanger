/* Shared, dependency-free extraction helpers for browser scans and unit tests.
   Do not infer an edition-specific ISBN from a work/title search result. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LibraryScan=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const stop=new Set('the a an of and by or in for to from with on at volume vol book books edition revised updated print printing publisher publishing press copyright isbn library page pages contents introduction preface acknowledgements dedication all rights reserved international standard number'.split(' '));
  function normalizedWords(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').split(/\s+/).filter(w=>w.length>1&&!stop.has(w))}
  function isbnValid(input){const s=String(input||'').toUpperCase().replace(/[^0-9X]/g,'');if(s.length===10){let n=0;for(let i=0;i<10;i++){const c=s[i]==='X'?10:Number(s[i]);if(c===10&&i!==9)return false;n+=(10-i)*c}return n%11===0}if(s.length===13&&/^97[89]/.test(s)){let sum=0;for(let i=0;i<13;i++)sum+=Number(s[i])*(i%2?3:1);return sum%10===0}return false}
  function isbnFromText(value){const text=String(value||'').toUpperCase();const codes=[];
    // Prefer labeled ISBN lines, then other contiguous 10/13 character strings.
    for(const line of text.split(/\r?\n/)){
      const isLabeled=/\bISBN(?:[-\s]?1[03])?\s*[:#]?/i.test(line);
      const source=isLabeled?line.replace(/^.*?\bISBN(?:[-\s]?1[03])?\s*[:#]?\s*/i,''):line;
      const segments=(source.match(/(?:[0-9OILX][\s\-–‐.]*){9,16}/g)||[]);
      for(const segment of segments){const test=segment.toUpperCase().replace(/[O]/g,'0').replace(/[IL]/g,'1').replace(/[^0-9X]/g,'');
        for(const n of [13,10]){for(let i=0;i+n<=test.length;i++){const part=test.slice(i,i+n);if(isbnValid(part)&&!codes.includes(part))codes.push(part)}}
      }
    }
    return codes;
  }
  function titleLines(text){return String(text||'').split(/[\r\n]+/).map(v=>v.replace(/[|•_*]+/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean)}
  function titleCandidates(text){const lines=titleLines(text),out=[];
    for(let i=0;i<lines.length&&i<40;i++){
      const line=lines[i].replace(/^(?:title\s*[:\-]\s*)/i,'');const tokens=normalizedWords(line),letters=(line.match(/\p{L}/gu)||[]).length;
      if(!tokens.length||letters<5||line.length>110||/\b(?:isbn|copyright|www\.|http|printed in|edition|published|all rights|library of congress|table of contents|\d{4}\s*[-–]\s*\d{4})\b/i.test(line))continue;
      if(/^(?:by|written by|author|authors|edited by|illustrated by|translated by)\b/i.test(line))continue;
      if(/^\d[\d .,:;\-/]*$/.test(line))continue;
      const base=Math.min(9,tokens.length)*2+(i<9?4:0)+(line===line.toUpperCase()?1:0);
      out.push({title:line,score:base});
      const next=lines[i+1];if(next&&i<12&&next.length<75&&!/^(?:by |written by |author|isbn|edition|copyright|publisher)/i.test(next)&&normalizedWords(next).length>=2&&line.length+next.length<115)out.push({title:line+' '+next,score:base+1});
    }
    return out.sort((a,b)=>b.score-a.score).slice(0,8).map(v=>v.title).filter((v,i,a)=>a.indexOf(v)===i);
  }
  function authorFromText(text){const lines=titleLines(text);
    for(const line of lines){const m=line.match(/^(?:by|written by|author(?:s)?\s*[:\-]|edited by)\s+(.{3,90})$/i);if(m)return m[1].replace(/[,.;]+$/,'').trim()}
    return '';
  }
  function similarity(a,b){const aa=new Set(normalizedWords(a)),bb=new Set(normalizedWords(b));if(!aa.size||!bb.size)return 0;let common=0;for(const t of aa)if(bb.has(t))common++;return (2*common)/(aa.size+bb.size)}
  function scoreCandidates(items,text,proposedTitle='',author=''){
    const lines=titleCandidates(text);if(proposedTitle)lines.unshift(proposedTitle);
    const authorEvidence=author||authorFromText(text);
    return (items||[]).map(item=>{
      const best=Math.max(0,...lines.map(line=>similarity(line,item.title)));
      const authorMatch=authorEvidence&&item.authors?similarity(authorEvidence,item.authors):0;
      return {...item,score:Math.min(1,best*0.85+authorMatch*0.15),titleScore:best,authorScore:authorMatch};
    }).sort((a,b)=>b.score-a.score);
  }
  function detailQuality(book){
    const hasTitle=!!String(book?.title||'').trim();
    const parts=['barcode','title','authors','publisher','publication_year','shelf_location'];
    const filled=parts.filter(k=>String(book?.[k]||'').trim()).length;
    return {noTitle:!hasTitle,full:filled===parts.length,needsAttention:filled!==parts.length,missing:parts.filter(k=>!String(book?.[k]||'').trim())};
  }
  return {isbnValid,isbnFromText,titleCandidates,authorFromText,normalizedWords,similarity,scoreCandidates,detailQuality};
});
