/* Excel review round-trip. Pure helpers shared by browser and Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LibraryReviewExcel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const columns = ['Review_Key', 'Photo_File', 'Folder', 'ISBN_Barcode', 'Title', 'Authors', 'Publisher', 'Publication_Year', 'Language', 'Pages', 'Subject', 'Shelf_Number', 'Lookup_Status', 'Import_Action'];
  const fields = {ISBN_Barcode:'barcode', Title:'title', Authors:'authors', Publisher:'publisher', Publication_Year:'publication_year', Language:'language', Pages:'pages', Subject:'subject', Shelf_Number:'shelf'};
  function str(v){return v===null||v===undefined?'':String(v).trim()}
  function exportRow(item, newId){
    const key = str(item.saveRecordId) || newId();
    item.saveRecordId=key;
    const output={Review_Key:key, Photo_File:str(item.fileName), Folder:str(item.path), Lookup_Status:str(item.lookup_status||'Manual'), Import_Action:'SAVE'};
    for(const [heading,field] of Object.entries(fields))output[heading]=str(item[field]);
    return Object.fromEntries(columns.map(k=>[k,output[k]??'']));
  }
  function validateAndParse(matrix, newId, maxRows=12000){
    if(!Array.isArray(matrix)||!matrix.length)throw Error('Excel sheet is empty. Export the Review template first.');
    const headers=matrix[0].map(str);
    const required=['ISBN_Barcode','Title','Shelf_Number'];
    if(required.some(h=>!headers.includes(h)))throw Error('Wrong Excel template. Required headers: ISBN_Barcode, Title, Shelf_Number. Export a new Review Excel file and use that format.');
    if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw Error('Duplicate column headings found. Keep each Excel column heading only once.');
    const indexes=Object.fromEntries(headers.map((h,i)=>[h,i]));
    const results=[],seen=new Set();
    for(let i=1;i<matrix.length;i++){
      const input=matrix[i];if(!Array.isArray(input))continue;
      const v=k=>str(input[indexes[k]]);
      const key=v('Review_Key'),action=v('Import_Action').toUpperCase();
      const hasContent=Object.keys(fields).some(h=>v(h))||v('Photo_File')||v('Folder');
      if(!hasContent)continue;
      if(action==='SKIP')continue;
      if(action&&action!=='SAVE')throw Error(`Row ${i+1}: Import_Action must be SAVE or SKIP.`);
      if(key&&seen.has(key))throw Error(`Row ${i+1}: Review_Key is repeated in this Excel file. Clear Review_Key on the additional physical copy to generate a separate record.`);
      if(key&&(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)))throw Error(`Row ${i+1}: Review_Key was changed or damaged. Restore the original key, or clear it if this is a new copy.`);
      const result={saveRecordId:key||newId(),fileName:v('Photo_File')||`Excel row ${i+1}`,path:v('Folder')||v('Photo_File')||`Excel row ${i+1}`,lookup_status:v('Lookup_Status')||'Excel review',selected:true,saved:false,error:'',saveError:'',duplicate:false};
      for(const [heading,field] of Object.entries(fields))result[field]=v(heading);
      seen.add(result.saveRecordId);results.push(result);
      if(results.length>maxRows)throw Error(`Excel file exceeds ${maxRows} review rows. Split it into smaller files.`);
    }
    if(!results.length)throw Error('No books marked SAVE were found in this Excel file.');
    return results;
  }
  return {columns,fields,exportRow,validateAndParse};
});
