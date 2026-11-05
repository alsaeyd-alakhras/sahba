// Minimal safe markdown → DOM (no innerHTML). Headings, paragraphs, lists, quotes, code, hr, **b**, *i*, `code`, [link](url).

function inline(text, parent) {
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parent.append(document.createTextNode(text.slice(last, m.index)));
    if (m[2] || m[3]) { const el = document.createElement('strong'); inline(m[2] || m[3], el); parent.append(el); }
    else if (m[4]) { const el = document.createElement('code'); el.textContent = m[4]; parent.append(el); }
    else if (m[5] || m[6]) { const el = document.createElement('em'); inline(m[5] || m[6], el); parent.append(el); }
    else if (m[7]) {
      const url = m[8];
      if (/^(https?:|mailto:|#)/i.test(url)) {
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.textContent = m[7];
        parent.append(a);
      } else parent.append(document.createTextNode(m[7]));
    }
    last = re.lastIndex;
  }
  if (last < text.length) parent.append(document.createTextNode(text.slice(last)));
}

export function renderMarkdown(src) {
  const root = document.createElement('div');
  root.className = 'md';
  root.dir = 'auto';
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  let para = [];
  const flush = () => {
    if (!para.length) return;
    const p = document.createElement('p');
    para.forEach((l, k) => { if (k) p.append(document.createElement('br')); inline(l, p); });
    root.append(p);
    para = [];
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flush();
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      code.textContent = buf.join('\n');
      pre.append(code); root.append(pre); i++;
      continue;
    }
    const hm = /^(#{1,6})\s+(.*)$/.exec(line);
    if (hm) { flush(); const el = document.createElement(`h${Math.min(hm[1].length + 1, 4)}`); inline(hm[2], el); root.append(el); i++; continue; }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); root.append(document.createElement('hr')); i++; continue; }
    if (/^\s*>/.test(line)) {
      flush();
      const bq = document.createElement('blockquote');
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      bq.append(...renderMarkdown(buf.join('\n')).childNodes);
      root.append(bq);
      continue;
    }
    const lm = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (lm) {
      flush();
      const ordered = /\d/.test(lm[1]);
      const list = document.createElement(ordered ? 'ol' : 'ul');
      while (i < lines.length) {
        const m2 = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (!m2) break;
        const li = document.createElement('li');
        inline(m2[2], li);
        list.append(li);
        i++;
      }
      root.append(list);
      continue;
    }
    if (!line.trim()) { flush(); i++; continue; }
    para.push(line);
    i++;
  }
  flush();
  return root;
}

/** Split markdown into sections by "## " (or "# ") headings. */
export function splitSections(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const sections = [];
  let cur = { heading: '', level: 0, start: 0, lines: [] };
  lines.forEach((l, idx) => {
    const m = /^(#{1,3})\s+(.*)$/.exec(l);
    if (m && m[1].length <= 2) {
      sections.push(cur);
      cur = { heading: m[2].trim(), level: m[1].length, start: idx, lines: [] };
    } else cur.lines.push(l);
  });
  sections.push(cur);
  return sections.map((s) => ({ ...s, body: s.lines.join('\n').trim() }));
}

export function joinSections(sections) {
  return sections
    .map((s) => (s.heading ? `${'#'.repeat(s.level || 2)} ${s.heading}\n\n${s.body}`.trim() : s.body))
    .filter((s) => s !== '')
    .join('\n\n') + '\n';
}
