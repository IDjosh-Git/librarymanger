(function(root){
  'use strict';
  function normalize(x){return String(x??'').toLocaleLowerCase().trim()}
  function filter(rows,opts={},complete){
    const query=normalize(opts.query),status=normalize(opts.status||'all'),quality=normalize(opts.quality||'all'),shelf=normalize(opts.shelf||'all');
    return (rows||[]).filter(book=>{
      const text=[book.book_id,book.record_id,book.barcode,book.title,book.authors,book.publisher,book.shelf_location].map(normalize).join(' ');
      if(query&&!text.includes(query))return false;
      const loan=normalize(book.book_status)==='borrowed';
      if(status==='borrowed'&&!loan||status==='available'&&loan)return false;
      if(shelf!=='all'&&normalize(book.shelf_location)!==shelf)return false;
      const isComplete=complete?complete(book):[book.title,book.authors,book.publisher,book.publication_year,book.shelf_location].every(x=>normalize(x).length>0);
      if(quality==='full'&&!isComplete||quality==='attention'&&isComplete)return false;
      return true;
    }).sort((a,b)=>String(b.scan_date||b.created_at||'').localeCompare(String(a.scan_date||a.created_at||''))||String(a.title||'').localeCompare(String(b.title||'')));
  }
  const api={filter};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.LibraryScannedBooks=api;
})(typeof globalThis!=='undefined'?globalThis:this);
