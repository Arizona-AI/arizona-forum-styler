chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_ECOSYSTEM_API') {
    fetchEcosystemApi()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

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
