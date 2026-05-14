/* ═══════════════════════════════════════════════════
   SAATHI AI v2 — Complete Frontend Application
   ═══════════════════════════════════════════════════ */
'use strict';

const API = '/api';
const TK   = 'saathi_token';
const UK   = 'saathi_user';

/* ── State ──────────────────────────────────────── */
const S = {
  docs:         [],
  activeDocId:  null,
  selectedIds:  new Set(),
  multiMode:    false,
  tab:          'chat',
  theme:        localStorage.getItem('saathi-theme') || 'light',
  flashcards:   [],
  fcCount:      10,
  fcDone:       0,
  examQs:       [],
  examCount:    5,
  examCorrect:  0,
  examAnswered: 0,
  podSegs:      [],
  podScript:    '',
  podPlaying:   false,
  podIdx:       0,
  podRate:      1,
  summaryType:  'short',
};

/* ── DOM helpers ────────────────────────────────── */
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

/* ══════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', boot);

async function boot() {
  // Auth guard
  const token = localStorage.getItem(TK);
  if (!token) { location.replace('login.html'); return; }

  // Verify token
  try {
    const r = await fetch(`${API}/auth/me`, { headers: authHdr() });
    if (!r.ok) { signOut(); return; }
    const d = await r.json();
    localStorage.setItem(UK, JSON.stringify(d.user));
  } catch {
    showBanner();
  }

  applyTheme(S.theme);
  renderUserBadge();
  bindEvents();
  await loadDocs();
  showUI();
}

/* ── Theme ──────────────────────────────────────── */
function applyTheme(t) {
  S.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('saathi-theme', t);
  $('theme-btn').textContent = t === 'dark' ? '☀️' : '🌙';
}

/* ── Auth helpers ───────────────────────────────── */
function getToken()  { return localStorage.getItem(TK); }
function authHdr(extra={}) {
  const h = { 'Content-Type':'application/json', ...extra };
  const t = getToken();
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
}
function signOut() {
  const t = getToken();
  if (t) fetch(`${API}/auth/logout`,{method:'POST',headers:authHdr()}).catch(()=>{});
  localStorage.removeItem(TK); localStorage.removeItem(UK);
  location.replace('login.html');
}

/* ── API calls ──────────────────────────────────── */
async function GET(ep) {
  const r = await fetch(API+ep, { headers: authHdr() });
  if (r.status===401) { signOut(); throw new Error('Session expired'); }
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e.error||r.statusText); }
  return r.json();
}
async function POST(ep, body) {
  const r = await fetch(API+ep, { method:'POST', headers: authHdr(), body: JSON.stringify(body) });
  if (r.status===401) { signOut(); throw new Error('Session expired'); }
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e.error||r.statusText); }
  return r.json();
}
async function DEL(ep) {
  const r = await fetch(API+ep, { method:'DELETE', headers: authHdr() });
  if (r.status===401) { signOut(); throw new Error('Session expired'); }
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e.error||r.statusText); }
  return r.json();
}

/* ── Server down banner ─────────────────────────── */
function showBanner() {
  if ($('srv-banner')) return;
  const b = document.createElement('div');
  b.id = 'srv-banner';
  b.className = 'server-banner';
  b.innerHTML = '⚠️ Cannot reach backend on port 3001. Run <code>npm run dev</code> in <code>saathi/backend</code> <button onclick="location.reload()">Retry</button>';
  document.body.prepend(b);
}

/* ══════════════════════════════════════════════════
   EVENTS
   ══════════════════════════════════════════════════ */
function bindEvents() {
  // Theme
  $('theme-btn').onclick = () => applyTheme(S.theme==='dark'?'light':'dark');

  // Upload
  $('browse-btn').onclick = () => $('file-input').click();
  $('start-btn').onclick  = () => $('file-input').click();
  $('file-input').onchange = e => handleUpload(e.target.files);

  // Drag & drop
  const da = $('drop-area');
  da.addEventListener('dragover',  e => { e.preventDefault(); da.classList.add('drag-over'); });
  da.addEventListener('dragleave', () => da.classList.remove('drag-over'));
  da.addEventListener('drop', e => {
    e.preventDefault(); da.classList.remove('drag-over');
    handleUpload(e.dataTransfer.files);
  });

  // Tabs
  $$('.tab').forEach(btn => btn.onclick = () => switchTab(btn.dataset.tab));

  // Chat
  $('send-btn').onclick = sendMsg;
  $('chat-input').addEventListener('keydown', e => {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });
  $('chat-input').addEventListener('input', () => autoResize($('chat-input')));

  // Suggestion chips (delegated)
  $('suggestions').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (c) { $('chat-input').value = c.textContent.replace(/^[^\s]+\s/,''); sendMsg(); }
  });

  // Summary — clicking type button auto-generates
  $('gen-summary-btn').onclick = genSummary;
  $$('.type-btn').forEach(b => b.onclick = () => {
    $$('.type-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    S.summaryType = b.dataset.type;
    // Auto-generate when switching type if doc is open
    if (S.activeDocId) genSummary();
  });
  $('compare-btn2').onclick = compareDoc;

  // Flashcards
  $('gen-fc-btn').onclick  = genFlashcards;
  $('fc-minus').onclick    = () => { S.fcCount = Math.max(5,S.fcCount-5); $('fc-count').textContent=S.fcCount; };
  $('fc-plus').onclick     = () => { S.fcCount = Math.min(20,S.fcCount+5); $('fc-count').textContent=S.fcCount; };
  $('shuffle-btn').onclick = shuffleFC;
  $('dl-fc-btn').onclick   = dlFlashcards;
  $('diff-filter').addEventListener('click', e => {
    const b = e.target.closest('.diff-btn');
    if (!b) return;
    $$('.diff-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    filterFC(b.dataset.diff);
  });

  // Podcast
  $('gen-pod-btn').onclick  = genPodcast;
  $('play-btn').onclick     = togglePlay;
  $('stop-btn').onclick     = stopPod;
  $('restart-btn').onclick  = () => { stopPod(); setTimeout(startPlay,100); };
  $('dl-script-btn').onclick = () => dlText(S.podScript,'podcast-script.txt');
  $$('.sp-btn').forEach(b => b.onclick = () => {
    $$('.sp-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    S.podRate = parseFloat(b.dataset.speed);
  });

  // Exam
  $('gen-exam-btn').onclick = genExam;
  $('ex-minus').onclick = () => { S.examCount = Math.max(3,S.examCount-1); $('ex-count').textContent=S.examCount; };
  $('ex-plus').onclick  = () => { S.examCount = Math.min(10,S.examCount+1); $('ex-count').textContent=S.examCount; };

  // Clear & download
  $('clear-btn').onclick = clearHistory;
  $('dl-btn').onclick    = dlCurrent;

  // Multi-doc
  $('multi-btn').onclick    = startMulti;
  $('compare-btn').onclick  = () => { switchTab('summary'); compareDoc(); };
}

/* ══════════════════════════════════════════════════
   DOCS
   ══════════════════════════════════════════════════ */
async function loadDocs() {
  try {
    const d = await GET('/documents');
    S.docs = d.documents || [];
    renderDocs();
  } catch {}
}

function renderDocs() {
  $('doc-count').textContent = S.docs.length;
  const list = $('doc-list');
  list.innerHTML = '';

  if (!S.docs.length) {
    list.innerHTML = '<div class="doc-empty" id="doc-empty"><div style="font-size:32px;margin-bottom:8px">📂</div><p>No documents yet</p><p style="font-size:11px;margin-top:4px;color:var(--text-muted)">Upload files to get started</p></div>';
    return;
  }

  S.docs.forEach(doc => {
    const el = document.createElement('div');
    el.className = 'doc-item' + (doc.id===S.activeDocId?' active':'') + (S.selectedIds.has(doc.id)?' checked':'');
    el.dataset.id = doc.id;
    const ext = (doc.originalName||'').split('.').pop().toUpperCase();
    const icon = ext==='PDF' ? '📕' : '📄';
    el.innerHTML = `
      <div class="doc-check"></div>
      <span class="doc-icon">${icon}</span>
      <div class="doc-info">
        <div class="doc-name" title="${esc(doc.originalName)}">${esc(doc.originalName)}</div>
        <div class="doc-meta">${doc.pageCount||'?'}p · ${doc.chunkCount||'?'} chunks · ${fmtBytes(doc.size)}</div>
      </div>
      <span class="doc-status ${doc.status||'ready'}">${doc.status||'ready'}</span>
      <button class="doc-del" title="Delete">×</button>`;

    el.addEventListener('click', e => {
      if (e.target.closest('.doc-del')) { delDoc(doc.id, doc.originalName); return; }
      if (e.target.closest('.doc-check')||e.ctrlKey||e.metaKey||e.shiftKey) { toggleSel(doc.id,el); return; }
      openDoc(doc.id);
    });

    list.appendChild(el);
  });

  updateMultiUI();
}

function toggleSel(id, el) {
  if (S.selectedIds.has(id)) { S.selectedIds.delete(id); el.classList.remove('checked'); }
  else { S.selectedIds.add(id); el.classList.add('checked'); }
  updateMultiUI();
}

function updateMultiUI() {
  const n = S.selectedIds.size;
  $('multi-bar').style.display   = n>0 ? 'flex' : 'none';
  $('compare-btn').style.display = n>=2 ? 'block' : 'none';
  $('sel-count').textContent     = `${n} selected`;
  const cmp = $('compare-section');
  if (cmp) cmp.style.display = n>=2 ? 'block' : 'none';
}

function openDoc(id) {
  S.activeDocId = id; S.multiMode = false;
  $$('.doc-item').forEach(el => el.classList.toggle('active', el.dataset.id===id));
  const doc = S.docs.find(d=>d.id===id);
  $('ws-name').textContent = doc?.originalName || 'Document';
  $('ws-meta').textContent = `${doc?.pageCount||'?'} pages · ${doc?.chunkCount||'?'} chunks`;
  $('active-indicator').textContent = `📄 ${doc?.originalName||''}`;
  const cw = $('cw-text');
  if (cw) cw.textContent = `Ask me anything about "${doc?.originalName||'your document'}"`;
  showWorkspace();
  resetPanels();
  loadHistory(id);
  switchTab('chat');
}

function startMulti() {
  if (S.selectedIds.size<2) return;
  S.multiMode=true;
  const ids = [...S.selectedIds];
  S.activeDocId = ids[0];
  const names = ids.map(id=>S.docs.find(d=>d.id===id)?.originalName||id);
  $('ws-name').textContent = `${ids.length} Documents`;
  $('ws-meta').textContent = names.join(', ').slice(0,60)+'...';
  $('active-indicator').textContent = `⚡ ${ids.length} docs`;
  showWorkspace();
  resetPanels();
  clearChatUI();
  const cw = $('chat-welcome');
  if(cw) { cw.innerHTML=`<div class="cw-icon">⚡</div><p>Multi-doc chat active — <strong>${ids.length} documents</strong> selected</p>`; }
  switchTab('chat');
}

async function delDoc(id, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  try {
    await DEL(`/documents/${id}`);
    S.docs = S.docs.filter(d=>d.id!==id);
    S.selectedIds.delete(id);
    if (S.activeDocId===id) { S.activeDocId=null; showWelcome(); }
    renderDocs();
    toast(`🗑️ Deleted "${name}"`, 'info');
  } catch(e) { toast('Delete failed: '+e.message,'error'); }
}

/* ══════════════════════════════════════════════════
   UPLOAD
   ══════════════════════════════════════════════════ */
async function handleUpload(files) {
  if (!files?.length) return;
  const token = getToken();
  if (!token) { toast('Please sign in first','error'); return; }

  const fd = new FormData();
  Array.from(files).forEach(f => fd.append('files',f));

  showOverlay(files.length);
  try {
    const r = await fetch(`${API}/upload`, {
      method: 'POST',
      headers: { 'Authorization':'Bearer '+token },
      body: fd
    });
    if (r.status===401) { signOut(); return; }
    if (!r.ok) {
      const e = await r.json().catch(()=>({}));
      toast('Upload failed: '+(e.error||r.statusText),'error');
      hideOverlay(); return;
    }
    const d = await r.json();
    hideOverlay();
    $('file-input').value='';
    if (d.errors?.length) d.errors.forEach(e=>toast(`❌ ${e.file}: ${e.error}`,'error'));
    if (d.uploaded?.length) {
      toast(`✅ ${d.uploaded.length} file(s) ready!`,'success');
      await loadDocs();
      if (d.uploaded[0]) openDoc(d.uploaded[0].id);
    }
  } catch(e) {
    hideOverlay();
    toast('Cannot reach server — is backend running?','error');
  }
}

/* ══════════════════════════════════════════════════
   CHAT
   ══════════════════════════════════════════════════ */
async function sendMsg() {
  const q = $('chat-input').value.trim();
  if (!q) return;
  const ids = S.multiMode ? [...S.selectedIds] : S.activeDocId ? [S.activeDocId] : [];
  if (!ids.length) { toast('Select a document first','warning'); return; }

  $('chat-input').value='';
  autoResize($('chat-input'));
  $('send-btn').disabled=true;

  // Remove welcome screen
  const cw = $('chat-welcome');
  if (cw) cw.remove();

  appendUserMsg(q);
  const tid = showTyping();

  try {
    const d = await POST('/chat', { query:q, docIds:ids });
    removeTyping(tid);
    appendAIMsg(d.answer||d.raw, d.sources||[]);
  } catch(e) {
    removeTyping(tid);
    appendAIMsg('❌ '+e.message, []);
  } finally {
    $('send-btn').disabled=false;
    $('chat-input').focus();
  }
}

function appendUserMsg(text) {
  const d = document.createElement('div');
  d.className='msg user';
  d.innerHTML=`<div class="msg-avatar">U</div><div class="msg-body"><div class="msg-bubble">${esc(text)}</div><div class="msg-time">${fmtTime()}</div></div>`;
  $('chat-msgs').appendChild(d);
  scrollBottom();
}

function appendAIMsg(text, sources=[]) {
  const d = document.createElement('div');
  d.className='msg assistant';
  const srcHtml = sources.length ? buildSources(sources) : '';
  d.innerHTML=`
    <div class="msg-avatar">🤖</div>
    <div class="msg-body">
      <div class="msg-bubble fmt">${renderMd(text)}</div>
      ${srcHtml}
      <div class="msg-time">${fmtTime()}</div>
    </div>`;
  // Wire sources toggle
  const hdr = d.querySelector('.sources-hdr');
  if (hdr) hdr.onclick=()=>{
    const list=d.querySelector('.sources-list');
    const tog=d.querySelector('.src-toggle');
    if(list){list.style.display=list.style.display==='none'?'':'none'; tog.textContent=list.style.display==='none'?'▼':'▲';}
  };
  $('chat-msgs').appendChild(d);
  scrollBottom();
}

function buildSources(srcs) {
  const items = srcs.map(s=>`
    <div class="source-item">
      ${s.page?`<span class="src-page">Page ${s.page}</span>`:''}
      <div class="src-quote">"${esc((s.quote||'').slice(0,200))}"</div>
    </div>`).join('');
  return `<div class="sources">
    <div class="sources-hdr"><span>📎 Sources (${srcs.length})</span><span class="src-toggle">▲</span></div>
    <div class="sources-list">${items}</div>
  </div>`;
}

function showTyping() {
  const id='typing-'+Date.now();
  const d=document.createElement('div');
  d.id=id; d.className='typing';
  d.innerHTML=`<div class="msg-avatar" style="background:var(--bg-elevated);border:1px solid var(--border)">🤖</div><div class="typing-dots"><span></span><span></span><span></span></div>`;
  $('chat-msgs').appendChild(d);
  scrollBottom();
  return id;
}
function removeTyping(id) { const e=$(id); if(e) e.remove(); }
function scrollBottom() { const m=$('chat-msgs'); m.scrollTop=m.scrollHeight; }

async function loadHistory(docId) {
  clearChatUI();
  try {
    const d = await GET(`/documents/${docId}/history`);
    const h = d.history||[];
    if (!h.length) { renderChatWelcome(); return; }
    h.forEach(m => {
      if(m.role==='user') appendUserMsg(m.content);
      else appendAIMsg(m.content, m.sources||[]);
    });
    scrollBottom();
  } catch { renderChatWelcome(); }
}

function clearChatUI() {
  $('chat-msgs').innerHTML='';
}

function renderChatWelcome() {
  const doc = S.docs.find(d=>d.id===S.activeDocId);
  const nm = doc?.originalName||'your document';
  $('chat-msgs').innerHTML=`
    <div class="chat-welcome" id="chat-welcome">
      <div class="cw-icon">🤖</div>
      <p id="cw-text">Ask me anything about <strong>${esc(nm)}</strong></p>
      <div class="suggestions" id="suggestions">
        <button class="chip">📋 What is this document about?</button>
        <button class="chip">🔑 List the key points</button>
        <button class="chip">💡 What are the main conclusions?</button>
        <button class="chip">❓ Explain the most important concept</button>
      </div>
    </div>`;
  // Re-bind suggestions
  $('suggestions')?.addEventListener('click', e => {
    const c=e.target.closest('.chip');
    if(c){$('chat-input').value=c.textContent.replace(/^[^\s]+\s/,'');sendMsg();}
  });
}

async function clearHistory() {
  if (!S.activeDocId) return;
  try {
    await DEL(`/documents/${S.activeDocId}/history`);
    clearChatUI(); renderChatWelcome();
    toast('🗑️ Chat cleared','info');
  } catch(e){ toast(e.message,'error'); }
}

/* ══════════════════════════════════════════════════
   SUMMARY
   ══════════════════════════════════════════════════ */
async function genSummary() {
  const id = S.activeDocId; if(!id) return toast('Open a document first','warning');
  const btn=$('gen-summary-btn');
  btn.disabled=true; btn.textContent='Generating...';
  $('summary-out').innerHTML='<div class="loading-row"><div class="mini-spin"></div>Generating summary...</div>';
  try {
    const d = await POST('/summary',{docId:id,type:S.summaryType});
    $('summary-out').innerHTML=`<div class="fmt">${renderMd(d.summary)}</div>`;
    toast('✅ Summary ready!','success');
  } catch(e){ $('summary-out').innerHTML=`<div class="placeholder">❌<br/>${esc(e.message)}</div>`; toast(e.message,'error'); }
  finally { btn.disabled=false; btn.textContent='✨ Generate Summary'; }
}

async function compareDoc() {
  const ids=[...S.selectedIds]; if(ids.length<2) return toast('Select 2+ documents','warning');
  const btn=$('compare-btn2');
  btn.disabled=true; btn.textContent='Comparing...';
  $('compare-out').innerHTML='<div class="loading-row"><div class="mini-spin"></div>Comparing documents...</div>';
  try {
    const d = await POST('/summary/compare',{docIds:ids});
    $('compare-out').innerHTML=`<div class="fmt">${renderMd(d.comparison)}</div>`;
    toast('📊 Comparison ready!','success');
  } catch(e){ $('compare-out').innerHTML=`<p style="color:var(--danger)">${esc(e.message)}</p>`; }
  finally { btn.disabled=false; btn.textContent='📊 Compare Selected Documents'; }
}

/* ══════════════════════════════════════════════════
   FLASHCARDS
   ══════════════════════════════════════════════════ */
async function genFlashcards() {
  const id=S.activeDocId; if(!id) return toast('Open a document first','warning');
  const btn=$('gen-fc-btn');
  btn.disabled=true; btn.textContent='Generating...';
  $('fc-area').innerHTML='<div class="loading-row"><div class="mini-spin"></div>Generating flashcards...</div>';
  try {
    const d = await POST('/flashcards',{docId:id,count:S.fcCount});
    S.flashcards = d.flashcards||[];
    renderFC(S.flashcards);
    toast(`🃏 ${S.flashcards.length} flashcards ready!`,'success');
  } catch(e){ $('fc-area').innerHTML=`<div class="placeholder">❌<br/>${esc(e.message)}</div>`; toast(e.message,'error'); }
  finally { btn.disabled=false; btn.textContent='🃏 Generate Flashcards'; }
}

function renderFC(cards) {
  if(!cards.length){ $('fc-area').innerHTML='<div class="placeholder">No cards generated</div>'; return; }
  $('fc-stats').style.display='flex';
  $('diff-filter').style.display='flex';
  $('fc-total').textContent=`${cards.length} cards`;
  S.fcDone=0; $('fc-done').textContent='0 reviewed';

  $('fc-area').innerHTML='';
  cards.forEach((c,i)=>{
    const el=document.createElement('div');
    const dCls=c.difficulty||'medium';
    el.className='flashcard';
    el.dataset.diff=dCls;
    el.dataset.i=i;

    const dIcon={easy:'🟢',medium:'🟡',hard:'🔴'}[dCls]||'🟡';
    const dLabel={easy:'Easy',medium:'Medium',hard:'Hard'}[dCls]||'Medium';
    const topicLabel=c.topic||'General';

    el.innerHTML=`
      <div class="fc-front">
        <div class="fc-top-row">
          <span class="fc-num">${String(i+1).padStart(2,'0')}</span>
          <span class="fc-diff ${dCls}">${dIcon} ${dLabel}</span>
        </div>
        <div class="fc-q">${esc(c.q)}</div>
        <div class="fc-hint">
          <span class="fc-hint-icon">👆</span>
          <span>Click to reveal answer</span>
        </div>
      </div>
      <div class="fc-back">
        <div class="fc-back-label">✅ Answer</div>
        <div class="fc-topic">${esc(topicLabel)}</div>
        <div>${esc(c.a)}</div>
      </div>`;

    el.onclick=()=>{
      const wasOpen=el.classList.contains('open');
      el.classList.toggle('open');
      // Update hint text
      const hint=el.querySelector('.fc-hint span:last-child');
      if(hint) hint.textContent=el.classList.contains('open')?'Click to hide answer':'Click to reveal answer';
      if(!wasOpen){S.fcDone++;$('fc-done').textContent=`${S.fcDone} reviewed`;}
    };
    $('fc-area').appendChild(el);
  });
}

function shuffleFC() {
  S.flashcards=[...S.flashcards].sort(()=>Math.random()-.5);
  renderFC(S.flashcards);
}

function filterFC(diff) {
  $$('#fc-area .flashcard').forEach(el=>{
    el.style.display=(diff==='all'||el.dataset.diff===diff)?'':'none';
  });
}

function dlFlashcards() {
  if(!S.flashcards.length) return;
  const txt=S.flashcards.map((c,i)=>`Q${i+1} [${c.difficulty}]: ${c.q}\nA: ${c.a}\n`).join('\n');
  dlText(txt,'saathi-flashcards.txt');
}

/* ══════════════════════════════════════════════════
   PODCAST
   ══════════════════════════════════════════════════ */
async function genPodcast() {
  const id=S.activeDocId; if(!id) return toast('Open a document first','warning');
  const btn=$('gen-pod-btn');
  btn.disabled=true; btn.textContent='Generating script...';
  try {
    const d = await POST('/podcast',{docId:id});
    S.podSegs=d.segments||[]; S.podScript=d.script||'';
    const doc=S.docs.find(x=>x.id===id);
    $('player-title').textContent=doc?.originalName||'Podcast';
    $('player-dur').textContent=`~${d.estimatedDuration||5} min`;
    $('t-tot').textContent=fmtDur(S.podSegs.reduce((s,sg)=>s+Math.ceil(sg.text.split(' ').length/2.3),0));
    $('player').style.display='flex';
    renderTranscript(d.script);
    $('transcript').style.display='block';
    toast('🎙️ Script ready — hit play!','success');
  } catch(e){ toast(e.message,'error'); }
  finally { btn.disabled=false; btn.textContent='🎙️ Generate Podcast Script'; }
}

function renderTranscript(script) {
  const body=$('transcript-body'); body.innerHTML='';
  script.split('\n').filter(l=>l.trim()).forEach(line=>{
    const m=line.match(/^(Alex|Sam|Host|Guest):\s*(.+)/i);
    if(!m) return;
    const el=document.createElement('div');
    el.className='tr-line';
    const spkDisplay = m[1].toLowerCase()==='sam' ? 'Maya' : m[1];
    el.innerHTML=`<span class="tr-spk ${m[1].toLowerCase()==='sam'?'sam':''}">${esc(spkDisplay)}:</span><span>${esc(m[2])}</span>`;
    body.appendChild(el);
  });
}

function togglePlay(){ S.podPlaying ? pausePod() : startPlay(); }

function startPlay() {
  if(!S.podSegs.length) return;
  if(!('speechSynthesis' in window)){ toast('Browser TTS not supported','warning'); return; }
  S.podPlaying=true;
  $('play-btn').textContent='⏸️';
  $('disc').classList.add('spin');
  $('waves').classList.add('active');
  playSeg(S.podIdx);
}

function playSeg(idx) {
  if(idx>=S.podSegs.length){ stopPod(); return; }
  S.podIdx=idx;
  const seg=S.podSegs[idx];

  // Rename Sam → Maya in the UI
  const displayName = seg.speaker==='Sam' ? 'Maya' : seg.speaker;
  $('sp-avatar').textContent=seg.speaker==='Sam'?'M':'A';
  $('sp-avatar').className='sp-avatar'+(seg.speaker==='Sam'?' sam':'');
  $('sp-name').textContent=displayName;
  $('sp-line').textContent=seg.text.slice(0,80)+(seg.text.length>80?'...':'');
  $('prog-fill').style.width=(idx/S.podSegs.length*100)+'%';
  const elapsed=S.podSegs.slice(0,idx).reduce((s,sg)=>s+Math.ceil(sg.text.split(' ').length/2.3),0);
  $('t-cur').textContent=fmtDur(elapsed);

  speechSynthesis.cancel();
  const utt=new SpeechSynthesisUtterance(seg.text);

  // Natural rate and pitch
  utt.rate   = S.podRate * 0.95;
  utt.pitch  = seg.voice==='female' ? 1.05 : 0.92;
  utt.volume = 1;

  const voices = speechSynthesis.getVoices();

  if(seg.voice==='female'){
    // Maya — Google UK English Female is the most natural
    const v = voices.find(v=>v.name==='Google UK English Female')
           || voices.find(v=>v.name==='Microsoft Heera - English (India)')
           || voices.find(v=>v.name==='Microsoft Zira - English (United States)')
           || voices.find(v=>v.name.includes('Female'));
    if(v) utt.voice=v;
  } else {
    // Alex — Google US English is clear and natural
    const v = voices.find(v=>v.name==='Google US English')
           || voices.find(v=>v.name==='Microsoft Mark - English (United States)')
           || voices.find(v=>v.name==='Microsoft David - English (United States)')
           || voices.find(v=>v.lang==='en-US');
    if(v) utt.voice=v;
  }

  utt.onend=()=>{ if(S.podPlaying) playSeg(idx+1); };
  speechSynthesis.speak(utt);
}

function pausePod() {
  S.podPlaying=false; speechSynthesis.pause();
  $('play-btn').textContent='▶️'; $('disc').classList.remove('spin'); $('waves').classList.remove('active');
}

function stopPod() {
  S.podPlaying=false; S.podIdx=0; speechSynthesis.cancel();
  $('play-btn').textContent='▶️'; $('disc').classList.remove('spin'); $('waves').classList.remove('active');
  $('prog-fill').style.width='0%'; $('t-cur').textContent='0:00'; $('sp-line').textContent='';
}

/* ══════════════════════════════════════════════════
   EXAM
   ══════════════════════════════════════════════════ */
async function genExam() {
  const id=S.activeDocId; if(!id) return toast('Open a document first','warning');
  const btn=$('gen-exam-btn');
  btn.disabled=true; btn.textContent='Generating...';
  $('exam-area').innerHTML='<div class="loading-row"><div class="mini-spin"></div>Generating exam...</div>';
  S.examCorrect=0; S.examAnswered=0; updateScore();
  try {
    const d=await POST('/flashcards/exam',{docId:id,count:S.examCount});
    S.examQs=d.questions||[];
    renderExam(S.examQs);
    $('score-bar').style.display='flex';
    toast(`🎓 ${S.examQs.length} questions ready!`,'success');
  } catch(e){ $('exam-area').innerHTML=`<div class="placeholder">❌<br/>${esc(e.message)}</div>`; toast(e.message,'error'); }
  finally { btn.disabled=false; btn.textContent='🎓 Start Exam'; }
}

function renderExam(qs) {
  $('exam-area').innerHTML='';
  qs.forEach((q,i)=>{
    const el=document.createElement('div');
    el.className='exam-q'; el.dataset.answered='false';
    const typeLabel=q.type==='mcq'?'Multiple Choice':'Short Answer';
    const typeCls=q.type==='mcq'?'mcq':'short';
    let inputHtml='';
    if(q.type==='mcq'&&q.options){
      inputHtml=`<div class="eq-opts">${(q.options||[]).map((o,j)=>`<div class="eq-opt" data-key="${o[0]}" data-idx="${j}"><span class="eq-key">${o[0]}</span><span>${esc(o.slice(3))}</span></div>`).join('')}</div>`;
    } else {
      inputHtml=`<div class="eq-sa"><textarea placeholder="Type your answer here..."></textarea><button class="eq-submit">Submit Answer</button></div>`;
    }
    el.innerHTML=`
      <div class="eq-header">
        <span class="eq-num">Q${i+1}</span>
        <span class="eq-type ${typeCls}">${typeLabel}</span>
      </div>
      <div class="eq-text">${esc(q.question)}</div>
      ${inputHtml}
      <div class="eq-feedback"></div>`;

    // MCQ handler
    if(q.type==='mcq'){
      el.querySelectorAll('.eq-opt').forEach(opt=>opt.onclick=()=>{
        if(el.dataset.answered==='true') return;
        el.dataset.answered='true';
        const sel=opt.dataset.key, cor=q.correct;
        el.querySelectorAll('.eq-opt').forEach(o=>{
          if(o.dataset.key===cor) o.classList.add('correct');
          else if(o===opt&&sel!==cor) o.classList.add('wrong');
        });
        const fb=el.querySelector('.eq-feedback');
        const ok=sel===cor;
        if(ok) S.examCorrect++;
        fb.className='eq-feedback '+(ok?'correct':'wrong');
        fb.style.display='block';
        fb.innerHTML=(ok?'✅ Correct! ':'❌ Incorrect. Correct: '+cor+'. ')+(q.explanation||'');
        S.examAnswered++; updateScore();
      });
    }

    // Short answer handler
    if(q.type!=='mcq'){
      const sb=el.querySelector('.eq-submit');
      if(sb) sb.onclick=async()=>{
        if(el.dataset.answered==='true') return;
        const ans=el.querySelector('textarea').value.trim();
        if(!ans){toast('Please write an answer','warning');return;}
        el.dataset.answered='true'; sb.disabled=true; sb.textContent='Evaluating...';
        try{
          const r=await POST('/flashcards/evaluate',{question:q.question,userAnswer:ans,modelAnswer:q.model_answer||''});
          const ok=r.score>=60; if(ok) S.examCorrect++;
          const fb=el.querySelector('.eq-feedback');
          fb.className='eq-feedback '+(ok?'correct':'wrong');
          fb.style.display='block';
          fb.innerHTML=`<strong>Score: ${r.score}/100</strong><br/>${esc(r.feedback||'')}`;
          S.examAnswered++; updateScore();
        }catch(e){sb.disabled=false;sb.textContent='Submit Answer';}
      };
    }

    $('exam-area').appendChild(el);
  });
}

function updateScore() {
  const tot=S.examQs.length;
  $('sc-correct').textContent=S.examCorrect;
  $('sc-total').textContent=tot;
  $('sc-pct').textContent=S.examAnswered>0?Math.round(S.examCorrect/S.examAnswered*100)+'%':'—';
}

/* ══════════════════════════════════════════════════
   UI HELPERS
   ══════════════════════════════════════════════════ */
function showWelcome()   { $('welcome').style.display='flex'; $('workspace').style.display='none'; }
function showWorkspace() { $('welcome').style.display='none'; $('workspace').style.display='flex'; }
function showUI()        { if(!S.activeDocId) showWelcome(); }

function switchTab(name) {
  S.tab=name;
  $$('.tab').forEach(b=>{ b.classList.toggle('active',b.dataset.tab===name); b.setAttribute('aria-selected',b.dataset.tab===name); });
  $$('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+name));
  if(name==='summary') { const cs=$('compare-section'); if(cs) cs.style.display=S.selectedIds.size>=2?'block':'none'; }
}

function resetPanels() {
  $('summary-out').innerHTML='<div class="placeholder">📝<br/>Click Generate to create a summary</div>';
  $('fc-area').innerHTML='<div class="placeholder">🃏<br/>Generate flashcards to start studying</div>';
  $('exam-area').innerHTML='<div class="placeholder">🎓<br/>Start an exam to test your knowledge</div>';
  $('fc-stats').style.display='none';
  $('diff-filter').style.display='none';
  $('score-bar').style.display='none';
  $('player').style.display='none';
  $('transcript').style.display='none';
  S.flashcards=[]; S.examQs=[];
  stopPod();
}

function renderUserBadge() {
  let user; try { user=JSON.parse(localStorage.getItem(UK)); } catch{}
  if(!user) return;
  const initials=((user.firstName?.[0]||'')+(user.lastName?.[0]||'')).toUpperCase()||user.email?.[0]?.toUpperCase()||'U';
  $('user-badge').innerHTML=`
    <div class="ub-avatar">${initials}</div>
    <div class="ub-info">
      <div class="ub-name">${esc((user.firstName+' '+(user.lastName||'')).trim())}</div>
      <div class="ub-email">${esc(user.email||'')}</div>
    </div>
    <button class="ub-logout" onclick="signOut()" title="Sign out">⏻</button>`;
}

function showOverlay(n) {
  $('ov-title').textContent=`Processing ${n} file${n>1?'s':''}...`;
  $('ov-msg').textContent='Extracting text and building knowledge index';
  $('overlay').style.display='flex';
}
function hideOverlay() { $('overlay').style.display='none'; }

function dlCurrent() {
  if(S.tab==='summary') { const t=$('summary-out').innerText; if(t&&!t.includes('Click Generate')) dlText(t,'summary.txt'); }
  else if(S.tab==='flashcards') dlFlashcards();
  else if(S.tab==='podcast') dlText(S.podScript,'podcast-script.txt');
  else if(S.tab==='chat') dlText($('chat-msgs').innerText,'chat-history.txt');
}

/* ══════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════ */
function toast(msg, type='info') {
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<span>${icons[type]||'ℹ️'}</span><span style="flex:1">${esc(msg)}</span><span class="toast-close">×</span>`;
  const close=()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),300); };
  el.querySelector('.toast-close').onclick=close;
  $('toasts').appendChild(el);
  setTimeout(close,4000);
}

/* ══════════════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════════════ */
function esc(s) {
  if(!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderMd(text) {
  if(!text) return '';
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>')
    .replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/^[•\-\*] (.+)$/gm,'<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm,'<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g,'<ul>$&</ul>')
    .replace(/\n\n/g,'</p><p>')
    .replace(/\n/g,'<br/>');
}

function fmtBytes(b) {
  if(!b) return '0B';
  if(b<1024) return b+'B';
  if(b<1048576) return (b/1024).toFixed(1)+'KB';
  return (b/1048576).toFixed(1)+'MB';
}
function fmtTime() { return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }
function fmtDur(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,120)+'px'; }
function dlText(text,name) {
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));
  a.download=name; a.click();
}