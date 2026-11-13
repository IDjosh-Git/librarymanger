/* Inventory is one row per identifiable title and author. Physical copies remain distinct. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LibraryInventoryGrouping = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const text = x => String(x ?? '').trim();
  const normalizedText = x => text(x).normalize('NFKC').toLocaleLowerCase()
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  const ids=(typeof module!=='undefined'&&module.exports)?require('./book-identifiers.js'):globalThis.LibraryBookIdentifiers;
  function isbn13(x){return ids.to13(x)}
  const identified = value => Boolean(normalizedText(value)) && !/^(?:unknown|untitled|untitled book|title not found|title missing|no title|n a)$/i.test(normalizedText(value));
  function identity(book, index) {
    // Same title and known author = same inventory row even with unique copy barcodes,
    // different ISBN editions, different shelves or missing optional metadata.
    const title = normalizedText(book.title), author = normalizedText(book.authors);
    if (identified(book.title)) return `title:${title}|author:${author || '?'}`;
    // No verified title? Keep copies independently identifiable for Scan & Review.
    return `unidentified:${text(book.record_id) || text(book.id) || 'index-' + index}`;
  }
  function detailScore(book) {
    const fields = ['title','authors','publisher','publication_year','language','pages','subject','shelf_location'];
    return fields.reduce((score, field) => score + (text(book[field]) ? (field === 'authors' ? 9 : 1) : 0), 0);
  }
  function groupBooks(books, overdueDate) {
    const entries = books || [];
    // A missing author on a scan should not split the same title into another row
    // when precisely one known author exists. Ambiguous titles remain separate.
    const titleAuthors = new Map();
    entries.forEach(book => {
      if (!identified(book.title) || !normalizedText(book.authors)) return;
      const title = normalizedText(book.title);
      if (!titleAuthors.has(title)) titleAuthors.set(title, new Set());
      titleAuthors.get(title).add(normalizedText(book.authors));
    });
    const groups = new Map();
    entries.forEach((book, index) => {
      let key = identity(book,index);
      if (identified(book.title) && !normalizedText(book.authors)) {
        const title=normalizedText(book.title), known=titleAuthors.get(title);
        if (known?.size === 1) key=`title:${title}|author:${[...known][0]}`;
      }
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
      g.barcodes = [...new Set(g.copies.map(b => text(b.barcode)).filter(Boolean))];
      g.isbns = [...new Set(g.copies.map(b => isbn13(b.barcode)).filter(Boolean))];
      g.newest = Math.max(...g.copies.map(b => new Date(b.created_at || b.updated_at || 0).getTime() || 0));
      g.oldest = Math.min(...g.copies.map(b => new Date(b.created_at || b.updated_at || 0).getTime() || 0));
      return g;
    });
  }
  return { identity, isbn13, groupBooks };
});
