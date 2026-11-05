/* Public-facing featured book. Only the dedicated public spotlight table is read. */
(() => {
  'use strict';
  const SUPABASE_URL = 'https://hotysnqorkqbiconjskl.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_OL7r2hmR6n7OOWY5m-3bRw_Peft2X9q';
  const byId = id => document.getElementById(id);
  const theme = byId('spotlightThemeToggle');
  theme.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('library_manager_theme_v2', next); } catch (_) {}
    theme.setAttribute('aria-pressed', String(next === 'dark'));
  });
  theme.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'));

  function validImageUrl(url) {
    try { const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.href : ''; }
    catch (_) { return ''; }
  }
  function updateSpotlight(data) {
    if (!data || !String(data.title || '').trim()) return;
    byId('spotlightOverline').textContent = 'THIS WEEK’S FEATURED TITLE';
    byId('spotlightTitle').textContent = String(data.title).trim();
    byId('spotlightAuthor').textContent = 'By ' + String(data.authors || 'Unknown author').trim();
    byId('spotlightDescription').textContent = String(data.description || 'Discover this featured title in our library collection.').trim();
    window.LibraryBookGuide?.addBook({title:data.title,authors:data.authors,isbn:data.isbn,shelf:data.shelf,description:data.description});
    byId('spotlightIsbn').textContent = data.isbn || 'Not listed';
    byId('spotlightShelf').textContent = data.shelf || 'Ask the library';
    const automatic=data.selection_source==='automatic';
    byId('spotlightSource').textContent=automatic?'Weekly automatic pick':'Curated by the library';
    byId('spotlightEdition').textContent=automatic?'Freshly selected from our shelves this week':'Handpicked by your library team';
    byId('spotlightOverline').textContent=automatic?'THIS WEEK’S LIBRARY DISCOVERY':'THIS WEEK’S FEATURED TITLE';
    if (data.published_at && !Number.isNaN(Date.parse(data.published_at))) {
      byId('spotlightPublished').textContent = (data.selection_source==='automatic'?'Weekly pick since ':'Featured on ') + new Date(data.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } else byId('spotlightPublished').textContent = 'Selected by your library';
    const cover = validImageUrl(String(data.cover_url || ''));
    if (cover) {
      const image = byId('spotlightCover');
      image.onerror = () => { image.onerror = null; image.src = 'assets/book-stack-fallback.jpg'; image.alt = 'Photograph of a stack of books'; };
      image.src = cover;
      image.alt = 'Cover of ' + String(data.title) + ' by ' + String(data.authors || 'the author');
    } else {
      byId('spotlightCover').src = 'assets/book-stack-fallback.jpg';
      byId('spotlightCover').alt = 'Photograph of books from the library collection';
    }
  }
  async function loadFeaturedBook() {
    if (!window.supabase?.createClient) return;
    try {
      // Only the public curated row, never the private inventory/borrower data.
      const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      // Populate the Book Guide with all public catalogue titles (metadata only).
      void window.LibraryBookGuide?.loadPublicCatalog();
      // SQL endpoint exposes only curated bibliographic fields, never loans or members.
      const { data, error } = await db.rpc('library_public_featured_book');
      if (!error && Array.isArray(data) && data[0]) updateSpotlight(data[0]);
      else {
        // Backwards-compatible manual feature if discovery upgrade is not installed.
        const {data:manual,error:legacyError}=await db.from('library_featured_books')
          .select('title,authors,isbn,description,cover_url,shelf,published_at').eq('id',1).maybeSingle();
        if(!legacyError&&manual)updateSpotlight({...manual,selection_source:'manual'});
      }
    } catch (_) { /* Unconfigured spotlight retains its honest, usable placeholder. */ }
  }
  byId('askFeaturedBook')?.addEventListener('click',()=>{const title=byId('spotlightTitle').textContent;if(!title||title==='Your next great read awaits.')return;window.LibraryBookGuide?.openBook({title,authors:byId('spotlightAuthor').textContent.replace(/^By /,''),isbn:byId('spotlightIsbn').textContent,shelf:byId('spotlightShelf').textContent,description:byId('spotlightDescription').textContent})});
  const share=byId('shareSpotlight');
  share?.addEventListener('click',async()=>{
    const title=byId('spotlightTitle').textContent;
    const text=`${title} — Book of the Week at Library Manager`;
    try{
      if(navigator.share)await navigator.share({title:text,text,url:location.href});
      else if(navigator.clipboard){await navigator.clipboard.writeText(location.href);share.textContent='Link copied ✓';}
      else share.textContent='Copy the page address to share';
    }catch{/* Dismissed system share dialog. */}
  });
  loadFeaturedBook();
})();
