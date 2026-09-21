// In Apps Script: Project Settings → Script Properties → add LIBRARY_SYNC_TOKEN.
// Do not store the token in source code or share it in your site ZIP.
const BOOKS_SHEET='Books';
const LOANS_SHEET='Loans';

const BOOK_HEADERS=['id','user_id','record_id','scan_date','scan_time','barcode','book_id','title','authors','publisher','publication_year','language','pages','subject','accession_no','shelf_location','lookup_status','borrower_name','date_borrowed','due_date','return_date','book_status','created_at','updated_at'];
const LOAN_HEADERS=['id','user_id','book_record_id','book_id','barcode','book_title','borrower_name','date_borrowed','due_date','return_date','status','created_at','updated_at'];

function doGet(e){
  try{
    verify_(e.parameter.token);
    const action=String(e.parameter.action||'ping').toLowerCase();
    const ss=SpreadsheetApp.openById(String(e.parameter.spreadsheetId||'').trim());
    ensureSheet_(ss,BOOKS_SHEET,BOOK_HEADERS);
    ensureSheet_(ss,LOANS_SHEET,LOAN_HEADERS);
    if(action==='ping') return callback_({ok:true,spreadsheetName:ss.getName()},e.parameter.callback);
    throw new Error('Unsupported GET action');
  }catch(err){return callback_({ok:false,error:String(err.message||err)},e&&e.parameter&&e.parameter.callback)}
}

function doPost(e){
  try{
    const p=e.parameter||{};
    verify_(p.token);
    const ss=SpreadsheetApp.openById(String(p.spreadsheetId||'').trim());
    const books=ensureSheet_(ss,BOOKS_SHEET,BOOK_HEADERS);
    const loans=ensureSheet_(ss,LOANS_SHEET,LOAN_HEADERS);
    const action=String(p.action||'').toLowerCase();

    if(action==='upsert_book'){
      upsert_(books,BOOK_HEADERS,JSON.parse(p.payload||'{}'),'record_id');
      return json_({ok:true});
    }
    if(action==='upsert_loan'){
      upsert_(loans,LOAN_HEADERS,JSON.parse(p.payload||'{}'),'id');
      return json_({ok:true});
    }
    if(action==='batch_sync'){
      const bs=JSON.parse(p.books||'[]');
      const ls=JSON.parse(p.loans||'[]');
      bs.forEach(x=>upsert_(books,BOOK_HEADERS,x,'record_id'));
      ls.forEach(x=>upsert_(loans,LOAN_HEADERS,x,'id'));
      return json_({ok:true,books:bs.length,loans:ls.length});
    }
    if(action==='delete_book'){
      deleteByKey_(books,BOOK_HEADERS,'record_id',String(p.record_id||''));
      return json_({ok:true});
    }
    throw new Error('Unsupported POST action');
  }catch(err){return json_({ok:false,error:String(err.message||err)})}
}

function verify_(token){
  const expected=PropertiesService.getScriptProperties().getProperty('LIBRARY_SYNC_TOKEN');
  if(!expected || String(token||'')!==expected) throw new Error('Unauthorized connector request');
}

function ensureSheet_(ss,name,headers){
  let sh=ss.getSheetByName(name);
  if(!sh) sh=ss.insertSheet(name);
  const row=sh.getRange(1,1,1,headers.length).getDisplayValues()[0];
  if(headers.some((h,i)=>row[i]!==h)){
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function upsert_(sheet,headers,obj,keyField){
  const key=String(obj[keyField]||'').trim();
  if(!key) throw new Error(keyField+' is required');
  const keyCol=headers.indexOf(keyField)+1;
  let row=0;
  if(sheet.getLastRow()>=2){
    const found=sheet.getRange(2,keyCol,sheet.getLastRow()-1,1).createTextFinder(key).matchEntireCell(true).findNext();
    if(found) row=found.getRow();
  }
  const values=headers.map(h=>{
    const v=obj[h];
    if(v===null||v===undefined) return '';
    // Prevent Google Sheets from interpreting untrusted book metadata as a formula.
    if(typeof v === 'string' && /^[\s]*[=+\-@]/.test(v)) return "'" + v;
    return v;
  });
  if(row) sheet.getRange(row,1,1,headers.length).setValues([values]);
  else sheet.getRange(sheet.getLastRow()+1,1,1,headers.length).setValues([values]);
}

function deleteByKey_(sheet,headers,keyField,key){
  key=String(key||'').trim();if(!key)return;
  const keyCol=headers.indexOf(keyField)+1;if(keyCol<1||sheet.getLastRow()<2)return;
  const found=sheet.getRange(2,keyCol,sheet.getLastRow()-1,1).createTextFinder(key).matchEntireCell(true).findNext();
  if(found)sheet.deleteRow(found.getRow());
}

function callback_(obj,callback){
  const text=JSON.stringify(obj);
  if(callback){
    const safe=String(callback);
    if(!/^[A-Za-z_$][\w$]{0,65}$/.test(safe)) throw new Error('Invalid callback');
    return ContentService.createTextOutput(safe+'('+text+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
