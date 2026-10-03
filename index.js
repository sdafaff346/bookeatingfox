// 책 먹는 여우 (Book-Eating Fox) — bookmarks, Ridi-style reading notes, chapters, search,
// stats, quote cards and export for SillyTavern chats. Vanilla JS, no dependencies.
// Storage keys keep the old 'st_bookshelf' name so data from v1 carries over.

const MODULE = 'st_bookshelf';
const META_KEY = 'st_bookshelf';

const DEFAULTS = Object.freeze({
    enabled: true,
    colors: ['#ffe066', '#8ce99a', '#74c0fc', '#f7a8c8'],
    showHighlights: true,
    showMemoUnderline: true,
    showChapters: true,
    showRibbon: true,
    theme: 'auto',
    charsPerPage: 600,
    cardTheme: 'fox',
    cardFox: true,
    cardTransFirst: false,
    searchHidden: 'all',      // search: 'all' (hidden + shown) | 'shown' | 'hidden'
    panel: null,
    sheetH: 0.62,
});

// Original fox mascot (inline SVG, no external assets)
// Mascot: 책을 문 여우 (original art)
const FOX_SVG = `<svg class="stbs-fox" viewBox="0 0 64 64" aria-hidden="true"><path d="M9.8 7.2 Q10 3.8 13.2 5.3 L28.2 18.5 L11.4 28.2 Z" fill="#ec8a52"/><path d="M54.2 7.2 Q54 3.8 50.8 5.3 L35.8 18.5 L52.6 28.2 Z" fill="#ec8a52"/><path d="M13.1 11.6 Q13.2 9.4 15.1 10.4 L23.2 18.6 L14.5 23.7 Z" fill="#fbd9c6"/><path d="M50.9 11.6 Q50.8 9.4 48.9 10.4 L40.8 18.6 L49.5 23.7 Z" fill="#fbd9c6"/><path d="M6.8 29.5 C8.4 13.2 55.6 13.2 57.2 29.5 C58 38.5 49.5 45.8 35 52.4 Q32 54 29 52.4 C14.5 45.8 6 38.5 6.8 29.5 Z" fill="#ec8a52"/><path d="M8 32.2 C15.2 36.5 24.6 37.3 32 49 C39.4 37.3 48.8 36.5 56 32.2 C54.4 41.4 46.2 47.8 35 52.4 Q32 54 29 52.4 C17.8 47.8 9.6 41.4 8 32.2 Z" fill="#fff7ee"/><path d="M20 32.9 Q23.3 29 26.6 32.9" stroke="#3a2a22" stroke-width="2.45" fill="none" stroke-linecap="round"/><path d="M37.400000000000006 32.9 Q40.7 29 44 32.9" stroke="#3a2a22" stroke-width="2.45" fill="none" stroke-linecap="round"/><path d="M29.8 43.6 Q32 42.300000000000004 34.2 43.6 Q33.5 45.800000000000004 32 46.2 Q30.5 45.800000000000004 29.8 43.6 Z" fill="#3a2a22"/><g transform="translate(32 55.4) scale(0.94) translate(-32 -55) rotate(-6 32 55)"><path d="M19 50.5 Q25.5 48.5 32 51 Q38.5 48.5 45 50.5 L45 60 Q38.5 58 32 60.5 Q25.5 58 19 60 Z" fill="#8fb3a6"/><path d="M20.8 51.6 Q26 50.2 31.2 52.2 L31.2 58.6 Q26 57 20.8 58.3 Z" fill="#fffdf8"/><path d="M43.2 51.6 Q38 50.2 32.8 52.2 L32.8 58.6 Q38 57 43.2 58.3 Z" fill="#fffdf8"/></g></svg>`;

const APP_NAME = '책 먹는 여우';
const PANEL_THEMES = { auto: '자동 (SillyTavern 밝기에 맞춤)', night: '밤의 서재 (어둡게)', day: '아침 서재 (밝게)', st: 'SillyTavern 테마 색 그대로' };

/** 'auto' → pick day/night from SillyTavern's body text brightness. */
function resolvedTheme() {
    const t = settings().theme || 'auto';
    if (t !== 'auto') return t;
    const m = getComputedStyle(document.body).color.match(/\d+(\.\d+)?/g);
    if (!m) return 'night';
    const [r, g, b] = m.map(Number);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum < 0.5 ? 'day' : 'night';
}

function emptyState(title, sub = '', fox = true) {
    return `<div class="stbs-empty">${fox ? `<div class="stbs-empty-fox">${FOX_SVG}</div>` : ''}<p class="stbs-empty-title">${title}</p>${sub ? `<p class="stbs-empty-sub">${sub}</p>` : ''}</div>`;
}

const COLOR_NAMES = ['노랑', '초록', '파랑', '분홍'];
const COLOR_EMOJI = ['🟨', '🟩', '🟦', '🟪'];

const CARD_THEMES = {
    fox: { name: '여우', bg: ['#f7a261', '#d9622b'], fg: '#3b1f0e', sub: '#6e3a1a', accent: '#fff5e8' },
    forest: { name: '밤숲', bg: ['#33402f', '#1a2419'], fg: '#f3ead9', sub: '#b6c2a4', accent: '#f08a3c' },
    paper: { name: '종이', bg: ['#f7f1e3', '#efe6d2'], fg: '#3b3226', sub: '#8a7a62', accent: '#c9a96e' },
    night: { name: '밤하늘', bg: ['#1d2340', '#0e1226'], fg: '#eef0ff', sub: '#9aa3d4', accent: '#f5d67b' },
    rose: { name: '장미', bg: ['#fde2e4', '#f9c5cf'], fg: '#5a2a35', sub: '#a0616f', accent: '#d9667f' },
    mint: { name: '민트', bg: ['#e3f6ef', '#c7ecdf'], fg: '#1f4b3f', sub: '#5f8f80', accent: '#3aa585' },
    ink: { name: '먹', bg: ['#2b2b2b', '#161616'], fg: '#f3f3f3', sub: '#a8a8a8', accent: '#e85d4a' },
    // community-post look: the quote as a hot post, with upvotes and reaction comments
    commu: {
        name: '커뮤 반응', commu: true, bg: ['#eef0f3', '#ffffff'], fg: '#1f2329', sub: '#7b828c', accent: '#ff6b3d',
        card: '#ffffff', line: '#e4e7eb', box: '#f5f6f8', best: '#fff0e8', up: '#ff6b3d', soft: '#ffe3d6',
    },
    commuDark: {
        name: '커뮤 다크', commu: true, bg: ['#15171b', '#2a2e35'], fg: '#eceef1', sub: '#8d949e', accent: '#ff8a5c',
        card: '#1f2228', line: '#30343c', box: '#272b32', best: '#3a2a23', up: '#ff8a5c', soft: '#4a3128',
    },
};

// Reaction pools for the community card (picked with a seed, so a card looks the same each time)
const COMMU_TITLES = ['이 대사 뭐냐 진짜', '오늘자 명대사 박제함', '와 이 장면 미쳤다', '이거 보고 잠 다 깸', '나만 이 대사에 치였냐',
    '이 대사 몇 번째 보는지 모름', '하 이 장면 진짜…', '명대사 공유함 다들 봐줘', '방금 읽은 거 실화냐', '이 대사 때문에 못 잠'];
const COMMU_COMMENTS = ['ㅁㅊ 이거 실화냐', '아 이 대사 때문에 밤새 정주행함', '소름 돋았어 진짜…', '저장 완료 ㅠㅠ', '{who} 진짜 미쳤다',
    '이 장면 몇 번을 돌려보는 건지', '여기서 울었음 아무도 안 물어봤지만', '캡처해서 배경화면 함', '와 문장 맛집이네', '나만 심장 떨어졌냐',
    '이건 박제해야 됨', '읽다가 소리 지름', 'ㄹㅇ 인생 대사', '이 대사 하나로 3일 버팀', '{who} 이러는 거 반칙 아니냐', '숨 참고 읽음',
    '와 이건 못 참지', '여기서부터 미쳐 돌아감', '이 맛에 롤플 함', '책으로 내주세요 제발'];
const COMMU_NICKS = ['익명의 여우', '책먹는여우', '새벽감성', '정주행러', '명대사수집가', '문장덕후', '롤플중독', '눈물버튼', '야행성 독자', '오늘도과몰입'];

function seeded(seed) {
    let a = (Number(seed) >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function commuDefaults(seed, who) {
    const r = seeded(seed);
    const pick = (arr, used) => { let k; do k = Math.floor(r() * arr.length); while (used.has(k) && used.size < arr.length); used.add(k); return arr[k]; };
    const used = new Set();
    const name = who || '얘';
    const comments = [0, 1, 2].map(() => pick(COMMU_COMMENTS, used).replace('{who}', name));
    return { title: COMMU_TITLES[Math.floor(r() * COMMU_TITLES.length)], comments };
}

const STOPWORDS = new Set(('그리고 그런데 하지만 그래서 그러나 그러면 그렇게 이렇게 저렇게 그냥 정말 너무 조금 아주 다시 지금 이제 여기 거기 저기 ' +
    '그는 그녀 그녀는 그녀의 그의 그가 그녀가 나는 내가 너는 네가 우리 우리는 당신 당신은 당신의 자신 자신의 ' +
    '있는 있다 있었다 없는 없다 했다 하는 하고 하며 했고 했던 되는 된다 것이 것을 것은 것도 그것 이것 저것 ' +
    '수 있 것 등 더 좀 잘 왜 뭐 어떻게 무슨 모든 같은 같이 한번 순간 듯 듯이 채 때 때문에 위해 ' +
    'the and a an to of in on at for is are was were be been it its this that with as by from or but not you your he she his her they them i me my we our').split(/\s+/));

// ---------------------------------------------------------------- helpers

const ctx = () => SillyTavern.getContext();
const $id = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + str.length.toString(36);
}

/** Raw message markdown -> plain text for snippets/search/stats. */
function plain(mes) {
    return String(mes ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/^[ \t]*(#{1,6}|>+)[ \t]+/gm, '')
        .replace(/[*_~`]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function clip(s, n) {
    s = String(s ?? '');
    return s.length > n ? s.slice(0, n) + '…' : s;
}

function fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return '';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function download(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function safeFileName(s) {
    return String(s || 'chat').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
}

// ---------------------------------------------------------------- settings

function settings() {
    const { extensionSettings } = ctx();
    if (!extensionSettings[MODULE]) extensionSettings[MODULE] = structuredClone(DEFAULTS);
    const s = extensionSettings[MODULE];
    for (const k of Object.keys(DEFAULTS)) {
        if (!Object.hasOwn(s, k)) s[k] = structuredClone(DEFAULTS[k]);
    }
    return s;
}

function saveSettings() {
    ctx().saveSettingsDebounced();
}

function applyColorVars() {
    const s = settings();
    const root = document.documentElement;
    s.colors.forEach((c, i) => root.style.setProperty(`--stbs-c${i}`, c));
}

// ---------------------------------------------------------------- chat data

function hasChat() {
    const c = ctx();
    return !!c.getCurrentChatId?.() && Array.isArray(c.chat);
}

/** Per-chat storage (chatMetadata). Never cache the returned object across chats. */
function data() {
    const meta = ctx().chatMetadata;
    if (!meta) return { bookmarks: [], notes: [], chapters: [], scrapbooks: [], trash: [], review: { rating: 0, text: '' } };
    if (!meta[META_KEY] || typeof meta[META_KEY] !== 'object') {
        meta[META_KEY] = { v: 1, bookmarks: [], notes: [], chapters: [] };
    }
    const d = meta[META_KEY];
    for (const k of ['bookmarks', 'notes', 'chapters', 'scrapbooks', 'trash']) if (!Array.isArray(d[k])) d[k] = [];
    if (!d.review || typeof d.review !== 'object') d.review = { rating: 0, text: '' };
    return d;
}

function persist() {
    const c = ctx();
    if (!hasChat()) return;
    (c.saveMetadata || c.saveMetadataDebounced)?.call(c);
}

const msg = (i) => ctx().chat?.[i];
/** Message the user hid (👁 hide / /hide): is_system without being one of SillyTavern's own notices. */
const isHiddenMes = (m) => !!m?.is_system && !m.extra?.type && !Array.isArray(m.extra?.tool_invocations);
/** SillyTavern's own system notices (help, welcome, tool calls…) — never searched. */
const isRealSystem = (m) => !!m?.is_system && !isHiddenMes(m);
const sigAt = (i) => hash(String(msg(i)?.mes ?? ''));
const speaker = (i) => {
    const m = msg(i);
    if (!m) return '';
    return m.name || (m.is_user ? ctx().name1 : ctx().name2) || '';
};

/** Re-anchor items whose message moved (e.g. after a deletion). */
function reconcile() {
    if (!hasChat()) return false;
    const d = data();
    const chat = ctx().chat;
    let changed = false;
    const sigCache = new Map();
    const sig = (i) => {
        if (!sigCache.has(i)) sigCache.set(i, sigAt(i));
        return sigCache.get(i);
    };
    for (const item of [...d.bookmarks, ...d.notes, ...d.chapters]) {
        if (!item.sig) { item.sig = sig(item.mesId); changed = true; continue; }
        if (item.mesId < chat.length && sig(item.mesId) === item.sig) continue;
        for (let dist = 1; dist <= 80; dist++) {
            const cand = [item.mesId - dist, item.mesId + dist].find(j => j >= 0 && j < chat.length && sig(j) === item.sig);
            if (cand !== undefined) { item.mesId = cand; changed = true; break; }
        }
        if (item.mesId >= chat.length) { item.mesId = Math.max(0, chat.length - 1); changed = true; }
    }
    if (changed) persist();
    return changed;
}

function sortedChapters() {
    return [...data().chapters].sort((a, b) => a.mesId - b.mesId);
}

/** Chapter info for a message index: {num, title, mesId} or prologue. */
function chapterOf(i, chapters = sortedChapters()) {
    let found = null;
    let num = 0;
    chapters.forEach((c, k) => { if (c.mesId <= i) { found = c; num = k + 1; } });
    if (!found) return { num: 0, title: '프롤로그', id: '__prologue', mesId: 0 };
    return { num, title: found.title, id: found.id, mesId: found.mesId };
}

function chapterLabel(ch) {
    return ch.num ? `${ch.num}장. ${ch.title}` : ch.title;
}

function bookmarkAt(i) {
    return data().bookmarks.find(b => b.mesId === i);
}

// ---------------------------------------------------------------- DOM text ranges

function mesTextEl(i) {
    return document.querySelector(`#chat .mes[mesid="${i}"] .mes_text`);
}

function offsetIn(root, node, offset) {
    const r = document.createRange();
    r.setStart(root, 0);
    r.setEnd(node, offset);
    return r.toString().length;
}

const BLOCK_TAGS = /^(P|DIV|LI|UL|OL|DL|DT|DD|BLOCKQUOTE|H[1-6]|PRE|TABLE|TR|DETAILS|SUMMARY|SECTION|ARTICLE|HEADER|FOOTER|FIGURE|FIGCAPTION|HR)$/;
const SKIP_TAGS = /^(STYLE|SCRIPT|TEMPLATE|NOSCRIPT)$/;

/**
 * The text between [start,end) (textContent coordinates) as it *looks* in the chat:
 * <br> becomes a line break, paragraphs/blocks become a blank line, source-code whitespace is collapsed.
 */
function formattedRange(root, start, end) {
    let pos = 0, out = '';
    const inRange = () => pos > start && pos < end;
    const brk = (s) => { if (inRange()) out += s; };
    const walk = (node) => {
        for (let c = node.firstChild; c; c = c.nextSibling) {
            if (c.nodeType === 3) {
                const t = c.data, a = Math.max(start, pos), b = Math.min(end, pos + t.length);
                if (b > a) out += t.slice(a - pos, b - pos).replace(/[\t\r\n\f ]+/g, ' ');
                pos += t.length;
            } else if (c.nodeType === 1) {
                if (SKIP_TAGS.test(c.nodeName)) { pos += c.textContent.length; continue; }
                if (c.nodeName === 'BR') { brk('\n'); continue; }
                const block = BLOCK_TAGS.test(c.nodeName);
                if (block) brk('\n\n');
                walk(c);
                if (block) brk('\n\n');
            }
        }
    };
    walk(root);
    return out
        .replace(/[ \u00a0]*\n[ \u00a0]*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/ {2,}/g, ' ')
        .trim();
}

/** Message source → readable text that keeps line breaks and paragraphs. */
function plainKeep(mes) {
    return String(mes ?? '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .replace(/^[ \t]*(#{1,6}|>+)[ \t]+/gm, '')
        .replace(/[*_~`]+/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** What a note shows: the formatted text (keeps the chat's paragraphs) or the raw quote for old notes. */
function noteText(n) {
    if (!n) return '';
    if (n.start == null) return plainKeep(msg(n.mesId)?.mes);
    return n.text || n.quote;
}

function unwrapMarks(root) {
    const marks = root.querySelectorAll('mark.stbs-hl');
    if (!marks.length) return;
    marks.forEach(m => m.replaceWith(...m.childNodes));
    root.normalize();
}

/** Wrap text between [start,end) (textContent coordinates) in <mark> elements. */
function wrapRange(root, start, end, make) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets = [];
    let pos = 0;
    let node;
    while ((node = walker.nextNode())) {
        const len = node.data.length;
        const s = Math.max(start, pos);
        const e = Math.min(end, pos + len);
        if (s < e) targets.push([node, s - pos, e - pos]);
        pos += len;
        if (pos >= end) break;
    }
    for (const [n, s, e] of targets) {
        if (!n.data.slice(s, e).trim()) continue;
        let mid = n;
        if (s > 0) mid = n.splitText(s);
        if (e - s < mid.data.length) mid.splitText(e - s);
        const mark = make();
        mid.parentNode.insertBefore(mark, mid);
        mark.appendChild(mid);
    }
}

function findNearest(text, quote, around) {
    if (!quote) return -1;
    let best = -1;
    let bestDist = Infinity;
    let idx = text.indexOf(quote);
    while (idx !== -1) {
        const dist = Math.abs(idx - around);
        if (dist < bestDist) { best = idx; bestDist = dist; }
        idx = text.indexOf(quote, idx + 1);
    }
    return best;
}

const staleNotes = new Set();

// ---------------------------------------------------------------- chat decoration

function decorateMessage(i) {
    const s = settings();
    const mesEl = document.querySelector(`#chat .mes[mesid="${i}"]`);
    if (!mesEl) return;
    ensureMesButtons(mesEl);
    const on = s.enabled && hasChat();
    mesEl.classList.toggle('stbs-bm', on && s.showRibbon && !!bookmarkAt(i));

    const textEl = mesEl.querySelector('.mes_text');
    if (!textEl || mesEl.querySelector('.edit_textarea')) return;
    unwrapMarks(textEl);
    if (!on) return;

    const notes = data().notes.filter(n => n.mesId === i && n.start != null);
    if (!notes.length) return;
    const text = textEl.textContent;
    let dirty = false;
    for (const n of notes) {
        let start = n.start;
        if (text.slice(n.start, n.end) !== n.quote) {
            start = findNearest(text, n.quote, n.start);
            if (start === -1) { staleNotes.add(n.id); continue; }
            n.start = start;
            n.end = start + n.quote.length;
            dirty = true;
        }
        staleNotes.delete(n.id);
        const fmt = formattedRange(textEl, n.start, n.end);
        if (fmt && fmt !== (n.text || n.quote)) { if (fmt === n.quote) delete n.text; else n.text = fmt; dirty = true; }
        const colored = n.color != null;
        if (colored && !s.showHighlights) continue;
        if (!colored && !s.showMemoUnderline) continue;
        wrapRange(textEl, n.start, n.end, () => {
            const m = document.createElement('mark');
            m.className = 'stbs-hl' + (colored ? ` stbs-c${n.color}` : ' stbs-ul') + (n.memo ? ' stbs-has-memo' : '');
            m.dataset.note = n.id;
            if (n.memo) m.title = n.memo;
            return m;
        });
    }
    if (dirty) persist();
}

function decorateChapters() {
    document.querySelectorAll('#chat .stbs-chapter-div').forEach(e => e.remove());
    const s = settings();
    if (!s.enabled || !s.showChapters || !hasChat()) return;
    sortedChapters().forEach((c, k) => {
        const mesEl = document.querySelector(`#chat .mes[mesid="${c.mesId}"]`);
        if (!mesEl) return;
        const div = document.createElement('div');
        div.className = 'stbs-chapter-div';
        div.dataset.chapter = c.id;
        div.innerHTML = `<span class="stbs-chapter-line"></span><span class="stbs-chapter-title"><span class="stbs-ch-num">${k + 1}장</span>${esc(c.title)}</span><span class="stbs-chapter-line"></span>`;
        mesEl.parentNode.insertBefore(div, mesEl);
    });
}

function decorateAll() {
    decorateChapters();
    document.querySelectorAll('#chat .mes[mesid]').forEach(el => decorateMessage(Number(el.getAttribute('mesid'))));
}

const MES_BUTTONS = `
<div class="mes_button stbs-mes-btn fa-solid fa-book-bookmark" data-stbs="bookmark" title="책갈피"></div>
<div class="mes_button stbs-mes-btn fa-solid fa-book-open" data-stbs="chapter" title="여기서 새 챕터"></div>
<div class="mes_button stbs-mes-btn fa-solid fa-note-sticky" data-stbs="memo" title="메시지에 메모"></div>
<div class="mes_button stbs-mes-btn fa-solid fa-quote-left" data-stbs="card" title="명대사 카드"></div>`;

function ensureMesButtons(root) {
    const holder = root.querySelector('.extraMesButtons');
    if (holder && !holder.querySelector('.stbs-mes-btn')) holder.insertAdjacentHTML('afterbegin', MES_BUTTONS);
}

// ---------------------------------------------------------------- navigation

let showMoreFn = null;
import('../../../../script.js').then(m => { showMoreFn = m.showMoreMessages ?? null; }).catch(() => { });

async function ensureRendered(i) {
    for (let n = 0; n < 500; n++) {
        const el = document.querySelector(`#chat .mes[mesid="${i}"]`);
        if (el) return el;
        const btn = document.getElementById('show_more_messages');
        if (!btn) return null;
        if (showMoreFn) await showMoreFn();
        else { btn.click(); await sleep(60); }
    }
    return null;
}

async function jumpTo(i, noteId = null) {
    const el = await ensureRendered(i);
    if (!el) { toastr.warning('메시지를 찾을 수 없어요.'); return; }
    decorateMessage(i);
    decorateChapters();
    const target = (noteId && el.querySelector(`mark[data-note="${noteId}"]`)) || el;
    if (isMobile() && panelOpen()) closePanel();
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const flashEl = target === el ? el : target;
    flashEl.classList.remove('stbs-flash');
    void flashEl.offsetWidth;
    flashEl.classList.add('stbs-flash');
    setTimeout(() => flashEl.classList.remove('stbs-flash'), 1800);
}

// ---------------------------------------------------------------- actions

async function toggleBookmark(i, askLabel = true) {
    if (!hasChat() || !msg(i)) return;
    const d = data();
    const existing = bookmarkAt(i);
    if (existing) {
        d.bookmarks = d.bookmarks.filter(b => b !== existing);
        toTrash('bookmark', existing);
    } else {
        let label = '';
        if (askLabel) {
            const res = await ctx().Popup.show.input('🦊 책갈피', '이름을 붙일 수 있어요. (비워두면 첫 줄이 이름이 돼요)', '');
            if (res === null || res === false || res === undefined) return;
            label = String(res).trim();
        }
        d.bookmarks.push({ id: uid(), mesId: i, label, created: Date.now(), sig: sigAt(i) });
        toastr.success('🦊 책갈피를 꽂았어요.');
    }
    persist();
    decorateMessage(i);
    refreshPanel();
}

async function addChapter(i) {
    if (!hasChat() || !msg(i)) return;
    const d = data();
    const existing = d.chapters.find(c => c.mesId === i);
    const num = sortedChapters().filter(c => c.mesId < i).length + 1;
    const res = await ctx().Popup.show.input(existing ? '챕터 이름 바꾸기' : `${num}장 시작`, '이 메시지부터 새 챕터가 시작돼요. 제목을 입력하세요.', existing?.title ?? '');
    if (res === null || res === false || res === undefined) return;
    const title = String(res).trim() || `${num}장`;
    if (existing) existing.title = title;
    else d.chapters.push({ id: uid(), mesId: i, title, created: Date.now(), sig: sigAt(i) });
    persist();
    decorateChapters();
    refreshPanel();
}

async function renameChapter(id) {
    const c = data().chapters.find(x => x.id === id);
    if (c) await addChapter(c.mesId);
}

async function deleteChapter(id) {
    const d = data();
    const c = d.chapters.find(x => x.id === id);
    if (!c) return;
    d.chapters = d.chapters.filter(x => x !== c);
    toTrash('chapter', c);
    persist();
    decorateChapters();
    refreshPanel();
}

function createNote({ mesId, start = null, end = null, quote = '', text = '', color = null, memo = '' }) {
    const n = { id: uid(), mesId, start, end, quote, color, memo, created: Date.now(), updated: Date.now(), sig: sigAt(mesId) };
    if (start != null && text && text !== quote) n.text = text;
    data().notes.push(n);
    persist();
    decorateMessage(mesId);
    refreshPanel();
    return n;
}

function getNote(id) {
    return data().notes.find(n => n.id === id);
}

function updateNote(id, patch) {
    const n = getNote(id);
    if (!n) return;
    Object.assign(n, patch, { updated: Date.now() });
    persist();
    decorateMessage(n.mesId);
    refreshPanel();
}

async function deleteNote(id) {
    const n = getNote(id);
    if (!n) return;
    const d = data();
    d.notes = d.notes.filter(x => x !== n);
    const inScraps = d.scrapbooks.filter(sb => sb.noteIds.includes(id)).map(sb => sb.id);
    for (const sb of d.scrapbooks) sb.noteIds = sb.noteIds.filter(x => x !== id);
    toTrash('note', n, { scraps: inScraps });
    ui.selected.delete(id);
    staleNotes.delete(id);
    persist();
    decorateMessage(n.mesId);
    refreshPanel();
}


// ---------------------------------------------------------------- 여우의 보관함 (trash)
// Deleted bookmarks / notes / chapters / scrapbooks wait here until they are restored or erased for good.

const TRASH_MAX = 300;
const TRASH_KIND = {
    note: { name: '독서노트', obj: '독서노트를', ic: 'fa-highlighter', list: 'notes' },
    bookmark: { name: '책갈피', obj: '책갈피를', ic: 'fa-bookmark', list: 'bookmarks' },
    chapter: { name: '챕터', obj: '챕터를', ic: 'fa-book-open', list: 'chapters' },
    scrap: { name: '스크랩북', obj: '스크랩북을', ic: 'fa-book-bookmark', list: 'scrapbooks' },
};

function toTrash(kind, item, extra = {}) {
    const d = data();
    const t = { id: uid(), kind, item, deleted: Date.now(), ...extra };
    d.trash.unshift(t);
    if (d.trash.length > TRASH_MAX) d.trash.length = TRASH_MAX;
    persist();
    toastr.info(`🦊 ${TRASH_KIND[kind].obj} 여우의 보관함에 넣었어요. <u>눌러서 되돌리기</u>`, '', {
        escapeHtml: false,
        timeOut: 4500,
        onclick: () => restoreTrash(t.id),
    });
    updateTrashBadge();
    return t;
}

/** Put a trashed item back. Returns false when its place is already taken. */
function restoreTrash(id, quiet = false) {
    const d = data();
    const t = d.trash.find(x => x.id === id);
    if (!t) return false;
    const kind = TRASH_KIND[t.kind];
    const list = d[kind.list];
    const it = t.item;
    if (list.some(x => x.id === it.id)) { d.trash = d.trash.filter(x => x !== t); persist(); refreshPanel(); return true; }
    if (t.kind === 'bookmark' && list.some(x => x.mesId === it.mesId && (!it.sig || x.sig === it.sig))) {
        if (!quiet) toastr.warning('그 메시지엔 이미 책갈피가 꽂혀 있어요.');
        return false;
    }
    if (t.kind === 'chapter' && list.some(x => x.mesId === it.mesId)) {
        if (!quiet) toastr.warning('그 메시지에서 이미 다른 챕터가 시작돼요.');
        return false;
    }
    list.push(it);
    if (t.kind === 'note') {
        for (const sbId of t.scraps || []) {
            // the scrapbook may itself be in the trash — put the note back into that copy too
            const sb = getScrap(sbId) || d.trash.find(x => x.kind === 'scrap' && x.item.id === sbId)?.item;
            if (sb && !(sb.noteIds ||= []).includes(it.id)) sb.noteIds.push(it.id);
        }
    }
    if (t.kind === 'scrap') it.noteIds = (it.noteIds || []).filter(nid => d.notes.some(n => n.id === nid) || d.trash.some(x => x.kind === 'note' && x.item.id === nid));
    d.trash = d.trash.filter(x => x !== t);
    reconcile();
    persist();
    if (t.kind === 'chapter') decorateChapters();
    else if (t.kind !== 'scrap') decorateMessage(it.mesId);
    if (!quiet) toastr.success(`🦊 ${kind.obj} 되돌렸어요.`);
    updateTrashBadge();
    refreshPanel();
    return true;
}

async function eraseTrash(id) {
    const d = data();
    const t = d.trash.find(x => x.id === id);
    if (!t) return;
    const ok = await ctx().Popup.show.confirm('영구 삭제', '여우의 보관함에서도 지울까요? 이건 되돌릴 수 없어요.');
    if (!ok) return;
    d.trash = d.trash.filter(x => x !== t);
    if (t.kind === 'note') for (const x of d.trash) if (x.kind === 'scrap') x.item.noteIds = (x.item.noteIds || []).filter(n => n !== t.item.id);
    persist();
    updateTrashBadge();
    refreshPanel();
}

async function emptyTrash() {
    const d = data();
    if (!d.trash.length) return;
    const ok = await ctx().Popup.show.confirm('보관함 비우기', `보관함의 ${d.trash.length}개를 모두 영구 삭제할까요? 이건 되돌릴 수 없어요.`);
    if (!ok) return;
    d.trash = [];
    persist();
    updateTrashBadge();
    refreshPanel();
}

function restoreAllTrash() {
    const d = data();
    // scrapbooks last, so their notes are back first; oldest first keeps the original order
    const order = [...d.trash].reverse().sort((a, b) => (a.kind === 'scrap') - (b.kind === 'scrap'));
    let ok = 0, fail = 0;
    for (const t of order) { if (restoreTrash(t.id, true)) ok++; else fail++; }
    decorateAll();
    toastr.success(`🦊 ${ok}개를 되돌렸어요.${fail ? ` (${fail}개는 자리가 겹쳐서 남겨 뒀어요)` : ''}`);
    refreshPanel();
}

function updateTrashBadge() {
    const b = $id('stbs-trash-count');
    if (!b) return;
    const n = hasChat() ? data().trash.length : 0;
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = !n;
}

function trashPreview(t) {
    const it = t.item;
    switch (t.kind) {
        case 'note': {
            const q = it.start != null ? (it.text || it.quote) : plain(msg(it.mesId)?.mes);
            return { title: clip(q, 90), sub: it.memo ? `✎ ${clip(it.memo, 60)}` : '', meta: `#${it.mesId}`, color: it.color };
        }
        case 'bookmark': return { title: it.label || clip(plain(msg(it.mesId)?.mes), 50), sub: it.label ? clip(plain(msg(it.mesId)?.mes), 70) : '', meta: `#${it.mesId}` };
        case 'chapter': return { title: it.title, sub: it.review ? `“${clip(it.review, 50)}”` : '', meta: `#${it.mesId}부터` };
        case 'scrap': return { title: `${it.emoji || '📒'} ${it.name}`, sub: '', meta: `노트 ${(it.noteIds || []).length}개` };
    }
    return { title: '', sub: '', meta: '' };
}

function renderTrash() {
    const d = data();
    const s = settings();
    let html = `
        <div class="stbs-trash-head">
            <div class="stbs-icon-btn fa-solid fa-chevron-left" data-act="trash-back" title="돌아가기"></div>
            <span class="stbs-avatar">${FOX_SVG}</span>
            <div class="stbs-grow"><div class="stbs-scrap-title">여우의 보관함</div><div class="stbs-meta">지운 것들은 영구 삭제 전까지 여기 있어요</div></div>
        </div>`;
    if (!d.trash.length) return html + emptyState('보관함이 텅 비었어요', '책갈피·노트·챕터·스크랩북을 지우면<br>여우가 여기에 고이 넣어 둬요.');
    const f = ui.trashFilter;
    const counts = {};
    for (const t of d.trash) counts[t.kind] = (counts[t.kind] || 0) + 1;
    const chip = (key, label) => `<div class="stbs-chip ${f === key ? 'active' : ''}" data-act="trash-filter" data-f="${key}">${label}</div>`;
    html += `<div class="stbs-row stbs-wrap">${chip('all', `전체 ${d.trash.length}`)}${Object.entries(TRASH_KIND).map(([k, v]) => counts[k] ? chip(k, `${v.name} ${counts[k]}`) : '').join('')}</div>
        <div class="stbs-row stbs-trash-tools">
            <div class="stbs-btn" data-act="trash-restore-all"><i class="fa-solid fa-rotate-left"></i> 모두 되돌리기</div>
            <div class="stbs-btn stbs-danger" data-act="trash-empty"><i class="fa-solid fa-fire"></i> 보관함 비우기</div>
        </div>`;
    const list = d.trash.filter(t => f === 'all' || t.kind === f);
    if (!list.length) return html + emptyState('이 종류는 비어 있어요', '', false);
    html += list.map(t => {
        const k = TRASH_KIND[t.kind];
        const p = trashPreview(t);
        const bar = p.color != null ? `style="--bar:${esc(s.colors[p.color])}"` : '';
        return `
        <div class="stbs-trash-item ${p.color != null ? 'colored' : ''}" ${bar}>
            <span class="stbs-trash-kind"><i class="fa-solid ${k.ic}"></i>${k.name}</span>
            <div class="stbs-trash-title">${esc(p.title)}</div>
            ${p.sub ? `<div class="stbs-snippet">${esc(p.sub)}</div>` : ''}
            <div class="stbs-note-foot">
                <div class="stbs-meta">${esc(p.meta)} · ${fmtDate(t.deleted)} 지움</div>
                <div class="stbs-actions">
                    <div class="stbs-btn stbs-mini-btn" data-act="trash-restore" data-id="${t.id}"><i class="fa-solid fa-rotate-left"></i> 되돌리기</div>
                    <div class="stbs-icon-btn fa-solid fa-trash-can" data-act="trash-erase" data-id="${t.id}" title="영구 삭제"></div>
                </div>
            </div>
        </div>`;
    }).join('');
    return html;
}

// ---------------------------------------------------------------- modal

function openModal(title, bodyHtml, { wide = false } = {}) {
    closeModal();
    const wrap = themed(document.createElement('div'));
    wrap.id = 'stbs-modal';
    wrap.innerHTML = `
        <div class="stbs-modal-box ${wide ? 'wide' : ''}" role="dialog">
            <div class="stbs-modal-head"><b>${title}</b><div class="stbs-icon-btn fa-solid fa-xmark" data-act="modal-close" title="닫기"></div></div>
            <div class="stbs-modal-body">${bodyHtml}</div>
        </div>`;
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) closeModal(); });
    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-act="modal-close"]')) closeModal(); });
    // Show inside its own modal <dialog> (browser top layer) so theme popovers — e.g. Blue Lemonade's
    // message ⋯ menu, which is itself a top-layer popover — can never cover it.
    const host = document.createElement('dialog');
    host.id = 'stbs-modal-host';
    themed(host);
    host.appendChild(wrap);
    host.addEventListener('cancel', (e) => { e.preventDefault(); closeModal(); });
    document.body.appendChild(host);
    try { host.showModal(); } catch { host.setAttribute('open', ''); }
    const tc = $id('toast-container');
    if (tc) host.appendChild(tc);
    return wrap.querySelector('.stbs-modal-body');
}

function closeModal() {
    const host = $id('stbs-modal-host');
    const tc = $id('toast-container');
    if (tc && host?.contains(tc)) (($id('stbs-dialog')?.open && $id('stbs-dialog')) || document.body).appendChild(tc);
    if (host) { try { host.close(); } catch { /* not open */ } host.remove(); }
    $id('stbs-modal')?.remove();
}

/** Close the message ⋯ menu our button lives in (SillyTavern keeps it open; some themes turn it into a top-layer popover). */
function closeMesMenu(btn) {
    const menu = btn.closest('.extraMesButtons');
    if (!menu || document.body.classList.contains('expandMessageActions')) return;
    try { if (menu.matches(':popover-open')) menu.hidePopover(); } catch { /* no popover API */ }
    menu.classList.remove('visible');
    menu.style.display = 'none';
    menu.style.opacity = '';
    const hint = menu.parentElement?.querySelector(':scope > .extraMesButtonsHint');
    if (hint) { hint.style.display = ''; hint.style.opacity = ''; }
}

function openMemoEditor({ note = null, pending = null, mesId = null }) {
    const quote = note ? (note.start != null ? noteText(note) : '') : pending ? (pending.text || pending.quote) : '';
    const i = note ? note.mesId : pending ? pending.mesId : mesId;
    const quoteHtml = quote
        ? `<blockquote class="stbs-quote">${esc(quote)}</blockquote>`
        : `<div class="stbs-muted">메시지 전체 · ${esc(speaker(i))}: ${esc(clip(plain(msg(i)?.mes), 80))}</div>`;
    const body = openModal('독서노트', `
        ${quoteHtml}
        <textarea id="stbs-memo-input" class="text_pole stbs-textarea" rows="6" placeholder="이 문장에 대한 생각을 남겨보세요">${esc(note?.memo ?? '')}</textarea>
        <div class="stbs-row stbs-end">
            <div class="stbs-btn" data-act="modal-close">취소</div>
            <div class="stbs-btn stbs-primary" id="stbs-memo-save">저장</div>
        </div>`);
    const ta = body.querySelector('#stbs-memo-input');
    setTimeout(() => ta.focus(), 30);
    body.querySelector('#stbs-memo-save').addEventListener('click', () => {
        const memo = ta.value.trim();
        if (note) updateNote(note.id, { memo });
        else if (pending) createNote({ ...pending, color: pending.color ?? null, memo });
        else createNote({ mesId: i, memo });
        closeModal();
        window.getSelection()?.removeAllRanges();
        toastr.success('🦊 여우가 노트를 챙겼어요.');
    });
}

// ---------------------------------------------------------------- selection popup (Ridi style)

let pendingSel = null;

function hideSelPopup() {
    $id('stbs-sel-pop')?.remove();
}

function readSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const startNode = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const root = startNode?.closest?.('#chat .mes_text');
    if (!root) return null;
    const mesEl = root.closest('.mes');
    if (!mesEl || mesEl.querySelector('.edit_textarea')) return null;
    const mesId = Number(mesEl.getAttribute('mesid'));
    const full = root.textContent;
    let start = offsetIn(root, range.startContainer, range.startOffset);
    let end = root.contains(range.endContainer) ? offsetIn(root, range.endContainer, range.endOffset) : full.length;
    while (start < end && /\s/.test(full[start])) start++;
    while (end > start && /\s/.test(full[end - 1])) end--;
    if (end - start < 1) return null;
    return { mesId, start, end, quote: full.slice(start, end), text: formattedRange(root, start, end), rect: range.getBoundingClientRect() };
}

const repositionPopup = debounce(() => {
    const pop = $id('stbs-sel-pop');
    if (!pop) return;
    let rect = null;
    if (pop.dataset.kind === 'note') rect = document.querySelector(`#chat mark[data-note="${pop.dataset.note}"]`)?.getBoundingClientRect();
    else rect = readSelection()?.rect;
    if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) { hideSelPopup(); return; }
    placePopup(pop, rect);
}, 60);

function placePopup(pop, rect) {
    if (!pop.isConnected) document.body.appendChild(pop);
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    const mobile = window.matchMedia('(pointer: coarse)').matches;
    let top = mobile ? rect.bottom + 12 : rect.top - ph - 10;
    if (top < 8) top = rect.bottom + 12;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, rect.top - ph - 10);
    let left = rect.left + rect.width / 2 - pw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
    avoidOtherPopups(pop);
    // Other extensions show their own selection chips a moment later — check again.
    clearTimeout(pop._stbsAvoid1); clearTimeout(pop._stbsAvoid2);
    pop._stbsAvoid1 = setTimeout(() => pop.isConnected && avoidOtherPopups(pop), 150);
    pop._stbsAvoid2 = setTimeout(() => pop.isConnected && avoidOtherPopups(pop), 500);
}

// Floating selection tools from other extensions (e.g. Blue Lemonade "다시 쓰기" quick-ban chip,
// LLM translator selection bar). Our toolbar moves out of their way instead of covering them.
const OTHER_SELECTION_TOOLS = ['.bwr_quickban', '#llmt-selection-selection'];

function avoidOtherPopups(pop) {
    const mine = () => pop.getBoundingClientRect();
    const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    for (const sel of OTHER_SELECTION_TOOLS) {
        for (const el of document.querySelectorAll(sel)) {
            if (el.hidden || !el.isConnected) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
            const o = el.getBoundingClientRect();
            if (!o.width || !o.height) continue;
            let r = mine();
            if (!overlaps(r, o)) continue;
            let top = o.bottom + 8;
            if (top + r.height > window.innerHeight - 8) top = o.top - r.height - 8;
            if (top < 8) top = Math.min(window.innerHeight - r.height - 8, o.bottom + 8);
            pop.style.top = `${Math.max(8, top)}px`;
        }
    }
}

function colorDots(active = null, withNone = false) {
    const dots = settings().colors.map((c, k) =>
        `<div class="stbs-dot ${active === k ? 'active' : ''}" data-color="${k}" style="background:${esc(c)}" title="${COLOR_NAMES[k]} 형광펜"></div>`).join('');
    return dots + (withNone ? `<div class="stbs-dot stbs-dot-none ${active == null ? 'active' : ''}" data-color="none" title="형광펜 없이 (메모만)"></div>` : '');
}

function showSelPopup(sel) {
    hideSelPopup();
    pendingSel = sel;
    const pop = themed(document.createElement('div'));
    pop.id = 'stbs-sel-pop';
    pop.dataset.kind = 'sel';
    pop.innerHTML = `
        ${colorDots()}
        <span class="stbs-sep"></span>
        <div class="stbs-pop-btn" data-pop="memo" title="형광펜 없이 메모만"><i class="fa-solid fa-note-sticky"></i><span>메모</span></div>
        <div class="stbs-pop-btn" data-pop="card" title="명대사 카드"><i class="fa-solid fa-quote-left"></i><span>카드</span></div>
        <div class="stbs-pop-btn" data-pop="copy" title="복사"><i class="fa-solid fa-copy"></i><span>복사</span></div>`;
    bindPopup(pop, (act, color) => {
        const p = pendingSel;
        if (!p) return;
        const base = { mesId: p.mesId, start: p.start, end: p.end, quote: p.quote, text: p.text };
        if (act === 'color') {
            const n = createNote({ ...base, color });
            window.getSelection()?.removeAllRanges();
            hideSelPopup();
            const mark = document.querySelector(`mark[data-note="${n.id}"]`);
            if (mark) showNotePopup(n.id, mark.getBoundingClientRect());
        } else if (act === 'memo') {
            hideSelPopup();
            openMemoEditor({ pending: base });
        } else if (act === 'card') {
            hideSelPopup();
            openCard({ text: p.text || p.quote, mesId: p.mesId });
        } else if (act === 'copy') {
            navigator.clipboard?.writeText(p.text || p.quote).then(() => toastr.success('복사했어요.'));
            hideSelPopup();
        }
    });
    placePopup(pop, sel.rect);
}

function showNotePopup(noteId, rect) {
    hideSelPopup();
    const n = getNote(noteId);
    if (!n) return;
    const pop = themed(document.createElement('div'));
    pop.id = 'stbs-sel-pop';
    pop.dataset.kind = 'note';
    pop.dataset.note = n.id;
    pop.innerHTML = `
        ${colorDots(n.color, true)}
        <span class="stbs-sep"></span>
        <div class="stbs-pop-btn" data-pop="memo" title="메모"><i class="fa-solid fa-note-sticky"></i><span>${n.memo ? '메모 수정' : '메모'}</span></div>
        <div class="stbs-pop-btn" data-pop="card" title="명대사 카드"><i class="fa-solid fa-quote-left"></i><span>카드</span></div>
        <div class="stbs-pop-btn" data-pop="delete" title="삭제"><i class="fa-solid fa-trash-can"></i><span>삭제</span></div>
        ${n.memo ? `<div class="stbs-pop-memo">${esc(clip(n.memo, 140))}</div>` : ''}`;
    bindPopup(pop, (act, color) => {
        if (act === 'color') { updateNote(n.id, { color }); hideSelPopup(); }
        else if (act === 'memo') { hideSelPopup(); openMemoEditor({ note: n }); }
        else if (act === 'card') { hideSelPopup(); openCard({ note: n }); }
        else if (act === 'delete') { hideSelPopup(); deleteNote(n.id); }
    });
    placePopup(pop, rect);
}

function bindPopup(pop, handler) {
    // Keep the text selection alive while tapping buttons.
    pop.addEventListener('pointerdown', e => e.preventDefault());
    pop.addEventListener('mousedown', e => e.preventDefault());
    pop.addEventListener('click', (e) => {
        const dot = e.target.closest('[data-color]');
        if (dot) {
            const v = dot.dataset.color;
            handler('color', v === 'none' ? null : Number(v));
            return;
        }
        const b = e.target.closest('[data-pop]');
        if (b) handler(b.dataset.pop);
    });
}

const onSelectionChange = debounce(() => {
    if (!settings().enabled || !hasChat()) return;
    const sel = readSelection();
    if (sel) showSelPopup(sel);
}, 300);

// ---------------------------------------------------------------- quote card (canvas)

function wrapLines(g, text, maxW) {
    const lines = [];
    const paras = String(text).replace(/\n{3,}/g, '\n\n').split('\n');
    for (const para of paras) {
        if (!para.trim()) { if (lines.length && lines[lines.length - 1] !== '') lines.push(''); continue; }
        const words = para.split(/(\s+)/);
        let line = '';
        for (const w of words) {
            const test = line + w;
            if (g.measureText(test).width <= maxW || !line.trim()) {
                if (g.measureText(test).width > maxW) {
                    // very long word: break by characters
                    for (const ch of w) {
                        if (g.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; } else line += ch;
                    }
                } else line = test;
            } else {
                lines.push(line.trimEnd());
                line = w.trimStart();
            }
        }
        if (line.trim()) lines.push(line.trimEnd());
    }
    return lines;
}

/** Split text into one sentence per line (keeps existing paragraph breaks). */
function sentencePerLine(text) {
    return String(text).split(/\n{2,}/).map(par => par
        .replace(/\s*\n\s*/g, ' ')
        .replace(/([.!?。！？…~]+["'”’)\]」』]*)\s+(?=\S)/g, '$1\n')
        .trim()).filter(Boolean).join('\n\n');
}
const oneParagraph = (text) => String(text).replace(/\s*\n+\s*/g, ' ').replace(/ {2,}/g, ' ').trim();

/** Lay out one text block: returns { lines } where '' marks a paragraph gap. */
function layoutBlock(g, text, font, maxW) {
    g.font = font;
    return wrapLines(g, text, maxW);
}

function rrect(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
}

function fitText(g, s, maxW) {
    s = String(s || '');
    if (g.measureText(s).width <= maxW) return s;
    while (s.length && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
}

const kNum = (n) => n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만` : n.toLocaleString();

/** Community theme: the quote as a hot post on an invented board, with upvotes and reactions. */
function drawCommunity(canvas, { text, trans = '', transFirst = false, who, chapter, commu = {} }, t) {
    const W = 1080, H = 1350;
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');
    const read = `${pageFonts().readFont}, sans-serif`;
    const ui = `${pageFonts().uiFont}, sans-serif`;
    const r = seeded(commu.seed || 1);
    const views = 3000 + Math.floor(r() * 42000), ups = 180 + Math.floor(r() * 2400), downs = Math.floor(r() * 9);
    const cmCount = 24 + Math.floor(r() * 180);

    g.fillStyle = t.bg[0];
    g.fillRect(0, 0, W, H);
    const X = 44, Y = 44, CW = W - 88, CH = H - 88, IN = 56;
    g.fillStyle = t.card;
    rrect(g, X, Y, CW, CH, 34); g.fill();
    g.textBaseline = 'middle';

    // board header
    g.fillStyle = t.accent;
    rrect(g, X + IN, Y + 44, 22, 22, 6); g.fill();
    g.fillStyle = t.fg;
    g.font = `bold 30px ${ui}`;
    g.fillText('여우굴 · 명대사 게시판', X + IN + 36, Y + 56);
    g.font = `bold 24px ${ui}`;
    const hot = '실시간 베스트';
    const hw = g.measureText(hot).width + 36;
    g.fillStyle = t.soft;
    rrect(g, X + CW - IN - hw, Y + 34, hw, 44, 22); g.fill();
    g.fillStyle = t.accent;
    g.fillText(hot, X + CW - IN - hw + 18, Y + 57);
    g.fillStyle = t.line;
    g.fillRect(X + IN, Y + 108, CW - IN * 2, 2);

    // title
    g.fillStyle = t.fg;
    g.font = `bold 46px ${ui}`;
    const title = commu.title || '이 대사 뭐냐 진짜';
    g.fillText(fitText(g, `[명대사] ${title}`, CW - IN * 2), X + IN, Y + 172);

    // author row
    const ay = Y + 252, ax = X + IN + 32;
    g.fillStyle = t.soft;
    g.beginPath(); g.arc(ax, ay, 32, 0, Math.PI * 2); g.fill();
    if (settings().cardFox && foxImage?.complete && foxImage.naturalWidth) g.drawImage(foxImage, ax - 27, ay - 26, 54, 54);
    g.fillStyle = t.fg;
    g.font = `bold 28px ${ui}`;
    g.fillText(commu.nick || '익명의 여우', ax + 50, ay - 15);
    g.fillStyle = t.sub;
    g.font = `24px ${ui}`;
    g.fillText(`조회 ${kNum(views)}  ·  추천 ${kNum(ups)}  ·  댓글 ${cmCount}  ·  방금 전`, ax + 50, ay + 19);

    // comments block (measured first, laid out from the bottom)
    const comments = (commu.comments || []).map(c => String(c).trim()).filter(Boolean).slice(0, 4);
    const cmW = CW - IN * 2 - 10;
    g.font = `30px ${ui}`;
    const nickBase = Math.floor(r() * (COMMU_NICKS.length - 1));
    const cms = comments.map((c, k) => {
        const lines = wrapLines(g, c, cmW).filter(l => l !== '').slice(0, 2);
        return { lines, nick: COMMU_NICKS[1 + (nickBase + k) % (COMMU_NICKS.length - 1)], likes: Math.max(3, Math.floor(ups * (0.5 - k * 0.12) * (0.6 + r() * 0.5))) };
    });
    const main = String(text || '').trim(), sub = String(trans || '').trim();
    const blocks = sub ? (transFirst ? [[sub, 1], [main, 0.76]] : [[main, 1], [sub, 0.76]]) : [[main, 1]];
    const DIV = 44, PARA = 0.55;
    const tx = X + IN + 52, maxW = CW - IN * 2 - 96;
    const footH = (who || chapter) ? 64 : 0;
    const measure = (size) => {
        let total = sub ? DIV : 0;
        const laid = blocks.map(([txt, sc]) => {
            const fs = Math.round(size * sc), lh = fs * 1.55;
            const lines = layoutBlock(g, txt, `${sc < 1 ? '' : '600 '}${fs}px ${read}`, maxW);
            const h = lines.reduce((a, l) => a + (l === '' ? lh * PARA : lh), 0);
            total += h;
            return { lines, fs, lh, h, sc };
        });
        return { laid, total };
    };
    // The quote comes first: comments step aside (fewer of them) until it fits at a readable size.
    const geom = (n) => {
        const cmH = cms.slice(0, n).reduce((a, c) => a + 46 + c.lines.length * 42 + 26, 0);
        const listTop = Y + CH - 40 - (n ? 66 + cmH : 0);
        const rowY = listTop - (n ? 70 : 90);
        const boxTop = ay + 62, boxBottom = rowY - 64;
        const areaTop = boxTop + 44;
        return { listTop, rowY, boxTop, boxBottom, areaTop, avail: boxBottom - 40 - footH - areaTop };
    };
    let nCm = cms.length, G = geom(nCm);
    while (nCm > 1 && measure(34).total > G.avail) G = geom(--nCm);
    cms.length = nCm;
    const { listTop, rowY, boxTop, boxBottom, areaTop, avail } = G;

    // quote box
    g.fillStyle = t.box;
    rrect(g, X + IN, boxTop, CW - IN * 2, boxBottom - boxTop, 26); g.fill();
    g.fillStyle = t.accent;
    rrect(g, X + IN, boxTop + 30, 8, boxBottom - boxTop - 60, 4); g.fill();
    let size = 52, m;
    for (; size >= 22; size -= 2) { m = measure(size); if (m.total <= avail) break; }
    if (m.total > avail) {
        const room = avail - (sub ? DIV : 0);
        for (const b of m.laid) {
            const share = room * (b.h / Math.max(1, m.total - (sub ? DIV : 0)));
            let h = 0; const keep = [];
            for (const l of b.lines) { const lh = l === '' ? b.lh * PARA : b.lh; if (h + lh > share && keep.length) break; keep.push(l); h += lh; }
            while (keep.length && keep[keep.length - 1] === '') { keep.pop(); h -= b.lh * PARA; }
            if (keep.length < b.lines.length && keep.length) keep[keep.length - 1] = keep[keep.length - 1].replace(/.?$/, '…');
            b.lines = keep; b.h = h;
        }
        m.total = m.laid.reduce((a, b) => a + b.h, sub ? DIV : 0);
    }
    let y = areaTop + Math.max(0, (avail - m.total) / 2);
    g.textBaseline = 'alphabetic';
    m.laid.forEach((b, k) => {
        g.font = `${b.sc < 1 ? '' : '600 '}${b.fs}px ${read}`;
        g.fillStyle = b.sc < 1 ? t.sub : t.fg;
        for (const l of b.lines) {
            if (l === '') { y += b.lh * PARA; continue; }
            g.fillText(l, tx, y + b.fs);
            y += b.lh;
        }
        if (sub && k === 0) { g.fillStyle = t.line; g.fillRect(tx, y + DIV / 2 - 1, 60, 3); y += DIV; }
    });
    if (footH) {
        g.fillStyle = t.sub;
        g.font = `bold 26px ${ui}`;
        g.fillText(fitText(g, [who && `— ${who}`, chapter].filter(Boolean).join('  ·  '), maxW), tx, boxBottom - 40);
    }

    // up / down
    g.textBaseline = 'middle';
    g.font = `bold 30px ${ui}`;
    const upT = `▲ 추천 ${kNum(ups)}`, dnT = `▼ ${downs}`;
    const uw = g.measureText(upT).width + 64, dw = g.measureText(dnT).width + 56, gap = 18;
    const bx = X + (CW - uw - dw - gap) / 2;
    g.fillStyle = t.up;
    rrect(g, bx, rowY - 38, uw, 76, 38); g.fill();
    g.fillStyle = '#ffffff';
    g.fillText(upT, bx + 32, rowY + 1);
    g.strokeStyle = t.line; g.lineWidth = 3;
    rrect(g, bx + uw + gap, rowY - 36, dw, 72, 36); g.stroke();
    g.fillStyle = t.sub;
    g.fillText(dnT, bx + uw + gap + 28, rowY + 1);

    // comments
    if (cms.length) {
        let cy = listTop;
        g.fillStyle = t.line;
        g.fillRect(X + IN, cy, CW - IN * 2, 2);
        g.fillStyle = t.fg;
        g.font = `bold 28px ${ui}`;
        g.fillText(`댓글 ${cmCount}`, X + IN, cy + 38);
        cy += 66;
        cms.forEach((c, k) => {
            const best = k === 0;
            const h = 46 + c.lines.length * 42 + 10;
            if (best) { g.fillStyle = t.best; rrect(g, X + IN - 16, cy - 6, CW - IN * 2 + 32, h + 6, 18); g.fill(); }
            let nx = X + IN + 4;
            if (best) {
                g.font = `bold 20px ${ui}`;
                const bw = g.measureText('BEST').width + 20;
                g.fillStyle = t.accent;
                rrect(g, nx, cy + 6, bw, 30, 9); g.fill();
                g.fillStyle = '#ffffff';
                g.fillText('BEST', nx + 10, cy + 22);
                nx += bw + 12;
            }
            g.fillStyle = t.sub;
            g.font = `bold 24px ${ui}`;
            g.fillText(c.nick, nx, cy + 22);
            g.font = `24px ${ui}`;
            const lk = `♥ ${kNum(c.likes)}`;
            g.fillStyle = best ? t.accent : t.sub;
            g.fillText(lk, X + CW - IN - g.measureText(lk).width, cy + 22);
            g.fillStyle = t.fg;
            g.font = `30px ${ui}`;
            c.lines.forEach((l, j) => g.fillText(l, X + IN + 4, cy + 46 + 21 + j * 42));
            cy += h + 16;
        });
    }
}

function drawCard(canvas, info, themeKey) {
    const t = CARD_THEMES[themeKey] || CARD_THEMES.paper;
    if (t.commu) return drawCommunity(canvas, info, t);
    const { text, trans = '', transFirst = false, who, chapter, source } = info;
    const W = 1080, H = 1350, PAD = 110;
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, t.bg[0]);
    grad.addColorStop(1, t.bg[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    g.strokeStyle = t.accent;
    g.globalAlpha = 0.5;
    g.lineWidth = 3;
    g.strokeRect(48, 48, W - 96, H - 96);
    g.globalAlpha = 1;

    // Card text uses the chat's own font (theme font), falling back to the system serif.
    const serif = `${pageFonts().readFont}, serif`;
    g.fillStyle = t.accent;
    g.font = `bold 200px ${serif}`;
    g.textBaseline = 'top';
    g.fillText('“', PAD - 20, 90);

    const main = String(text || '').trim(), sub = String(trans || '').trim();
    const blocks = sub ? (transFirst ? [[sub, 1], [main, 0.74]] : [[main, 1], [sub, 0.74]]) : [[main, 1]];
    const maxW = W - PAD * 2;
    const areaTop = 330, areaBottom = H - 300, avail = areaBottom - areaTop;
    const DIVIDE = 64;               // space for the line between original and translation
    const PARA = 0.55;               // blank line = a little more than half a line
    const measure = (size) => {
        let total = sub ? DIVIDE : 0;
        const laid = blocks.map(([txt, scale]) => {
            const fs = Math.round(size * scale), lh = fs * 1.6;
            const lines = layoutBlock(g, txt, `${fs}px ${serif}`, maxW);
            const h = lines.reduce((acc, l) => acc + (l === '' ? lh * PARA : lh), 0);
            total += h;
            return { lines, fs, lh, h, scale };
        });
        return { laid, total };
    };
    let size = 64, m;
    for (; size >= 24; size -= 2) { m = measure(size); if (m.total <= avail) break; }
    // still too long: cut each block to fit its share
    if (m.total > avail) {
        let room = avail - (sub ? DIVIDE : 0);
        for (const b of m.laid) {
            const share = room * (b.h / Math.max(1, m.total - (sub ? DIVIDE : 0)));
            let h = 0, keep = [];
            for (const l of b.lines) { const lh = l === '' ? b.lh * PARA : b.lh; if (h + lh > share) break; keep.push(l); h += lh; }
            if (keep.length < b.lines.length && keep.length) keep[keep.length - 1] = keep[keep.length - 1].replace(/.?$/, '…');
            b.lines = keep; b.h = h;
        }
        m.total = m.laid.reduce((a2, b2) => a2 + b2.h, sub ? DIVIDE : 0);
    }
    let y = areaTop + (avail - m.total) / 2;
    g.textBaseline = 'alphabetic';
    m.laid.forEach((b, k) => {
        g.font = `${b.fs}px ${serif}`;
        g.fillStyle = b.scale < 1 ? t.sub : t.fg;
        for (const l of b.lines) {
            if (l === '') { y += b.lh * PARA; continue; }
            g.fillText(l, PAD, y + b.fs);
            y += b.lh;
        }
        if (sub && k === 0) {
            g.fillStyle = t.accent;
            g.globalAlpha = 0.7;
            g.fillRect(PAD, y + DIVIDE / 2 - 1, 44, 3);
            g.globalAlpha = 1;
            y += DIVIDE;
        }
    });

    g.fillStyle = t.accent;
    g.fillRect(PAD, H - 250, 70, 4);
    g.fillStyle = t.fg;
    g.font = `bold 40px ${serif}`;
    if (who) g.fillText(`— ${who}`, PAD, H - 180);
    g.fillStyle = t.sub;
    g.font = `28px ${serif}`;
    const foot = [chapter, source].filter(Boolean).join('  ·  ');
    if (foot) g.fillText(clip(foot, 40), PAD, H - 128);
    if (settings().cardFox && foxImage?.complete && foxImage.naturalWidth) {
        const cx = W - PAD - 70, cy = H - 170;
        g.fillStyle = '#fff5e8';
        g.beginPath(); g.arc(cx, cy, 82, 0, Math.PI * 2); g.fill();
        g.strokeStyle = t.accent === '#fff5e8' ? '#d9622b' : t.accent;
        g.lineWidth = 5; g.stroke();
        g.globalAlpha = 0.97;
        g.drawImage(foxImage, cx - 64, cy - 60, 128, 128);
        g.globalAlpha = 1;
    }
}

let foxImage = null;
function loadFoxImage() {
    if (foxImage) return Promise.resolve(foxImage);
    return new Promise((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(img);
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(FOX_SVG.replace('<svg class="stbs-fox"', '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"'));
        foxImage = img;
    });
}

function openCard({ text, trans = '', mesId, who, note = null }) {
    const s = settings();
    if (note) { mesId = note.mesId; text = noteText(note); trans = note.trans || ''; }
    const m = msg(mesId);
    // Whole message + SillyTavern's own translation (extra.display_text) → prefill both languages.
    if (!text) {
        text = plainKeep(m?.mes);
        if (!trans && m?.extra?.display_text && plainKeep(m.extra.display_text) !== text) trans = plainKeep(m.extra.display_text);
    }
    const original = text;
    // The other language of this message (SillyTavern translate keeps the original in `mes`
    // and shows extra.display_text), so the translation box can be filled in one tap.
    let alt = '';
    if (m?.extra?.display_text) {
        const shown = plainKeep(m.extra.display_text), src = plainKeep(m.mes);
        const probe = oneParagraph(text).slice(0, 12);
        alt = probe && oneParagraph(shown).includes(probe) ? src : shown;
        if (alt === text) alt = '';
    }
    const ch = chapterOf(mesId);
    const info = { text, who: who ?? speaker(mesId), chapter: sortedChapters().length ? chapterLabel(ch) : '', source: ctx().getCurrentChatId?.() || '' };
    const themes = Object.entries(CARD_THEMES).map(([k, t]) =>
        `<div class="stbs-chip ${k === s.cardTheme ? 'active' : ''}" data-theme="${k}"><span class="stbs-swatch" style="background:linear-gradient(135deg,${t.bg[0]},${t.bg[1]})"></span>${t.name}</div>`).join('');
    const body = openModal('명대사 카드', `
        <div class="stbs-card-wrap"><canvas id="stbs-card-canvas"></canvas></div>
        <div class="stbs-row stbs-wrap">${themes}</div>
        <div class="stbs-row stbs-between stbs-wrap">
            <label class="stbs-label">문장 <span class="stbs-dim">· 원문</span></label>
            <div class="stbs-row stbs-wrap stbs-card-tools">
                <div class="stbs-chip" data-break="keep" title="채팅에서 보이던 그대로">원문 줄바꿈</div>
                <div class="stbs-chip" data-break="sentence" title="문장마다 줄을 바꿔요">문장마다</div>
                <div class="stbs-chip" data-break="flow" title="줄바꿈 없이 한 덩어리로">한 문단</div>
            </div>
        </div>
        <textarea id="stbs-card-text" class="text_pole stbs-textarea" rows="4">${esc(info.text)}</textarea>
        <div class="stbs-hint">엔터로 줄을 바꾸고, 빈 줄을 넣으면 문단이 나뉘어요.</div>
        <div class="stbs-row stbs-between stbs-wrap">
            <label class="stbs-label">번역 <span class="stbs-dim">· 선택 (예: 영어 원문 아래 한국어)</span></label>
            <div class="stbs-row stbs-wrap">
                <div class="stbs-chip ${s.cardTransFirst ? '' : 'active'}" data-order="orig">원문 위</div>
                <div class="stbs-chip ${s.cardTransFirst ? 'active' : ''}" data-order="trans">번역 위</div>
            </div>
        </div>
        <textarea id="stbs-card-trans" class="text_pole stbs-textarea stbs-trans" rows="3" placeholder="번역 문장을 적으면 카드에 작게 함께 들어가요">${esc(trans)}</textarea>
        ${alt ? `<div class="stbs-row stbs-wrap"><div class="stbs-chip" data-alt title="이 메시지의 다른 언어 전체를 넣어요. 필요한 부분만 남기세요."><i class="fa-solid fa-language"></i> 메시지의 다른 언어 불러오기</div></div>` : ''}
        <div class="stbs-commu-box" id="stbs-commu-box" ${CARD_THEMES[s.cardTheme]?.commu ? '' : 'hidden'}>
            <div class="stbs-row stbs-between stbs-wrap">
                <label class="stbs-label">커뮤 반응 <span class="stbs-dim">· 글 제목과 댓글 (한 줄에 하나, 4개까지)</span></label>
                <div class="stbs-chip" data-reroll title="제목·댓글·숫자를 새로 뽑아요"><i class="fa-solid fa-dice"></i> 다시 뽑기</div>
            </div>
            <input id="stbs-commu-title" class="text_pole" maxlength="40" placeholder="글 제목">
            <textarea id="stbs-commu-cm" class="text_pole stbs-textarea" rows="3" placeholder="댓글 반응을 한 줄에 하나씩"></textarea>
        </div>
        <label class="checkbox_label stbs-inline"><input type="checkbox" id="stbs-card-fox" ${s.cardFox ? 'checked' : ''}> <span>여우 도장 찍기 <span class="stbs-dim">(커뮤 테마는 프로필 사진)</span></span></label>
        <div class="stbs-row">
            <input id="stbs-card-who" class="text_pole" placeholder="화자" value="${esc(info.who)}">
            <input id="stbs-card-ch" class="text_pole" placeholder="챕터/출처" value="${esc(info.chapter)}">
        </div>
        <div class="stbs-row stbs-end">
            <div class="stbs-btn" id="stbs-card-copy"><i class="fa-solid fa-copy"></i> 이미지 복사</div>
            <div class="stbs-btn stbs-primary" id="stbs-card-save"><i class="fa-solid fa-download"></i> PNG 저장</div>
        </div>`, { wide: true });
    const canvas = body.querySelector('#stbs-card-canvas');
    const ta = body.querySelector('#stbs-card-text');
    const tr = body.querySelector('#stbs-card-trans');
    let theme = s.cardTheme;
    const cTitle = body.querySelector('#stbs-commu-title');
    const cCm = body.querySelector('#stbs-commu-cm');
    let seed = parseInt(hash(String(text || '')).slice(0, 6), 36) || 7;
    const fillCommu = () => {
        const dflt = commuDefaults(seed, body.querySelector('#stbs-card-who').value.trim());
        cTitle.value = dflt.title;
        cCm.value = dflt.comments.join('\n');
    };
    const redraw = () => drawCard(canvas, {
        text: ta.value,
        trans: tr.value,
        transFirst: !!s.cardTransFirst,
        who: body.querySelector('#stbs-card-who').value.trim(),
        chapter: body.querySelector('#stbs-card-ch').value.trim(),
        source: '',
        commu: { seed, title: cTitle.value.trim(), comments: cCm.value.split('\n') },
    }, theme);
    const redrawSoon = debounce(redraw, 150);
    // keep a note's translation so the next card (and the notes list / export) has it too
    const saveTrans = debounce(() => {
        if (!note || !getNote(note.id)) return;
        const v = tr.value.trim();
        if ((note.trans || '') !== v) { if (v) note.trans = v; else delete note.trans; persist(); refreshPanel(); }
    }, 500);
    body.addEventListener('input', (e) => { redrawSoon(); if (e.target === tr) saveTrans(); });
    body.querySelector('#stbs-card-fox').addEventListener('change', (e) => { s.cardFox = e.target.checked; saveSettings(); redraw(); });
    body.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-theme]');
        if (chip) {
            theme = chip.dataset.theme;
            s.cardTheme = theme;
            saveSettings();
            body.querySelectorAll('[data-theme]').forEach(x => x.classList.toggle('active', x === chip));
            body.querySelector('#stbs-commu-box').hidden = !CARD_THEMES[theme]?.commu;
            redraw();
            return;
        }
        if (e.target.closest('[data-reroll]')) {
            seed = Math.floor(Math.random() * 1e9);
            fillCommu();
            redraw();
            return;
        }
        const br = e.target.closest('[data-break]');
        if (br) {
            const mode = br.dataset.break;
            const apply = (v, orig) => mode === 'keep' ? orig : mode === 'sentence' ? sentencePerLine(v) : oneParagraph(v);
            ta.value = apply(ta.value, original);
            if (tr.value.trim()) tr.value = mode === 'keep' ? tr.value : apply(tr.value, tr.value);
            redraw();
            return;
        }
        if (e.target.closest('[data-alt]')) {
            tr.value = alt;
            saveTrans();
            redraw();
            return;
        }
        const ord = e.target.closest('[data-order]');
        if (ord) {
            s.cardTransFirst = ord.dataset.order === 'trans';
            saveSettings();
            body.querySelectorAll('[data-order]').forEach(x => x.classList.toggle('active', x === ord));
            redraw();
        }
    });
    body.querySelector('#stbs-card-save').addEventListener('click', () => {
        canvas.toBlob(b => b && download(`명대사_${fmtDate(Date.now())}_${uid().slice(-4)}.png`, b), 'image/png');
    });
    body.querySelector('#stbs-card-copy').addEventListener('click', () => {
        canvas.toBlob(async (b) => {
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
                toastr.success('이미지를 복사했어요.');
            } catch {
                toastr.warning('이 브라우저에서는 이미지 복사가 안 돼요. PNG 저장을 써주세요.');
            }
        }, 'image/png');
    });
    fillCommu();
    Promise.all([
        loadFoxImage(),
        document.fonts?.ready?.catch?.(() => { }),
    ]).then(redraw);
    redraw();
}

// ---------------------------------------------------------------- panel

const TABS = [
    ['toc', 'fa-list-ol', '목차'],
    ['bookmarks', 'fa-book-bookmark', '책갈피'],
    ['notes', 'fa-highlighter', '독서노트'],
    ['search', 'fa-magnifying-glass', '검색'],
    ['stats', 'fa-chart-simple', '통계'],
];

const ui = {
    tab: 'notes',
    noteFilter: 'all',
    noteSort: 'story',
    q: '',
    scope: 'all',
    chapterScope: 'all',
    scrap: null,          // open scrapbook id in the notes tab
    selecting: false,     // multi-select mode in the notes tab
    selected: new Set(),
    trashFilter: 'all',
    prevTab: 'notes',
};

// ---------------------------------------------------------------- rating & one-line review

const SCRAP_EMOJI = ['📒', '📕', '📗', '📘', '💌', '☔', '🌸', '🌙', '🔥', '🍂'];

function starsHtml(r, size = '') {
    const n = Math.max(0, Math.min(5, Math.round(Number(r) || 0)));
    return `<span class="stbs-stars ${size}">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
}

function reviewTarget(target) {
    const d = data();
    if (target === 'book') return { obj: d.review, title: '이 책(채팅)의 별점', sub: ctx().getCurrentChatId?.() || '' };
    const c = d.chapters.find(x => x.id === target);
    if (!c) return null;
    const num = sortedChapters().indexOf(c) + 1;
    return { obj: c, title: `${num}장의 별점`, sub: c.title };
}

function reviewStrip(target, compact = false) {
    const t = reviewTarget(target);
    if (!t) return '';
    const r = Number(t.obj.rating) || 0;
    const text = t.obj.review ?? t.obj.text ?? '';
    if (!r && !text) {
        return `<div class="stbs-review empty" data-act="rate" data-target="${target}">
            <span class="stbs-review-lab">${target === 'book' ? '이 책의 별점' : '별점'}</span>${starsHtml(0)}<span class="stbs-review-hint">눌러서 별점과 한줄평 남기기</span></div>`;
    }
    return `<div class="stbs-review ${compact ? 'compact' : ''}" data-act="rate" data-target="${target}">
        <div class="stbs-review-top"><span class="stbs-review-lab">${target === 'book' ? '이 책의 별점' : '별점'}</span>${starsHtml(r)}<b class="stbs-review-num">${r ? r.toFixed(1) : '–'}</b></div>
        ${text ? `<p class="stbs-review-text">“${esc(text)}”</p>` : ''}
    </div>`;
}

function openRatingEditor(target) {
    const t = reviewTarget(target);
    if (!t) return;
    const isBook = target === 'book';
    let rating = Number(t.obj.rating) || 0;
    const text = isBook ? (t.obj.text || '') : (t.obj.review || '');
    const body = openModal(esc(t.title), `
        <div class="stbs-muted">${esc(clip(t.sub, 60))}</div>
        <div class="stbs-star-pick" role="radiogroup" aria-label="별점">
            ${[1, 2, 3, 4, 5].map(k => `<button type="button" class="stbs-star-btn" data-star="${k}" aria-label="${k}점">★</button>`).join('')}
        </div>
        <div class="stbs-star-caption" id="stbs-star-cap"></div>
        <input id="stbs-oneline" class="text_pole" maxlength="80" placeholder="한줄평을 남겨 보세요 (80자까지)" value="${esc(text)}">
        <div class="stbs-row stbs-end">
            <div class="stbs-btn" id="stbs-rate-clear">지우기</div>
            <div class="stbs-btn stbs-primary" id="stbs-rate-save">저장</div>
        </div>`);
    const CAPS = ['', '별로였어요', '그저 그래요', '괜찮았어요', '좋았어요', '인생 채팅이에요'];
    const paint = () => {
        body.querySelectorAll('.stbs-star-btn').forEach(b => b.classList.toggle('on', Number(b.dataset.star) <= rating));
        body.querySelector('#stbs-star-cap').textContent = rating ? `${rating}점 · ${CAPS[rating]}` : '별을 눌러 주세요';
    };
    body.querySelector('.stbs-star-pick').addEventListener('click', (e) => {
        const b = e.target.closest('[data-star]');
        if (!b) return;
        const k = Number(b.dataset.star);
        rating = rating === k ? 0 : k;
        paint();
    });
    const save = (r, tx) => {
        t.obj.rating = r;
        if (isBook) t.obj.text = tx; else t.obj.review = tx;
        t.obj.reviewed = Date.now();
        persist();
        closeModal();
        refreshPanel();
    };
    body.querySelector('#stbs-rate-save').addEventListener('click', () => { save(rating, body.querySelector('#stbs-oneline').value.trim()); toastr.success('🦊 별점을 남겼어요.'); });
    body.querySelector('#stbs-rate-clear').addEventListener('click', () => save(0, ''));
    body.querySelector('#stbs-oneline').addEventListener('keydown', (e) => { if (e.key === 'Enter') body.querySelector('#stbs-rate-save').click(); });
    paint();
}

// ---------------------------------------------------------------- scrapbooks (bundles of notes)

function getScrap(id) {
    return data().scrapbooks.find(x => x.id === id);
}

function scrapNotes(sb) {
    const byId = new Map(data().notes.map(n => [n.id, n]));
    return sb.noteIds.map(id => byId.get(id)).filter(Boolean);
}

function addToScrap(sbId, noteIds) {
    const sb = getScrap(sbId);
    if (!sb) return 0;
    let added = 0;
    for (const id of noteIds) if (!sb.noteIds.includes(id)) { sb.noteIds.push(id); added++; }
    sb.updated = Date.now();
    persist();
    return added;
}

function openScrapEditor({ scrap = null, noteIds = [] } = {}) {
    let emoji = scrap?.emoji || SCRAP_EMOJI[data().scrapbooks.length % SCRAP_EMOJI.length];
    const body = openModal(scrap ? '스크랩북 이름 바꾸기' : '새 스크랩북', `
        <div class="stbs-emoji-pick">${SCRAP_EMOJI.map(e => `<button type="button" class="stbs-emoji ${e === emoji ? 'on' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div>
        <input id="stbs-scrap-name" class="text_pole" maxlength="30" placeholder="예: 고백 장면 모음" value="${esc(scrap?.name || '')}">
        ${noteIds.length ? `<div class="stbs-muted">고른 노트 ${noteIds.length}개를 담아요.</div>` : ''}
        <div class="stbs-row stbs-end">
            <div class="stbs-btn" data-act="modal-close">취소</div>
            <div class="stbs-btn stbs-primary" id="stbs-scrap-save">${scrap ? '저장' : '만들기'}</div>
        </div>`);
    const input = body.querySelector('#stbs-scrap-name');
    setTimeout(() => input.focus(), 30);
    body.querySelector('.stbs-emoji-pick').addEventListener('click', (e) => {
        const b = e.target.closest('[data-emoji]');
        if (!b) return;
        emoji = b.dataset.emoji;
        body.querySelectorAll('.stbs-emoji').forEach(x => x.classList.toggle('on', x === b));
    });
    const save = () => {
        const name = input.value.trim() || '이름 없는 스크랩북';
        if (scrap) { scrap.name = name; scrap.emoji = emoji; scrap.updated = Date.now(); persist(); }
        else {
            const sb = { id: uid(), name, emoji, noteIds: [], created: Date.now(), updated: Date.now() };
            data().scrapbooks.push(sb);
            if (noteIds.length) addToScrap(sb.id, noteIds); else persist();
            toastr.success(`🦊 "${name}" 스크랩북을 만들었어요.`);
            if (noteIds.length) endSelecting();
        }
        closeModal();
        refreshPanel();
    };
    body.querySelector('#stbs-scrap-save').addEventListener('click', save);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
}

function openScrapPicker(noteIds) {
    const list = data().scrapbooks;
    if (!list.length) { openScrapEditor({ noteIds }); return; }
    const body = openModal('스크랩북에 담기', `
        <div class="stbs-muted">고른 노트 ${noteIds.length}개를 어디에 담을까요?</div>
        <div class="stbs-scrap-pick">
            ${list.map(sb => `<div class="stbs-item stbs-scrap-row" data-pick="${sb.id}"><span class="stbs-scrap-emoji">${esc(sb.emoji || '📒')}</span><div class="stbs-grow"><div class="stbs-item-title">${esc(sb.name)}</div><div class="stbs-meta">노트 ${scrapNotes(sb).length}개</div></div><i class="fa-solid fa-plus"></i></div>`).join('')}
            <div class="stbs-btn stbs-wide-btn stbs-ghost" data-pick="__new"><i class="fa-solid fa-plus"></i> 새 스크랩북 만들어 담기</div>
        </div>`);
    body.addEventListener('click', (e) => {
        const pick = e.target.closest('[data-pick]')?.dataset.pick;
        if (!pick) return;
        if (pick === '__new') { openScrapEditor({ noteIds }); return; }
        const added = addToScrap(pick, noteIds);
        closeModal();
        toastr.success(added ? `🦊 ${added}개를 담았어요.` : '이미 다 들어 있어요.');
        endSelecting();
        refreshPanel();
    });
}

async function deleteScrap(id) {
    const sb = getScrap(id);
    if (!sb) return;
    const d = data();
    d.scrapbooks = d.scrapbooks.filter(x => x !== sb);
    toTrash('scrap', sb);
    ui.scrap = null;
    persist();
    refreshPanel();
}

function cardFromNotes(notes) {
    if (!notes.length) return;
    const text = notes.map(noteText).join('\n\n');
    const trans = notes.some(n => n.trans) ? notes.map(n => n.trans || '').filter(Boolean).join('\n\n') : '';
    const speakers = [...new Set(notes.map(n => speaker(n.mesId)))];
    openCard({ text, trans, mesId: notes[0].mesId, who: speakers.length === 1 ? speakers[0] : '' });
}

function endSelecting() {
    ui.selecting = false;
    ui.selected.clear();
}

function panelOpen() {
    return $id('stbs-panel')?.classList.contains('open');
}

function isMobile() {
    return window.matchMedia('(max-width: 800px)').matches;
}

/** Fonts of the live page, so our UI follows whatever theme (ST theme, Blue Lemonade, …) is active. */
function pageFonts() {
    const chatText = document.querySelector('#chat .mes:not(.smallSysMes) .mes_text') || document.querySelector('#chat') || document.body;
    const read = getComputedStyle(chatText);
    const body = getComputedStyle(document.body);
    return { uiFont: body.fontFamily, uiSize: body.fontSize, readFont: read.fontFamily, readSize: read.fontSize };
}

function themed(el) {
    el.dataset.stbsTheme = resolvedTheme();
    const f = pageFonts();
    el.style.setProperty('--stbs-ui-font', f.uiFont);
    el.style.setProperty('--stbs-fs', f.uiSize);
    el.style.setProperty('--stbs-read-font', f.readFont);
    el.style.setProperty('--stbs-read-size', f.readSize);
    return el;
}

function applyThemeEverywhere() {
    for (const id of ['stbs-panel', 'stbs-modal', 'stbs-sel-pop']) {
        const el = $id(id);
        if (el) themed(el);
    }
}

function buildPanel() {
    if ($id('stbs-panel')) return;
    const p = themed(document.createElement('div'));
    p.id = 'stbs-panel';
    p.innerHTML = `
        <div class="stbs-grab" data-drag="sheet"><span></span></div>
        <div class="stbs-head" data-drag="move">
            <div class="stbs-icon-btn stbs-back fa-solid fa-chevron-left" data-act="close" title="채팅으로 돌아가기"></div>
            <div class="stbs-title"><span class="stbs-avatar">${FOX_SVG}</span><div class="stbs-title-text"><b>${APP_NAME}</b><span class="stbs-sub" id="stbs-chatname"></span></div></div>
            <div class="stbs-icon-btn stbs-trash-btn fa-solid fa-box-archive" data-act="trash" title="여우의 보관함 (지운 것들)"><span id="stbs-trash-count" class="stbs-count-badge" hidden></span></div>
            <div class="stbs-icon-btn fa-solid fa-file-export" data-act="export" title="내보내기 / 불러오기"></div>
            <div class="stbs-icon-btn stbs-x fa-solid fa-xmark" data-act="close" title="닫기"></div>
        </div>
        <div class="stbs-tabs">${TABS.map(([k, ic, name]) => `<div class="stbs-tab" data-tab="${k}"><i class="fa-solid ${ic}"></i><span>${name}</span></div>`).join('')}</div>
        <div class="stbs-body" id="stbs-body"></div>
        <div class="stbs-resize" data-drag="resize" title="크기 조절"></div>`;
    document.body.appendChild(p);
    p.addEventListener('click', onPanelClick);
    p.addEventListener('input', onPanelInput);
    p.addEventListener('change', onPanelInput);
    p.addEventListener('pointerdown', onPanelPointerDown);
    p.querySelector('.stbs-head').addEventListener('dblclick', (e) => {
        if (e.target.closest('[data-act]') || isMobile()) return;
        settings().panel = null;
        saveSettings();
        applyGeometry();
    });
}

function setSheetHeight(p, h) {
    p.style.height = `${Math.round(h)}px`;
    p.style.top = `${Math.round(window.innerHeight - h)}px`;
}

/** Desktop: floating window at saved x/y/w/h. Mobile: bottom sheet with saved height. */
function applyGeometry() {
    const p = $id('stbs-panel');
    if (!p) return;
    const s = settings();
    const vw = window.innerWidth, vh = window.innerHeight;
    if (isMobile()) {
        p.classList.add('page');
        p.classList.remove('float', 'sheet');
        p.removeAttribute('style');
        return;
    }
    p.classList.add('float');
    p.classList.remove('sheet', 'page');
    const g = s.panel || { w: 400, h: Math.min(720, vh - 90), x: vw - 400 - 20, y: 60 };
    const w = Math.min(Math.max(300, g.w), vw - 16);
    const h = Math.min(Math.max(320, g.h), vh - 16);
    const x = Math.min(Math.max(8 - w + 120, g.x), vw - 120);
    const y = Math.min(Math.max(0, g.y), vh - 48);
    Object.assign(p.style, { left: `${x}px`, top: `${y}px`, right: 'auto', bottom: 'auto', width: `${w}px`, height: `${h}px` });
}

function onPanelPointerDown(e) {
    const handle = e.target.closest('[data-drag]');
    if (!handle || e.target.closest('[data-act]') || e.button > 0) return;
    const p = $id('stbs-panel');
    const mode = handle.dataset.drag;
    const mobile = isMobile();
    if (mobile) return;
    if (mode === 'sheet') return;
    e.preventDefault();
    const rect = p.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    p.classList.add('dragging');
    handle.setPointerCapture?.(e.pointerId);

    const move = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (mobile) {
            const h = Math.min(window.innerHeight * 0.95, Math.max(80, rect.height - dy));
            setSheetHeight(p, h);
        } else if (mode === 'move') {
            p.style.left = `${Math.min(Math.max(8 - rect.width + 120, rect.left + dx), window.innerWidth - 120)}px`;
            p.style.top = `${Math.min(Math.max(0, rect.top + dy), window.innerHeight - 48)}px`;
        } else {
            p.style.width = `${Math.min(Math.max(300, rect.width + dx), window.innerWidth - rect.left - 8)}px`;
            p.style.height = `${Math.min(Math.max(320, rect.height + dy), window.innerHeight - rect.top - 8)}px`;
        }
    };
    const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        p.classList.remove('dragging');
        const r = p.getBoundingClientRect();
        const s = settings();
        if (mobile) {
            const frac = r.height / window.innerHeight;
            if (frac < 0.25) { closePanel(); applyGeometry(); return; }
            s.sheetH = Math.min(0.95, Math.max(0.3, frac));
        } else {
            s.panel = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
        }
        saveSettings();
        applyGeometry();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
}

function openPanel(tab) {
    if (!settings().enabled) { toastr.info(`${APP_NAME} 확장이 꺼져 있어요. 확장 설정에서 켜주세요.`); return; }
    buildPanel();
    if (tab && (TABS.some(t => t[0] === tab) || tab === 'trash')) ui.tab = tab;
    const p = $id('stbs-panel');
    placePanel();
    applyGeometry();
    if (isMobile()) {
        const dlg = $id('stbs-dialog');
        if (!dlg.open) { try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); } }
        const tc = $id('toast-container');
        if (tc) dlg.appendChild(tc);
    }
    if (!p.classList.contains('open')) {
        p.classList.add('anim');
        p.addEventListener('animationend', () => p.classList.remove('anim'), { once: true });
    }
    themed(p); // pick up the theme's current fonts/colours every time the panel opens
    p.classList.add('open');
    document.body.classList.add('stbs-panel-open');
    renderPanel();
}

function closePanel() {
    $id('stbs-panel')?.classList.remove('open');
    document.body.classList.remove('stbs-panel-open');
    const dlg = $id('stbs-dialog');
    if (dlg?.open) dlg.close();
    const tc = $id('toast-container');
    if (tc && tc.parentElement !== document.body) document.body.appendChild(tc);
}

/** Where popups (memo, card, export) are attached: inside the mobile window when it is open. */
function overlayHost() {
    const dlg = $id('stbs-dialog');
    return dlg?.open ? dlg : document.body;
}

/**
 * Mobile: the panel lives inside a full-screen <dialog> (browser top layer), so no SillyTavern
 * layout, transform or z-index can hide it. Desktop: floating, movable window on <body>.
 */
function placePanel() {
    const p = $id('stbs-panel');
    if (!p) return;
    if (isMobile()) {
        let dlg = $id('stbs-dialog');
        if (!dlg) {
            dlg = document.createElement('dialog');
            dlg.id = 'stbs-dialog';
            dlg.addEventListener('close', () => {
                $id('stbs-panel')?.classList.remove('open');
                document.body.classList.remove('stbs-panel-open');
                const tc = $id('toast-container');
                if (tc && tc.parentElement !== document.body) document.body.appendChild(tc);
            });
            document.body.appendChild(dlg);
        }
        themed(dlg);
        if (p.parentElement !== dlg) dlg.appendChild(p);
    } else {
        const dlg = $id('stbs-dialog');
        if (dlg?.open) dlg.close();
        if (p.parentElement !== document.body) document.body.appendChild(p);
    }
}

function togglePanel(tab) {
    if (panelOpen() && (!tab || tab === ui.tab)) closePanel(); else openPanel(tab);
}

window.addEventListener('resize', debounce(() => {
    const wasOpen = panelOpen();
    const before = $id('stbs-panel')?.parentElement?.id;
    placePanel();
    applyGeometry();
    const after = $id('stbs-panel')?.parentElement?.id;
    if (wasOpen && before !== after) openPanel();
}, 150));

function refreshPanel() {
    if (panelOpen()) renderPanel();
}

function renderPanel() {
    const body = $id('stbs-body');
    if (!body) return;
    document.querySelectorAll('#stbs-panel .stbs-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === ui.tab));
    $id('stbs-chatname').textContent = hasChat() ? clip(ctx().getCurrentChatId(), 40) : '오늘의 책을 펼쳐 주세요';
    if (!hasChat()) { body.innerHTML = emptyState('아직 펼친 책이 없어요', '채팅을 열면 여우가 함께 읽기 시작해요.'); return; }
    const scroll = body.scrollTop;
    const keepFocus = document.activeElement?.id === 'stbs-q';
    updateTrashBadge();
    $id('stbs-panel')?.classList.toggle('in-trash', ui.tab === 'trash');
    body.innerHTML = ({ toc: renderToc, bookmarks: renderBookmarks, notes: renderNotes, search: renderSearch, stats: renderStats, trash: renderTrash }[ui.tab] || renderNotes)();
    body.scrollTop = scroll;
    if (ui.tab === 'search') {
        const q = $id('stbs-q');
        if (keepFocus || !ui.q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }
}

function metaLine(i, extra = '') {
    return `<div class="stbs-meta">${esc(speaker(i))} · #${i}${extra ? ' · ' + extra : ''}</div>`;
}

function groupByChapter(items, render) {
    const chapters = sortedChapters();
    let html = '';
    let last = null;
    for (const it of items) {
        const ch = chapterOf(it.mesId, chapters);
        if (chapters.length && ch.id !== last) {
            html += `<div class="stbs-group-head">${esc(chapterLabel(ch))}</div>`;
            last = ch.id;
        }
        html += render(it);
    }
    return html;
}

function renderToc() {
    const chat = ctx().chat;
    const chapters = sortedChapters();
    const d = data();
    const cpp = Math.max(100, Number(settings().charsPerPage) || 600);
    const entries = [];
    if (!chapters.length || chapters[0].mesId > 0) entries.push({ id: '__prologue', title: chapters.length ? '프롤로그' : '처음부터', mesId: 0, num: 0 });
    chapters.forEach((c, k) => entries.push({ ...c, num: k + 1 }));
    let html = reviewStrip('book') + `
        <div class="stbs-hint">메시지 <i class="fa-solid fa-ellipsis"></i> 메뉴의 <i class="fa-solid fa-book-open"></i> 버튼으로 원하는 위치에서 챕터를 시작할 수 있어요.</div>
        <div class="stbs-btn stbs-wide-btn stbs-ghost" data-act="chapter-last"><i class="fa-solid fa-plus"></i> 마지막 메시지에서 새 챕터</div>`;
    entries.forEach((e, k) => {
        const endId = (entries[k + 1]?.mesId ?? chat.length) - 1;
        let chars = 0;
        for (let j = e.mesId; j <= endId; j++) chars += plain(chat[j]?.mes).length;
        const bm = d.bookmarks.filter(b => b.mesId >= e.mesId && b.mesId <= endId).length;
        const nt = d.notes.filter(n => n.mesId >= e.mesId && n.mesId <= endId).length;
        const isReal = e.id !== '__prologue';
        html += `
        <div class="stbs-item stbs-toc" data-jump="${e.mesId}">
            <div class="stbs-toc-num">${e.num || '–'}</div>
            <div class="stbs-grow">
                <div class="stbs-item-title">${esc(e.title)}${e.rating ? ` ${starsHtml(e.rating, 'sm')}` : ''}</div>
                ${e.review ? `<div class="stbs-snippet stbs-ch-review">“${esc(e.review)}”</div>` : ''}
                <div class="stbs-meta">#${e.mesId}–#${Math.max(e.mesId, endId)} · 약 ${Math.max(1, Math.round(chars / cpp))}쪽${bm ? ` · 책갈피 ${bm}` : ''}${nt ? ` · 노트 ${nt}` : ''}</div>
            </div>
            ${isReal ? `<div class="stbs-actions">
                <div class="stbs-icon-btn fa-regular fa-star" data-act="rate" data-target="${e.id}" title="별점 · 한줄평"></div>
                <div class="stbs-icon-btn fa-solid fa-pen" data-act="chapter-rename" data-id="${e.id}" title="이름 바꾸기"></div>
                <div class="stbs-icon-btn fa-solid fa-trash-can" data-act="chapter-del" data-id="${e.id}" title="삭제"></div>
            </div>` : ''}
        </div>`;
    });
    return html;
}

function renderBookmarks() {
    const list = [...data().bookmarks].sort((a, b) => a.mesId - b.mesId);
    if (!list.length) return emptyState('아직 꽂아 둔 책갈피가 없어요', '메시지 <i class="fa-solid fa-ellipsis"></i> 메뉴의 <i class="fa-solid fa-book-bookmark"></i> 버튼으로 꽂을 수 있어요.');
    return `<div class="stbs-count">책갈피 ${list.length}개</div>` + groupByChapter(list, b => {
        const text = plain(msg(b.mesId)?.mes);
        return `
        <div class="stbs-item stbs-bm-item" data-jump="${b.mesId}">
            <i class="fa-solid fa-bookmark stbs-bm-ico"></i>
            <div class="stbs-grow">
                <div class="stbs-item-title">${esc(b.label || clip(text, 40))}</div>
                ${b.label ? `<div class="stbs-snippet">${esc(clip(text, 120))}</div>` : ''}
                ${metaLine(b.mesId, fmtDate(b.created))}
            </div>
            <div class="stbs-actions">
                <div class="stbs-icon-btn fa-solid fa-pen" data-act="bm-rename" data-id="${b.id}" title="이름 바꾸기"></div>
                <div class="stbs-icon-btn fa-solid fa-trash-can" data-act="bm-del" data-id="${b.id}" title="삭제"></div>
            </div>
        </div>`;
    });
}

function noteCard(n, { inScrap = null } = {}) {
    const s = settings();
    const colorCss = n.color != null ? `style="--bar:${esc(s.colors[n.color])}"` : '';
    const stale = staleNotes.has(n.id) ? '<span class="stbs-badge">원문 변경됨</span>' : '';
    const quote = n.start != null
        ? `<div class="stbs-note-quote">${esc(noteText(n))}</div>${n.trans ? `<div class="stbs-note-trans">${esc(n.trans)}</div>` : ''}`
        : `<div class="stbs-note-quote stbs-whole"><span class="stbs-badge">메시지 전체</span> ${esc(clip(plain(msg(n.mesId)?.mes), 120))}</div>`;
    const sel = ui.selecting;
    const on = ui.selected.has(n.id);
    const inBooks = data().scrapbooks.filter(sb => sb.noteIds.includes(n.id));
    return `
    <div class="stbs-note ${n.color == null ? 'no-color' : ''} ${sel ? 'selecting' : ''} ${on ? 'picked' : ''}" ${colorCss} data-jump="${n.mesId}" data-note="${n.id}">
        ${sel ? `<span class="stbs-check ${on ? 'on' : ''}"><i class="fa-solid fa-check"></i></span>` : ''}
        ${quote}
        ${n.memo ? `<div class="stbs-note-memo">${esc(n.memo)}</div>` : ''}
        <div class="stbs-note-foot">
            <div class="stbs-meta">${esc(speaker(n.mesId))} · #${n.mesId} · ${fmtDate(n.updated)} ${stale}${!inScrap && inBooks.length ? ` <span class="stbs-badge">${esc(inBooks[0].emoji || '📒')} ${inBooks.length > 1 ? inBooks.length : esc(clip(inBooks[0].name, 8))}</span>` : ''}</div>
            ${sel ? '' : `<div class="stbs-actions">
                <div class="stbs-icon-btn fa-solid fa-pen" data-act="note-edit" data-id="${n.id}" title="메모 쓰기/수정"></div>
                <div class="stbs-icon-btn fa-solid fa-quote-left" data-act="note-card" data-id="${n.id}" title="명대사 카드"></div>
                ${inScrap
                    ? `<div class="stbs-icon-btn fa-solid fa-folder-minus" data-act="scrap-remove" data-id="${n.id}" title="스크랩북에서 빼기"></div>`
                    : `<div class="stbs-icon-btn fa-solid fa-trash-can" data-act="note-del" data-id="${n.id}" title="삭제"></div>`}
            </div>`}
        </div>
    </div>`;
}

function selectionBar() {
    if (!ui.selecting) return '';
    const n = ui.selected.size;
    return `<div class="stbs-selbar">
        <span class="stbs-selbar-count">${n ? `${n}개 골랐어요` : '노트를 눌러 골라요'}</span>
        <div class="stbs-btn ${n ? '' : 'disabled'}" data-act="sel-scrap"><i class="fa-solid fa-book-bookmark"></i> 스크랩북에 담기</div>
        <div class="stbs-btn stbs-primary ${n ? '' : 'disabled'}" data-act="sel-card"><i class="fa-solid fa-quote-left"></i> 카드로 모으기</div>
        <div class="stbs-icon-btn fa-solid fa-xmark" data-act="sel-cancel" title="그만 고르기"></div>
    </div>`;
}

function renderScrapView(sb) {
    const notes = scrapNotes(sb);
    let html = `
        <div class="stbs-scrap-head">
            <div class="stbs-icon-btn fa-solid fa-chevron-left" data-act="scrap-back" title="모든 노트"></div>
            <span class="stbs-scrap-emoji big">${esc(sb.emoji || '📒')}</span>
            <div class="stbs-grow"><div class="stbs-scrap-title">${esc(sb.name)}</div><div class="stbs-meta">노트 ${notes.length}개 · ${fmtDate(sb.updated || sb.created)}</div></div>
            <div class="stbs-icon-btn fa-solid fa-pen" data-act="scrap-rename" data-id="${sb.id}" title="이름 바꾸기"></div>
            <div class="stbs-icon-btn fa-solid fa-trash-can" data-act="scrap-del" data-id="${sb.id}" title="스크랩북 삭제"></div>
        </div>`;
    if (!notes.length) return html + emptyState('아직 빈 스크랩북이에요', '모든 노트에서 <b>고르기</b>를 눌러 노트를 담아 보세요.');
    html += `<div class="stbs-btn stbs-wide-btn" data-act="scrap-card" data-id="${sb.id}"><i class="fa-solid fa-quote-left"></i> 이 스크랩북을 카드 한 장으로</div>`;
    return html + notes.map(n => noteCard(n, { inScrap: sb })).join('');
}

function renderNotes() {
    const s = settings();
    const d = data();
    const all = d.notes;
    if (ui.scrap) {
        const sb = getScrap(ui.scrap);
        if (sb) return renderScrapView(sb);
        ui.scrap = null;
    }
    const counts = { all: all.length, none: all.filter(n => n.color == null).length, memo: all.filter(n => n.memo).length };
    s.colors.forEach((_, k) => { counts[k] = all.filter(n => n.color === k).length; });
    const f = ui.noteFilter;
    let list = all.filter(n => f === 'all' ? true : f === 'none' ? n.color == null : f === 'memo' ? !!n.memo : n.color === Number(f));
    list = ui.noteSort === 'story'
        ? list.sort((a, b) => a.mesId - b.mesId || (a.start ?? -1) - (b.start ?? -1))
        : list.sort((a, b) => b.updated - a.updated);

    let html = reviewStrip('book');
    html += `<div class="stbs-shelf-head"><b>스크랩북</b>${d.scrapbooks.length ? `<span class="stbs-meta">${d.scrapbooks.length}권</span>` : ''}</div>
        <div class="stbs-shelf">
            ${d.scrapbooks.map(sb => `<div class="stbs-scrap-tile" data-act="scrap-open" data-id="${sb.id}"><span class="stbs-scrap-emoji">${esc(sb.emoji || '📒')}</span><b>${esc(sb.name)}</b><span class="stbs-meta">노트 ${scrapNotes(sb).length}</span></div>`).join('')}
            <div class="stbs-scrap-tile add" data-act="scrap-new"><i class="fa-solid fa-plus"></i><b>새 스크랩북</b></div>
        </div>`;

    const chip = (key, label) => `<div class="stbs-chip ${String(f) === String(key) ? 'active' : ''}" data-act="note-filter" data-f="${key}">${label}</div>`;
    html += `
        <div class="stbs-row stbs-wrap">
            ${chip('all', `전체 ${counts.all}`)}
            ${s.colors.map((c, k) => counts[k] ? chip(k, `<span class="stbs-swatch" style="background:${esc(c)}"></span>${counts[k]}`) : '').join('')}
            ${counts.none ? chip('none', `메모만 ${counts.none}`) : ''}
            ${counts.memo ? chip('memo', `메모 있는 것 ${counts.memo}`) : ''}
            <div class="stbs-chip stbs-sort" data-act="note-sort"><i class="fa-solid fa-arrow-down-wide-short"></i> ${ui.noteSort === 'story' ? '이야기 순' : '최근 순'}</div>
            ${all.length ? `<div class="stbs-chip ${ui.selecting ? 'active' : ''}" data-act="sel-mode"><i class="fa-regular fa-square-check"></i> 고르기</div>` : ''}
        </div>`;
    if (!all.length) {
        return html + emptyState('여우가 맛있는 문장을 기다려요', '채팅에서 문장이나 문단을 드래그해 보세요.<br>형광펜을 칠하거나, 형광펜 없이 메모만 남길 수도 있어요.');
    }
    if (!list.length) return html + emptyState('조건에 맞는 노트가 없어요', '', false) + selectionBar();
    return html + (ui.noteSort === 'story' ? groupByChapter(list, n => noteCard(n)) : list.map(n => noteCard(n)).join('')) + selectionBar();
}

function renderSearch() {
    const chapters = sortedChapters();
    let html = `
        <div class="stbs-search-bar">
            <i class="fa-solid fa-magnifying-glass stbs-search-ico"></i>
            <input id="stbs-q" type="search" placeholder="채팅에서 찾기…" value="${esc(ui.q)}" autocomplete="off">
        </div>
        <div class="stbs-row">
            <select id="stbs-scope" class="stbs-sel">
                <option value="all" ${ui.scope === 'all' ? 'selected' : ''}>모두</option>
                <option value="user" ${ui.scope === 'user' ? 'selected' : ''}>나</option>
                <option value="char" ${ui.scope === 'char' ? 'selected' : ''}>캐릭터</option>
            </select>
            <select id="stbs-hidscope" class="stbs-sel" title="숨김 표시한 메시지도 찾을지 골라요">
                <option value="all" ${hidScope() === 'all' ? 'selected' : ''}>숨김 포함</option>
                <option value="shown" ${hidScope() === 'shown' ? 'selected' : ''}>숨김 빼고</option>
                <option value="hidden" ${hidScope() === 'hidden' ? 'selected' : ''}>숨김만</option>
            </select>
            ${chapters.length ? `<select id="stbs-chscope" class="stbs-sel">
                <option value="all">모든 챕터</option>
                ${(chapters[0].mesId > 0 ? [{ id: '__prologue', title: '프롤로그' }] : []).concat(chapters.map((c, k) => ({ id: c.id, title: `${k + 1}장. ${c.title}` })))
                .map(c => `<option value="${c.id}" ${ui.chapterScope === c.id ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}
            </select>` : ''}
        </div>
        <div id="stbs-results">${searchResults()}</div>`;
    return html;
}

function hidScope() {
    const v = settings().searchHidden;
    return v === 'shown' || v === 'hidden' ? v : 'all';
}

function searchResults() {
    const q = ui.q.trim().toLowerCase();
    const hs = hidScope();
    if (!q) {
        const nHidden = ctx().chat.filter(isHiddenMes).length;
        const sub = hs === 'hidden' ? '숨김 표시한 메시지에서만 찾아요.' : hs === 'shown' ? '숨김 표시한 메시지는 빼고 찾아요.' : '숨김 표시한 메시지까지 모두 찾아요.';
        return emptyState('무엇을 찾아볼까요?', `여우가 킁킁, 이 채팅 전체에서 찾아줄게요.<br>${sub}${nHidden ? ` <span class="stbs-dim">(숨긴 메시지 ${nHidden}개)</span>` : ''}`);
    }
    const chat = ctx().chat;
    const chapters = sortedChapters();
    const LIMIT = 300;
    const out = [];
    let total = 0, hiddenHits = 0;
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        if (!m || isRealSystem(m)) continue;
        const hidden = isHiddenMes(m);
        if (hs === 'shown' && hidden) continue;
        if (hs === 'hidden' && !hidden) continue;
        if (ui.scope === 'user' && !m.is_user) continue;
        if (ui.scope === 'char' && m.is_user) continue;
        if (ui.chapterScope !== 'all' && chapterOf(i, chapters).id !== ui.chapterScope) continue;
        const text = plain(m.mes);
        const lower = text.toLowerCase();
        const idx = lower.indexOf(q);
        if (idx === -1) continue;
        let hits = 0;
        for (let p = idx; p !== -1; p = lower.indexOf(q, p + q.length)) hits++;
        total += hits;
        if (hidden) hiddenHits++;
        if (out.length >= LIMIT) continue;
        const from = Math.max(0, idx - 40);
        const to = Math.min(text.length, idx + q.length + 60);
        const pre = (from > 0 ? '…' : '') + text.slice(from, idx);
        const hit = text.slice(idx, idx + q.length);
        const post = text.slice(idx + q.length, to) + (to < text.length ? '…' : '');
        out.push(`
        <div class="stbs-item stbs-result ${hidden ? 'is-hidden' : ''}" data-jump="${i}">
            <div class="stbs-grow">
                ${hidden ? '<span class="stbs-badge stbs-hid-badge"><i class="fa-solid fa-eye-slash"></i> 숨김</span>' : ''}
                <div class="stbs-snippet">${esc(pre)}<mark class="stbs-find">${esc(hit)}</mark>${esc(post)}</div>
                ${metaLine(i, `${chapters.length ? esc(chapterLabel(chapterOf(i, chapters))) : ''}${hits > 1 ? ` · ${hits}번` : ''}`)}
            </div>
        </div>`);
    }
    if (!out.length) {
        const tip = hs === 'hidden' ? '숨긴 메시지에는 없어요. 범위를 <b>숨김 포함</b>으로 바꿔 볼까요?'
            : hs === 'shown' ? '숨긴 메시지에 있을 수도 있어요. 범위를 <b>숨김 포함</b>으로 바꿔 볼까요?' : '다른 단어로 찾아볼까요?';
        return emptyState(`"${esc(ui.q)}" 결과가 없어요`, tip, false);
    }
    return `<div class="stbs-count">메시지 ${out.length}${out.length >= LIMIT ? '+' : ''}개${hs === 'all' && hiddenHits ? ` <span class="stbs-dim">(숨김 ${hiddenHits})</span>` : ''} · ${total}번 등장${out.length >= LIMIT ? ` <span class="stbs-dim">(처음 ${LIMIT}개만 표시)</span>` : ''}</div>` + out.join('');
}

function computeStats() {
    const chat = ctx().chat;
    const s = settings();
    const cpp = Math.max(100, Number(s.charsPerPage) || 600);
    const bySpeaker = new Map();
    const words = new Map();
    let chars = 0, count = 0, userChars = 0, longest = { i: -1, len: 0 };
    let first = null, last = null;
    chat.forEach((m, i) => {
        if (!m || m.is_system) return;
        const text = plain(m.mes);
        const len = text.length;
        count++;
        chars += len;
        if (m.is_user) userChars += len;
        const name = speaker(i) || (m.is_user ? '나' : '캐릭터');
        const sp = bySpeaker.get(name) || { name, chars: 0, msgs: 0, user: !!m.is_user };
        sp.chars += len; sp.msgs++;
        bySpeaker.set(name, sp);
        if (len > longest.len) longest = { i, len };
        const t = Date.parse(m.send_date);
        if (!isNaN(t)) { if (first === null || t < first) first = t; if (last === null || t > last) last = t; }
        for (const w of text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []) {
            if (STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
            words.set(w, (words.get(w) || 0) + 1);
        }
    });
    const topWords = [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const chapters = sortedChapters();
    const chapterBars = [];
    if (chapters.length) {
        const entries = (chapters[0].mesId > 0 ? [{ title: '프롤로그', mesId: 0 }] : []).concat(chapters.map((c, k) => ({ title: `${k + 1}장. ${c.title}`, mesId: c.mesId })));
        entries.forEach((e, k) => {
            const end = entries[k + 1]?.mesId ?? chat.length;
            let c = 0;
            for (let j = e.mesId; j < end; j++) if (chat[j] && !chat[j].is_system) c += plain(chat[j].mes).length;
            chapterBars.push({ title: e.title, pages: c / cpp, mesId: e.mesId });
        });
    }
    return { count, chars, pages: chars / cpp, userChars, speakers: [...bySpeaker.values()].sort((a, b) => b.chars - a.chars), topWords, chapterBars, longest, first, last };
}

function renderStats() {
    const st = computeStats();
    const d = data();
    const hl = d.notes.filter(n => n.color != null).length;
    const fmt = (n) => Math.round(n).toLocaleString();
    const days = st.first && st.last ? Math.max(1, Math.round((st.last - st.first) / 86400000) + 1) : null;
    const tile = (v, l) => `<div class="stbs-tile"><b>${v}</b><span>${l}</span></div>`;
    const userPct = st.chars ? Math.round(st.userChars / st.chars * 100) : 0;
    const maxSp = st.speakers[0]?.chars || 1;
    const maxPg = Math.max(...st.chapterBars.map(c => c.pages), 0.01);
    let html = `
        <div class="stbs-hero">
            <div class="stbs-hero-text">
                <span class="stbs-eyebrow">여우가 냠냠 먹어치운 분량</span>
                <div class="stbs-book-pages">${fmt(Math.max(1, st.pages))}<span class="stbs-unit">쪽</span></div>
                <span class="stbs-meta">1쪽 = ${settings().charsPerPage}자 기준</span>
                ${d.review?.rating ? `<span class="stbs-hero-stars" data-act="rate" data-target="book">${starsHtml(d.review.rating)} ${d.review.text ? `<em>“${esc(clip(d.review.text, 26))}”</em>` : ''}</span>` : ''}
            </div>
            <span class="stbs-avatar lg">${FOX_SVG}</span>
        </div>
        <div class="stbs-tiles">
            ${tile(fmt(st.count), '메시지')}
            ${tile(fmt(st.chars), '글자')}
            ${tile(days ? `${days}일` : '–', '함께한 기간')}
            ${tile(d.chapters.length, '챕터')}
            ${tile(d.bookmarks.length, '책갈피')}
            ${tile(`${hl}<span class="stbs-dim"> / ${d.notes.length - hl}</span>`, '형광펜 / 메모')}
        </div>
        <div class="stbs-section">대사 비율</div>
        <div class="stbs-ratio"><div style="width:${userPct}%"></div></div>
        <div class="stbs-row stbs-between stbs-meta"><span>나 ${userPct}%</span><span>캐릭터 ${100 - userPct}%</span></div>`;
    if (st.speakers.length > 2 || st.speakers.length && !st.speakers.some(s => s.user)) {
        html += `<div class="stbs-section">화자별 분량</div>` + st.speakers.slice(0, 8).map(sp => `
            <div class="stbs-bar-row"><span class="stbs-bar-label">${esc(clip(sp.name, 12))}</span>
            <div class="stbs-bar"><div style="width:${sp.chars / maxSp * 100}%"></div></div><span class="stbs-bar-val">${sp.msgs}</span></div>`).join('');
    }
    if (st.chapterBars.length) {
        html += `<div class="stbs-section">챕터별 분량 (쪽)</div>` + st.chapterBars.map(c => `
            <div class="stbs-bar-row stbs-click" data-jump="${c.mesId}"><span class="stbs-bar-label">${esc(clip(c.title, 12))}</span>
            <div class="stbs-bar"><div style="width:${c.pages / maxPg * 100}%"></div></div><span class="stbs-bar-val">${c.pages < 1 ? c.pages.toFixed(1) : Math.round(c.pages)}</span></div>`).join('');
    }
    if (st.topWords.length) {
        html += `<div class="stbs-section">자주 나온 단어</div><div class="stbs-row stbs-wrap">` +
            st.topWords.map(([w, n], k) => `<div class="stbs-chip stbs-word" data-act="search-word" data-w="${esc(w)}"><b>${k + 1}</b> ${esc(w)} <span class="stbs-dim">${n}</span></div>`).join('') + '</div>';
    }
    if (st.longest.i >= 0) {
        html += `<div class="stbs-section">가장 긴 메시지</div>
            <div class="stbs-item" data-jump="${st.longest.i}"><div class="stbs-grow">
                <div class="stbs-snippet">${esc(clip(plain(msg(st.longest.i)?.mes), 100))}</div>
                ${metaLine(st.longest.i, `${fmt(st.longest.len)}자`)}
            </div></div>`;
    }
    return html;
}

const runSearch = debounce(() => {
    const r = $id('stbs-results');
    if (r) r.innerHTML = searchResults();
}, 250);

function onPanelInput(e) {
    const t = e.target;
    if (t.id === 'stbs-q') { ui.q = t.value; runSearch(); }
    else if (t.id === 'stbs-scope' && e.type === 'change') { ui.scope = t.value; runSearch(); }
    else if (t.id === 'stbs-chscope' && e.type === 'change') { ui.chapterScope = t.value; runSearch(); }
    else if (t.id === 'stbs-hidscope' && e.type === 'change') { settings().searchHidden = t.value; saveSettings(); runSearch(); }
}

async function onPanelClick(e) {
    const tab = e.target.closest('[data-tab]');
    if (tab) { ui.tab = tab.dataset.tab; if (tab.dataset.tab !== 'notes') endSelecting(); renderPanel(); $id('stbs-body').scrollTop = 0; return; }
    // multi-select mode: tapping a note card toggles it
    if (ui.selecting && !e.target.closest('[data-act]')) {
        const card = e.target.closest('.stbs-note[data-note]');
        if (card) {
            const id = card.dataset.note;
            if (ui.selected.has(id)) ui.selected.delete(id); else ui.selected.add(id);
            renderPanel();
            return;
        }
    }
    const act = e.target.closest('[data-act]');
    if (act) {
        e.stopPropagation();
        const id = act.dataset.id;
        const d = data();
        switch (act.dataset.act) {
            case 'close': closePanel(); break;
            case 'export': openExport(); break;
            case 'trash': if (ui.tab !== 'trash') { ui.prevTab = ui.tab; ui.tab = 'trash'; endSelecting(); } else ui.tab = ui.prevTab || 'notes'; renderPanel(); $id('stbs-body').scrollTop = 0; break;
            case 'trash-back': ui.tab = ui.prevTab || 'notes'; renderPanel(); break;
            case 'trash-filter': ui.trashFilter = act.dataset.f; renderPanel(); break;
            case 'trash-restore': restoreTrash(id); break;
            case 'trash-erase': await eraseTrash(id); break;
            case 'trash-empty': await emptyTrash(); break;
            case 'trash-restore-all': restoreAllTrash(); break;
            case 'chapter-last': {
                const len = ctx().chat.length;
                if (len) await addChapter(len - 1);
                break;
            }
            case 'chapter-rename': await renameChapter(id); break;
            case 'chapter-del': await deleteChapter(id); break;
            case 'bm-rename': {
                const b = d.bookmarks.find(x => x.id === id);
                if (!b) break;
                const res = await ctx().Popup.show.input('🦊 책갈피 이름', '', b.label || '');
                if (res === null || res === false || res === undefined) break;
                b.label = String(res).trim();
                persist(); refreshPanel();
                break;
            }
            case 'bm-del': {
                const b = d.bookmarks.find(x => x.id === id);
                if (b) await toggleBookmark(b.mesId, false);
                break;
            }
            case 'note-filter': ui.noteFilter = act.dataset.f; renderPanel(); break;
            case 'note-sort': ui.noteSort = ui.noteSort === 'story' ? 'recent' : 'story'; renderPanel(); break;
            case 'note-edit': { const n = getNote(id); if (n) openMemoEditor({ note: n }); break; }
            case 'note-card': { const n = getNote(id); if (n) openCard({ note: n }); break; }
            case 'note-del': await deleteNote(id); break;
            case 'search-word': ui.q = act.dataset.w; ui.tab = 'search'; renderPanel(); break;
            case 'rate': openRatingEditor(act.dataset.target); break;
            case 'scrap-open': ui.scrap = id; endSelecting(); renderPanel(); $id('stbs-body').scrollTop = 0; break;
            case 'scrap-back': ui.scrap = null; renderPanel(); break;
            case 'scrap-new': openScrapEditor(); break;
            case 'scrap-rename': { const sb = getScrap(id); if (sb) openScrapEditor({ scrap: sb }); break; }
            case 'scrap-del': await deleteScrap(id); break;
            case 'scrap-card': { const sb = getScrap(id); if (sb) cardFromNotes(scrapNotes(sb)); break; }
            case 'scrap-remove': {
                const sb = getScrap(ui.scrap);
                if (sb) { sb.noteIds = sb.noteIds.filter(x => x !== id); sb.updated = Date.now(); persist(); renderPanel(); }
                break;
            }
            case 'sel-mode': if (ui.selecting) endSelecting(); else ui.selecting = true; renderPanel(); break;
            case 'sel-cancel': endSelecting(); renderPanel(); break;
            case 'sel-scrap': if (ui.selected.size) openScrapPicker([...ui.selected]); break;
            case 'sel-card': {
                if (!ui.selected.size) break;
                const order = new Map(d.notes.map((n, k) => [n.id, k]));
                const picked = d.notes.filter(n => ui.selected.has(n.id)).sort((a, b) => a.mesId - b.mesId || (a.start ?? -1) - (b.start ?? -1) || order.get(a.id) - order.get(b.id));
                cardFromNotes(picked);
                break;
            }
        }
        return;
    }
    const jump = e.target.closest('[data-jump]');
    if (jump) jumpTo(Number(jump.dataset.jump), jump.dataset.note || null);
}

// ---------------------------------------------------------------- export / import

function buildMarkdown() {
    const c = ctx();
    const d = data();
    const chapters = sortedChapters();
    const st = computeStats();
    const colors = settings().colors;
    const lines = [];
    const title = c.getCurrentChatId();
    lines.push(`# 📖 ${title}`, '');
    lines.push(`> ${c.groupId ? '그룹 채팅' : `캐릭터: ${c.name2}`} · 내보낸 날짜: ${fmtDate(Date.now())}`);
    lines.push(`> 메시지 ${st.count}개 · ${st.chars.toLocaleString()}자 · 약 ${Math.round(st.pages)}쪽 · 책갈피 ${d.bookmarks.length} · 노트 ${d.notes.length}`, '');
    const starTxt = (r) => '★'.repeat(r) + '☆'.repeat(5 - r);
    if (d.review?.rating || d.review?.text) {
        lines.push(`**별점** ${starTxt(Number(d.review.rating) || 0)}${d.review.text ? `  \n**한줄평** “${d.review.text}”` : ''}`, '');
    }

    if (chapters.length) {
        lines.push('## 목차', '');
        if (chapters[0].mesId > 0) lines.push(`- 프롤로그 (#0)`);
        chapters.forEach((ch, k) => lines.push(`${k + 1}. ${ch.title} (#${ch.mesId})${ch.rating ? ` ${starTxt(ch.rating)}` : ''}${ch.review ? ` — “${ch.review}”` : ''}`));
        lines.push('');
    }

    const section = (items, heading, render) => {
        if (!items.length) return;
        lines.push(`## ${heading}`, '');
        let last = null;
        for (const it of items) {
            const ch = chapterOf(it.mesId, chapters);
            if (chapters.length && ch.id !== last) { lines.push(`### ${chapterLabel(ch)}`, ''); last = ch.id; }
            render(it);
        }
    };

    section([...d.bookmarks].sort((a, b) => a.mesId - b.mesId), '🦊 책갈피', (b) => {
        const text = plain(msg(b.mesId)?.mes);
        lines.push(`- **${b.label || clip(text, 40)}** — ${speaker(b.mesId)} (#${b.mesId})`);
        if (b.label) lines.push(`  > ${clip(text, 200)}`);
    });
    if (d.bookmarks.length) lines.push('');

    section([...d.notes].sort((a, b) => a.mesId - b.mesId || (a.start ?? -1) - (b.start ?? -1)), '🖍️ 독서노트', (n) => {
        const q = n.start != null ? noteText(n) : `(메시지 전체) ${clip(plain(msg(n.mesId)?.mes), 200)}`;
        for (const l of q.split('\n')) lines.push(`> ${l}`);
        if (n.trans) { lines.push('>'); for (const l of n.trans.split('\n')) lines.push(l.trim() ? `> *${l.trim()}*` : '>'); }
        const tag = n.color != null ? `${COLOR_EMOJI[n.color]} ${COLOR_NAMES[n.color]}` : '📝 메모';
        lines.push('>', `> — ${speaker(n.mesId)} · #${n.mesId} · ${fmtDate(n.updated)} · ${tag}`, '');
        if (n.memo) { lines.push(...n.memo.split('\n').map(l => `📝 ${l}`), ''); }
        lines.push('---', '');
    });
    if (d.scrapbooks.length) {
        lines.push('## 📚 스크랩북', '');
        for (const sb of d.scrapbooks) {
            const ns = scrapNotes(sb);
            lines.push(`### ${sb.emoji || '📒'} ${sb.name} (${ns.length})`, '');
            for (const n of ns) {
                const q = n.start != null ? noteText(n) : clip(plain(msg(n.mesId)?.mes), 200);
                lines.push(...q.split('\n').map(l => `> ${l}`), `> — ${speaker(n.mesId)} · #${n.mesId}`, '');
                if (n.memo) lines.push(`📝 ${n.memo.replace(/\n/g, ' ')}`, '');
            }
        }
    }
    void colors;
    return lines.join('\n');
}

function openExport() {
    if (!hasChat()) return;
    const body = openModal('내보내기 · 불러오기', `
        <div class="stbs-muted">지금 열린 채팅의 기록만 대상이에요.</div>
        <div class="stbs-btn stbs-wide-btn" data-x="md"><i class="fa-solid fa-file-lines"></i> 마크다운(.md)으로 내보내기</div>
        <div class="stbs-muted">목차, 별점·한줄평, 책갈피, 형광펜, 메모, 스크랩북을 읽기 좋게 정리한 문서예요.</div>
        <div class="stbs-btn stbs-wide-btn" data-x="json"><i class="fa-solid fa-floppy-disk"></i> 백업 파일(.json) 저장</div>
        <div class="stbs-btn stbs-wide-btn" data-x="import"><i class="fa-solid fa-file-import"></i> 백업 불러오기</div>
        <div class="stbs-muted">불러오면 지금 데이터에 합쳐져요. (같은 항목은 건너뜀)</div>
        <input type="file" id="stbs-import-file" accept=".json,application/json" hidden>`);
    const name = safeFileName(ctx().getCurrentChatId());
    body.addEventListener('click', (e) => {
        const x = e.target.closest('[data-x]')?.dataset.x;
        if (x === 'md') download(`${name}_독서노트.md`, new Blob([buildMarkdown()], { type: 'text/markdown;charset=utf-8' }));
        if (x === 'json') {
            const payload = { format: 'st-bookshelf', version: 1, chat: ctx().getCurrentChatId(), exportedAt: new Date().toISOString(), data: data() };
            download(`${name}_책먹는여우백업.json`, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
        }
        if (x === 'import') body.querySelector('#stbs-import-file').click();
    });
    body.querySelector('#stbs-import-file').addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const json = JSON.parse(await file.text());
            if (json?.format !== 'st-bookshelf' || !json.data) throw new Error('format');
            const d = data();
            let added = 0;
            if (json.data.review && !(d.review.rating || d.review.text)) d.review = { ...json.data.review };
            for (const k of ['bookmarks', 'notes', 'chapters', 'scrapbooks', 'trash']) {
                const have = new Set(d[k].map(x => x.id));
                for (const item of json.data[k] || []) {
                    if (!item || have.has(item.id)) continue;
                    if (k === 'trash' ? !(item.item && TRASH_KIND[item.kind]) : k === 'scrapbooks' ? !Array.isArray(item.noteIds) : typeof item.mesId !== 'number') continue;
                    d[k].push(item);
                    added++;
                }
            }
            reconcile();
            persist();
            decorateAll();
            refreshPanel();
            closeModal();
            toastr.success(`${added}개 항목을 불러왔어요.`);
        } catch {
            toastr.error('책 먹는 여우 백업 파일이 아니에요.');
        }
    });
}

// ---------------------------------------------------------------- settings UI

function buildSettingsUI() {
    if ($id('stbs-settings')) return;
    const s = settings();
    const html = `
    <div id="stbs-settings" class="extension_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b class="stbs-set-title">${FOX_SVG} ${APP_NAME}</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label"><input type="checkbox" data-set="enabled"> <span>사용하기</span></label>
                <div class="menu_button stbs-wide-btn" id="stbs-open-from-settings"><i class="fa-solid fa-book-open"></i> 독서 패널 열기</div>
                <hr>
                <label class="checkbox_label"><input type="checkbox" data-set="showHighlights"> <span>채팅에 형광펜 보이기</span></label>
                <label class="checkbox_label"><input type="checkbox" data-set="showMemoUnderline"> <span>메모만 단 문장에 점선 밑줄</span></label>
                <label class="checkbox_label"><input type="checkbox" data-set="showChapters"> <span>채팅에 챕터 구분선 보이기</span></label>
                <label class="checkbox_label"><input type="checkbox" data-set="showRibbon"> <span>책갈피 꽂은 메시지에 리본 표시</span></label>
                <div class="stbs-set-row"><span>패널 테마</span>
                    <select class="text_pole stbs-select" data-set-theme>${Object.entries(PANEL_THEMES).map(([k, v]) => `<option value="${k}" ${s.theme === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
                </div>
                <div class="menu_button stbs-wide-btn" id="stbs-reset-pos"><i class="fa-solid fa-arrows-to-dot"></i> 패널 위치·크기 초기화</div>
                <div class="stbs-set-row"><span>형광펜 색상</span>
                    ${s.colors.map((c, k) => `<input type="color" data-color-set="${k}" value="${esc(c)}" title="${COLOR_NAMES[k]}">`).join('')}
                    <div class="menu_button stbs-mini" id="stbs-color-reset" title="기본 색으로">↺</div>
                </div>
                <div class="stbs-set-row"><span>1쪽 = </span><input type="number" class="text_pole stbs-num" data-set="charsPerPage" min="100" max="5000" step="50"><span>자</span></div>
                <div class="stbs-set-note">마법봉 메뉴 → <b>책 먹는 여우</b>로 패널을 열어요. 패널 윗부분을 끌어 옮기고, 오른쪽 아래 모서리로 크기를 바꿔요. 모바일에서는 손잡이를 위아래로 끌어요.<br><code>/bookfox</code> 패널 열기 · <code>/bm</code> 마지막 메시지에 책갈피</div>
            </div>
        </div>
    </div>`;
    const host = $id('extensions_settings2') || $id('extensions_settings');
    host?.insertAdjacentHTML('beforeend', html);
    const root = $id('stbs-settings');
    if (!root) return;
    root.querySelectorAll('[data-set]').forEach(inp => {
        const k = inp.dataset.set;
        if (inp.type === 'checkbox') inp.checked = !!s[k]; else inp.value = s[k];
        inp.addEventListener('change', () => {
            s[k] = inp.type === 'checkbox' ? inp.checked : Math.max(100, Number(inp.value) || DEFAULTS[k]);
            saveSettings();
            if (k === 'enabled' && !s.enabled) { closePanel(); hideSelPopup(); }
            decorateAll();
            refreshPanel();
        });
    });
    root.querySelectorAll('[data-color-set]').forEach(inp => {
        inp.addEventListener('input', () => {
            s.colors[Number(inp.dataset.colorSet)] = inp.value;
            applyColorVars();
            saveSettings();
        });
    });
    root.querySelector('#stbs-color-reset').addEventListener('click', () => {
        s.colors = [...DEFAULTS.colors];
        root.querySelectorAll('[data-color-set]').forEach((inp, k) => { inp.value = s.colors[k]; });
        applyColorVars();
        saveSettings();
    });
    root.querySelector('#stbs-open-from-settings').addEventListener('click', () => openPanel());
    root.querySelector('[data-set-theme]').addEventListener('change', (e) => {
        s.theme = e.target.value;
        saveSettings();
        applyThemeEverywhere();
    });
    root.querySelector('#stbs-reset-pos').addEventListener('click', () => {
        s.panel = null; s.sheetH = DEFAULTS.sheetH;
        saveSettings();
        applyGeometry();
        toastr.success('위치를 처음대로 돌렸어요.');
    });
}

function buildWandItem() {
    const menu = $id('extensionsMenu');
    if (!menu || $id('stbs-wand')) return;
    const item = document.createElement('div');
    item.id = 'stbs-wand';
    item.className = 'list-group-item flex-container flexGap5 interactable';
    item.tabIndex = 0;
    item.innerHTML = `<div class="extensionsMenuExtensionButton stbs-wand-fox">${FOX_SVG}</div><span>${APP_NAME}</span>`;
    item.addEventListener('click', () => openPanel());
    menu.appendChild(item);
}

// ---------------------------------------------------------------- slash commands

function registerCommands() {
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = ctx();
    if (!SlashCommandParser || !SlashCommand) return;
    try {
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'bookfox',
            aliases: ['bookshelf'],
            callback: (_args, value) => { openPanel(String(value ?? '').trim() || undefined); return ''; },
            returns: 'nothing',
            unnamedArgumentList: [SlashCommandArgument.fromProps({
                description: 'tab: toc | bookmarks | notes | search | stats | trash',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumList: [...TABS.map(t => t[0]), 'trash'],
            })],
            helpString: '<div>책 먹는 여우 독서 패널을 엽니다. 예: <code>/bookfox notes</code></div>',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'bm',
            callback: async (_args, value) => {
                const len = ctx().chat?.length ?? 0;
                if (!len) return '';
                const i = len - 1;
                if (bookmarkAt(i)) { await toggleBookmark(i, false); return ''; }
                data().bookmarks.push({ id: uid(), mesId: i, label: String(value ?? '').trim(), created: Date.now(), sig: sigAt(i) });
                persist(); decorateMessage(i); refreshPanel();
                toastr.success('🦊 책갈피를 꽂았어요.');
                return '';
            },
            returns: 'nothing',
            unnamedArgumentList: [SlashCommandArgument.fromProps({ description: '책갈피 이름 (선택)', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
            helpString: '<div>마지막 메시지에 책갈피를 꽂습니다(다시 쓰면 뺍니다). 예: <code>/bm 고백 장면</code></div>',
        }));
    } catch (err) {
        console.warn('[BookFox] slash command registration failed', err);
    }
}

// ---------------------------------------------------------------- wiring

function onChatChanged() {
    hideSelPopup();
    closeModal();
    staleNotes.clear();
    ui.q = ''; ui.chapterScope = 'all'; ui.noteFilter = 'all'; ui.scrap = null; endSelecting();
    reconcile();
    setTimeout(decorateAll, 50);
    refreshPanel();
}

function bindGlobal() {
    const { eventSource, event_types: E } = ctx();
    eventSource.on(E.CHAT_CHANGED, onChatChanged);
    const one = (id) => { const i = Number(id); if (!isNaN(i)) { decorateMessage(i); if (data().chapters.some(c => c.mesId === i)) decorateChapters(); } };
    eventSource.on(E.CHARACTER_MESSAGE_RENDERED, one);
    eventSource.on(E.USER_MESSAGE_RENDERED, one);
    if (E.MESSAGE_UPDATED) eventSource.on(E.MESSAGE_UPDATED, one);
    eventSource.on(E.MESSAGE_SWIPED, (id) => setTimeout(() => one(id), 0));
    eventSource.on(E.MESSAGE_EDITED, (id) => {
        const i = Number(id);
        if (!hasChat() || isNaN(i)) return;
        const d = data();
        const sig = sigAt(i);
        for (const item of [...d.bookmarks, ...d.chapters, ...d.notes]) if (item.mesId === i) item.sig = sig;
        persist();
        refreshPanel();
    });
    eventSource.on(E.MESSAGE_DELETED, () => { reconcile(); setTimeout(decorateAll, 30); refreshPanel(); });
    if (E.MORE_MESSAGES_LOADED) eventSource.on(E.MORE_MESSAGES_LOADED, () => decorateAll());

    // message buttons (delegated)
    $(document).on('click', '.stbs-mes-btn', function (e) {
        e.stopPropagation();
        if (!settings().enabled) { toastr.info(`${APP_NAME} 확장이 꺼져 있어요.`); return; }
        if (!hasChat()) { toastr.info('채팅을 먼저 열어 주세요.'); return; }
        const i = Number($(this).closest('.mes').attr('mesid'));
        if (isNaN(i)) return;
        const act = this.dataset.stbs;
        closeMesMenu(this);
        if (act === 'bookmark') toggleBookmark(i);
        else if (act === 'chapter') addChapter(i);
        else if (act === 'memo') openMemoEditor({ mesId: i });
        else if (act === 'card') openCard({ mesId: i });
    });

    // chapter divider click -> TOC
    $(document).on('click', '#chat .stbs-chapter-div', () => openPanel('toc'));

    // highlight click -> note popup
    $(document).on('click', '#chat mark.stbs-hl', function (e) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) return;
        e.stopPropagation();
        showNotePopup(this.dataset.note, this.getBoundingClientRect());
    });

    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('pointerdown', (e) => {
        if (!e.target.closest?.('#stbs-sel-pop')) hideSelPopup();
    }, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideSelPopup();
            // Close only our top-most window; stop the browser from also closing the panel window underneath.
            if ($id('stbs-modal')) { e.preventDefault(); e.stopPropagation(); closeModal(); }
        }
    });
    $id('chat')?.addEventListener('scroll', repositionPopup, { passive: true });
}

function injectTemplateButtons() {
    const tpl = document.querySelector('#message_template .mes');
    if (tpl) ensureMesButtons(tpl);
    document.querySelectorAll('#chat .mes').forEach(ensureMesButtons);
}

(function init() {
    const s0 = settings();
    if (!s0.v12) { s0.theme = 'auto'; s0.cardTheme = s0.cardTheme === 'paper' ? 'fox' : s0.cardTheme; s0.v12 = true; delete s0.showFab; delete s0.showSendButton; delete s0.fab; saveSettings(); }
    applyColorVars();
    injectTemplateButtons();
    bindGlobal();
    registerCommands();
    const { eventSource, event_types } = ctx();
    eventSource.on(event_types.APP_READY, () => {
        buildSettingsUI();
        buildWandItem();
        document.getElementById('stbs-font')?.remove();
        document.getElementById('stbs-font-sans')?.remove();
        $id('stbs-send-btn')?.remove();
        $id('stbs-fab')?.remove();
        injectTemplateButtons();
        reconcile();
        decorateAll();
    });
    console.log('[BookFox] loaded');
})();
