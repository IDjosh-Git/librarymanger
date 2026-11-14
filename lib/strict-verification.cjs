'use strict';
const {validISBN,digitISBN,sameISBN}=require('./book-metadata.cjs');
const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function verify(row,lookup){
 const data=row?.data||{};const isbn=digitISBN(data.barcode);
 const reasons=[];
 if(!validISBN(isbn))reasons.push('invalid_isbn');
 if(!data.title||!data.authors)reasons.push('missing_title_or_author');
 if(!lookup?.found||lookup?.conflicted||lookup?.conflicts?.length)reasons.push('missing_or_conflicting_provider_evidence');
 const checked=lookup?.checked||[];
 const supported=checked.find(x=>x.status==='found'&&['Google Books','Open Library Edition','Open Library Books API'].includes(x.source));
 if(!supported)reasons.push('no_exact_edition_provider');
 if(norm(data.title)!==norm(lookup?.metadata?.title))reasons.push('title_mismatch');
 const actual=norm(data.authors),expected=norm(lookup?.metadata?.authors);
 if(!actual||!expected||actual!==expected)reasons.push('author_mismatch');
 return {ok:reasons.length===0,reasons,isbn,source:supported?.source==='Google Books'?'google_books':'open_library',title:data.title,authors:data.authors};
}
module.exports={verify,norm};
