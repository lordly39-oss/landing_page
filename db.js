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

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let trimmed = line.trim();

    if (trimmed.startsWith('---') || trimmed.startsWith('***') || trimmed.startsWith('___')) {
      if (inList) { output.push('</ul>'); inList = false; }
      if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }
      if (inBlockquote) { output.push('</blockquote>'); inBlockquote = false; }
      output.push('<hr class="my-6 border-border-subtle" />');
      continue;
    }

    if (trimmed.startsWith('#')) {
      if (inList) { output.push('</ul>'); inList = false; }
      if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }
      if (inBlockquote) { output.push('</blockquote>'); inBlockquote = false; }

      let level = 0;
      while (level < trimmed.length && trimmed[level] === '#') level++;
      let headingText = trimmed.slice(level).trim();
      headingText = formatInline(headingText);

      if (level === 1) output.push(`<h1 class="text-2xl sm:text-3xl font-bold mt-8 mb-4 text-on-surface">${headingText}</h1>`);
      else if (level === 2) output.push(`<h2 class="text-xl sm:text-2xl font-bold mt-6 mb-3 text-on-surface">${headingText}</h2>`);
      else if (level === 3) output.push(`<h3 class="text-lg sm:text-xl font-bold mt-5 mb-2 text-on-surface">${headingText}</h3>`);
      else output.push(`<h4 class="text-base sm:text-lg font-semibold mt-4 mb-2 text-on-surface">${headingText}</h4>`);
      continue;
    }

    if (trimmed.startsWith('>')) {
      if (inList) { output.push('</ul>'); inList = false; }
      if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }
      let quoteContent = formatInline(trimmed.replace(/^>\s?/, ''));
      if (!inBlockquote) {
        output.push('<blockquote class="border-l-4 border-primary pl-4 py-2 my-4 bg-primary/5 text-on-surface-variant italic rounded-r-lg">');
        inBlockquote = true;
      }
      output.push(`<p class="my-1">${quoteContent}</p>`);
      continue;
    } else if (inBlockquote) {
      output.push('</blockquote>');
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
  if (inBlockquote) output.push('</blockquote>');

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
