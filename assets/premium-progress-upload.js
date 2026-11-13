/* v5.18 progress and upload microcopy. No artificial countdown or percentages. */
(()=>{
  const init=()=>{
    const progress=document.getElementById('batchProgress');
    const container=progress?.closest('.premium-progress');
    const status=document.getElementById('batchStatus');
    if(!progress||!container||!status)return;
    const stage=document.getElementById('batchProgressStage');
    const percent=document.getElementById('batchProgressPercent');
    const count=document.getElementById('batchProgressCount');
    const hint=document.getElementById('batchProgressHint');
    let lastState='idle';
    const refresh=()=>{
      const scanMode=progress.dataset.scanMode==='true';
      const scanTotal=Math.max(0,Number(progress.dataset.scanTotal)||0);
      const scanPrepared=Math.max(0,Number(progress.dataset.scanPrepared)||0);
      const scanChecked=Math.max(0,Number(progress.dataset.scanChecked)||0);
      const scanScanned=Math.max(0,Number(progress.dataset.scanScanned)||0);
      const scanSkipped=Math.max(0,Number(progress.dataset.scanSkipped)||0);
      const max=Math.max(0,Number(progress.max)||0);
      const value=Math.max(0,Math.min(max,Number(progress.value)||0));
      const pct=max>0?100*value/max:0;
      const message=(status.textContent||'').trim();
      const error=/(?:cannot|could not|failed|exceed|limit|too large|unsupported|rate.limit|sign in|not load|no supported|cancelled|stopped)/i.test(message);
      const preparingZip=/opening ZIP|preparing ZIP/i.test(message);
      const saving=/saving|saved [0-9]+ of/i.test(message);
      const checking=/checking (?:files|[0-9]+|uploads)|duplicate photo|shared inventory/i.test(message)&&/checking/i.test(message);
      const success=/(?:finished|complete|scanned|saved|skipped|already uploaded)/i.test(message)&&max>0&&value>=max;
      const working=/(?:recognised|scanning|processing|reading|opening ZIP|preparing photos|selected\.|starts now|saving|importing|analyzing|extracting|checking)/i.test(message);
      const ready=/(?:choose a folder|choose folder|choose ZIP|choose photos|selection cleared)/i.test(message);
      const state=error?'error':success?'done':working?'working':ready?'idle':lastState==='done'?'done':'idle';
      const hasRealCount=max>0&&!preparingZip&&state!=='idle'&&!(state==='error'&&max===100&&value===0);
      lastState=state;
      container.dataset.progressState=state;
      stage.textContent=state==='error'?'Needs attention':state==='done'?'Completed':preparingZip?'Preparing ZIP':saving?'Saving books':scanMode&&scanScanned?'Scanning books':scanMode&&scanChecked?'Recognizing covers':scanMode&&scanPrepared?'Preparing images':checking?'Checking duplicates':state==='working'?'Scanning books':'Ready to scan';
      percent.textContent=hasRealCount?`${pct>=10?Math.round(pct):Number(pct.toFixed(1))}%`:(preparingZip?'Preparing…':'0%');
      count.textContent=scanMode&&scanTotal?`${scanScanned} scanned · ${scanSkipped} skipped / ${scanTotal} photos`:hasRealCount?`${value} / ${max} ${saving?'books':'photos'}`:'';
      hint.textContent=state==='error'?'Check the message above, then retry.':state==='done'?'Verified books have been saved to Inventory. Uncertain books were sent to Review.':preparingZip?'Opening the archive and checking images.':saving?'Saving verified books to Inventory automatically.':scanMode?`${scanPrepared} prepared · ${scanChecked} checked · ${scanScanned+scanSkipped} finished. Percentage includes preparation, duplicate checks and recognition.`:checking?'Repeated photos are skipped before scanning.':state==='working'?'Verified books are saved automatically while scanning. Uncertain books go to Review.':'Scanning begins when you select files.';
      progress.setAttribute('aria-label',`${stage.textContent}: ${Number(pct.toFixed(1))}%${scanMode?`, ${scanScanned} scanned and ${scanSkipped} skipped of ${scanTotal} photos`:max?`, ${value} of ${max} photos`:''}`);
    };
    const observer=new MutationObserver(refresh);
    observer.observe(status,{subtree:true,childList:true,characterData:true});
    observer.observe(progress,{attributes:true,attributeFilter:['value','max']});
    window.LibraryProgressUI={refresh};
    for(const id of ['batchFolder','batchZip','batchPhotos']){
      const input=document.getElementById(id);
      const label=input?.closest('[data-input-label]');
      const detail=label?.querySelector('.premium-upload-detail');
      if(!input||!detail)return;
      const original=detail.textContent;
      input.addEventListener('change',()=>{
        const files=Array.from(input.files||[]);
        if(!files.length)return;
        for(const previous of document.querySelectorAll('#shelfScan [data-input-label][data-selected="true"]')){
          previous.dataset.selected='false';
          const previousDetail=previous.querySelector('.premium-upload-detail');
          if(previousDetail?.dataset.original)previousDetail.textContent=previousDetail.dataset.original;
        }
        detail.dataset.original=original;
        detail.textContent=id==='batchZip'?'ZIP selected · preparing':`${files.length} ${files.length===1?'photo':'photos'} selected`;
        label.dataset.selected='true';
      },{capture:true});
    }
    document.getElementById('batchClear')?.addEventListener('click',()=>{
      for(const el of document.querySelectorAll('#shelfScan [data-input-label]')){
        el.dataset.selected='false';
        const detail=el.querySelector('.premium-upload-detail');
        if(detail?.dataset.original)detail.textContent=detail.dataset.original;
      }
    });
    refresh();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
