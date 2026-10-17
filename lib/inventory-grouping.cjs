/* Inventory is displayed by bibliographic identity, while retaining individual
   physical-copy records for lending, returns, and audit history. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LibraryInventoryGrouping = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const text = x => String(x ?? '').trim();
  const normalizedText = x => text(x).replace(/\s+/g, ' ').toLocaleLowerCase();
  function isbn13(x) {
    const raw = text(x).replace(/^ISBN(?:-1[03])?\s*:?\s*/i, '').replace(/[\s-]/g, '').toUpperCase();
    if (/^97[89]\d{10}$/.test(raw)) {
      let sum = 0; for (let i = 0; i < 13; i++) sum += Number(raw[i]) * (i % 2 ? 3 : 1);
      return sum % 10 === 0 ? raw : '';
    }
    if (/^\d{9}[\dX]$/.test(raw)) {
      let sum = 0; for (let i = 0; i < 10; i++) sum += (10 - i) * (raw[i] === 'X' ? 10 : Number(raw[i]));
      if (sum % 11) return '';
      const first12 = '978' + raw.slice(0, 9); let n = 0;
      for (let i = 0; i < first12.length; i++) n += Number(first12[i]) * (i % 2 ? 3 : 1);
      return first12 + String((10 - (n % 10)) % 10);
    }
    return '';
  }
  function identity(book, index) {
    const code = text(book.barcode).replace(/[\s-]/g, '').toUpperCase();
    // A known ISBN-10 and its equivalent ISBN-13 represent the same edition.
    if (code) return 'code:' + (isbn13(code) || code);
    // Never merge two photographs with missing identifiers purely because
    // their filename, shelf or empty title happen to match.
    const title = normalizedText(book.title), author = normalizedText(book.authors);
    const publisher = normalizedText(book.publisher), year = normalizedText(book.publication_year);
    if (title && author && publisher && year) return `bibliography:${title}|${author}|${publisher}|${year}|${normalizedText(book.language)}`;
    return `unidentified:${text(book.record_id) || text(book.id) || 'index-' + index}`;
  }
  function detailScore(book) {
    const fields = ['title','authors','publisher','publication_year','language','pages','subject','shelf_location'];
    return fields.reduce((score, field) => score + (text(book[field]) ? 1 : 0), 0);
  }
  function groupBooks(books, overdueDate) {
    const groups = new Map();
    (books || []).forEach((book, index) => {
      const key = identity(book, index);
      if (!groups.has(key)) groups.set(key, { key, copies: [] });
      groups.get(key).copies.push(book);
    });
    return Array.from(groups.values(), g => {
      const ranked = [...g.copies].sort((a, b) => detailScore(b) - detailScore(a));
      g.representative = ranked[0];
      g.totalCopies = g.copies.length;
      g.availableCopies = g.copies.filter(b => (b.book_status || 'Available') === 'Available').length;
      g.borrowedCopies = g.copies.filter(b => b.book_status === 'Borrowed').length;
      g.overdueCopies = g.copies.filter(b => b.book_status === 'Borrowed' && b.due_date && overdueDate && b.due_date < overdueDate).length;
      g.availableCopy = g.copies.find(b => (b.book_status || 'Available') === 'Available') || null;
      g.borrowedCopy = g.copies.find(b => b.book_status === 'Borrowed') || null;
      g.shelves = [...new Set(g.copies.map(b => text(b.shelf_location)).filter(Boolean))];
      g.newest = Math.max(...g.copies.map(b => new Date(b.created_at || b.updated_at || 0).getTime() || 0));
      g.oldest = Math.min(...g.copies.map(b => new Date(b.created_at || b.updated_at || 0).getTime() || 0));
      return g;
    });
  }
  return { identity, isbn13, groupBooks };
});
