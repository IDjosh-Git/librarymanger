/* Per-column filters are applied to grouped bibliographic entries, not to
   individual physical copies. This preserves the available/total copy counts. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LibraryInventoryColumnFilters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FIELDS = ['isbn', 'title', 'authors', 'shelf', 'availableMin', 'availableMax',
    'totalMin', 'totalMax', 'loanMin', 'loanMax', 'status', 'details'];
  const KEYS = ['isbn', 'title', 'authors', 'available', 'total', 'loan', 'status', 'details', 'shelf'];
  function empty() { return Object.fromEntries(FIELDS.map(field => [field, ''])); }
  function normalize(x) { return String(x ?? '').trim().toLocaleLowerCase(); }
  function active(filters = {}, selections = {}) {
    return KEYS.filter(key => {
      const fields = key === 'available' || key === 'total' || key === 'loan'
        ? [key + 'Min', key + 'Max'] : [key];
      return fields.some(field => normalize(filters[field]) !== '') ||
        (Array.isArray(selections[key]) && selections[key].length > 0);
    });
  }
  // These reflect what is *in the column*, not values from a hard-coded menu.
  // A grouped title can have several shelves, authors or barcode variants.
  const BLANK = '(Blank)';
  function groupValues(group, key, quality = {}) {
    const copies = group?.copies || [];
    let values;
    switch (key) {
      case 'isbn': values = copies.map(book => book.barcode); break;
      case 'title': values = copies.map(book => book.title); break;
      case 'authors': values = copies.map(book => book.authors); break;
      case 'shelf': values = copies.map(book => book.shelf_location); break;
      case 'available': values = [group.availableCopies]; break;
      case 'total': values = [group.totalCopies]; break;
      case 'loan': values = [group.borrowedCopies]; break;
      case 'status': values = [
        ...(group.availableCopies ? ['Available'] : []),
        ...(group.borrowedCopies ? ['On loan'] : []),
        ...(group.overdueCopies ? ['Overdue'] : [])
      ]; break;
      case 'details': values = [
        ...(quality.full ? ['Full details'] : []),
        ...(quality.attention ? ['Needs attention'] : []),
        ...(quality.noTitle ? ['Without title'] : [])
      ]; break;
      default: values = [];
    }
    return [...new Map(values.map(value => {
      const label = String(value ?? '').trim() || BLANK;
      return [normalize(label), label];
    })).values()];
  }
  // Used by each header picker, including search and multi-select.
  function choices(groups, key, qualityFor = () => ({})) {
    if (!KEYS.includes(key)) return [];
    const found = new Map();
    for (const group of groups) {
      for (const value of groupValues(group, key, qualityFor(group))) {
        const id = normalize(value), item = found.get(id);
        if (item) item.count++;
        else found.set(id, {value, count:1});
      }
    }
    const isNumeric = ['available','total','loan'].includes(key);
    return [...found.values()].sort((a,b)=>isNumeric
      ? Number(a.value)-Number(b.value)
      : a.value === BLANK ? -1 : b.value === BLANK ? 1 :
        a.value.localeCompare(b.value,undefined,{numeric:true,sensitivity:'base'}));
  }
  function matchesText(copies, property, query) {
    const needle = normalize(query);
    return !needle || copies.some(book => normalize(book[property]).includes(needle));
  }
  function matchesNumber(value, min, max) {
    const minText = String(min ?? '').trim(), maxText = String(max ?? '').trim();
    const v = Number(value);
    return (!minText || !Number.isFinite(Number(minText)) || v >= Number(minText)) &&
      (!maxText || !Number.isFinite(Number(maxText)) || v <= Number(maxText));
  }
  function matches(group, filters = {}, quality = {}, selections = {}) {
    const copies = group?.copies || [];
    if (!matchesText(copies, 'barcode', filters.isbn)) return false;
    if (!matchesText(copies, 'title', filters.title)) return false;
    if (!matchesText(copies, 'authors', filters.authors)) return false;
    if (normalize(filters.shelf) && !(group.shelves || []).some(shelf => normalize(shelf).includes(normalize(filters.shelf)))) return false;
    if (!matchesNumber(group.availableCopies, filters.availableMin, filters.availableMax)) return false;
    if (!matchesNumber(group.totalCopies, filters.totalMin, filters.totalMax)) return false;
    if (!matchesNumber(group.borrowedCopies, filters.loanMin, filters.loanMax)) return false;
    switch (filters.status) {
      case 'available': if (!group.availableCopies) return false; break;
      case 'borrowed': if (!group.borrowedCopies) return false; break;
      case 'overdue': if (!group.overdueCopies) return false; break;
      case 'fully-available': if (!group.availableCopies || group.borrowedCopies) return false; break;
      case 'all-on-loan': if (!group.borrowedCopies || group.availableCopies) return false; break;
      case 'mixed': if (!group.availableCopies || !group.borrowedCopies) return false; break;
      default: break;
    }
    switch (filters.details) {
      case 'full': if (!quality.full) return false; break;
      case 'attention': if (!quality.attention) return false; break;
      case 'no-title': if (!quality.noTitle) return false; break;
      default: break;
    }
    return KEYS.every(key => !Array.isArray(selections[key]) || selections[key].length === 0 ||
      groupValues(group, key, quality).some(value =>
        selections[key].some(selected => normalize(selected) === normalize(value))));
  }
  return { empty, active, matches, matchesNumber, groupValues, choices, KEYS, BLANK };
});
