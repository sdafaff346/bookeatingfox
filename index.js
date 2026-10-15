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
    cardLayout: null,     // card design (see CARD_LAYOUTS); null = take over the old cardTheme
    cardTints: {},
    cardRatio: '4:5',
    cardShow: null,
    cardFox: true,
    cardTransFirst: false,
    searchHidden: 'all',
    dailyLine: true,      // today's line at the top of the panel
    dailyHidden: {},      // chat id → day it was dismissed
    bmSort: 'story',      // bookmarks: 'story' | 'mine'
    summaryTint: 0,
    farReader: true,          // far-away (not yet drawn) messages open in a reading window first      // search: 'all' (hidden + shown) | 'shown' | 'hidden'
    panel: null,
    sheetH: 0.62,
});

// Original fox mascot (inline SVG, no external assets)
// Mascot: 책을 문 여우 (original art)
const FOX_SVG = `<svg class="stbs-fox" viewBox="0 0 64 64" aria-hidden="true"><path d="M9.8 7.2 Q10 3.8 13.2 5.3 L28.2 18.5 L11.4 28.2 Z" fill="#ec8a52"/><path d="M54.2 7.2 Q54 3.8 50.8 5.3 L35.8 18.5 L52.6 28.2 Z" fill="#ec8a52"/><path d="M13.1 11.6 Q13.2 9.4 15.1 10.4 L23.2 18.6 L14.5 23.7 Z" fill="#fbd9c6"/><path d="M50.9 11.6 Q50.8 9.4 48.9 10.4 L40.8 18.6 L49.5 23.7 Z" fill="#fbd9c6"/><path d="M6.8 29.5 C8.4 13.2 55.6 13.2 57.2 29.5 C58 38.5 49.5 45.8 35 52.4 Q32 54 29 52.4 C14.5 45.8 6 38.5 6.8 29.5 Z" fill="#ec8a52"/><path d="M8 32.2 C15.2 36.5 24.6 37.3 32 49 C39.4 37.3 48.8 36.5 56 32.2 C54.4 41.4 46.2 47.8 35 52.4 Q32 54 29 52.4 C17.8 47.8 9.6 41.4 8 32.2 Z" fill="#fff7ee"/><path d="M20 32.9 Q23.3 29 26.6 32.9" stroke="#3a2a22" stroke-width="2.45" fill="none" stroke-linecap="round"/><path d="M37.400000000000006 32.9 Q40.7 29 44 32.9" stroke="#3a2a22" stroke-width="2.45" fill="none" stroke-linecap="round"/><path d="M29.8 43.6 Q32 42.300000000000004 34.2 43.6 Q33.5 45.800000000000004 32 46.2 Q30.5 45.800000000000004 29.8 43.6 Z" fill="#3a2a22"/><g transform="translate(32 55.4) scale(0.94) translate(-32 -55) rotate(-6 32 55)"><path d="M19 50.5 Q25.5 48.5 32 51 Q38.5 48.5 45 50.5 L45 60 Q38.5 58 32 60.5 Q25.5 58 19 60 Z" fill="#8fb3a6"/><path d="M20.8 51.6 Q26 50.2 31.2 52.2 L31.2 58.6 Q26 57 20.8 58.3 Z" fill="#fffdf8"/><path d="M43.2 51.6 Q38 50.2 32.8 52.2 L32.8 58.6 Q38 57 43.2 58.3 Z" fill="#fffdf8"/></g></svg>`;

const APP_NAME = '책 먹는 여우';
const VERSION = '1.15.0';
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

// Card designs: each is a layout (how the page is built) with a few colour sets (tints).
const CARD_COMMU = {
    light: { name: '밝게', commu: true, bg: ['#eef0f3', '#ffffff'], fg: '#1f2329', sub: '#7b828c', accent: '#ff6b3d', card: '#ffffff', line: '#e4e7eb', box: '#f5f6f8', best: '#fff0e8', up: '#ff6b3d', soft: '#ffe3d6' },
    dark: { name: '어둡게', commu: true, bg: ['#15171b', '#2a2e35'], fg: '#eceef1', sub: '#8d949e', accent: '#ff8a5c', card: '#1f2228', line: '#30343c', box: '#272b32', best: '#3a2a23', up: '#ff8a5c', soft: '#4a3128' },
};
const CARD_LAYOUTS = {
    underline: { name: '밑줄', tints: [
        { name: '하양', bg: '#fbfaf7', fg: '#26231f', sub: '#857e74', cover: '#e9e4da' },
        { name: '모래', bg: '#ece5d8', fg: '#2b2620', sub: '#7f7465', cover: '#dcd2c0' },
        { name: '밤', bg: '#1f1e23', fg: '#efede9', sub: '#9c99a3', cover: '#2e2d33', dark: true },
    ] },
    page: { name: '책 한 쪽', tints: [
        { name: '미색', bg: '#f4eee1', fg: '#2f2a22', sub: '#968b77' },
        { name: '하양', bg: '#fbfbf8', fg: '#2a2a28', sub: '#979792' },
        { name: '밤', bg: '#24221f', fg: '#e8e1d3', sub: '#8f877a', dark: true },
    ] },
    subtitle: { name: '자막', tints: [
        { name: '검정', veil: '0,0,0', fg: '#ffffff', tr: '#f2d479', sub: '#c9c9c9' },
        { name: '남색', veil: '10,16,38', fg: '#ffffff', tr: '#a9c4ff', sub: '#b9c2d8' },
        { name: '세피아', veil: '38,22,8', fg: '#fff8ee', tr: '#f6c48f', sub: '#d8c4ad' },
    ] },
    chat: { name: '말풍선', tints: [
        { name: '하늘', bg: '#d6e2ec', bubble: '#ffffff', fg: '#1f2328', sub: '#5f6b77', pill: 'rgba(31,35,40,.09)', tr: '#f3f6f9' },
        { name: '복숭아', bg: '#f5ded2', bubble: '#ffffff', fg: '#2a1f1a', sub: '#7d6559', pill: 'rgba(42,31,26,.09)', tr: '#fbf3ee' },
        { name: '밤', bg: '#1b1e23', bubble: '#2d3239', fg: '#eceef1', sub: '#8d949e', pill: 'rgba(255,255,255,.09)', tr: '#252a30', dark: true },
    ] },
    poster: { name: '포스터', tints: [
        { name: '여우', bg: '#e8743b', fg: '#2a1408', sub: '#5e2a10', mark: '#fff1e4' },
        { name: '숲', bg: '#26332a', fg: '#eef0e6', sub: '#a9b8a2', mark: '#e8913f' },
        { name: '밤하늘', bg: '#1b2140', fg: '#eef0ff', sub: '#9aa3d4', mark: '#f2cf6c' },
        { name: '먹', bg: '#161616', fg: '#f4f4f4', sub: '#9a9a9a', mark: '#e5533d' },
        { name: '장미', bg: '#f4cbd3', fg: '#4b1f2a', sub: '#8c4e61', mark: '#c94a68' },
        { name: '민트', bg: '#cfeee2', fg: '#16392f', sub: '#4a7d6f', mark: '#2b9a77' },
    ] },
    commu: { name: '커뮤 반응', tints: [CARD_COMMU.light, CARD_COMMU.dark] },
};
// cards made before v1.14 remember an old theme name
const OLD_CARD_THEMES = { fox: ['poster', 0], forest: ['poster', 1], night: ['poster', 2], ink: ['poster', 3], rose: ['poster', 4], mint: ['poster', 5], paper: ['page', 0], commu: ['commu', 0], commuDark: ['commu', 1] };
const CARD_RATIOS = { '4:5': 1350, '1:1': 1080, '9:16': 1920 };

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
/** Quick Reply / slash-command output: /comment (e.g. QR analysis results) and /sys narrator messages. */
const QR_TYPES = new Set(['comment', 'narrator']);
const isQrMes = (m) => QR_TYPES.has(m?.extra?.type);
/** SillyTavern's own system notices (help, welcome, tool calls…) — never searched. */
const isRealSystem = (m) => !!m?.is_system && !isHiddenMes(m) && !isQrMes(m);

/** Message source → searchable text: no <style>/<script> code, folded <details> bodies included. */
function searchText(src) {
    return plain(String(src ?? '').replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, ' ')).replace(/(^|\s)#{1,6}\s+/g, '$1');
}
/** Text that sits inside folded <details> (summary excluded), for the "접힌 내용" badge. */
function foldedText(src) {
    const out = [];
    String(src ?? '').replace(/<details\b[^>]*>([\s\S]*?)<\/details>/gi, (_, body) => { out.push(body.replace(/<summary\b[\s\S]*?<\/summary>/i, ' ')); return ''; });
    return out.length ? searchText(out.join(' ')).toLowerCase() : '';
}
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
    // Only messages that have (or had) highlights need the full text pass; the rest just get their
    // buttons and ribbon. Loading hundreds of old messages at once stays light.
    const s = settings();
    const on = s.enabled && hasChat();
    const withNotes = new Set(on ? data().notes.filter(n => n.start != null).map(n => n.mesId) : []);
    const marked = new Set(on ? data().bookmarks.map(b => b.mesId) : []);
    document.querySelectorAll('#chat .mes[mesid]').forEach(el => {
        const i = Number(el.getAttribute('mesid'));
        if (withNotes.has(i) || el.querySelector('mark.stbs-hl')) { decorateMessage(i); return; }
        ensureMesButtons(el);
        el.classList.toggle('stbs-bm', on && s.showRibbon && marked.has(i));
    });
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
let stScript = null;
import('../../../../script.js').then(m => { stScript = m; showMoreFn = m.showMoreMessages ?? null; }).catch(() => { });

/**
 * Make sure message i is drawn. Loads all older messages in one go, but never waits for other
 * extensions: SillyTavern only finishes "show more" after every MORE_MESSAGES_LOADED listener is done,
 * and one slow (or stuck) listener would freeze the jump forever. So we start the load and simply
 * watch for the element to appear, with a hard time limit.
 */
async function ensureRendered(i, { timeout = 60000 } = {}) {
    const sel = () => document.querySelector(`#chat .mes[mesid="${i}"]`);
    if (sel()) return sel();
    const t0 = Date.now();
    const waitFor = async (until) => {
        while (Date.now() < until) {
            const el = sel();
            if (el) return el;
            await sleep(150);
        }
        return sel();
    };
    const first = Number(document.querySelector('#chat .mes[mesid]')?.getAttribute('mesid'));
    if (showMoreFn && Number.isFinite(first) && first > i) {
        await nextFrame();
        let settled = false;
        Promise.resolve().then(() => showMoreFn(first - i + 3)).catch(() => { }).finally(() => { settled = true; });
        // the messages are inserted synchronously at the start of showMoreMessages; listeners run after
        const el = await (async () => {
            while (Date.now() - t0 < timeout) {
                const found = sel();
                if (found) return found;
                if (settled) return null; // finished without drawing it → fall back below
                await sleep(150);
            }
            return null;
        })();
        if (el) return el;
    }
    // fallback: press "Show more" step by step
    while (Date.now() - t0 < timeout) {
        const el = sel();
        if (el) return el;
        const btn = document.getElementById('show_more_messages');
        if (!btn) return null;
        btn.click();
        const got = await waitFor(Date.now() + 1500);
        if (got) return got;
    }
    return null;
}

const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

let releaseHold = null;
let releaseGuard = null;

/** Last jump, step by step — shown by `/bookfox debug` so a failing jump on someone's own setup can be explained. */
let jumpLog = null;
function logStep(msg) {
    if (!jumpLog) return;
    jumpLog.steps.push(`${String(Date.now() - jumpLog.t0).padStart(6)}ms ${msg}`);
    if (jumpLog.steps.length > 80) jumpLog.steps.splice(40, 1);
}
/** Which code (outside this extension) tried to scroll the chat. */
function callerHint() {
    const lines = String(new Error().stack || '').split('\n').slice(2);
    const skip = /SillyTavern-BookFox|stbs|jquery/i;
    const hit = lines.find(l => /https?:|\.js/.test(l) && !skip.test(l)) || lines.find(l => /https?:|\.js/.test(l)) || '';
    return hit.trim().replace(/^at\s+/, '').replace(/https?:\/\/[^/]+\//, '').slice(0, 120);
}

/**
 * The element to show for a jump, looked up fresh every time: other extensions (Tavern Helper…) may
 * re-render a message after it appears, replacing its contents with a new, closed <details>.
 */
/** Has a box on screen (not display:none, not inside something hidden — e.g. the text Tavern Helper hides
 *  when it draws the whole message as a frontend, or a code block it replaced with a frame). */
function isDrawn(n) {
    if (!n?.isConnected) return false;
    if (typeof n.checkVisibility === 'function' && !n.checkVisibility()) return false;
    const r = n.getBoundingClientRect();
    return n.getClientRects().length > 0 && (r.width > 0 || r.height > 0);
}
/** The nearest element (from n up to the message) that is actually drawn. */
function drawnIn(n, el) {
    for (let x = n; x && x !== el && el.contains(x); x = x.parentElement) if (isDrawn(x)) return x;
    return el;
}

function jumpTarget(i, noteId, q) {
    const el = document.querySelector(`#chat .mes[mesid="${i}"]`);
    if (!el) return null;
    if (noteId) { const mk = el.querySelector(`mark[data-note="${noteId}"]`); return mk ? drawnIn(mk, el) : el; }
    if (!q) return el;
    // search hit inside a folded <details> (QR answers, collapsible replies) → unfold just that one
    const folds = [...el.querySelectorAll('.mes_text details')].filter(d => d.textContent.toLowerCase().includes(q));
    const inner = folds.find(d => !folds.some(o => o !== d && d.contains(o)));
    if (!inner) return el;
    for (let d = inner; d && el.contains(d); d = d.parentElement?.closest('details')) if (!d.open) d.open = true;
    return drawnIn(inner, el);
}

/** The element that actually scrolls the chat (normally #chat; some themes scroll a parent instead). */
function chatScroller(target) {
    const chat = $id('chat');
    const scrolls = (n) => { const o = getComputedStyle(n).overflowY; return (o === 'auto' || o === 'scroll' || o === 'overlay') && n.scrollHeight > n.clientHeight + 4; };
    if (chat && scrolls(chat)) return chat;
    for (let n = (target || chat)?.parentElement; n && n !== document.body; n = n.parentElement) if (scrolls(n)) return n;
    return document.scrollingElement || document.documentElement;
}

const NATIVE_SCROLL_TOP = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');

/**
 * While we are bringing a message into view, the chat's scroll position belongs to us: other code
 * (SillyTavern's "scroll to bottom", theme or Tavern Helper scripts, frontends inside messages…) that
 * tries to move it is ignored. Only the user's own wheel / touch / keys (and new messages) end this.
 * Returns { get, set } that bypass the block, for our own scrolling.
 */
function guardScroller(sc) {
    releaseGuard?.();
    const get = () => NATIVE_SCROLL_TOP.get.call(sc);
    let expect = get();
    const set = (v) => { NATIVE_SCROLL_TOP.set.call(sc, v); expect = get(); };
    const note = (how) => {
        if (!jumpLog) return;
        jumpLog.blocked++;
        if (jumpLog.who.length < 15) jumpLog.who.push(how);
    };
    const block = (how) => () => note(`${how} ← ${callerHint()}`);
    try {
        Object.defineProperty(sc, 'scrollTop', { configurable: true, get, set: block('scrollTop') });
        for (const m of ['scrollTo', 'scroll', 'scrollBy']) Object.defineProperty(sc, m, { configurable: true, writable: true, value: block(m) });
    } catch { /* ignore */ }
    const nativeSiv = Element.prototype.scrollIntoView;
    const blockSiv = block('scrollIntoView');
    const patchedSiv = function (...a) { if (sc.contains(this) && this !== sc) { blockSiv(); return; } return nativeSiv.apply(this, a); };
    Element.prototype.scrollIntoView = patchedSiv;

    // The user's own hand, anywhere in the chat — including inside frontend frames (their events never
    // bubble out of the iframe, so each frame's document is listened to separately).
    const USER_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const hooked = new Map(); // frame window → document
    const hookFrames = () => {
        for (const f of sc.querySelectorAll('iframe')) {
            let w, d;
            try { w = f.contentWindow; d = f.contentDocument; } catch { continue; }
            if (!w || !d || hooked.get(w) === d) continue;
            hooked.set(w, d);
            for (const ev of USER_EVENTS) d.addEventListener(ev, onUser, { capture: true, passive: true });
        }
    };

    // Anything else that still moves the chat natively (focus() on an input in a frontend, a frame's
    // scrollIntoView, the browser restoring focus when a window closes…) is put right back. A long run
    // of such moves means a hand we can't see (e.g. a video embed from another site) → let go.
    let odd = [];
    // A touch / wheel / key only counts as "the user took over" if the chat then really moves — a stray
    // event (a tap on a message, a synthetic event from another extension) must not make us let go.
    let userUntil = 0, userLogged = false;
    const userActive = () => performance.now() < userUntil;
    const onScroll = () => {
        const cur = get();
        if (Math.abs(cur - expect) <= 2) return;
        if (userActive()) { expect = cur; releaseHold?.('user scroll'); release('user scroll'); return; }
        const maxTop = sc.scrollHeight - sc.clientHeight;
        if (cur < expect && cur >= maxTop - 2) { expect = cur; return; } // content below shrank
        const now = performance.now();
        odd = odd.filter(t => now - t < 800); odd.push(now);
        if (odd.length > 6) { releaseHold?.('user (unseen)'); release('user (unseen)'); return; }
        const ae = document.activeElement;
        note(`native scroll ${Math.round(cur - expect)}px (focus: ${ae ? ae.tagName.toLowerCase() + (ae.id ? '#' + ae.id : '') : '-'})`);
        NATIVE_SCROLL_TOP.set.call(sc, expect);
    };
    sc.addEventListener('scroll', onScroll, { passive: true });

    let done = false;
    const release = (why = '') => {
        if (done) return;
        done = true;
        for (const m of ['scrollTop', 'scrollTo', 'scroll', 'scrollBy']) { try { delete sc[m]; } catch { /* ignore */ } }
        if (Element.prototype.scrollIntoView === patchedSiv) Element.prototype.scrollIntoView = nativeSiv;
        sc.removeEventListener('scroll', onScroll);
        for (const ev of ['wheel', 'touchstart', 'pointerdown']) sc.removeEventListener(ev, onUser);
        window.removeEventListener('keydown', onKey, true);
        for (const d of hooked.values()) for (const ev of USER_EVENTS) { try { d.removeEventListener(ev, onUser, true); } catch { /* frame gone */ } }
        hooked.clear();
        clearTimeout(timer); clearInterval(frameTimer);
        if (releaseGuard === release) releaseGuard = null;
        logStep(`scroll guard released${why ? ` (${why})` : ''}`);
    };
    const onUser = () => {
        userUntil = performance.now() + 1500;
        if (!userLogged) { userLogged = true; logStep('your hand on the chat — letting go as soon as it moves'); }
    };
    const onKey = (e) => { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) onUser(); };
    for (const ev of ['wheel', 'touchstart', 'pointerdown']) sc.addEventListener(ev, onUser, { passive: true });
    window.addEventListener('keydown', onKey, true);
    hookFrames();
    const frameTimer = setInterval(hookFrames, 400); // frames load lazily as they come into view
    let timer = setTimeout(() => { releaseHold?.('timeout'); release('timeout'); }, 60000);
    const extend = (ms) => { clearTimeout(timer); timer = setTimeout(() => { releaseHold?.('timeout'); release('timeout'); }, ms); };
    releaseGuard = release;
    return { sc, get, set, release, userActive, extend };
}

/**
 * Bring the target into view, then keep it there until the chat has been calm for a while.
 * Old messages that were just loaded keep changing for seconds (frontend iframes resizing, other
 * extensions re-rendering…), which would otherwise pull the view away. If the message disappears
 * (another extension unloading old messages), it is loaded again.
 */
function scrollAndHold(resolve, { reload, guard = null, quiet = 3000, max = 60000 } = {}) {
    releaseHold?.('new jump');
    let target = resolve();
    if (!target) { guard?.release('no target'); return; }
    const sc = chatScroller(target);
    const isDoc = sc === document.scrollingElement || sc === document.documentElement;
    const io = guard && guard.sc === sc && releaseGuard === guard.release ? guard : (guard?.release('other scroller'), guardScroller(sc));
    io.extend(max + 500);
    const top0 = () => isDoc ? 0 : sc.getBoundingClientRect().top;
    const viewH = () => isDoc ? window.innerHeight : sc.clientHeight;
    const offset = (t) => t.getBoundingClientRect().top - top0();
    const anchorFor = (t) => { const h = t.getBoundingClientRect().height, H = viewH(); return h > H * 0.6 ? H * 0.12 : Math.max(8, (H - h) / 2); };
    let anchor = anchorFor(target);
    const prevAnchor = sc.style.overflowAnchor;
    sc.style.overflowAnchor = 'none';
    const prevBehavior = sc.style.scrollBehavior;
    sc.style.scrollBehavior = 'auto'; // a theme's smooth scrolling would turn every correction into a slow glide
    io.set(io.get() + offset(target) - anchor);

    if (jumpLog) jumpLog.scroller = isDoc ? 'document' : (sc.id ? `#${sc.id}` : sc.className.toString().slice(0, 40));
    logStep(`scrolled, target at ${Math.round(offset(target))}px (want ${Math.round(anchor)})`);
    const t0 = Date.now();
    let lastChange = t0, lastHeight = sc.scrollHeight, done = false, raf = 0, lastCheck = 0, corrections = 0, reloads = 0, reloading = false, calm = false;
    const stop = (why) => {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        sc.style.overflowAnchor = prevAnchor;
        sc.style.scrollBehavior = prevBehavior;
        if (releaseHold === stop) releaseHold = null;
        if (jumpLog) {
            const t = resolve();
            const y = t ? Math.round(offset(t)) : null;
            jumpLog.end = why; jumpLog.corrections = corrections;
            jumpLog.final = t ? { y, visible: y > -t.getBoundingClientRect().height && y < viewH() } : 'target gone';
        }
        logStep(`hold ended (${why}), ${corrections} corrections`);
    };
    const tick = () => {
        if (done) return;
        const now = Date.now();
        // busy at first (every 90ms); once calm, a cheap check four times a second until the user takes over
        if (now - lastCheck < (calm ? 250 : 90)) { raf = requestAnimationFrame(tick); return; }
        lastCheck = now;
        if (now - t0 > max) { stop('max time'); releaseGuard?.('max time'); return; }
        if (!calm && now - lastChange > quiet && now - t0 > 1500) { calm = true; logStep('calm — keeping an eye on it until you scroll'); if (jumpLog) jumpLog.final = { y: Math.round(offset(target || resolve() || sc)), calm: true }; }
        // look the target up again every time: a re-rendered message is a new element, and its folded
        // answer is closed again (resolve() re-opens it)
        const fresh = resolve();
        if (fresh !== target) {
            target = fresh;
            lastChange = now;
            if (target) { anchor = anchorFor(target); logStep('target re-rendered, found again'); }
            else if (reload && !reloading && reloads < 3) {
                reloading = true; reloads++;
                logStep('target was removed from the chat → loading it again');
                reload().then(() => { reloading = false; target = resolve(); lastChange = Date.now(); if (target) anchor = anchorFor(target); });
            }
        }
        if (target && !io.userActive() && isDrawn(target)) {
            const drift = offset(target) - anchor;
            if (Math.abs(drift) > 4) { io.set(io.get() + drift); lastChange = now; corrections++; if (calm) logStep(`moved while calm (${Math.round(drift)}px) → put back`); if (corrections <= 6 || corrections % 20 === 0) logStep(`corrected drift ${Math.round(drift)}px`); }
        }
        if (sc.scrollHeight !== lastHeight) { lastHeight = sc.scrollHeight; lastChange = now; }
        raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    releaseHold = stop;
}

let jumpBusy = false;

/** How many not-yet-drawn messages lie between the chat's first drawn message and i (0 = already drawn). */
function missingBefore(i) {
    if (document.querySelector(`#chat .mes[mesid="${i}"]`)) return 0;
    const first = Number(document.querySelector('#chat .mes[mesid]')?.getAttribute('mesid'));
    return Number.isFinite(first) && first > i ? first - i : 0;
}

/** Id of the message at the top of the chat view right now. */
function viewMesId() {
    const chat = $id('chat');
    if (!chat) return null;
    const top = chat.getBoundingClientRect().top;
    const list = chat.querySelectorAll('.mes[mesid]');
    // binary search: messages are in order
    let lo = 0, hi = list.length - 1, found = null;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (list[mid].getBoundingClientRect().bottom > top + 1) { found = list[mid]; hi = mid - 1; } else lo = mid + 1;
    }
    return found ? Number(found.getAttribute('mesid')) : null;
}

/** Far enough from what is on screen that the reading window is the better first step. */
function isFar(i) {
    if (missingBefore(i) >= READER_MIN_MISSING) return true;
    const v = viewMesId();
    return v !== null && Math.abs(v - i) >= READER_MIN_MISSING;
}

async function jumpTo(i, noteId = null, query = '') {
    if (jumpBusy) { toastr.info('🦊 아직 앞쪽 페이지를 넘기는 중이에요. 조금만 기다려 주세요.', '', { timeOut: 2000, preventDuplicates: true }); return; }
    releaseHold?.('new jump');
    releaseGuard?.('new jump');
    const missing = missingBefore(i);
    jumpLog = { v: VERSION, t0: Date.now(), at: new Date().toISOString(), target: i, missing, view: viewMesId(), rendered: document.querySelectorAll('#chat .mes').length, chatLen: ctx().chat?.length, mobile: isMobile(), ua: navigator.userAgent.slice(0, 120), steps: [], blocked: 0, who: [] };
    let busyToast = null;
    if (missing > 120) busyToast = toastr.info(`메시지 ${missing}개를 불러와서 그 위치로 가는 중이에요. 화면이 잠깐 멈춰도 기다려 주세요.`, '🦊 앞쪽 페이지를 넘기는 중…', { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false });
    jumpBusy = true;
    // From here on the chat's scroll position is ours: closing the panel / reading window, the phone
    // keyboard going away, SillyTavern's own fixes on resize — nothing can move it back while we go.
    // (Not while old messages are loading: the browser keeps the view steady over the inserted messages
    // by itself then, and undoing that would make hundreds of frames start loading on screen.)
    const guard = missing ? null : guardScroller(chatScroller(null));
    // phone: close the panel first so the chat (and the notice) is what you see while it loads
    if (isMobile() && panelOpen()) closePanel();
    if (busyToast) await sleep(80); // let the notice paint before the heavy loading freezes the screen
    let el;
    try { el = await ensureRendered(i); } catch (err) { el = null; logStep(`load error: ${err?.message || err}`); } finally { jumpBusy = false; if (busyToast) toastr.clear(busyToast); }
    logStep(el ? `message drawn (${document.querySelectorAll('#chat .mes').length} on screen)` : 'message could not be drawn');
    if (!el) {
        jumpLog.end = 'not drawn';
        guard?.release('not drawn');
        toastr.warning('옛날 메시지를 끝까지 불러오지 못했어요. 눌러서 미리 읽기 창으로 볼 수 있어요.', '', { timeOut: 7000, onclick: () => openReader(i, { noteId, query }) });
        return;
    }
    decorateMessage(i);
    const q = String(query || '').trim().toLowerCase();
    const resolve = () => jumpTarget(i, noteId, noteId ? '' : q);
    resolve(); // unfold before measuring
    if (isMobile() && panelOpen()) closePanel();
    // something in the chat still holding focus (an input in a frontend, a frame you tapped) would pull
    // the view back to itself when focus returns to it
    try { const ae = document.activeElement; if (ae && ae !== document.body && $id('chat')?.contains(ae)) { logStep(`released focus from ${ae.tagName.toLowerCase()}`); ae.blur(); } } catch { /* ignore */ }
    // let closing windows / the keyboard finish first (the guard keeps everything still meanwhile), then go —
    // without waiting for frames or other extensions; the hold corrects as things settle
    // (only when nothing had to be loaded — after a long load all of that is long over, and waiting for a
    // frame then would mean waiting for Tavern Helper to finish drawing hundreds of frames)
    if (!missing) { await nextFrame(); await sleep(isMobile() ? 300 : 60); }
    scrollAndHold(resolve, { guard, reload: () => ensureRendered(i, { timeout: 20000 }).catch(() => null) });
    setTimeout(() => { try { decorateChapters(); } catch { /* ignore */ } }, 0);
    const flashEl = resolve();
    if (flashEl) {
        flashEl.classList.remove('stbs-flash');
        void flashEl.offsetWidth;
        flashEl.classList.add('stbs-flash');
        setTimeout(() => flashEl.classList.remove('stbs-flash'), 1800);
    }
}

function jumpReport() {
    if (!jumpLog) return '아직 이동한 기록이 없어요. 검색 결과나 책갈피를 눌러 이동한 뒤 다시 열어 주세요.';
    const L = jumpLog;
    return [
        `책 먹는 여우 v${L.v} · 이동 기록 ${L.at}`,
        `목표 #${L.target} · 이동 전 화면 #${L.view} · 그려진 메시지 ${L.rendered}/${L.chatLen} · 안 그려진 앞쪽 ${L.missing}개 · ${L.mobile ? '모바일' : 'PC'}`,
        `스크롤 칸: ${L.scroller || '-'} · 결과: ${L.end || '진행 중'} · 위치 ${JSON.stringify(L.final ?? '-')} · 보정 ${L.corrections ?? 0}번`,
        `막은 다른 스크롤 ${L.blocked}번${L.who.length ? ':\n  ' + L.who.join('\n  ') : ''}`,
        '— 단계 —', ...L.steps,
        `UA: ${L.ua}`,
    ].join('\n');
}

function openJumpReport() {
    const text = jumpReport();
    const body = openModal('🦊 마지막 이동 기록', `
        <div class="stbs-hint">이동이 이상할 때 이 내용을 복사해서 보내 주면 원인을 찾을 수 있어요.</div>
        <textarea class="text_pole stbs-report" readonly rows="14">${esc(text)}</textarea>
        <div class="stbs-row stbs-end stbs-wrap">
            <div class="stbs-btn" data-act="modal-close">닫기</div>
            <div class="stbs-btn stbs-primary" id="stbs-report-copy"><i class="fa-solid fa-copy"></i> 복사</div>
        </div>`, { wide: true });
    body.querySelector('#stbs-report-copy').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(text); toastr.success('복사했어요.'); }
        catch { const ta = body.querySelector('textarea'); ta.select(); document.execCommand('copy'); toastr.success('복사했어요.'); }
    });
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


// ---------------------------------------------------------------- reader (far-away messages)
// Jumping to a message hundreds of messages up means drawing all of them first, which can take many
// seconds on a phone. For reading, show the message right away in a window instead.
const READER_MIN_MISSING = 60;

function highlightIn(root, phrase) {
    const q = String(phrase || '').trim().toLowerCase();
    if (!q) return null;
    let first = null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    let node;
    while ((node = walker.nextNode())) {
        if (node.parentElement?.closest('style, script, mark')) continue;
        const lower = node.data.toLowerCase();
        let at = lower.indexOf(q);
        while (at !== -1) { hits.push([node, at]); at = lower.indexOf(q, at + q.length); }
    }
    for (let k = hits.length - 1; k >= 0; k--) {
        const [n, at] = hits[k];
        const mid = n.splitText(at);
        mid.splitText(q.length);
        const mk = document.createElement('mark');
        mk.className = 'stbs-find';
        mid.replaceWith(mk);
        mk.appendChild(mid);
        first = mk;
    }
    return first;
}

function openReader(i, { noteId = null, query = '' } = {}) {
    const m = msg(i);
    if (!m) { toastr.warning('메시지를 찾을 수 없어요.'); return; }
    const note = noteId ? getNote(noteId) : null;
    const phrase = note ? (noteText(note).split('\n').find(l => l.trim()) || '').slice(0, 60) : query;
    let html = '';
    try {
        html = stScript?.messageFormatting
            ? stScript.messageFormatting(m.mes, m.name, !!m.is_system, !!m.is_user, i)
            : esc(plainKeep(m.mes)).replace(/\n/g, '<br>');
    } catch { html = esc(plainKeep(m.mes)).replace(/\n/g, '<br>'); }
    const ch = sortedChapters().length ? chapterLabel(chapterOf(i)) : '';
    const badges = [isHiddenMes(m) ? '<span class="stbs-badge stbs-hid-badge"><i class="fa-solid fa-eye-slash"></i> 숨김</span>' : '',
        isQrMes(m) ? `<span class="stbs-badge stbs-qr-badge"><i class="fa-solid fa-bolt"></i> ${m.extra.type === 'narrator' ? '내레이터' : 'QR·코멘트'}</span>` : ''].join('');
    const body = openModal('🦊 미리 읽기', `
        <div class="stbs-reader-meta">${badges}<span>${esc(speaker(i) || m.name || '')} · #${i}${ch ? ` · ${esc(ch)}` : ''}</span></div>
        <div class="stbs-reader mes_text">${html}</div>
        <div class="stbs-hint">채팅 앞쪽(#${i})에 있는 메시지라 바로 펼쳐 보여 드려요. 실제 위치로 가려면 아래 버튼을 누르세요.</div>
        <div class="stbs-row stbs-end stbs-wrap">
            <div class="stbs-btn" data-act="modal-close">닫기</div>
            <div class="stbs-btn stbs-primary" id="stbs-reader-go"><i class="fa-solid fa-location-arrow"></i> 채팅에서 그 위치로 가기</div>
        </div>`, { wide: true });
    const box = body.querySelector('.stbs-reader');
    // full-page HTML answers (frontend code blocks) → show them drawn, in a sandboxed frame (scripts run,
    // but it can't touch SillyTavern), like Tavern Helper does in the chat
    box.querySelectorAll('pre > code').forEach(code => {
        const src = code.textContent || '';
        if (!/^\s*(<!doctype html|<html[\s>])/i.test(src)) return;
        const frame = document.createElement('iframe');
        frame.className = 'stbs-reader-frame';
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.setAttribute('loading', 'lazy');
        frame.srcdoc = src;
        code.parentElement.replaceWith(frame);
    });
    const hit = highlightIn(box, phrase);
    if (hit) {
        for (let d = hit.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
        setTimeout(() => hit.scrollIntoView({ block: 'center' }), 60);
    }
    body.querySelector('#stbs-reader-go').addEventListener('click', () => {
        closeModal();
        jumpTo(i, noteId, note ? '' : query);
    });
}

// ---------------------------------------------------------------- modal

function openModal(title, bodyHtml, { wide = false } = {}) {
    closeModal();
    const wrap = themed(document.createElement('div'));
    wrap.id = 'stbs-modal';
    wrap.innerHTML = `
        <div class="stbs-modal-box ${wide ? 'wide' : ''} ${wide === 'x' ? 'xwide' : ''}" role="dialog">
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
        <div class="stbs-hint"><b>#설렘</b>처럼 #을 붙여 쓰면 태그가 돼요. 태그로 노트를 모아 볼 수 있어요.</div>
        ${allTags().length ? `<div class="stbs-row stbs-wrap stbs-tag-row">${allTags().slice(0, 14).map(([t]) => `<span class="stbs-tag" data-addtag="${esc(t)}">#${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="stbs-row stbs-end">
            <div class="stbs-btn" data-act="modal-close">취소</div>
            <div class="stbs-btn stbs-primary" id="stbs-memo-save">저장</div>
        </div>`);
    const ta = body.querySelector('#stbs-memo-input');
    setTimeout(() => ta.focus(), 30);
    body.addEventListener('click', (e) => {
        const t = e.target.closest('[data-addtag]')?.dataset.addtag;
        if (!t) return;
        if (!noteTags({ memo: ta.value }).includes(t)) ta.value = `${ta.value.replace(/\s+$/, '')}${ta.value.trim() ? ' ' : ''}#${t} `;
        ta.focus();
    });
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
    const W = canvas.width, H = canvas.height;
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

// ---- shared pieces for every card design

/** Fit the quote (and its translation) into a box: the first block is the big one. */
function fitQuote(g, { main, sub, transFirst = false, font, maxW, avail, max = 60, min = 22, lh = 1.6, subScale = 0.72, gap = 56, para = 0.55, prep = (s) => s }) {
    main = String(main || '').trim(); sub = String(sub || '').trim();
    const blocks = sub ? (transFirst ? [sub, main] : [main, sub]) : [main];
    const measure = (size) => {
        let total = sub ? gap : 0;
        const laid = blocks.map((txt, k) => {
            const small = k > 0;
            const fs = Math.round(size * (small ? subScale : 1)), l = fs * lh;
            g.font = font(fs, small);
            const lines = wrapLines(g, prep(txt), maxW);
            const h = lines.reduce((a, x) => a + (x === '' ? l * para : l), 0);
            total += h;
            return { lines, fs, lh: l, h, small };
        });
        return { laid, total };
    };
    let size = max, m;
    for (; size >= min; size -= 2) { m = measure(size); if (m.total <= avail) break; }
    if (m.total > avail) {
        const room = avail - (sub ? gap : 0);
        for (const b of m.laid) {
            const share = room * (b.h / Math.max(1, m.total - (sub ? gap : 0)));
            let h = 0; const keep = [];
            for (const l of b.lines) { const x = l === '' ? b.lh * para : b.lh; if (h + x > share && keep.length) break; keep.push(l); h += x; }
            while (keep.length && keep[keep.length - 1] === '') { keep.pop(); h -= b.lh * para; }
            if (keep.length < b.lines.length && keep.length) keep[keep.length - 1] = keep[keep.length - 1].replace(/.?$/, '…');
            b.lines = keep; b.h = h;
        }
        m.total = m.laid.reduce((a, b) => a + b.h, sub ? gap : 0);
    }
    m.gap = sub ? gap : 0; m.para = para;
    return m;
}

/** Draw fitted blocks from y. onLine(b, x, top, width, baseline) runs before each line (markers…). */
function drawLaid(g, m, { x, y, w, align = 'left', color, subColor, font, justify = false, onLine, divider, only }) {
    m.laid.forEach((b, k) => {
        if (only !== undefined && only !== k) return;
        g.font = font(b.fs, b.small);
        b.lines.forEach((l, j) => {
            if (l === '') { y += b.lh * m.para; return; }
            const last = j === b.lines.length - 1 || b.lines[j + 1] === '';
            const lw = g.measureText(l).width;
            const lx = align === 'center' ? x + (w - lw) / 2 : align === 'right' ? x + w - lw : x;
            const base = y + b.lh / 2 + b.fs * 0.36;
            onLine?.(b, lx, y, lw, base);
            g.font = font(b.fs, b.small);
            g.fillStyle = b.small ? subColor : color;
            const words = l.split(' ');
            const plain = justify ? words.reduce((a, s) => a + g.measureText(s).width, 0) : 0;
            const sp = justify && words.length > 1 ? (w - plain) / (words.length - 1) : 0;
            // justify like a book, but never with holes wider than about one letter
            if (justify && !last && words.length > 1 && sp < b.fs * 0.9) {
                let cx = x;
                for (const s of words) { g.fillText(s, cx, base); cx += g.measureText(s).width + sp; }
            } else g.fillText(l, lx, base);
            y += b.lh;
        });
        if (m.gap && k === 0) { divider?.(y + m.gap / 2); y += m.gap; }
    });
    return y;
}

function coverImage(g, img, x, y, w, h) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
    // faces sit in the upper part of portraits
    g.drawImage(img, x + (w - iw) / 2, y + (h - ih) * 0.22, iw, ih);
}

function foxStamp(g, cx, cy, r, ring) {
    if (!(foxImage?.complete && foxImage.naturalWidth)) return;
    g.save();
    g.fillStyle = '#fff5e8';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    if (ring) { g.strokeStyle = ring; g.lineWidth = Math.max(2, r * 0.07); g.stroke(); }
    g.drawImage(foxImage, cx - r * 0.78, cy - r * 0.74, r * 1.56, r * 1.56);
    g.restore();
}

/** Quotation mark drawn as a shape (the font's “ glyph is often missing or tiny). */
function quoteMark(g, x, y, s, color) {
    g.save();
    g.fillStyle = color;
    for (let k = 0; k < 2; k++) {
        const r = s * 0.27, cx = x + r + k * s * 0.72, cy = y + s - r;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(cx - r, cy - r * 0.05);
        g.quadraticCurveTo(cx - r * 1.05, cy - r * 2.1, cx + r * 0.85, cy - r * 2.75);
        g.lineTo(cx + r * 1.05, cy - r * 2.35);
        g.quadraticCurveTo(cx - r * 0.05, cy - r * 1.85, cx + r * 0.1, cy - r * 0.8);
        g.closePath();
        g.fill();
    }
    g.restore();
}

function roundPath(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else rrect(g, x, y, w, h, Array.isArray(r) ? r[1] : r);
}

// ---- the designs

function cardUnderline(g, W, H, I, t, A) {
    g.fillStyle = t.bg; g.fillRect(0, 0, W, H);
    const M = 96, ui = I.ui;
    const hasCover = I.show.avatar && A.thumb;
    const rowH = hasCover ? 132 : 84;
    let tx = M;
    if (hasCover) {
        g.save();
        g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
        g.fillStyle = t.cover; roundPath(g, M, M, 96, rowH, 10); g.fill();
        g.restore();
        g.save(); roundPath(g, M, M, 96, rowH, 10); g.clip(); coverImage(g, A.thumb, M, M, 96, rowH); g.restore();
        tx = M + 96 + 30;
    }
    g.textBaseline = 'alphabetic';
    g.fillStyle = t.fg; g.font = `700 36px ${ui}`;
    g.fillText(fitText(g, I.title, W - tx - M), tx, M + (hasCover ? 54 : 34));
    if (I.show.chapter && I.chapter) {
        g.fillStyle = t.sub; g.font = `28px ${ui}`;
        g.fillText(fitText(g, I.chapter, W - tx - M), tx, M + (hasCover ? 98 : 78));
    }
    const top = M + rowH + 72, bottom = H - M - 110, maxW = W - M * 2;
    const font = (fs, small) => `${small ? 400 : 500} ${fs}px ${I.read}`;
    const m = fitQuote(g, { main: I.text, sub: I.trans, transFirst: I.transFirst, font, maxW, avail: bottom - top, max: 58, min: 24, lh: 1.8, subScale: 0.7, gap: 60 });
    const r = seeded(I.seed);
    const y0 = top + Math.max(0, bottom - top - m.total) * 0.42;
    drawLaid(g, m, {
        x: M, y: y0, w: maxW, color: t.fg, subColor: t.sub, font,
        onLine: (b, lx, ly, lw, base) => {
            if (b.small) return;
            // a marker stroke: a little uneven, under the lower part of the letters
            g.save();
            g.globalAlpha = t.dark ? 0.42 : 0.6;
            g.fillStyle = I.hl;
            const j1 = (r() - 0.5) * 6, j2 = (r() - 0.5) * 6;
            g.beginPath();
            g.moveTo(lx - 8, base - b.fs * 0.5 + j1);
            g.lineTo(lx + lw + 10, base - b.fs * 0.54 + j2);
            g.lineTo(lx + lw + 6, base + b.fs * 0.2 + j2);
            g.lineTo(lx - 6, base + b.fs * 0.24 + j1);
            g.closePath(); g.fill();
            g.restore();
        },
        divider: (dy) => { g.fillStyle = t.sub; g.globalAlpha = 0.5; g.fillRect(M, dy - 1, 48, 3); g.globalAlpha = 1; },
    });
    const fy = H - M;
    if (I.show.who && I.who) { g.fillStyle = t.fg; g.font = `600 30px ${ui}`; g.fillText(fitText(g, I.who, maxW * 0.6), M, fy); }
    let rx = W - M;
    if (I.show.page && I.page) { g.fillStyle = t.sub; g.font = `28px ${ui}`; const p = `p. ${I.page}`; const pw = g.measureText(p).width; g.fillText(p, rx - pw, fy); rx -= pw + 22; }
    if (I.show.fox) foxStamp(g, rx - 24, fy - 10, 26);
}

function cardPage(g, W, H, I, t, A) {
    g.fillStyle = t.bg; g.fillRect(0, 0, W, H);
    // the bound edge of a book page
    const sp = g.createLinearGradient(0, 0, 90, 0);
    sp.addColorStop(0, t.dark ? 'rgba(0,0,0,.45)' : 'rgba(60,40,10,.13)');
    sp.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sp; g.fillRect(0, 0, 90, H);
    const M = 110, ui = I.ui, maxW = W - M * 2;
    g.textBaseline = 'alphabetic';
    g.fillStyle = t.sub; g.font = `26px ${ui}`;
    g.fillText(fitText(g, I.title, maxW / 2 - 20), M, 100);
    if (I.show.chapter && I.chapter) { const c = fitText(g, I.chapter, maxW / 2 - 20); g.fillText(c, W - M - g.measureText(c).width, 100); }
    const top = 190, bottom = H - 230;
    const font = (fs) => `${fs}px ${I.read}`;
    const indent = (s) => String(s).split('\n').map(l => l.trim() ? '　' + l.trim() : l).join('\n');
    const m = fitQuote(g, { main: I.text, sub: I.trans, transFirst: I.transFirst, font, maxW, avail: bottom - top - 70, max: 50, min: 22, lh: 1.9, subScale: 0.8, gap: 52, prep: indent });
    let y = top + Math.max(0, bottom - top - 70 - m.total) / 2;
    y = drawLaid(g, m, { x: M, y, w: maxW, color: t.fg, subColor: t.sub, font, justify: true,
        divider: (dy) => { g.fillStyle = t.sub; g.font = `24px ${I.read}`; const s = '*'; g.fillText(s, (W - g.measureText(s).width) / 2, dy + 10); } });
    if (I.show.who && I.who) { g.fillStyle = t.sub; g.font = `italic 28px ${I.read}`; const s = `— ${I.who}`; g.fillText(s, W - M - g.measureText(s).width, y + 52); }
    if (I.show.page && I.page) { g.fillStyle = t.sub; g.font = `30px ${ui}`; const p = String(I.page); g.fillText(p, (W - g.measureText(p).width) / 2, H - 92); }
    if (I.show.fox) foxStamp(g, W - M + 20, H - 102, 24);
}

function cardSubtitle(g, W, H, I, t, A) {
    const bar = Math.round(H * 0.075);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const img = I.show.avatar ? (A.full || A.thumb) : null;
    if (img) { g.save(); g.beginPath(); g.rect(0, bar, W, H - bar * 2); g.clip(); coverImage(g, img, 0, bar, W, H - bar * 2); g.restore(); }
    else { const rg = g.createRadialGradient(W * 0.5, H * 0.35, 40, W * 0.5, H * 0.45, H * 0.75); rg.addColorStop(0, `rgba(${t.veil},.2)`); rg.addColorStop(0, '#3a3f4a'); rg.addColorStop(1, `rgb(${t.veil})`); g.fillStyle = rg; g.fillRect(0, bar, W, H - bar * 2); }
    const vg = g.createLinearGradient(0, bar, 0, H - bar);
    vg.addColorStop(0, `rgba(${t.veil},.18)`); vg.addColorStop(0.45, `rgba(${t.veil},.3)`); vg.addColorStop(1, `rgba(${t.veil},.9)`);
    g.fillStyle = vg; g.fillRect(0, bar, W, H - bar * 2);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    const ui = I.ui;
    g.textBaseline = 'alphabetic';
    if (I.show.chapter && I.chapter) { g.fillStyle = '#9a9a9a'; g.font = `24px ${ui}`; g.fillText(fitText(g, I.chapter, W - 260), 64, bar * 0.62); }
    if (I.show.fox) foxStamp(g, W - 70, bar * 0.5, bar * 0.3);
    const maxW = W - 180;
    const font = (fs, small) => `${small ? 500 : 600} ${fs}px ${ui}`;
    const m = fitQuote(g, { main: I.text, sub: I.trans, transFirst: I.transFirst, font, maxW, avail: H * 0.4, max: 50, min: 24, lh: 1.5, subScale: 0.74, gap: 26 });
    let y = H - bar - 96 - m.total;
    g.save();
    g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 14; g.shadowOffsetY = 2;
    if (I.show.who && I.who) { g.fillStyle = t.sub; g.font = `500 28px ${ui}`; const s = fitText(g, I.who, maxW); g.fillText(s, (W - g.measureText(s).width) / 2, y - 30); }
    drawLaid(g, m, { x: 90, y, w: maxW, align: 'center', color: t.fg, subColor: t.tr, font });
    g.restore();
}

function cardChat(g, W, H, I, t, A) {
    g.fillStyle = t.bg; g.fillRect(0, 0, W, H);
    const M = 72, ui = I.ui, d = 112, pad = 34;
    const bx = M + d + 26, bubbleMax = W - bx - M - 40;
    const font = (fs) => `${fs}px ${I.read}`;
    const pillH = I.show.chapter && I.chapter ? 56 : 0;
    const nameH = I.show.who && I.who ? 50 : 0;
    const avail = H - M * 2 - pillH - 70 - nameH - pad * 2 * (I.trans ? 2 : 1) - (I.trans ? 22 : 0) - 60;
    const m = fitQuote(g, { main: I.text, sub: I.trans, transFirst: I.transFirst, font, maxW: bubbleMax - pad * 2, avail, max: 44, min: 22, lh: 1.6, subScale: 0.86, gap: 0 });
    const sizes = m.laid.map(b => {
        g.font = font(b.fs);
        const w = Math.max(...b.lines.map(l => (l ? g.measureText(l).width : 0)), 40);
        return { w: Math.min(bubbleMax, w + pad * 2), h: b.h + pad * 2 - (b.lh - b.fs * 1.25) };
    });
    const groupH = nameH + sizes.reduce((a, s) => a + s.h, 0) + (sizes.length - 1) * 18;
    const total = (pillH ? pillH + 64 : 0) + Math.max(d, groupH);
    let y = Math.max(M, (H - total) / 2);
    g.textBaseline = 'alphabetic';
    if (pillH) {
        g.font = `500 24px ${ui}`;
        const s = fitText(g, I.chapter, W - M * 2 - 60), pw = g.measureText(s).width + 48;
        g.fillStyle = t.pill; roundPath(g, (W - pw) / 2, y, pw, pillH, pillH / 2); g.fill();
        g.fillStyle = t.sub; g.fillText(s, (W - pw) / 2 + 24, y + pillH / 2 + 9);
        y += pillH + 64;
    }
    // avatar
    g.save(); g.beginPath(); g.arc(M + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); g.clip();
    if (I.show.avatar && A.thumb) coverImage(g, A.thumb, M, y, d, d);
    else { g.fillStyle = t.dark ? '#3a4048' : '#ffffff'; g.fillRect(M, y, d, d); if (I.who) { g.fillStyle = t.sub; g.font = `700 44px ${ui}`; const c = [...I.who][0]; g.fillText(c, M + (d - g.measureText(c).width) / 2, y + d / 2 + 16); } }
    g.restore();
    if (nameH) { g.fillStyle = t.fg; g.font = `600 30px ${ui}`; g.fillText(fitText(g, I.who, bubbleMax), bx, y + 30); }
    let by = y + nameH;
    m.laid.forEach((b, k) => {
        const s = sizes[k];
        g.fillStyle = k === 0 ? t.bubble : t.tr;
        roundPath(g, bx, by, s.w, s.h, k === 0 ? [8, 36, 36, 36] : 36); g.fill();
        drawLaid(g, { ...m, laid: [b], gap: 0 }, { x: bx + pad, y: by + pad - (b.lh - b.fs * 1.25) / 2, w: s.w - pad * 2, color: t.fg, subColor: t.sub, font });
        if (k === m.laid.length - 1 && I.time) {
            g.fillStyle = t.sub; g.font = `22px ${ui}`;
            const tw = g.measureText(I.time).width;
            if (bx + s.w + 14 + tw < W - 20) g.fillText(I.time, bx + s.w + 14, by + s.h - 6);
            else g.fillText(I.time, bx + s.w - tw, by + s.h + 34);
        }
        by += s.h + 18;
    });
    if (I.show.fox) foxStamp(g, W - M, H - M, 28);
}

function cardPoster(g, W, H, I, t, A) {
    g.fillStyle = t.bg; g.fillRect(0, 0, W, H);
    const M = 100, ui = I.ui, maxW = W - M * 2;
    quoteMark(g, M, M, 120, t.mark);
    const footH = (I.show.who && I.who ? 46 : 0) + (I.show.chapter && I.chapter ? 40 : 0);
    const top = M + 190, bottom = H - M - footH - 70;
    const font = (fs, small) => `${small ? 500 : 800} ${fs}px ${ui}`;
    const m = fitQuote(g, { main: I.text, sub: I.trans, transFirst: I.transFirst, font, maxW, avail: bottom - top, max: 92, min: 34, lh: 1.32, subScale: 0.46, gap: 48 });
    g.textBaseline = 'alphabetic';
    const y = top + Math.max(0, bottom - top - m.total) * 0.45;
    drawLaid(g, m, { x: M, y, w: maxW, color: t.fg, subColor: t.sub, font,
        divider: (dy) => { g.fillStyle = t.mark; g.fillRect(M, dy - 2, 64, 5); } });
    let fy = H - M;
    if (I.show.chapter && I.chapter) { g.fillStyle = t.sub; g.font = `28px ${ui}`; g.fillText(fitText(g, I.chapter, maxW - 140), M, fy); fy -= 46; }
    if (I.show.who && I.who) { g.fillStyle = t.fg; g.font = `700 36px ${ui}`; g.fillText(fitText(g, I.who, maxW - 140), M, fy); }
    if (I.show.fox) foxStamp(g, W - M - 44, H - M - 30, 46, t.mark);
}

const CARD_DRAW = { underline: cardUnderline, page: cardPage, subtitle: cardSubtitle, chat: cardChat, poster: cardPoster };

/** Draw a card. info: text, trans, transFirst, who, chapter, title, page, time, hl, show, commu, seed; assets: thumb/full images. */
function drawCard(canvas, info, layoutKey = 'underline', tintIdx = 0, ratio = '4:5', assets = {}) {
    const L = CARD_LAYOUTS[layoutKey] || CARD_LAYOUTS.underline;
    const t = L.tints[tintIdx] || L.tints[0];
    canvas.width = 1080;
    canvas.height = CARD_RATIOS[ratio] || 1350;
    if (t.commu) return drawCommunity(canvas, info, t);
    const g = canvas.getContext('2d');
    const f = pageFonts();
    const I = { ...info, ui: `${f.uiFont}, sans-serif`, read: `${f.readFont}, sans-serif` };
    I.show = { who: true, chapter: true, avatar: true, page: true, fox: true, ...(info.show || {}) };
    (CARD_DRAW[layoutKey] || cardUnderline)(g, canvas.width, canvas.height, I, t, assets);
    if (info.series) drawSeriesMark(g, canvas.width, canvas.height, layoutKey, t, info.series.k, info.series.n);
}

// ---- pictures for the cards: the speaker's avatar, as SillyTavern shows it
const cardImages = new Map();
function loadCardImage(url) {
    if (!url) return Promise.resolve(null);
    if (!cardImages.has(url)) cardImages.set(url, new Promise((res) => {
        const im = new Image();
        im.onload = () => res(im.naturalWidth ? im : null);
        im.onerror = () => res(null);
        im.src = url;
    }));
    return cardImages.get(url);
}
function avatarUrls(mesId) {
    let thumb = document.querySelector(`#chat .mes[mesid="${mesId}"] .avatar img`)?.getAttribute('src') || '';
    const m = msg(mesId), c = ctx();
    if (!thumb && !m?.is_user) { const ch = c.characters?.[c.characterId]; if (ch?.avatar) thumb = `/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}`; }
    if (!thumb) return { thumb: '', full: '' };
    let full = '';
    const q = thumb.match(/[?&]type=(avatar|persona)&file=([^&]+)/);
    if (q) full = q[1] === 'avatar' ? `/characters/${q[2]}` : `/User%20Avatars/${q[2]}`;
    return { thumb, full };
}
/** Which page of the "book" this message is on (same rule as the statistics: 1 page = N characters). */
function pageOf(mesId) {
    const chat = ctx().chat || [];
    const per = Math.max(100, Number(settings().charsPerPage) || 600);
    let n = 0;
    for (let k = 0; k <= mesId && k < chat.length; k++) if (!isRealSystem(chat[k])) n += String(chat[k].mes || '').length;
    return Math.max(1, Math.ceil(n / per));
}
function mesTime(mesId) {
    const d = new Date(msg(mesId)?.send_date ?? NaN);
    return isNaN(d) ? '' : d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
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

function cardLayoutOf(s) {
    if (!CARD_LAYOUTS[s.cardLayout]) {
        const old = OLD_CARD_THEMES[s.cardTheme];
        s.cardLayout = old ? old[0] : 'underline';
        s.cardTints = { ...(s.cardTints || {}), [s.cardLayout]: old ? old[1] : 0 };
    }
    s.cardTints = { ...(s.cardTints || {}) };
    s.cardShow = { who: true, chapter: true, avatar: true, page: true, fox: s.cardFox !== false, ...(s.cardShow || {}) };
    if (!CARD_RATIOS[s.cardRatio]) s.cardRatio = '4:5';
    return s.cardLayout;
}

const CARD_SHOW = [['who', '화자'], ['chapter', '챕터'], ['avatar', '프로필 사진'], ['page', '쪽수'], ['fox', '여우 도장']];
const RATIO_NAMES = { '4:5': '4:5 피드', '1:1': '1:1 정사각', '9:16': '9:16 스토리' };

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
    // The other language of this message, so the translation box can be filled in one tap.
    let alt = '';
    if (m?.extra?.display_text) {
        const shown = plainKeep(m.extra.display_text), src = plainKeep(m.mes);
        const probe = oneParagraph(text).slice(0, 12);
        alt = probe && oneParagraph(shown).includes(probe) ? src : shown;
        if (alt === text) alt = '';
    }
    let layout = cardLayoutOf(s);
    const c = ctx();
    const base = {
        title: c.groupId ? (c.groups?.find?.(x => x.id === c.groupId)?.name || c.name2 || '') : (c.name2 || ''),
        page: pageOf(mesId),
        time: mesTime(mesId),
        hl: s.colors[note?.color ?? 0] || s.colors[0] || '#ffe066',
    };
    const chapter0 = sortedChapters().length ? chapterLabel(chapterOf(mesId)) : '';
    const who0 = who ?? speaker(mesId);
    const urls = avatarUrls(mesId);
    const assets = {};
    const tileHtml = Object.entries(CARD_LAYOUTS).map(([k, L]) =>
        `<button type="button" class="stbs-cx-lay ${k === layout ? 'active' : ''}" data-layout="${k}"><canvas class="stbs-cx-thumb" data-thumb="${k}" width="216" height="270"></canvas><span>${L.name}</span></button>`).join('');
    const body = openModal('명대사 카드', `
        <div class="stbs-cx">
            <div class="stbs-cx-view"><canvas id="stbs-card-canvas"></canvas></div>
            <div class="stbs-cx-side">
                <section class="stbs-cx-sec">
                    <div class="stbs-cx-h">디자인</div>
                    <div class="stbs-cx-lays">${tileHtml}</div>
                    <div class="stbs-cx-row"><span class="stbs-cx-k">색</span><div class="stbs-cx-tints" id="stbs-cx-tints"></div></div>
                    <div class="stbs-cx-row"><span class="stbs-cx-k">크기</span><div class="stbs-seg" id="stbs-cx-ratio">${Object.keys(CARD_RATIOS).map(r => `<button type="button" data-ratio="${r}" class="${r === s.cardRatio ? 'active' : ''}">${RATIO_NAMES[r]}</button>`).join('')}</div></div>
                </section>
                <section class="stbs-cx-sec">
                    <div class="stbs-cx-h stbs-between"><span>문장</span>
                        <div class="stbs-seg stbs-seg-sm">
                            <button type="button" data-break="keep" title="채팅에서 보이던 그대로">원문 줄바꿈</button>
                            <button type="button" data-break="sentence" title="문장마다 줄을 바꿔요">문장마다</button>
                            <button type="button" data-break="flow" title="줄바꿈 없이 한 덩어리로">한 문단</button>
                        </div>
                    </div>
                    <textarea id="stbs-card-text" class="text_pole stbs-textarea" rows="4">${esc(text)}</textarea>
                    <div class="stbs-hint">빈 줄을 넣으면 문단이 나뉘어요. 길면 글자가 알아서 작아져요.</div>
                </section>
                <details class="stbs-cx-sec stbs-cx-fold" ${trans ? 'open' : ''}>
                    <summary class="stbs-cx-h">번역 함께 넣기 <span class="stbs-dim">선택</span></summary>
                    <div class="stbs-cx-row"><span class="stbs-cx-k">순서</span><div class="stbs-seg stbs-seg-sm">
                        <button type="button" data-order="orig" class="${s.cardTransFirst ? '' : 'active'}">원문이 위</button>
                        <button type="button" data-order="trans" class="${s.cardTransFirst ? 'active' : ''}">번역이 위</button>
                    </div></div>
                    <textarea id="stbs-card-trans" class="text_pole stbs-textarea stbs-trans" rows="3" placeholder="여기 적은 문장이 작은 글씨로 함께 들어가요">${esc(trans)}</textarea>
                    ${alt ? '<button type="button" class="stbs-chip" data-alt title="이 메시지의 다른 언어 전체를 넣어요. 필요한 부분만 남기세요."><i class="fa-solid fa-language"></i> 메시지의 다른 언어 불러오기</button>' : ''}
                </details>
                <section class="stbs-cx-sec stbs-commu-box" id="stbs-commu-box" hidden>
                    <div class="stbs-cx-h stbs-between"><span>게시판 반응</span><button type="button" class="stbs-chip" data-reroll title="제목·댓글·숫자를 새로 뽑아요"><i class="fa-solid fa-dice"></i> 다시 뽑기</button></div>
                    <input id="stbs-commu-title" class="text_pole" maxlength="40" placeholder="글 제목">
                    <textarea id="stbs-commu-cm" class="text_pole stbs-textarea" rows="3" placeholder="댓글을 한 줄에 하나씩 (4개까지)"></textarea>
                </section>
                <section class="stbs-cx-sec">
                    <div class="stbs-cx-h">카드에 넣을 것</div>
                    <div class="stbs-cx-checks">${CARD_SHOW.map(([k, n]) => `<button type="button" class="stbs-cx-check ${s.cardShow[k] ? 'on' : ''}" data-show="${k}" aria-pressed="${!!s.cardShow[k]}"><i class="fa-solid fa-check"></i>${n}</button>`).join('')}</div>
                    <div class="stbs-cx-row2">
                        <label><span>화자</span><input id="stbs-card-who" class="text_pole" value="${esc(who0)}"></label>
                        <label><span>챕터 · 출처</span><input id="stbs-card-ch" class="text_pole" value="${esc(chapter0)}"></label>
                    </div>
                </section>
            </div>
            <div class="stbs-cx-foot">
                <div class="stbs-btn" id="stbs-card-copy"><i class="fa-solid fa-copy"></i> 이미지 복사</div>
                <div class="stbs-btn stbs-primary" id="stbs-card-save"><i class="fa-solid fa-download"></i> PNG로 저장</div>
            </div>
        </div>`, { wide: 'x' });
    const canvas = body.querySelector('#stbs-card-canvas');
    const ta = body.querySelector('#stbs-card-text');
    const tr = body.querySelector('#stbs-card-trans');
    const cTitle = body.querySelector('#stbs-commu-title');
    const cCm = body.querySelector('#stbs-commu-cm');
    const whoIn = body.querySelector('#stbs-card-who');
    const chIn = body.querySelector('#stbs-card-ch');
    let seed = parseInt(hash(String(text || '')).slice(0, 6), 36) || 7;
    const fillCommu = () => {
        const dflt = commuDefaults(seed, whoIn.value.trim());
        cTitle.value = dflt.title;
        cCm.value = dflt.comments.join('\n');
    };
    const info = () => ({
        ...base,
        text: ta.value,
        trans: tr.value,
        transFirst: !!s.cardTransFirst,
        who: whoIn.value.trim(),
        chapter: chIn.value.trim(),
        show: s.cardShow,
        seed,
        commu: { seed, title: cTitle.value.trim(), comments: cCm.value.split('\n') },
    });
    const tint = (k) => s.cardTints[k] ?? 0;
    const renderTints = () => {
        body.querySelector('#stbs-cx-tints').innerHTML = CARD_LAYOUTS[layout].tints.map((t, k) => {
            const sw = t.commu ? t.card : t.bg || `rgb(${t.veil})`;
            const dot = t.mark || t.hl || t.fg;
            return `<button type="button" class="stbs-cx-tint ${k === tint(layout) ? 'active' : ''}" data-tint="${k}" title="${t.name}"><span style="background:${sw}"><i style="background:${t.commu ? t.accent : dot}"></i></span>${t.name}</button>`;
        }).join('');
        body.querySelector('#stbs-commu-box').hidden = layout !== 'commu';
    };
    const ratioCss = () => canvas.style.setProperty('aspect-ratio', `1080 / ${CARD_RATIOS[s.cardRatio]}`);
    const redraw = () => { drawCard(canvas, info(), layout, tint(layout), s.cardRatio, assets); ratioCss(); };
    // little live previews of every design, with this very text
    const off = document.createElement('canvas');
    const drawThumbs = () => {
        const inf = info();
        body.querySelectorAll('[data-thumb]').forEach(tc => {
            const k = tc.dataset.thumb;
            drawCard(off, inf, k, tint(k), '4:5', assets);
            const tg = tc.getContext('2d');
            tg.clearRect(0, 0, tc.width, tc.height);
            tg.drawImage(off, 0, 0, tc.width, tc.height);
        });
    };
    const redrawSoon = debounce(redraw, 120);
    const thumbsSoon = debounce(drawThumbs, 900);
    const saveTrans = debounce(() => {
        if (!note || !getNote(note.id)) return;
        const v = tr.value.trim();
        if ((note.trans || '') !== v) { if (v) note.trans = v; else delete note.trans; persist(); refreshPanel(); }
    }, 500);
    body.addEventListener('input', (e) => { redrawSoon(); thumbsSoon(); if (e.target === tr) saveTrans(); });
    body.addEventListener('click', (e) => {
        const lay = e.target.closest('[data-layout]');
        if (lay) {
            layout = lay.dataset.layout;
            s.cardLayout = layout; saveSettings();
            body.querySelectorAll('[data-layout]').forEach(x => x.classList.toggle('active', x === lay));
            renderTints(); redraw();
            return;
        }
        const tn = e.target.closest('[data-tint]');
        if (tn) {
            s.cardTints[layout] = Number(tn.dataset.tint); saveSettings();
            renderTints(); redraw(); drawThumbs();
            return;
        }
        const ra = e.target.closest('[data-ratio]');
        if (ra) {
            s.cardRatio = ra.dataset.ratio; saveSettings();
            body.querySelectorAll('[data-ratio]').forEach(x => x.classList.toggle('active', x === ra));
            redraw();
            return;
        }
        const sh = e.target.closest('[data-show]');
        if (sh) {
            const k = sh.dataset.show;
            s.cardShow[k] = !s.cardShow[k];
            if (k === 'fox') s.cardFox = s.cardShow.fox;
            saveSettings();
            sh.classList.toggle('on', s.cardShow[k]); sh.setAttribute('aria-pressed', String(s.cardShow[k]));
            redraw(); drawThumbs();
            return;
        }
        if (e.target.closest('[data-reroll]')) { seed = Math.floor(Math.random() * 1e9); fillCommu(); redraw(); return; }
        const br = e.target.closest('[data-break]');
        if (br) {
            const mode = br.dataset.break;
            const apply = (v, orig) => mode === 'keep' ? orig : mode === 'sentence' ? sentencePerLine(v) : oneParagraph(v);
            ta.value = apply(ta.value, original);
            if (tr.value.trim()) tr.value = mode === 'keep' ? tr.value : apply(tr.value, tr.value);
            body.querySelectorAll('[data-break]').forEach(x => x.classList.toggle('active', x === br));
            redraw(); thumbsSoon();
            return;
        }
        if (e.target.closest('[data-alt]')) { tr.value = alt; saveTrans(); redraw(); thumbsSoon(); return; }
        const ord = e.target.closest('[data-order]');
        if (ord) {
            s.cardTransFirst = ord.dataset.order === 'trans'; saveSettings();
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
                toastr.warning('이 브라우저에서는 이미지 복사가 안 돼요. PNG로 저장을 써 주세요.');
            }
        }, 'image/png');
    });
    fillCommu();
    renderTints();
    redraw();
    Promise.all([
        loadFoxImage(),
        loadCardImage(urls.thumb).then(im => { assets.thumb = im; }),
        loadCardImage(urls.full).then(im => { assets.full = im; }),
        document.fonts?.ready?.catch?.(() => { }),
    ]).then(() => { if (canvas.isConnected) { redraw(); drawThumbs(); } });
    setTimeout(drawThumbs, 30);
}

// ---------------------------------------------------------------- panel

const TABS = [
    ['toc', 'fa-list-ol', '목차'],
    ['bookmarks', 'fa-book-bookmark', '책갈피'],
    ['notes', 'fa-highlighter', '독서노트'],
    ['search', 'fa-magnifying-glass', '검색'],
    ['stats', 'fa-chart-simple', '통계'],
    ['library', 'fa-book-open-reader', '서재'],
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
    dailyShift: 0,
    noteTag: '',
    libQ: '', libKind: 'all', libTag: '', libOpen: null,
    bmFold: new Set(),
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
    const grip = e.target.closest('[data-bmgrip]');
    if (grip && e.button <= 0) { startBmDrag(e, grip); return; }
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
    // who you're reading with and how long the book is — the raw chat file name is hard to read
    $id('stbs-chatname').textContent = hasChat() ? (() => {
        const c = ctx();
        const who = c.groupId ? (c.groups?.find?.(x => x.id === c.groupId)?.name || '그룹 채팅') : (c.name2 || '');
        return clip([who, `메시지 ${(c.chat?.length || 0).toLocaleString()}개`].filter(Boolean).join(' · '), 40);
    })() : '오늘의 책을 펼쳐 주세요';
    $id('stbs-chatname').title = hasChat() ? ctx().getCurrentChatId() : '';
    if (!hasChat()) { body.innerHTML = emptyState('아직 펼친 책이 없어요', '채팅을 열면 여우가 함께 읽기 시작해요.'); return; }
    const scroll = body.scrollTop;
    const keepFocus = document.activeElement?.id === 'stbs-q';
    const keepLib = document.activeElement?.id === 'stbs-lib-q' ? document.activeElement.selectionStart : null;
    updateTrashBadge();
    $id('stbs-panel')?.classList.toggle('in-trash', ui.tab === 'trash');
    const daily = ['notes', 'toc', 'bookmarks', 'stats'].includes(ui.tab) && !(ui.tab === 'notes' && ui.scrap) ? dailyHtml() : '';
    body.innerHTML = daily + ({ toc: renderToc, bookmarks: renderBookmarks, notes: renderNotes, search: renderSearch, stats: renderStats, trash: renderTrash, library: renderLibrary }[ui.tab] || renderNotes)();
    body.scrollTop = scroll;
    if (keepLib !== null) { const lq = $id('stbs-lib-q'); if (lq) { lq.focus(); lq.setSelectionRange(keepLib, keepLib); } }
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
                <div class="stbs-icon-btn fa-regular fa-image" data-act="chapter-card" data-id="${e.id}" title="챕터 요약 카드"></div>
                <div class="stbs-icon-btn fa-regular fa-star" data-act="rate" data-target="${e.id}" title="별점 · 한줄평"></div>
                <div class="stbs-icon-btn fa-solid fa-pen" data-act="chapter-rename" data-id="${e.id}" title="이름 바꾸기"></div>
                <div class="stbs-icon-btn fa-solid fa-trash-can" data-act="chapter-del" data-id="${e.id}" title="삭제"></div>
            </div>` : `<div class="stbs-actions"><div class="stbs-icon-btn fa-regular fa-image" data-act="chapter-card" data-id="__prologue" title="요약 카드"></div></div>`}
        </div>`;
    });
    return html;
}

function renderBookmarks() {
    const all = data().bookmarks;
    if (!all.length) return emptyState('아직 꽂아 둔 책갈피가 없어요', '메시지 <i class="fa-solid fa-ellipsis"></i> 메뉴의 <i class="fa-solid fa-book-bookmark"></i> 버튼으로 꽂을 수 있어요.');
    const mine = settings().bmSort === 'mine';
    if (mine) ensureBmOrder();
    const sorter = mine ? (a, b) => (a.order ?? 0) - (b.order ?? 0) : (a, b) => a.mesId - b.mesId;
    const item = (b) => {
        const text = plain(msg(b.mesId)?.mes);
        return `
        <div class="stbs-item stbs-bm-item ${mine ? 'can-drag' : ''}" data-jump="${b.mesId}" data-bm="${b.id}">
            ${mine ? '<span class="stbs-grip" data-bmgrip title="끌어서 순서 바꾸기"><i class="fa-solid fa-grip-vertical"></i></span>' : '<i class="fa-solid fa-bookmark stbs-bm-ico"></i>'}
            <div class="stbs-grow">
                <div class="stbs-item-title">${esc(b.label || clip(text, 40))}</div>
                ${b.label ? `<div class="stbs-snippet">${esc(clip(text, 120))}</div>` : ''}
                ${metaLine(b.mesId, fmtDate(b.created))}
            </div>
            <div class="stbs-actions">
                <div class="stbs-icon-btn fa-regular fa-folder" data-act="bm-folder" data-id="${b.id}" title="폴더에 넣기"></div>
                <div class="stbs-icon-btn fa-solid fa-pen" data-act="bm-rename" data-id="${b.id}" title="이름 바꾸기"></div>
                <div class="stbs-icon-btn fa-solid fa-trash-can" data-act="bm-del" data-id="${b.id}" title="삭제"></div>
            </div>
        </div>`;
    };
    const folders = bmFolders(all);
    let html = `<div class="stbs-row stbs-between stbs-wrap">
        <span class="stbs-count">책갈피 ${all.length}개${folders.length ? ` · 폴더 ${folders.length}개` : ''}</span>
        <div class="stbs-seg stbs-seg-sm"><button type="button" data-act="bm-sort" data-v="story" class="${mine ? '' : 'active'}">이야기 순</button><button type="button" data-act="bm-sort" data-v="mine" class="${mine ? 'active' : ''}">내 순서</button></div>
    </div>`;
    if (mine) html += '<div class="stbs-hint"><i class="fa-solid fa-grip-vertical"></i> 손잡이를 끌어 순서를 바꾸거나 다른 폴더로 옮겨요.</div>';
    if (!folders.length && !mine) return html + groupByChapter([...all].sort(sorter), item);
    const group = (name, list) => {
        const shut = name && ui.bmFold.has(name);
        return `<div class="stbs-bm-group ${shut ? 'shut' : ''}">
            ${name ? `<div class="stbs-bm-group-head" data-act="bm-fold" data-f="${esc(name)}"><i class="fa-solid ${shut ? 'fa-folder' : 'fa-folder-open'}"></i><b>${esc(name)}</b><span class="stbs-dim">${list.length}</span><i class="fa-solid fa-chevron-down stbs-fold-caret"></i></div>` : (folders.length ? '<div class="stbs-bm-group-head is-loose"><i class="fa-regular fa-file"></i><b>폴더 없음</b></div>' : '')}
            <div class="stbs-bm-list" data-folder="${esc(name)}">${shut ? '' : list.map(item).join('')}</div>
        </div>`;
    };
    for (const f of folders) html += group(f, all.filter(b => b.folder === f).sort(sorter));
    const loose = all.filter(b => !b.folder).sort(sorter);
    if (loose.length || mine) html += group('', loose);
    return html;
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
        ${n.memo ? `<div class="stbs-note-memo">${memoHtml(n.memo)}</div>` : ''}
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
        <div class="stbs-btn stbs-primary ${n ? '' : 'disabled'}" data-act="sel-card"><i class="fa-solid fa-quote-left"></i> 카드 만들기</div>
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
    html += `<div class="stbs-btn stbs-wide-btn" data-act="scrap-card" data-id="${sb.id}"><i class="fa-solid fa-quote-left"></i> 이 스크랩북을 카드로</div>`;
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
    if (ui.noteTag) list = list.filter(n => noteTags(n).includes(ui.noteTag));
    const tags = allTags(all);
    list = ui.noteSort === 'story'
        ? list.sort((a, b) => a.mesId - b.mesId || (a.start ?? -1) - (b.start ?? -1))
        : list.sort((a, b) => b.updated - a.updated);

    let html = reviewStrip('book', true);
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
        </div>
        ${tags.length ? `<div class="stbs-row stbs-wrap stbs-tag-row">${tags.slice(0, 24).map(([t, c]) => `<span class="stbs-tag ${ui.noteTag === t ? 'on' : ''}" data-act="note-tag" data-tag="${esc(t)}">#${esc(t)} <span class="stbs-dim">${c}</span></span>`).join('')}</div>` : ''}`;
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
                <option value="qr" ${ui.scope === 'qr' ? 'selected' : ''}>QR·코멘트</option>
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
    if (/^#[\p{L}\p{N}_]+$/u.test(q)) {
        // #tag: the notes carrying that tag
        const tag = q.slice(1);
        const hits = data().notes.filter(n => noteTags(n).some(t => t.toLowerCase() === tag)).sort((a, b) => a.mesId - b.mesId);
        if (!hits.length) return emptyState(`#${esc(tag)} 태그를 단 노트가 없어요`, '노트 메모에 #태그를 적으면 여기서 모아 볼 수 있어요.', false);
        return `<div class="stbs-count">#${esc(tag)} 태그 노트 ${hits.length}개</div>` + hits.map(n => noteCard(n)).join('');
    }
    const chat = ctx().chat;
    const chapters = sortedChapters();
    const LIMIT = 300;
    const out = [];
    let total = 0, hiddenHits = 0, qrHits = 0;
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        if (!m || isRealSystem(m)) continue;
        const hidden = isHiddenMes(m);
        if (hs === 'shown' && hidden) continue;
        if (hs === 'hidden' && !hidden) continue;
        const qr = isQrMes(m);
        if (ui.scope === 'user' && (!m.is_user || qr)) continue;
        if (ui.scope === 'char' && (m.is_user || qr)) continue;
        if (ui.scope === 'qr' && !qr) continue;
        if (ui.chapterScope !== 'all' && chapterOf(i, chapters).id !== ui.chapterScope) continue;
        const text = searchText(m.mes);
        const lower = text.toLowerCase();
        const idx = lower.indexOf(q);
        if (idx === -1) continue;
        const folded = foldedText(m.mes).includes(q);
        let hits = 0;
        for (let p = idx; p !== -1; p = lower.indexOf(q, p + q.length)) hits++;
        total += hits;
        if (hidden) hiddenHits++;
        if (qr) qrHits++;
        if (out.length >= LIMIT) continue;
        const from = Math.max(0, idx - 40);
        const to = Math.min(text.length, idx + q.length + 60);
        const pre = (from > 0 ? '…' : '') + text.slice(from, idx);
        const hit = text.slice(idx, idx + q.length);
        const post = text.slice(idx + q.length, to) + (to < text.length ? '…' : '');
        out.push(`
        <div class="stbs-item stbs-result ${hidden ? 'is-hidden' : ''}" data-jump="${i}">
            <div class="stbs-grow">
                ${hidden || qr || folded ? `<div class="stbs-badges">${hidden ? '<span class="stbs-badge stbs-hid-badge"><i class="fa-solid fa-eye-slash"></i> 숨김</span>' : ''}${qr ? `<span class="stbs-badge stbs-qr-badge"><i class="fa-solid fa-bolt"></i> ${m.extra.type === 'narrator' ? '내레이터' : 'QR·코멘트'}</span>` : ''}${folded ? '<span class="stbs-badge stbs-fold-badge"><i class="fa-solid fa-caret-down"></i> 접힌 내용</span>' : ''}</div>` : ''}
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
    return `<div class="stbs-count">메시지 ${out.length}${out.length >= LIMIT ? '+' : ''}개${[hs === 'all' && hiddenHits ? `숨김 ${hiddenHits}` : '', ui.scope !== 'qr' && qrHits ? `QR ${qrHits}` : ''].filter(Boolean).map(t => ` <span class="stbs-dim">(${t})</span>`).join('')} · ${total}번 등장${out.length >= LIMIT ? ` <span class="stbs-dim">(처음 ${LIMIT}개만 표시)</span>` : ''}</div>` + out.join('');
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
        <div class="stbs-btn stbs-wide-btn stbs-ghost" data-act="stats-card"><i class="fa-regular fa-image"></i> 이 기록을 카드로 만들기</div>
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

const runLibSearch = debounce(() => { if (ui.tab === 'library') renderPanel(); }, 250);

function onPanelInput(e) {
    const t = e.target;
    if (t.id === 'stbs-q') { ui.q = t.value; runSearch(); }
    else if (t.id === 'stbs-lib-q') { ui.libQ = t.value; runLibSearch(); }
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
            case 'note-tag': {
                const t = act.dataset.tag;
                if (ui.tab === 'library') { ui.libTag = ui.libTag === t ? '' : t; renderPanel(); break; }
                ui.noteTag = ui.tab === 'notes' && ui.noteTag === t ? '' : t;
                ui.tab = 'notes'; ui.scrap = null; renderPanel();
                break;
            }
            case 'daily-next': ui.dailyShift = (ui.dailyShift || 0) + 1; renderPanel(); break;
            case 'daily-hide': { const s2 = settings(); s2.dailyHidden = { ...(s2.dailyHidden || {}), [ctx().getCurrentChatId()]: todayKey() }; saveSettings(); renderPanel(); toastr.info('오늘의 문장은 내일 다시 보여 드릴게요.', '', { timeOut: 2200 }); break; }
            case 'chapter-card': openSummaryCard('chapter', id); break;
            case 'stats-card': openSummaryCard('stats'); break;
            case 'bm-sort': settings().bmSort = act.dataset.v; saveSettings(); renderPanel(); break;
            case 'bm-folder': { const b = d.bookmarks.find(x => x.id === id); if (b) await setBmFolder(b); break; }
            case 'bm-fold': { const f2 = act.dataset.f; if (ui.bmFold.has(f2)) ui.bmFold.delete(f2); else ui.bmFold.add(f2); renderPanel(); break; }
            case 'lib-refresh': loadLibrary(true); renderPanel(); break;
            case 'lib-kind': ui.libKind = act.dataset.k; renderPanel(); break;
            case 'lib-tag': ui.libTag = ui.libTag === act.dataset.tag ? '' : act.dataset.tag; renderPanel(); break;
            case 'lib-toggle': {
                ui.libOpen ||= new Map();
                const el = act.closest('.stbs-lib-chat');
                ui.libOpen.set(act.dataset.chat, !el?.classList.contains('open'));
                renderPanel();
                break;
            }
            case 'lib-open': openChatAndJump(act.dataset.chat, Number(act.dataset.mes), act.dataset.nid || null); break;
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
            case 'scrap-card': { const sb = getScrap(id); if (sb) openCardChoice(scrapNotes(sb), sb.name); break; }
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
                openCardChoice(picked);
                break;
            }
        }
        return;
    }
    if (e.target.closest('[data-bmgrip]')) return; // end of a drag, not a tap on the bookmark
    const jump = e.target.closest('[data-jump]');
    if (jump) {
        const i = Number(jump.dataset.jump), noteId = jump.dataset.note || null, q = ui.tab === 'search' ? ui.q : '';
        if (settings().farReader && isFar(i)) openReader(i, { noteId, query: q });
        else jumpTo(i, noteId, q);
    }
}

// ---------------------------------------------------------------- many cards at once (v1.15)

/** Everything a card needs to know about one message (and the note on it, if any). */
function cardBase(mesId, note = null) {
    const s = settings(), c = ctx();
    return {
        title: c.groupId ? (c.groups?.find?.(x => x.id === c.groupId)?.name || c.name2 || '') : (c.name2 || ''),
        page: pageOf(mesId),
        time: mesTime(mesId),
        hl: s.colors[note?.color ?? 0] || s.colors[0] || '#ffe066',
        who: speaker(mesId),
        chapter: sortedChapters().length ? chapterLabel(chapterOf(mesId)) : '',
    };
}
async function cardAssets(mesId) {
    const u = avatarUrls(mesId);
    const [thumb, full] = await Promise.all([loadCardImage(u.thumb), loadCardImage(u.full)]);
    return { thumb, full };
}

/** "1 / 5" on cards saved as a set, where each design has room for it. */
function drawSeriesMark(g, W, H, layout, t, k, n) {
    const s = `${k} / ${n}`;
    g.save();
    g.font = `600 24px ${pageFonts().uiFont}, sans-serif`;
    g.textBaseline = 'middle';
    const w = g.measureText(s).width + 30, h = 42;
    let x = W - 64 - w, y = 64;
    if (layout === 'page') { x = 110; y = H - 92 - h / 2 - 8; }
    if (layout === 'subtitle') { x = W - 120 - w; y = Math.round(H * 0.075) / 2 - h / 2; }
    const dark = t.dark || layout === 'subtitle' || ['#26332a', '#1b2140', '#161616'].includes(t.bg);
    g.fillStyle = dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.07)';
    roundPath(g, x, y, w, h, h / 2); g.fill();
    g.fillStyle = layout === 'subtitle' ? '#d0d0d0' : (t.sub || '#888');
    g.fillText(s, x + 15, y + h / 2 + 1);
    g.restore();
}

/** Picked notes / a scrapbook: one card with everything, or one card per note. */
function openCardChoice(notes, name = '') {
    if (!notes.length) return;
    if (notes.length === 1) { openCard({ note: notes[0] }); return; }
    const body = openModal('카드로 만들기', `
        <div class="stbs-choice">
            <button type="button" class="stbs-choice-btn" data-pick="one"><i class="fa-regular fa-square"></i><b>한 장에 모으기</b><span>노트 ${notes.length}개를 카드 한 장에 이어서 담아요</span></button>
            <button type="button" class="stbs-choice-btn" data-pick="many"><i class="fa-regular fa-clone"></i><b>여러 장으로</b><span>노트마다 한 장씩, 같은 디자인으로 ${notes.length}장을 만들어요</span></button>
        </div>`);
    body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pick]');
        if (!b) return;
        closeModal();
        if (b.dataset.pick === 'one') cardFromNotes(notes); else openCardSeries(notes, name);
    });
}

function openCardSeries(notes, name = '') {
    const s = settings();
    let layout = cardLayoutOf(s);
    if (layout === 'commu') layout = 'underline';
    const items = notes.map(n => ({ n, info: { ...cardBase(n.mesId, n), text: noteText(n), trans: n.trans || '', seed: parseInt(hash(noteText(n)).slice(0, 6), 36) || 7 }, assets: {} }));
    let cur = 0;
    const layouts = Object.entries(CARD_LAYOUTS).filter(([k]) => k !== 'commu');
    const body = openModal(`카드 ${notes.length}장`, `
        <div class="stbs-cx">
            <div class="stbs-cx-view stbs-cx-series">
                <canvas id="stbs-card-canvas"></canvas>
                <div class="stbs-series-nav">
                    <button type="button" data-step="-1" title="앞 장" aria-label="앞 장"><i class="fa-solid fa-chevron-left"></i></button>
                    <span id="stbs-series-at">1 / ${notes.length}</span>
                    <button type="button" data-step="1" title="다음 장" aria-label="다음 장"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </div>
            <div class="stbs-cx-side">
                <section class="stbs-cx-sec">
                    <div class="stbs-cx-h">디자인 <span class="stbs-dim">모든 장에 똑같이</span></div>
                    <div class="stbs-cx-lays">${layouts.map(([k, L]) => `<button type="button" class="stbs-cx-lay ${k === layout ? 'active' : ''}" data-layout="${k}"><canvas class="stbs-cx-thumb" data-thumb="${k}" width="216" height="270"></canvas><span>${L.name}</span></button>`).join('')}</div>
                    <div class="stbs-cx-row"><span class="stbs-cx-k">색</span><div class="stbs-cx-tints" id="stbs-cx-tints"></div></div>
                    <div class="stbs-cx-row"><span class="stbs-cx-k">크기</span><div class="stbs-seg">${Object.keys(CARD_RATIOS).map(r => `<button type="button" data-ratio="${r}" class="${r === s.cardRatio ? 'active' : ''}">${RATIO_NAMES[r]}</button>`).join('')}</div></div>
                </section>
                <section class="stbs-cx-sec">
                    <div class="stbs-cx-h">카드에 넣을 것</div>
                    <div class="stbs-cx-checks">${[...CARD_SHOW, ['count', `장 번호 (1 / ${notes.length})`]].map(([k, n]) => `<button type="button" class="stbs-cx-check ${(k === 'count' ? s.cardShow.count !== false : s.cardShow[k]) ? 'on' : ''}" data-show="${k}"><i class="fa-solid fa-check"></i>${n}</button>`).join('')}</div>
                </section>
                <section class="stbs-cx-sec">
                    <div class="stbs-cx-h">들어갈 노트</div>
                    <ol class="stbs-series-list">${items.map((it, k) => `<li data-goto="${k}" class="${k === 0 ? 'on' : ''}"><span>${esc(clip(it.info.text.replace(/\s+/g, ' '), 46))}</span></li>`).join('')}</ol>
                    <div class="stbs-hint">문장을 고치려면 카드를 한 장씩 만들어 주세요. 여기서는 디자인만 맞춰요.</div>
                </section>
            </div>
            <div class="stbs-cx-foot">
                ${navigator.canShare ? '<div class="stbs-btn" id="stbs-series-share"><i class="fa-solid fa-share-nodes"></i> 공유</div>' : ''}
                <div class="stbs-btn stbs-primary" id="stbs-series-save"><i class="fa-solid fa-download"></i> ${notes.length}장 모두 저장</div>
            </div>
        </div>`, { wide: 'x' });
    const canvas = body.querySelector('#stbs-card-canvas');
    const tint = (k) => s.cardTints[k] ?? 0;
    const infoAt = (k) => ({ ...items[k].info, show: s.cardShow, series: s.cardShow.count !== false ? { k: k + 1, n: items.length } : null });
    const draw = (cv, k, lay = layout, ratio = s.cardRatio) => drawCard(cv, infoAt(k), lay, tint(lay), ratio, items[k].assets);
    const redraw = () => {
        draw(canvas, cur);
        canvas.style.setProperty('aspect-ratio', `1080 / ${CARD_RATIOS[s.cardRatio]}`);
        body.querySelector('#stbs-series-at').textContent = `${cur + 1} / ${items.length}`;
        body.querySelectorAll('[data-goto]').forEach(li => li.classList.toggle('on', Number(li.dataset.goto) === cur));
    };
    const off = document.createElement('canvas');
    const drawThumbs = () => body.querySelectorAll('[data-thumb]').forEach(tc => {
        draw(off, cur, tc.dataset.thumb, '4:5');
        const tg = tc.getContext('2d'); tg.clearRect(0, 0, tc.width, tc.height); tg.drawImage(off, 0, 0, tc.width, tc.height);
    });
    const renderTints = () => {
        body.querySelector('#stbs-cx-tints').innerHTML = CARD_LAYOUTS[layout].tints.map((t, k) =>
            `<button type="button" class="stbs-cx-tint ${k === tint(layout) ? 'active' : ''}" data-tint="${k}" title="${t.name}"><span style="background:${t.bg || `rgb(${t.veil})`}"><i style="background:${t.mark || t.fg}"></i></span>${t.name}</button>`).join('');
    };
    body.addEventListener('click', (e) => {
        const st = e.target.closest('[data-step]');
        if (st) { cur = (cur + Number(st.dataset.step) + items.length) % items.length; redraw(); return; }
        const go = e.target.closest('[data-goto]');
        if (go) { cur = Number(go.dataset.goto); redraw(); return; }
        const lay = e.target.closest('[data-layout]');
        if (lay) { layout = lay.dataset.layout; s.cardLayout = layout; saveSettings(); body.querySelectorAll('[data-layout]').forEach(x => x.classList.toggle('active', x === lay)); renderTints(); redraw(); return; }
        const tn = e.target.closest('[data-tint]');
        if (tn) { s.cardTints[layout] = Number(tn.dataset.tint); saveSettings(); renderTints(); redraw(); drawThumbs(); return; }
        const ra = e.target.closest('[data-ratio]');
        if (ra) { s.cardRatio = ra.dataset.ratio; saveSettings(); body.querySelectorAll('[data-ratio]').forEach(x => x.classList.toggle('active', x === ra)); redraw(); return; }
        const sh = e.target.closest('[data-show]');
        if (sh) {
            const k = sh.dataset.show;
            s.cardShow[k] = k === 'count' ? s.cardShow.count === false : !s.cardShow[k];
            if (k === 'fox') s.cardFox = s.cardShow.fox;
            saveSettings(); sh.classList.toggle('on', k === 'count' ? s.cardShow.count !== false : !!s.cardShow[k]);
            redraw(); drawThumbs();
        }
    });
    const blobs = async () => {
        const out = [];
        const cv = document.createElement('canvas');
        for (let k = 0; k < items.length; k++) {
            draw(cv, k);
            out.push(await new Promise(r => cv.toBlob(r, 'image/png')));
        }
        return out;
    };
    const base = safeFileName(name || `명대사_${fmtDate(Date.now())}`);
    const fileName = (k) => `${base}_${String(k + 1).padStart(2, '0')}.png`;
    body.querySelector('#stbs-series-save').addEventListener('click', async () => {
        const list = await blobs();
        // one download after another — browsers drop downloads that start in the same moment
        for (let k = 0; k < list.length; k++) { if (list[k]) download(fileName(k), list[k]); await sleep(350); }
        toastr.success(`🦊 카드 ${list.length}장을 저장했어요.`);
    });
    body.querySelector('#stbs-series-share')?.addEventListener('click', async () => {
        const list = await blobs();
        const files = list.map((b, k) => new File([b], fileName(k), { type: 'image/png' }));
        try {
            if (!navigator.canShare({ files })) throw new Error('no');
            await navigator.share({ files });
        } catch (err) {
            if (err?.name !== 'AbortError') toastr.warning('이 브라우저에서는 여러 장 공유가 안 돼요. 모두 저장을 써 주세요.');
        }
    });
    renderTints();
    redraw();
    Promise.all([loadFoxImage(), document.fonts?.ready?.catch?.(() => { }), ...items.map(it => cardAssets(it.n.mesId).then(a => { it.assets = a; }))])
        .then(() => { if (canvas.isConnected) { redraw(); drawThumbs(); } });
    setTimeout(drawThumbs, 30);
}

// ---------------------------------------------------------------- chapter summary card & reading record card (v1.15)

const SUMMARY_TINTS = [
    { name: '미색', bg: '#f4eee1', fg: '#2f2a22', sub: '#857a68', box: '#fbf7ee', line: '#e2d8c5', star: '#e8a33d', accent: '#c8642e' },
    { name: '여우', bg: '#e8743b', fg: '#2a1408', sub: '#5e2a10', box: '#f08a55', line: '#f3a072', star: '#fff1e4', accent: '#fff1e4' },
    { name: '밤', bg: '#1d1f26', fg: '#eceef3', sub: '#9097a6', box: '#262934', line: '#333746', star: '#f2cf6c', accent: '#f29a66', dark: true },
];

function starShape(g, cx, cy, r) {
    g.beginPath();
    for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
        g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
}
function drawStars(g, x, cy, r, n, on, off) {
    for (let k = 0; k < 5; k++) { g.fillStyle = k < n ? on : off; starShape(g, x + r + k * r * 2.3, cy, r); g.fill(); }
    return x + 5 * r * 2.3;
}

function drawSummary(canvas, S, tintIdx = 0, ratio = '4:5', A = {}) {
    const t = SUMMARY_TINTS[tintIdx] || SUMMARY_TINTS[0];
    const W = canvas.width = 1080, H = canvas.height = CARD_RATIOS[ratio] || 1350;
    const g = canvas.getContext('2d');
    const f = pageFonts(), ui = `${f.uiFont}, sans-serif`, read = `${f.readFont}, sans-serif`;
    const M = 92, maxW = W - M * 2;
    g.fillStyle = t.bg; g.fillRect(0, 0, W, H);
    g.textBaseline = 'alphabetic';
    const off = t.dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.12)';
    // who this book is with
    let y = M;
    const showAv = S.show.avatar && A.thumb;
    if (showAv) {
        g.save(); g.beginPath(); g.arc(M + 36, y + 36, 36, 0, Math.PI * 2); g.clip(); coverImage(g, A.thumb, M, y, 72, 72); g.restore();
    }
    const hx = showAv ? M + 92 : M;
    g.fillStyle = t.fg; g.font = `700 32px ${ui}`; g.fillText(fitText(g, S.title || '', W - hx - M), hx, y + 32);
    g.fillStyle = t.sub; g.font = `26px ${ui}`; g.fillText(fitText(g, S.kicker, W - hx - M), hx, y + 68);
    y += 72 + 70;

    if (S.kind === 'chapter') {
        g.fillStyle = t.fg; g.font = `800 64px ${ui}`;
        const tl = wrapLines(g, S.heading, maxW).filter(Boolean).slice(0, 2);
        tl.forEach((l, k) => g.fillText(k === 1 && wrapLines(g, S.heading, maxW).filter(Boolean).length > 2 ? fitText(g, l + '…', maxW) : l, M, y + 56 + k * 78));
        y += 56 + (tl.length - 1) * 78 + 40;
        if (S.rating) { drawStars(g, M, y + 20, 20, S.rating, t.star, off); y += 64; }
        if (S.review) {
            g.fillStyle = t.fg; g.font = `500 34px ${read}`;
            const rl = wrapLines(g, `“${S.review}”`, maxW).filter(Boolean).slice(0, 2);
            rl.forEach((l, k) => g.fillText(l, M, y + 34 + k * 52));
            y += 34 + (rl.length - 1) * 52 + 40;
        }
        // the chapter's best lines — one text size for all of them, each box as tall as its text
        const foot = 120;
        const lines = S.lines.slice(0, 3);
        const quotes = lines.length ? lines : (S.opening ? [{ text: S.opening, who: S.openingWho, color: null }] : []);
        if (quotes.length) {
            g.fillStyle = t.sub; g.font = `600 26px ${ui}`; g.fillText(lines.length ? '이 장의 문장' : '이 장은 이렇게 시작해요', M, y + 30); y += 56;
            const avail = H - M - foot - y - (quotes.length - 1) * 18;
            const font = (fs) => `${fs}px ${read}`;
            const PADV = 26, WHO = 40, inner = maxW - 70;
            let size = 34, laid;
            for (; size >= 20; size -= 2) {
                laid = quotes.map(q => fitQuote(g, { main: q.text, font, maxW: inner, avail: 1e6, max: size, min: size, lh: 1.55 }));
                if (laid.reduce((a, m) => a + m.total + PADV * 2 + WHO, 0) <= avail) break;
            }
            // still too tall at the smallest size: cut each quote to its share
            const share = avail / quotes.length;
            quotes.forEach((q, k) => {
                let m = laid[k];
                if (m.total + PADV * 2 + WHO > share && laid.reduce((a, x) => a + x.total + PADV * 2 + WHO, 0) > avail) m = fitQuote(g, { main: q.text, font, maxW: inner, avail: share - PADV * 2 - WHO, max: size, min: size, lh: 1.55 });
                const box = m.total + PADV * 2 + WHO;
                g.fillStyle = t.box; roundPath(g, M, y, maxW, box, 20); g.fill();
                g.fillStyle = q.color || t.accent; roundPath(g, M, y + 18, 7, box - 36, 4); g.fill();
                drawLaid(g, m, { x: M + 36, y: y + PADV, w: inner, color: t.fg, subColor: t.sub, font });
                g.fillStyle = t.sub; g.font = `22px ${ui}`; g.fillText(fitText(g, q.who || '', inner), M + 36, y + box - PADV + 2);
                y += box + 18;
            });
        }
    } else {
        // reading record: the pages the fox ate, big
        g.fillStyle = t.sub; g.font = `600 28px ${ui}`; g.fillText('여우가 냠냠 먹어치운 분량', M, y + 28);
        g.fillStyle = t.fg; g.font = `800 168px ${ui}`;
        const num = Math.max(1, Math.round(S.pages)).toLocaleString();
        g.fillText(num, M - 6, y + 200);
        const nw = g.measureText(num).width;
        g.font = `700 52px ${ui}`; g.fillText('쪽', M + nw + 12, y + 200);
        y += 250;
        const tiles = S.tiles;
        const tw = (maxW - 18) / 2, th = 128;
        tiles.forEach(([v, l], k) => {
            const tx = M + (k % 2) * (tw + 18), ty = y + Math.floor(k / 2) * (th + 18);
            g.fillStyle = t.box; roundPath(g, tx, ty, tw, th, 22); g.fill();
            g.fillStyle = t.fg; g.font = `800 48px ${ui}`; g.fillText(fitText(g, v, tw - 52), tx + 28, ty + 64);
            g.fillStyle = t.sub; g.font = `26px ${ui}`; g.fillText(l, tx + 28, ty + 104);
        });
        y += Math.ceil(tiles.length / 2) * (th + 18) + 36;
        if (S.words.length && y < H - 380) {
            g.fillStyle = t.sub; g.font = `600 26px ${ui}`; g.fillText('자주 나온 단어', M, y + 26); y += 50;
            let wx = M;
            g.font = `600 30px ${ui}`;
            for (const w of S.words) {
                const ww = g.measureText(w).width + 44;
                if (wx + ww > W - M) break;
                g.fillStyle = t.box; roundPath(g, wx, y, ww, 58, 29); g.fill();
                g.fillStyle = t.fg; g.fillText(w, wx + 22, y + 40);
                wx += ww + 12;
            }
            y += 58 + 40;
        }
        if ((S.rating || S.review) && y < H - 220) {
            if (S.rating) { drawStars(g, M, y + 20, 18, S.rating, t.star, off); y += 56; }
            if (S.review) { g.fillStyle = t.fg; g.font = `500 32px ${read}`; g.fillText(fitText(g, `“${S.review}”`, maxW), M, y + 30); }
        }
    }
    // footer
    g.fillStyle = t.sub; g.font = `24px ${ui}`;
    g.fillText(fitText(g, S.footer || '', maxW - 100), M, H - M + 6);
    if (S.show.fox) foxStamp(g, W - M - 30, H - M - 4, 34, t.dark ? null : t.accent);
}

/** Which lines stand for a chapter: ones with a memo first, then the rest in story order. */
function chapterLines(from, to) {
    const s = settings();
    const notes = data().notes.filter(n => n.mesId >= from && n.mesId <= to && n.start != null);
    const scored = notes.map((n, k) => ({ n, k, score: (n.memo ? 2 : 0) + (n.color != null ? 1 : 0) }));
    scored.sort((a, b) => b.score - a.score || a.n.mesId - b.n.mesId || a.k - b.k);
    return scored.map(({ n }) => ({ id: n.id, text: noteText(n), who: speaker(n.mesId), color: n.color != null ? s.colors[n.color] : null, mesId: n.mesId }));
}

function chapterRange(id) {
    const chat = ctx().chat || [];
    const chapters = sortedChapters();
    if (id === '__prologue') return { title: chapters.length ? '프롤로그' : '처음부터', num: 0, from: 0, to: (chapters[0]?.mesId ?? chat.length) - 1, ch: null };
    const k = chapters.findIndex(c => c.id === id);
    if (k < 0) return null;
    return { title: chapters[k].title, num: k + 1, from: chapters[k].mesId, to: (chapters[k + 1]?.mesId ?? chat.length) - 1, ch: chapters[k] };
}

function openSummaryCard(kind, chapterId = null) {
    const s = settings();
    s.summaryTint ??= 0;
    const show = { avatar: s.cardShow?.avatar !== false, fox: s.cardFox !== false };
    const c = ctx();
    const title = c.groupId ? (c.groups?.find?.(x => x.id === c.groupId)?.name || '') : (c.name2 || '');
    const cpp = Math.max(100, Number(s.charsPerPage) || 600);
    let S, picks = [], all = [];
    if (kind === 'chapter') {
        const r = chapterRange(chapterId);
        if (!r) return;
        all = chapterLines(r.from, r.to);
        picks = all.slice(0, 3).map(x => x.id);
        let chars = 0; for (let j = r.from; j <= r.to; j++) chars += plain(c.chat[j]?.mes).length;
        const p0 = pageOf(r.from), p1 = pageOf(Math.max(r.from, r.to));
        S = { kind, title, kicker: r.num ? `${r.num}장` : r.title, heading: r.num ? r.title : r.title, rating: Number(r.ch?.rating) || 0, review: r.ch?.review || '',
            footer: `p. ${Math.max(1, p0)}–${Math.max(1, p1)} · 약 ${Math.max(1, Math.round(chars / cpp))}쪽 · #${r.from}–#${Math.max(r.from, r.to)}`, show, lines: [] };
        // no highlighted lines in this chapter: show how it begins instead
        const first = (() => { for (let j = r.from; j <= r.to; j++) { const m = c.chat[j]; if (m && !m.is_system && plain(m.mes).trim()) return j; } return -1; })();
        if (first >= 0) { S.opening = clip(plainKeep(c.chat[first].mes), 220); S.openingWho = speaker(first); }
    } else {
        const st = computeStats(), d = data();
        const days = st.first && st.last ? Math.max(1, Math.round((st.last - st.first) / 86400000) + 1) : null;
        S = { kind, title, kicker: '함께 읽은 기록', pages: st.pages, rating: Number(d.review?.rating) || 0, review: d.review?.text || '',
            tiles: [[st.count.toLocaleString(), '메시지'], [days ? `${days}일` : '–', '함께한 날'], [String(d.notes.filter(n => n.color != null).length), '형광펜'], [String(d.bookmarks.length), '책갈피']],
            words: st.topWords.slice(0, 6).map(([w]) => w), footer: `${fmtDate(Date.now())} · 1쪽 = ${cpp}자`, show };
    }
    const body = openModal(kind === 'chapter' ? '챕터 요약 카드' : '독서 기록 카드', `
        <div class="stbs-cx">
            <div class="stbs-cx-view"><canvas id="stbs-card-canvas"></canvas></div>
            <div class="stbs-cx-side">
                <section class="stbs-cx-sec">
                    <div class="stbs-cx-row"><span class="stbs-cx-k">색</span><div class="stbs-cx-tints">${SUMMARY_TINTS.map((t, k) => `<button type="button" class="stbs-cx-tint ${k === s.summaryTint ? 'active' : ''}" data-tint="${k}"><span style="background:${t.bg}"><i style="background:${t.accent}"></i></span>${t.name}</button>`).join('')}</div></div>
                    <div class="stbs-cx-row"><span class="stbs-cx-k">크기</span><div class="stbs-seg">${Object.keys(CARD_RATIOS).map(r => `<button type="button" data-ratio="${r}" class="${r === s.cardRatio ? 'active' : ''}">${RATIO_NAMES[r]}</button>`).join('')}</div></div>
                    <div class="stbs-cx-checks">${[['avatar', '프로필 사진'], ['fox', '여우 도장']].map(([k, n]) => `<button type="button" class="stbs-cx-check ${show[k] ? 'on' : ''}" data-show="${k}"><i class="fa-solid fa-check"></i>${n}</button>`).join('')}</div>
                </section>
                ${kind === 'chapter' ? `<section class="stbs-cx-sec">
                    <div class="stbs-cx-h">카드에 넣을 문장 <span class="stbs-dim">3개까지</span></div>
                    ${all.length ? `<div class="stbs-pick-list">${all.slice(0, 30).map(x => `<button type="button" class="stbs-pick ${picks.includes(x.id) ? 'on' : ''}" data-pickline="${x.id}"><i class="fa-solid fa-check"></i><span>${esc(clip(x.text.replace(/\s+/g, ' '), 70))}</span></button>`).join('')}</div>`
                        : '<div class="stbs-hint">이 장에 칠한 문장이 없어요. 형광펜을 칠하면 여기에 골라 넣을 수 있어요.</div>'}
                    <div class="stbs-hint">별점과 한줄평은 목차의 <i class="fa-regular fa-star"></i> 버튼으로 바꿔요.</div>
                </section>` : `<section class="stbs-cx-sec"><div class="stbs-hint">숫자는 통계 탭과 같아요. 별점과 한줄평은 "이 책의 별점"에서 바꿔요.</div></section>`}
            </div>
            <div class="stbs-cx-foot">
                <div class="stbs-btn" id="stbs-card-copy"><i class="fa-solid fa-copy"></i> 이미지 복사</div>
                <div class="stbs-btn stbs-primary" id="stbs-card-save"><i class="fa-solid fa-download"></i> PNG로 저장</div>
            </div>
        </div>`, { wide: 'x' });
    const canvas = body.querySelector('#stbs-card-canvas');
    const A = {};
    const redraw = () => {
        if (kind === 'chapter') S.lines = picks.map(id => all.find(x => x.id === id)).filter(Boolean);
        drawSummary(canvas, S, s.summaryTint, s.cardRatio, A);
        canvas.style.setProperty('aspect-ratio', `1080 / ${CARD_RATIOS[s.cardRatio]}`);
    };
    body.addEventListener('click', (e) => {
        const tn = e.target.closest('[data-tint]');
        if (tn) { s.summaryTint = Number(tn.dataset.tint); saveSettings(); body.querySelectorAll('[data-tint]').forEach(x => x.classList.toggle('active', x === tn)); redraw(); return; }
        const ra = e.target.closest('[data-ratio]');
        if (ra) { s.cardRatio = ra.dataset.ratio; saveSettings(); body.querySelectorAll('[data-ratio]').forEach(x => x.classList.toggle('active', x === ra)); redraw(); return; }
        const sh = e.target.closest('[data-show]');
        if (sh) { const k = sh.dataset.show; show[k] = !show[k]; sh.classList.toggle('on', show[k]); redraw(); return; }
        const pl = e.target.closest('[data-pickline]');
        if (pl) {
            const id = pl.dataset.pickline;
            if (picks.includes(id)) picks = picks.filter(x => x !== id);
            else if (picks.length < 3) picks.push(id);
            else { toastr.info('문장은 3개까지 넣을 수 있어요. 하나를 먼저 빼 주세요.', '', { timeOut: 2200, preventDuplicates: true }); return; }
            body.querySelectorAll('[data-pickline]').forEach(x => x.classList.toggle('on', picks.includes(x.dataset.pickline)));
            redraw();
        }
    });
    const name = kind === 'chapter' ? `챕터요약_${S.kicker}_${S.heading}` : `독서기록_${title}`;
    body.querySelector('#stbs-card-save').addEventListener('click', () => canvas.toBlob(b => b && download(`${safeFileName(name)}.png`, b), 'image/png'));
    body.querySelector('#stbs-card-copy').addEventListener('click', () => canvas.toBlob(async (b) => {
        try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); toastr.success('이미지를 복사했어요.'); }
        catch { toastr.warning('이 브라우저에서는 이미지 복사가 안 돼요. PNG로 저장을 써 주세요.'); }
    }, 'image/png'));
    redraw();
    const lastChar = [...(c.chat || [])].map((m, i) => [m, i]).reverse().find(([m]) => m && !m.is_user && !m.is_system)?.[1] ?? 0;
    Promise.all([loadFoxImage(), document.fonts?.ready?.catch?.(() => { }), cardAssets(lastChar).then(a => Object.assign(A, a))])
        .then(() => { if (canvas.isConnected) redraw(); });
}

// ---------------------------------------------------------------- today's line (v1.15)

const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

/** One highlighted line from this book, the same one all day (↻ picks another). */
function dailyPick() {
    const notes = data().notes.filter(n => n.start != null && noteText(n).trim());
    if (notes.length < 2) return null;
    const seed = parseInt(hash(`${todayKey()}|${ctx().getCurrentChatId?.() || ''}`).slice(0, 7), 36) || 1;
    return notes[(seed + (ui.dailyShift || 0)) % notes.length];
}
function dailyHtml() {
    const s = settings();
    if (!s.dailyLine || !hasChat()) return '';
    if (s.dailyHidden?.[ctx().getCurrentChatId?.()] === todayKey()) return '';
    const n = dailyPick();
    if (!n) return '';
    const days = Math.max(0, Math.floor((Date.now() - (n.created || Date.now())) / 86400000));
    const when = days >= 1 ? `${days}일 전에 칠한 문장` : '오늘 칠한 문장';
    const color = n.color != null ? `style="--bar:${esc(s.colors[n.color])}"` : '';
    return `<div class="stbs-daily" ${color} data-jump="${n.mesId}" data-note="${n.id}">
        <div class="stbs-daily-head"><span><i class="fa-solid fa-sun"></i> 오늘의 문장</span><span class="stbs-dim">${when}</span>
            <span class="stbs-daily-acts">
                <span class="stbs-icon-btn fa-solid fa-rotate" data-act="daily-next" title="다른 문장"></span>
                <span class="stbs-icon-btn fa-solid fa-quote-left" data-act="note-card" data-id="${n.id}" title="명대사 카드"></span>
                <span class="stbs-icon-btn fa-solid fa-xmark" data-act="daily-hide" title="오늘은 그만 보기"></span>
            </span></div>
        <div class="stbs-daily-text">${esc(noteText(n))}</div>
        <div class="stbs-meta">${esc(speaker(n.mesId))} · #${n.mesId}</div>
    </div>`;
}

// ---------------------------------------------------------------- note tags (v1.15)
// A tag is simply #word inside the memo: "#설렘 #복선 우산 장면에서 처음으로…"

const TAG_RE = /#([\p{L}\p{N}_]+)/gu;
function noteTags(n) {
    return [...new Set([...String(n?.memo || '').matchAll(TAG_RE)].map(m => m[1]))];
}
function allTags(notes = data().notes) {
    const m = new Map();
    for (const n of notes) for (const t of noteTags(n)) m.set(t, (m.get(t) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
/** Memo text with its #tags as tappable chips. */
function memoHtml(memo) {
    return esc(memo).replace(/#([\p{L}\p{N}_]+)/gu, (all, t) => `<span class="stbs-tag" data-act="note-tag" data-tag="${t}">#${t}</span>`);
}

// ---------------------------------------------------------------- bookmark folders & own order (v1.15)

function bmFolders(list = data().bookmarks) {
    const seen = new Map();
    for (const b of list) if (b.folder && !seen.has(b.folder)) seen.set(b.folder, Math.min(...list.filter(x => x.folder === b.folder).map(x => x.order ?? x.mesId)));
    return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([f]) => f);
}
/** Give every bookmark an order the first time "my order" is used (story order to start with). */
function ensureBmOrder() {
    const list = data().bookmarks;
    if (list.every(b => Number.isFinite(b.order))) return;
    [...list].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.mesId - b.mesId).forEach((b, k) => { b.order = k; });
    persist();
}

async function setBmFolder(b) {
    const have = bmFolders();
    const res = await ctx().Popup.show.input('📁 책갈피 폴더', have.length ? `있는 폴더: ${have.join(', ')}<br>비워 두면 폴더에서 빼요.` : '새 폴더 이름을 적어요. 비워 두면 폴더에서 빼요.', b.folder || '');
    if (res === null || res === false || res === undefined) return;
    const v = String(res).trim().slice(0, 30);
    if (v) b.folder = v; else delete b.folder;
    persist(); refreshPanel();
}

/** Drag a bookmark by its handle (mouse or finger) to reorder it, or drop it into another folder. */
function startBmDrag(e, handle) {
    const item = handle.closest('.stbs-bm-item');
    const body = $id('stbs-body');
    if (!item || !body) return;
    e.preventDefault();
    const pid = e.pointerId;
    item.classList.add('dragging');
    const startY = e.clientY;
    const r0 = item.getBoundingClientRect();
    let lastY = e.clientY;
    // where the item is in the list follows the finger right away (no frame delay: a quick flick must not lose moves)
    const place = () => {
        const others = [...body.querySelectorAll('.stbs-bm-item:not(.dragging), .stbs-bm-group-head')];
        const over = others.find(o => { const r = o.getBoundingClientRect(); return lastY >= r.top && lastY <= r.bottom; });
        if (over) {
            if (over.classList.contains('stbs-bm-group-head')) {
                const list = over.parentElement.querySelector('.stbs-bm-list');
                if (list && list.firstElementChild !== item) list.prepend(item);
            } else {
                const r = over.getBoundingClientRect();
                const ref = lastY < r.top + r.height / 2 ? over : over.nextElementSibling;
                if (ref !== item && item.nextElementSibling !== ref) over.parentElement.insertBefore(item, ref);
            }
        }
        item.style.transform = '';
        const nr = item.getBoundingClientRect();
        item.style.transform = `translateY(${lastY - (nr.top + (startY - r0.top))}px)`;
    };
    // listen on the window: moving the item inside the list makes the browser drop pointer capture
    const move = (ev) => {
        if (ev.pointerId !== pid) return;
        ev.preventDefault();
        lastY = ev.clientY;
        // auto-scroll near the panel's edges
        const br = body.getBoundingClientRect();
        if (lastY < br.top + 40) body.scrollTop -= 12; else if (lastY > br.bottom - 40) body.scrollTop += 12;
        place();
    };
    const up = (ev) => {
        if (ev && ev.pointerId !== pid) return;
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', up, true);
        item.classList.remove('dragging');
        item.style.transform = '';
        const d = data();
        let k = 0;
        body.querySelectorAll('.stbs-bm-list').forEach(listEl => {
            const folder = listEl.dataset.folder || '';
            listEl.querySelectorAll('.stbs-bm-item').forEach(el => {
                const b = d.bookmarks.find(x => x.id === el.dataset.bm);
                if (!b) return;
                b.order = k++;
                if (folder) b.folder = folder; else delete b.folder;
            });
        });
        persist();
        refreshPanel();
    };
    window.addEventListener('pointermove', move, { capture: true, passive: false });
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
}

// ---------------------------------------------------------------- library: this character's other chats (v1.15)

const library = { key: '', at: 0, loading: false, chats: [], error: '' };

function libraryKey() {
    const c = ctx();
    return c.groupId ? `g:${c.groupId}` : `c:${c.characters?.[c.characterId]?.avatar || ''}`;
}
function chatLabel(fileId) {
    // "Seraphina - 2026-10-04@04h55m21s" → "2026-10-04 04:55"
    const m = String(fileId).match(/(\d{4})-(\d{1,2})-(\d{1,2})\s*@\s*(\d{1,2})h\s*(\d{1,2})m/);
    return m ? `${m[1]}.${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')} ${m[4].padStart(2, '0')}:${m[5].padStart(2, '0')}` : String(fileId);
}

async function loadLibrary(force = false) {
    const key = libraryKey();
    if (library.loading || (!force && library.key === key && Date.now() - library.at < 60000)) return;
    const c = ctx();
    library.loading = true; library.error = '';
    try {
        if (c.groupId) throw new Error('group');
        const avatar = c.characters?.[c.characterId]?.avatar;
        if (!avatar) throw new Error('none');
        const res = await fetch('/api/characters/chats', { method: 'POST', headers: c.getRequestHeaders(), body: JSON.stringify({ avatar_url: avatar, metadata: true }) });
        const list = Object.values(await res.json() || {}).filter(x => x?.file_name);
        // older SillyTavern doesn't send the metadata with the list: read each chat's first line instead
        const need = list.filter(x => !x.chat_metadata);
        for (let k = 0; k < need.length; k += 4) {
            await Promise.all(need.slice(k, k + 4).map(async (x) => {
                try {
                    const r = await fetch('/api/chats/get', { method: 'POST', headers: c.getRequestHeaders(), body: JSON.stringify({ ch_name: c.characters[c.characterId].name, file_name: String(x.file_name).replace(/\.jsonl$/, ''), avatar_url: avatar }) });
                    const arr = await r.json();
                    x.chat_metadata = (Array.isArray(arr) ? arr[0]?.chat_metadata : null) || {};
                    x.__messages = Array.isArray(arr) ? arr.slice(1) : null;
                } catch { x.chat_metadata = {}; }
            }));
        }
        const current = c.getCurrentChatId?.();
        library.chats = list.map(x => {
            const id = String(x.file_name).replace(/\.jsonl$/, '');
            const isCur = id === current;
            const d = isCur ? data() : (x.chat_metadata?.[META_KEY] || {});
            return { id, label: chatLabel(id), isCur, last: Number(x.last_mes) || Date.parse(x.last_mes) || 0, items: Number(x.chat_items) || 0, notes: d.notes || [], bookmarks: d.bookmarks || [], review: d.review || null, messages: isCur ? null : x.__messages || null };
        }).filter(x => x.notes.length || x.bookmarks.length || x.isCur).sort((a, b) => (b.isCur - a.isCur) || b.last - a.last);
        library.key = key; library.at = Date.now();
    } catch (err) {
        library.chats = []; library.key = key; library.at = Date.now();
        library.error = err?.message === 'group' ? 'group' : 'fail';
    } finally {
        library.loading = false;
        if (ui.tab === 'library') refreshPanel();
    }
}

function renderLibrary() {
    const key = libraryKey();
    if (library.key !== key || Date.now() - library.at > 60000) loadLibrary();
    if (library.error === 'group') return emptyState('그룹 채팅에서는 아직 못 넘나들어요', '캐릭터 한 명과의 채팅에서 써 주세요.');
    if (library.loading && library.key !== key) return emptyState('서재를 살펴보는 중이에요…', '이 캐릭터와 나눈 다른 채팅들을 열어 보고 있어요.');
    if (library.error) return emptyState('다른 채팅을 읽지 못했어요', '<span class="stbs-btn" data-act="lib-refresh"><i class="fa-solid fa-rotate"></i> 다시 시도</span>', false);
    const q = (ui.libQ || '').trim().toLowerCase();
    const kind = ui.libKind || 'all';
    const tag = ui.libTag || '';
    const s = settings();
    const chats = library.chats.map(ch => ({ ...ch, notes: ch.isCur ? data().notes : ch.notes, bookmarks: ch.isCur ? data().bookmarks : ch.bookmarks }));
    const tags = allTags(chats.flatMap(ch => ch.notes));
    let total = 0;
    const blocks = chats.map(ch => {
        const rows = [];
        if (kind !== 'bookmark') for (const n of ch.notes) {
            const text = n.start == null ? (ch.messages ? plainKeep(ch.messages[n.mesId]?.mes) : '') : (n.text || n.quote || '');
            if (tag && !noteTags(n).includes(tag)) continue;
            if (q && !`${text}\n${n.memo || ''}`.toLowerCase().includes(q)) continue;
            rows.push({ t: n.mesId, html: `<div class="stbs-note stbs-lib-row ${n.color == null ? 'no-color' : ''}" ${n.color != null ? `style="--bar:${esc(s.colors[n.color])}"` : ''} data-act="lib-open" data-chat="${esc(ch.id)}" data-mes="${n.mesId}" data-nid="${n.id}">
                <div class="stbs-note-quote">${text ? esc(text) : `<span class="stbs-badge">메시지 전체</span> #${n.mesId}`}</div>
                ${n.memo ? `<div class="stbs-note-memo">${memoHtml(n.memo)}</div>` : ''}
                <div class="stbs-meta">#${n.mesId} · ${fmtDate(n.updated || n.created)}</div></div>` });
        }
        if (kind !== 'note' && !tag) for (const b of ch.bookmarks) {
            const text = ch.isCur ? plain(msg(b.mesId)?.mes) : (ch.messages ? plain(ch.messages[b.mesId]?.mes) : '');
            if (q && !`${b.label || ''}\n${text}`.toLowerCase().includes(q)) continue;
            rows.push({ t: b.mesId, html: `<div class="stbs-item stbs-bm-item stbs-lib-row" data-act="lib-open" data-chat="${esc(ch.id)}" data-mes="${b.mesId}">
                <i class="fa-solid fa-bookmark stbs-bm-ico"></i>
                <div class="stbs-grow"><div class="stbs-item-title">${esc(b.label || (text ? clip(text, 40) : `#${b.mesId}`))}</div>
                ${b.folder ? `<div class="stbs-meta"><i class="fa-regular fa-folder"></i> ${esc(b.folder)}</div>` : ''}<div class="stbs-meta">#${b.mesId} · ${fmtDate(b.created)}</div></div></div>` });
        }
        if (!rows.length) return '';
        total += rows.length;
        rows.sort((a, b) => a.t - b.t);
        const open = ui.libOpen?.get(ch.id) ?? (ch.isCur || !!q || !!tag);
        return `<div class="stbs-lib-chat ${open ? 'open' : ''}">
            <div class="stbs-lib-head" data-act="lib-toggle" data-chat="${esc(ch.id)}">
                <i class="fa-solid fa-chevron-right stbs-lib-caret"></i>
                <div class="stbs-grow"><b>${esc(ch.label)}</b>${ch.isCur ? ' <span class="stbs-badge">지금 채팅</span>' : ''}
                <div class="stbs-meta">${[ch.notes.length && `노트 ${ch.notes.length}`, ch.bookmarks.length && `책갈피 ${ch.bookmarks.length}`, ch.items && `메시지 ${ch.items}`].filter(Boolean).join(' · ')}${ch.review?.rating ? ` · ${'★'.repeat(ch.review.rating)}` : ''}</div></div>
                <span class="stbs-count-pill">${rows.length}</span>
            </div>
            ${open ? `<div class="stbs-lib-rows">${rows.map(r => r.html).join('')}</div>` : ''}
        </div>`;
    }).join('');
    const chip = (v, label) => `<div class="stbs-chip ${kind === v ? 'active' : ''}" data-act="lib-kind" data-k="${v}">${label}</div>`;
    return `
        <div class="stbs-search-bar"><i class="fa-solid fa-magnifying-glass stbs-search-ico"></i>
            <input id="stbs-lib-q" type="search" placeholder="모든 채팅의 노트·책갈피에서 찾기…" value="${esc(ui.libQ || '')}" autocomplete="off"></div>
        <div class="stbs-row stbs-wrap">${chip('all', '전체')}${chip('note', '노트')}${chip('bookmark', '책갈피')}
            <div class="stbs-chip stbs-sort" data-act="lib-refresh" title="다시 읽어 오기"><i class="fa-solid fa-rotate ${library.loading ? 'fa-spin' : ''}"></i></div></div>
        ${tags.length ? `<div class="stbs-row stbs-wrap stbs-tag-row">${tags.slice(0, 20).map(([t, n]) => `<span class="stbs-tag ${tag === t ? 'on' : ''}" data-act="lib-tag" data-tag="${esc(t)}">#${esc(t)} <span class="stbs-dim">${n}</span></span>`).join('')}</div>` : ''}
        <div class="stbs-count">채팅 ${library.chats.length}개${total ? ` · ${total}개 찾음` : ''}</div>
        ${blocks || emptyState(q || tag ? '찾는 노트가 없어요' : '아직 다른 채팅에 남긴 기록이 없어요', q || tag ? '다른 단어로 찾아볼까요?' : '이 캐릭터와의 다른 채팅에서 칠한 문장과 책갈피가 여기에 모여요.', false)}`;
}

let pendingJump = null;
/** Open another chat of this character, then go to the message (and note) there. */
async function openChatAndJump(chatId, mesId, noteId) {
    const c = ctx();
    if (chatId === c.getCurrentChatId?.()) { jumpTo(mesId, noteId); return; }
    pendingJump = { chatId, mesId, noteId, at: Date.now() };
    toastr.info('🦊 그 채팅을 펼치는 중이에요…', '', { timeOut: 2000 });
    try { await c.openCharacterChat(chatId); }
    catch { pendingJump = null; toastr.warning('그 채팅을 열지 못했어요.'); }
}
function runPendingJump() {
    const p = pendingJump;
    if (!p || Date.now() - p.at > 30000) { pendingJump = null; return; }
    if (ctx().getCurrentChatId?.() !== p.chatId) return;
    pendingJump = null;
    setTimeout(() => { if (settings().farReader && isFar(p.mesId)) openReader(p.mesId, { noteId: p.noteId }); else jumpTo(p.mesId, p.noteId); }, 700);
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
        lines.push(`- **${b.label || clip(text, 40)}** — ${speaker(b.mesId)} (#${b.mesId})${b.folder ? ` 📁 ${b.folder}` : ''}`);
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
                <b class="stbs-set-title">${FOX_SVG} ${APP_NAME} <small class="stbs-ver">v${VERSION}</small></b>
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
                <label class="checkbox_label"><input type="checkbox" data-set="farReader"> <span>멀리 있는 옛날 메시지는 미리 읽기 창으로 먼저 보기</span></label>
                <label class="checkbox_label"><input type="checkbox" data-set="dailyLine"> <span>패널 맨 위에 오늘의 문장 보이기</span></label>
                <div class="stbs-set-row"><span>패널 테마</span>
                    <select class="text_pole stbs-select" data-set-theme>${Object.entries(PANEL_THEMES).map(([k, v]) => `<option value="${k}" ${s.theme === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
                </div>
                <div class="menu_button stbs-wide-btn" id="stbs-reset-pos"><i class="fa-solid fa-arrows-to-dot"></i> 패널 위치·크기 초기화</div>
                <div class="menu_button stbs-wide-btn" id="stbs-jump-report"><i class="fa-solid fa-clipboard-list"></i> 마지막 이동 기록 보기</div>
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
    root.querySelector('#stbs-jump-report').addEventListener('click', () => openJumpReport());
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
            callback: (_args, value) => { const v = String(value ?? '').trim(); if (v === 'debug') openJumpReport(); else openPanel(v || undefined); return ''; },
            returns: 'nothing',
            unnamedArgumentList: [SlashCommandArgument.fromProps({
                description: 'tab: toc | bookmarks | notes | search | stats | trash (debug = last jump log)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumList: [...TABS.map(t => t[0]), 'trash', 'debug'],
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
    ui.noteTag = ''; ui.dailyShift = 0;
    library.at = 0;
    reconcile();
    setTimeout(decorateAll, 50);
    refreshPanel();
    runPendingJump();
}

function bindGlobal() {
    const { eventSource, event_types: E } = ctx();
    eventSource.on(E.CHAT_CHANGED, onChatChanged);
    // the user is writing / a reply is coming: stop holding the old position so the chat can follow
    for (const ev of [E.CHAT_CHANGED, E.MESSAGE_SENT, E.GENERATION_STARTED]) if (ev) eventSource.on(ev, () => { releaseHold?.('chat activity'); releaseGuard?.('chat activity'); });
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
