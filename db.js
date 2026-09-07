let _config = null;

async function loadConfig() {
  if (_config) return _config;
  let api = {}, file = {};
  try { const r = await fetch('/api/config'); if (r.ok) api = await r.json(); } catch(e) {}
  try { const r = await fetch('config/git_config.json'); if (r.ok) file = await r.json(); } catch(e) {}
  const apiTok = String(api.github_token || '').trim();
  const fileTok = String(file.github_token || '').trim();
  _config = {
    github_token: (apiTok && apiTok !== 'YOUR_GITHUB_TOKEN') ? apiTok : fileTok,
    github_owner: file.github_owner || '',
    github_repo: file.github_repo || '',
    data_file_path: file.data_file_path || 'data/posts.json',
    admin_password: api.admin_password || file.admin_password || 'admin1234'
  };
  return _config;
}

function isAdmin() {
  return sessionStorage.getItem('isAdmin') === 'true';
}

function requireAdmin() {
  if (!isAdmin()) {
    window.location.href = 'admin.html';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(src) {
  if (!src) return '';
  
  const codeBlocks = [];
  let text = String(src).replace(/```([\s\S]*?)```/g, function(match, code) {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre class="bg-surface-container-highest p-4 rounded-xl overflow-x-auto my-4 text-sm font-mono text-on-surface"><code>${escapeHtml(code.trim())}</code></pre>`);
    return placeholder;
  });

  const inlineCodes = [];
  text = text.replace(/`([^`]+)`/g, function(match, code) {
    const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
    inlineCodes.push(`<code class="bg-surface-container-highest px-1.5 py-0.5 rounded text-sm font-mono text-primary">${escapeHtml(code)}</code>`);
    return placeholder;
  });

  let lines = text.split('\n');
  let output = [];
  let inList = false;
  let inOrderedList = false;
  let inBlockquote = false;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let trimmed = line.trim();

    // Table Handling
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (inList) { output.push('</ul>'); inList = false; }
      if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }
      if (inBlockquote) { output.push('</div></div>'); inBlockquote = false; }

      if (/^\|(\s*:?-+:?\s*\|)+$/.test(trimmed)) {
        continue;
      }

      const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
      if (!inTable) {
        inTable = true;
        output.push('<div class="overflow-x-auto my-6 rounded-2xl border border-border-subtle shadow-sm"><table class="w-full text-left text-sm border-collapse">');
        output.push('<thead class="bg-surface-container-low text-on-surface font-semibold border-b border-border-subtle"><tr>');
        cells.forEach(c => output.push(`<th class="p-3.5 sm:px-4">${formatInline(c)}</th>`));
        output.push('</tr></thead><tbody class="divide-y divide-border-subtle bg-surface-container-lowest">');
      } else {
        output.push('<tr class="hover:bg-surface-container-low/50 transition-colors">');
        cells.forEach(c => output.push(`<td class="p-3.5 sm:px-4 text-on-surface-variant">${formatInline(c)}</td>`));
        output.push('</tr>');
      }
      continue;
    } else if (inTable) {
      output.push('</tbody></table></div>');
      inTable = false;
    }

    if (trimmed.startsWith('---') || trimmed.startsWith('***') || trimmed.startsWith('___')) {
      if (inList) { output.push('</ul>'); inList = false; }
      if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }
      if (inBlockquote) { output.push('</div></div>'); inBlockquote = false; }
      output.push('<hr class="my-6 border-border-subtle" />');
      continue;
    }

    if (trimmed.startsWith('#')) {
      if (inList) { output.push('</ul>'); inList = false; }
      if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }
      if (inBlockquote) { output.push('</div></div>'); inBlockquote = false; }

      let level = 0;
      while (level < trimmed.length && trimmed[level] === '#') level++;
      let headingText = trimmed.slice(level).trim();
      headingText = formatInline(headingText);

      if (level === 1) output.push(`<h1 class="text-2xl sm:text-3xl font-bold mt-8 mb-4 text-on-surface tracking-tight">${headingText}</h1>`);
      else if (level === 2) output.push(`<h2 class="text-xl sm:text-2xl font-bold mt-7 mb-3 text-on-surface tracking-tight flex items-center gap-2"><span class="w-1.5 h-5 bg-primary rounded-full inline-block"></span>${headingText}</h2>`);
      else if (level === 3) output.push(`<h3 class="text-lg sm:text-xl font-bold mt-5 mb-2 text-on-surface">${headingText}</h3>`);
      else output.push(`<h4 class="text-base sm:text-lg font-semibold mt-4 mb-2 text-on-surface">${headingText}</h4>`);
      continue;
    }

    if (trimmed.startsWith('>')) {
      if (inList) { output.push('</ul>'); inList = false; }
      if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }
      
      let rawQuote = trimmed.replace(/^>\s?/, '').trim();
      const alertMatch = rawQuote.match(/^\[!(SUMMARY|TLDR|KEY-TAKEAWAY|STATISTICS|DATA|QUOTE|SOURCES|CITATION|NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
      
      if (alertMatch) {
        if (inBlockquote) { output.push('</div></div>'); }
        const type = alertMatch[1].toUpperCase();
        inBlockquote = true;
        
        if (type === 'SUMMARY' || type === 'TLDR' || type === 'KEY-TAKEAWAY') {
          output.push(`
            <div class="my-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-primary-fixed/30 to-secondary-fixed/20 border border-primary/25 shadow-sm">
              <div class="flex items-center gap-2 mb-2 font-bold text-primary text-sm sm:text-base">
                <span class="material-symbols-outlined text-[20px]">psychology</span>
                <span>AI 핵심 요약 (TL;DR)</span>
              </div>
              <div class="text-on-surface-variant text-sm sm:text-base leading-relaxed space-y-1">
          `);
        } else if (type === 'STATISTICS' || type === 'DATA') {
          output.push(`
            <div class="my-6 p-5 sm:p-6 rounded-2xl bg-amber-500/10 border border-action-gold/30 shadow-sm">
              <div class="flex items-center gap-2 mb-2 font-bold text-tertiary text-sm sm:text-base">
                <span class="material-symbols-outlined text-[20px]">analytics</span>
                <span>핵심 시장 &amp; 실거래가 데이터</span>
              </div>
              <div class="text-on-surface text-sm sm:text-base leading-relaxed space-y-1">
          `);
        } else if (type === 'QUOTE') {
          output.push(`
            <div class="my-6 p-5 sm:p-6 rounded-2xl bg-surface-container-low border-l-4 border-secondary shadow-sm">
              <div class="flex items-center gap-2 mb-2 font-bold text-secondary text-sm sm:text-base">
                <span class="material-symbols-outlined text-[20px]">format_quote</span>
                <span>공인중개사 전문 분석 &amp; 코멘트</span>
              </div>
              <div class="text-on-surface italic text-sm sm:text-base leading-relaxed space-y-1">
          `);
        } else if (type === 'SOURCES' || type === 'CITATION') {
          output.push(`
            <div class="my-6 p-4 sm:p-5 rounded-2xl bg-surface-container-high/60 border border-border-subtle text-xs sm:text-sm">
              <div class="flex items-center gap-2 mb-2 font-semibold text-on-surface-variant">
                <span class="material-symbols-outlined text-[18px] text-primary">verified</span>
                <span>공식 데이터 출처 &amp; 인용</span>
              </div>
              <div class="text-on-surface-variant leading-normal space-y-1">
          `);
        } else {
          output.push(`
            <div class="my-5 p-4 rounded-xl bg-primary/5 border-l-4 border-primary text-on-surface-variant">
              <div class="text-sm sm:text-base space-y-1">
          `);
        }
        continue;
      }

      if (!inBlockquote) {
        output.push(`
          <div class="my-5 p-4 sm:p-5 rounded-xl bg-primary/5 border-l-4 border-primary text-on-surface-variant italic">
            <div class="text-sm sm:text-base leading-relaxed">
        `);
        inBlockquote = true;
      }

      output.push(`<p class="my-1">${formatInline(rawQuote)}</p>`);
      continue;
    } else if (inBlockquote) {
      output.push('</div></div>');
      inBlockquote = false;
    }

    let ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }
      if (!inList) { output.push('<ul class="list-disc list-inside space-y-2 my-4 text-on-surface-variant">'); inList = true; }
      output.push(`<li>${formatInline(ulMatch[2])}</li>`);
      continue;
    } else if (inList) {
      output.push('</ul>');
      inList = false;
    }

    let olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      if (inList) { output.push('</ul>'); inList = false; }
      if (!inOrderedList) { output.push('<ol class="list-decimal list-inside space-y-2 my-4 text-on-surface-variant">'); inOrderedList = true; }
      output.push(`<li>${formatInline(olMatch[2])}</li>`);
      continue;
    } else if (inOrderedList) {
      output.push('</ol>');
      inOrderedList = false;
    }

    if (trimmed === '') {
      continue;
    }

    output.push(`<p class="my-3 leading-relaxed text-on-surface-variant">${formatInline(trimmed)}</p>`);
  }

  if (inList) output.push('</ul>');
  if (inOrderedList) output.push('</ol>');
  if (inBlockquote) output.push('</div></div>');
  if (inTable) output.push('</tbody></table></div>');

  let result = output.join('\n');

  inlineCodes.forEach((codeHtml, idx) => {
    result = result.replace(`__INLINE_CODE_${idx}__`, codeHtml);
  });
  codeBlocks.forEach((blockHtml, idx) => {
    result = result.replace(`__CODE_BLOCK_${idx}__`, blockHtml);
  });

  return result;
}

function formatInline(str) {
  let safe = escapeHtml(str);
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-on-surface">$1</strong>');
  safe = safe.replace(/__(.+?)__/g, '<strong class="font-bold text-on-surface">$1</strong>');
  safe = safe.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
  safe = safe.replace(/_(.+?)_/g, '<em class="italic">$1</em>');
  safe = safe.replace(/~~(.+?)~~/g, '<del class="line-through opacity-70">$1</del>');
    // Markdown 이미지
  safe = safe.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)/g,
    '<img src="$2" alt="$1" class="max-w-full h-auto rounded-xl my-4 block" loading="lazy">'
  );
  safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+|mailto:[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-secondary">$1</a>');
  return safe;
}

function markdownToText(src) {
  if (!src) return '';
  return String(src)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/---|\*\*\*|___/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

function generateArticleSchema(post, fullUrl) {
  if (!post) return '';
  const cleanSummary = markdownToText(post.content || '').slice(0, 160);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title || "부동산 소식",
    "description": cleanSummary,
    "datePublished": post.date || new Date().toISOString().split('T')[0],
    "dateModified": post.date || new Date().toISOString().split('T')[0],
    "author": {
      "@type": "RealEstateAgent",
      "name": "강릉 솔올 공인중개사 사무소",
      "telephone": "033-642-8606",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "선수촌로 69, 209호",
        "addressLocality": "강릉시",
        "addressRegion": "강원특별자치도",
        "addressCountry": "KR"
      }
    },
    "publisher": {
      "@type": "Organization",
      "name": "강릉 솔올 공인중개사 사무소",
      "logo": {
        "@type": "ImageObject",
        "url": "https://lh3.googleusercontent.com/aida-public/AB6AXuDTFw5yAn1KlQUT9cAGxJfi4CfynKDH6uMWebqmTbbYgxaLJXWnLXJoW9BT9ZoC6ilgqVd6Gf34w2NzP6-8-iyRF8OUm6Y3JzzS9-pCg9kjeWOVfIQC7OmSf8f7hAn6th-UXkIwGiDrYXv-wtEijsjvalLcQvQFRkpJckuT2rtZxJmlVLVbGPUhuaHy0wmQ3oijFjdFmvZjHdC6P5E7mTALiFOjiZU0kP11W8oaok9gvTnh_gtv6B98Xw"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": fullUrl || window.location.href
    }
  };
  return JSON.stringify(schema);
}

async function getPosts() {
  const localData = localStorage.getItem('posts_cache');
  let posts = null;

  try {
    const config = await loadConfig();
    const token = String(config.github_token || '').replace(/\s+/g, '');
    if (token && config.github_owner && config.github_repo) {
      const url = `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/contents/${config.data_file_path}?ref=main&t=${Date.now()}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (res.ok) {
        const fileData = await res.json();
        const contentStr = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
        posts = JSON.parse(contentStr);
        localStorage.setItem('posts_cache', JSON.stringify(posts));
        return sortPosts(posts);
      }
    }
  } catch (err) {}

  if (!posts) {
    try {
      const fallbackRes = await fetch('data/posts.json?t=' + Date.now());
      if (fallbackRes.ok) {
        posts = await fallbackRes.json();
        localStorage.setItem('posts_cache', JSON.stringify(posts));
        return sortPosts(posts);
      }
    } catch (e) {}
  }

  if (!posts && localData) {
    try {
      posts = JSON.parse(localData);
      return sortPosts(posts);
    } catch (e) {}
  }

  return sortPosts(posts || []);
}

function sortPosts(posts) {
  if (!Array.isArray(posts)) return [];
  return posts.sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime();
    const dateB = new Date(b.date || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return (b.id || 0) - (a.id || 0);
  });
}

async function getPost(id) {
  const posts = await getPosts();
  return posts.find(p => String(p.id) === String(id)) || null;
}

async function savePost(postData) {
  const config = await loadConfig();
  const token = String(config.github_token || '').replace(/\s+/g, '');
  
  if (!token || !config.github_owner || !config.github_repo) {
    throw new Error('GitHub 토큰 또는 저장소 설정이 누락되었습니다.');
  }

  const posts = await getPosts();
  let updatedPosts = [...posts];

  if (postData.id) {
    const idx = updatedPosts.findIndex(p => String(p.id) === String(postData.id));
    if (idx !== -1) {
      updatedPosts[idx] = { ...updatedPosts[idx], ...postData };
    } else {
      updatedPosts.unshift(postData);
    }
  } else {
    const newId = Date.now();
    const newPost = {
      ...postData,
      id: newId,
      date: postData.date || new Date().toISOString().split('T')[0]
    };
    updatedPosts.unshift(newPost);
    postData.id = newId;
  }

  updatedPosts = sortPosts(updatedPosts);
  const jsonContent = JSON.stringify(updatedPosts, null, 2);
  const utf8Base64 = btoa(unescape(encodeURIComponent(jsonContent)));

  const url = `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/contents/${config.data_file_path}`;
  
  let currentSha = null;
  try {
    const getRes = await fetch(url + `?ref=main&t=${Date.now()}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (getRes.ok) {
      const data = await getRes.json();
      currentSha = data.sha;
    }
  } catch (e) {}

  const bodyPayload = {
    message: postData.id ? `feat: update post #${postData.id}` : `feat: create new post`,
    content: utf8Base64,
    branch: 'main'
  };
  if (currentSha) {
    bodyPayload.sha = currentSha;
  }

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyPayload)
  });

  if (!putRes.ok) {
    const errJson = await putRes.json().catch(() => ({}));
    throw new Error(errJson.message || `저장 실패: ${putRes.statusText} (${putRes.status})`);
  }

  localStorage.setItem('posts_cache', JSON.stringify(updatedPosts));
  return postData;
}

async function deletePost(id) {
  const config = await loadConfig();
  const token = String(config.github_token || '').replace(/\s+/g, '');
  
  if (!token || !config.github_owner || !config.github_repo) {
    throw new Error('GitHub 토큰 또는 저장소 설정이 누락되었습니다.');
  }

  const posts = await getPosts();
  const updatedPosts = posts.filter(p => String(p.id) !== String(id));
  const jsonContent = JSON.stringify(updatedPosts, null, 2);
  const utf8Base64 = btoa(unescape(encodeURIComponent(jsonContent)));

  const url = `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/contents/${config.data_file_path}`;
  
  let currentSha = null;
  const getRes = await fetch(url + `?ref=main&t=${Date.now()}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  if (getRes.ok) {
    const data = await getRes.json();
    currentSha = data.sha;
  } else {
    throw new Error('원격 파일 정보를 가져오지 못했습니다.');
  }

  const bodyPayload = {
    message: `feat: delete post #${id}`,
    content: utf8Base64,
    sha: currentSha,
    branch: 'main'
  };

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyPayload)
  });

  if (!putRes.ok) {
    const errJson = await putRes.json().catch(() => ({}));
    throw new Error(errJson.message || `삭제 실패: ${putRes.statusText} (${putRes.status})`);
  }

  localStorage.setItem('posts_cache', JSON.stringify(updatedPosts));
  return true;
}
