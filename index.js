/* ============================================================
   BOOK ENGINE
   Reads <book> and <chapter> tags. Builds the full layout.
   Runs automatically on every page load. Nothing is stored.
   ============================================================ */
(function () {

  const BOOK    = document.querySelector('book');
  const CHS     = [...document.querySelectorAll('chapter')];
  const INTRO_EL = document.querySelector('introduction');
  if (!BOOK || !CHS.length) return;

  const TITLE   = BOOK.getAttribute('title')  || 'My Book';
  const AUTHOR  = BOOK.getAttribute('author') || '';
  document.title = TITLE;

  // Layout constants (must match CSS vars in px)
  const PAGE_H     = 920;
  const PAD_TOP    = 90;
  const PAD_SIDE   = 88;
  const PAD_BOT    = 70;
  const FOOTER_H   = 56;
  const TEXT_W     = 650 - PAD_SIDE * 2;  // available text width
  const TEXT_H     = PAGE_H - PAD_TOP - FOOTER_H - PAD_BOT;

  // Parse introduction data (optional)
  const intro = INTRO_EL ? {
    title : INTRO_EL.getAttribute('title') || 'Introduction',
    paras : [...INTRO_EL.querySelectorAll('p')].map(p => p.innerHTML),
  } : null;

  // Parse chapter data from DOM
  const chapters = CHS.map((ch, i) => ({
    index : i,
    title : ch.getAttribute('title') || `Chapter ${i + 1}`,
    paras : [...ch.querySelectorAll('p')].map(p => p.innerHTML),
  }));

  // Hide raw <book> tag
  BOOK.style.display = 'none';

  // ── Build TOC shell ──
  const toc = document.createElement('div');
  toc.id = 'toc';
  toc.innerHTML = `
    <div class="toc-label">Table of Contents</div>
    <div class="toc-book-title">${x(TITLE)}</div>
    <div class="toc-author">${x(AUTHOR)}</div>
    <div class="toc-divider"></div>
    <ul class="toc-list" id="toc-list"></ul>
  `;
  document.body.insertBefore(toc, BOOK);

  // ── Measurement ruler ──
  const ruler = document.createElement('div');
  ruler.style.cssText = [
    'position:absolute', 'visibility:hidden', 'pointer-events:none',
    `width:${TEXT_W}px`,
    `font-family:'EB Garamond',Georgia,serif`,
    `font-size:17.5px`,
    `line-height:1.9`,
    'text-align:justify',
    'hyphens:auto',
    'word-break:normal',
    'top:0', 'left:0',
  ].join(';');
  document.body.appendChild(ruler);

  // ── Render after fonts load ──
  document.fonts.ready.then(render);

  function render() {
    let globalPage = 0;
    const chStartPage = {};   // chapter index → first writing page #
    const titlePages  = [];   // chapter title page DOM elements (for TOC scroll)

    // ── Render introduction (if present) ──
    let introTitlePage = null;
    let introStartPage = null;

    if (intro) {
      const tp = buildPage(true);
      tp.inner.innerHTML = `
        <div class="ch-ornament">— ✦ —</div>
        <div class="ch-num-label">&nbsp;</div>
        <div class="ch-name">${x(intro.title)}</div>
        <div class="ch-rule"></div>
      `;
      tp.ftChapter.textContent = intro.title.toUpperCase();
      tp.ftNum.textContent     = '';
      document.body.insertBefore(tp.page, BOOK);
      introTitlePage = tp.page;

      let usedH = 0, curInner = null, curBlock = null, firstOfIntro = true, paraIndexOnPage = 0;
      intro.paras.forEach((html, pi) => {
        ruler.innerHTML = `<p style="margin:0;text-indent:${pi===0?'0':'1.6em'}">${html}</p>`;
        const pH = ruler.scrollHeight + 1;
        if (!curInner || usedH + pH > TEXT_H) {
          globalPage++;
          if (firstOfIntro) { introStartPage = globalPage; firstOfIntro = false; }
          const pg = buildPage(false);
          pg.ftChapter.textContent = intro.title.toUpperCase();
          pg.ftNum.textContent     = globalPage;
          document.body.insertBefore(pg.page, BOOK);
          curInner = pg.inner;
          curBlock = document.createElement('div');
          curBlock.className = 'text-block';
          curInner.appendChild(curBlock);
          usedH = 0; paraIndexOnPage = 0;
        }
        const p = document.createElement('p');
        p.innerHTML = html;
        if (pi === 0 && paraIndexOnPage === 0) p.classList.add('drop-cap');
        curBlock.appendChild(p);
        usedH += pH; paraIndexOnPage++;
      });
    }

    chapters.forEach((ch, ci) => {

      // ─ Chapter title page ─
      const tp = buildPage(true);
      tp.inner.innerHTML = `
        <div class="ch-ornament">— ✦ —</div>
        <div class="ch-num-label">Chapter ${ ci + 1 }</div>
        <div class="ch-name">${x(ch.title)}</div>
        <div class="ch-rule"></div>
      `;
      tp.ftChapter.textContent = ch.title.toUpperCase();
      tp.ftNum.textContent     = '';
      document.body.insertBefore(tp.page, BOOK);
      titlePages.push(tp.page);

      // ─ Writing pages ─
      let usedH        = 0;
      let curInner     = null;
      let curBlock     = null;
      let firstOfCh    = true;
      let paraIndexOnPage = 0;

      ch.paras.forEach((html, pi) => {
        // Measure paragraph height
        ruler.innerHTML = `<p style="margin:0;text-indent:${pi===0?'0':'1.6em'}">${html}</p>`;
        const pH = ruler.scrollHeight + 1; // +1 safety

        // Need new page?
        if (!curInner || usedH + pH > TEXT_H) {
          globalPage++;
          if (firstOfCh) { chStartPage[ci] = globalPage; firstOfCh = false; }

          const pg = buildPage(false);
          pg.ftChapter.textContent = ch.title.toUpperCase();
          pg.ftNum.textContent     = globalPage;
          document.body.insertBefore(pg.page, BOOK);

          curInner = pg.inner;
          curBlock = document.createElement('div');
          curBlock.className = 'text-block';
          curInner.appendChild(curBlock);

          usedH = 0;
          paraIndexOnPage = 0;
        }

        const p = document.createElement('p');
        p.innerHTML = html;

        // Drop cap: very first paragraph of each chapter, on its first page
        if (pi === 0 && paraIndexOnPage === 0) p.classList.add('drop-cap');

        curBlock.appendChild(p);
        usedH += pH;
        paraIndexOnPage++;
      });
    });

    ruler.remove();

    // ── Fill TOC entries ──
    const tocList = document.getElementById('toc-list');

    // Introduction entry (no chapter number)
    if (intro && introTitlePage) {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="toc-row toc-row-intro">
          <span class="toc-ch-label toc-intro-label"></span>
          <span class="toc-ch-name toc-intro-name">${x(intro.title)}</span>
          <span class="toc-dots"></span>
          <span class="toc-pg-num">${introStartPage || '—'}</span>
        </div>
      `;
      li.querySelector('.toc-row').addEventListener('click', () => {
        introTitlePage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      tocList.appendChild(li);
    }

    chapters.forEach((ch, ci) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="toc-row" data-ci="${ci}">
          <span class="toc-ch-label">CH ${String(ci+1).padStart(2,'0')}</span>
          <span class="toc-ch-name">${x(ch.title)}</span>
          <span class="toc-dots"></span>
          <span class="toc-pg-num">${chStartPage[ci] || '—'}</span>
        </div>
      `;
      li.querySelector('.toc-row').addEventListener('click', () => {
        titlePages[ci]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      tocList.appendChild(li);
    });
  }

  // ── Page factory ──
  function buildPage(isTitlePage) {
    const page = document.createElement('div');
    page.className = 'page' + (isTitlePage ? ' ch-title-page' : '');

    const inner = document.createElement('div');
    inner.className = 'page-inner';
    page.appendChild(inner);

    const footer = document.createElement('div');
    footer.className = 'page-footer';
    const ftChapter = document.createElement('span');
    ftChapter.className = 'ft-chapter';
    const ftNum = document.createElement('span');
    ftNum.className = 'ft-num';
    footer.appendChild(ftChapter);
    footer.appendChild(ftNum);
    page.appendChild(footer);

    return { page, inner, ftChapter, ftNum };
  }

  // HTML escape
  function x(s) {
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

})();

/* ============================================================
   PDF EXPORT ENGINE
   Uses html2canvas to screenshot each page, then jsPDF to
   assemble them into a downloadable PDF.
   ============================================================ */
async function downloadPDF() {
  const { jsPDF } = window.jspdf;

  const pages     = document.querySelectorAll('.page');
  const tocEl     = document.getElementById('toc');
  const btn       = document.getElementById('pdf-btn');
  const label     = document.getElementById('pdf-btn-label');
  const overlay   = document.getElementById('pdf-overlay');
  const msg       = document.getElementById('pdf-overlay-msg');
  const fill      = document.getElementById('pdf-progress-fill');
  const bookTitle = document.querySelector('book')?.getAttribute('title') || 'book';

  if (!pages.length) { alert('No pages found. Refresh and try again.'); return; }

  btn.disabled = true;
  label.textContent = 'Generating…';
  overlay.classList.add('show');

  // Collect elements: TOC first, then all pages
  const elements = [tocEl, ...pages];
  const total    = elements.length;

  // A4 in mm
  const PDF_W = 210;
  const PDF_H = 297;

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let isFirst = true;

  for (let i = 0; i < total; i++) {
    const el = elements[i];
    const pct = Math.round(((i) / total) * 100);
    fill.style.width = pct + '%';
    msg.textContent  = `Rendering page ${i + 1} of ${total}…`;

    // Temporarily hide shadows & pseudo-elements for cleaner capture
    el.style.boxShadow = 'none';

    const canvas = await html2canvas(el, {
      scale       : 2,          // retina quality
      useCORS     : true,
      backgroundColor: '#faf7f2',
      logging     : false,
      removeContainer: true,
    });

    el.style.boxShadow = '';    // restore

    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    // Fit image to A4 keeping aspect ratio
    const imgW   = canvas.width;
    const imgH   = canvas.height;
    const ratio  = Math.min(PDF_W / imgW, PDF_H / imgH);
    const drawW  = imgW * ratio;
    const drawH  = imgH * ratio;
    const offX   = (PDF_W - drawW) / 2;
    const offY   = (PDF_H - drawH) / 2;

    if (!isFirst) pdf.addPage();
    isFirst = false;

    pdf.setFillColor(250, 247, 242);
    pdf.rect(0, 0, PDF_W, PDF_H, 'F');
    pdf.addImage(imgData, 'JPEG', offX, offY, drawW, drawH);

    // Small yield so browser doesn't freeze
    await new Promise(r => setTimeout(r, 10));
  }

  fill.style.width = '100%';
  msg.textContent  = 'Saving…';
  await new Promise(r => setTimeout(r, 200));

  const filename = bookTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.pdf';
  pdf.save(filename);

  overlay.classList.remove('show');
  btn.disabled     = false;
  label.textContent = 'Download PDF';
  fill.style.width  = '0%';
}