# Photographic asset credits

The app uses real public Unsplash photographs through its CDN; they are not rendered illustrations.

- Library reading room: https://unsplash.com/photos/people-inside-library-RqtElNpHcs8 (Isaac Benhesed), image photo-1557818288-320deebced6c.
- Library bookshelves: https://unsplash.com/photos/man-sitting-on-chair-inside-library-yUSLlcOkJnk, image photo-1548453282-29d422a7025a.
- Stack of books: https://unsplash.com/photos/a-stack-of-books-sitting-on-top-of-a-table-mD773wwr85M, image photo-1520467795206-62e33627e6ce.

Unsplash license: https://unsplash.com/license. Photos are retrieved over HTTPS at runtime, so a network connection is needed to display them. The application never sends book scans to Unsplash. Cover thumbnails are retrieved from Open Library only for valid ISBNs; an unavailable cover falls back to a generic icon, not a picture of a different book.
