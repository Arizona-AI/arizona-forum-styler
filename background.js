chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_ECOSYSTEM_API') {
    fetchEcosystemApi()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  if (message.type === 'RESOLVE_BACKGROUND_TEMPLATE') {
    resolveBackgroundTemplate(message.path)
      .then(url => sendResponse({ success: true, url }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function resolveBackgroundTemplate(path) {
  if (typeof path !== 'string' || !/^\/static\/img\/extensions_backgrounds\/[a-zA-Z0-9_%.-]+$/.test(path) || path.includes('..')) {
    throw new Error('Invalid background template path.');
  }
  for (const origin of ['https://arizona-ai.ru', 'https://arizona-ai.tech']) {
    const url = origin + path;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
      const contentType = response.headers.get('content-type') || '';
      if (response.body) await response.body.cancel();
      if (response.ok && contentType.toLowerCase().startsWith('image/')) return url;
    } catch (error) {
      console.warn(`[Arizona Styler Background] Failed to fetch from ${url}:`, error);
    }
  }
  throw new Error('Не удалось загрузить шаблон ни с одного домена ArizonaAI.');
}

async function fetchEcosystemApi() {
  const urls = [
    'https://arizona-ai.ru/ecosystem_api/info',
    'https://arizona-ai.tech/ecosystem_api/info'
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const json = await response.json();
      if (json && json.status === 'success' && Array.isArray(json.users)) {
        return json;
      }
    } catch (e) {
      console.warn(`[Arizona Styler Background] Failed to fetch from ${url}:`, e);
    }
  }
  throw new Error('All ArizonaAI Ecosystem API fallback routes failed.');
}
