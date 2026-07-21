// AI Advisory Group — site-wide chat widget
// Talks to the /api/chat serverless function hosted on Vercel (cross-origin,
// since this site itself is served from GitHub Pages).
(function () {
  var API_URL = 'https://ai-advisory-group-chat-api.vercel.app/api/chat';

  var style = document.createElement('style');
  style.textContent = [
    '#aag-chat-bubble{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:#111;color:#fff;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25);z-index:99998;font-size:24px;display:flex;align-items:center;justify-content:center;}',
    '#aag-chat-panel{position:fixed;bottom:90px;right:20px;width:min(340px,calc(100vw - 40px));height:min(480px,calc(100vh - 140px));background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.3);z-index:99999;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,system-ui,sans-serif;}',
    '#aag-chat-panel.open{display:flex;}',
    '#aag-chat-header{background:#111;color:#fff;padding:14px 16px;font-size:14px;font-weight:600;display:flex;justify-content:space-between;align-items:center;}',
    '#aag-chat-close{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;}',
    '#aag-chat-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;}',
    '.aag-msg{max-width:85%;padding:8px 12px;border-radius:10px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word;}',
    '.aag-msg.user{align-self:flex-end;background:#111;color:#fff;}',
    '.aag-msg.bot{align-self:flex-start;background:#f0f0f0;color:#111;}',
    '.aag-msg.error{align-self:flex-start;background:#fde8e8;color:#b00020;}',
    '.aag-msg a{color:inherit;text-decoration:underline;}',
    '#aag-chat-form{display:flex;border-top:1px solid #eee;padding:8px;gap:8px;}',
    '#aag-chat-input{flex:1;border:1px solid #ddd;border-radius:8px;padding:8px 10px;font-size:14px;resize:none;font-family:inherit;}',
    '#aag-chat-send{background:#111;color:#fff;border:none;border-radius:8px;padding:0 14px;cursor:pointer;font-size:14px;}',
    '#aag-chat-send:disabled{opacity:.5;cursor:default;}'
  ].join('\n');
  document.head.appendChild(style);

  var bubble = document.createElement('button');
  bubble.id = 'aag-chat-bubble';
  bubble.setAttribute('aria-label', 'Open chat');
  bubble.textContent = '💬';

  var panel = document.createElement('div');
  panel.id = 'aag-chat-panel';
  panel.innerHTML =
    '<div id="aag-chat-header"><span>AI Advisory Group</span><button id="aag-chat-close" aria-label="Close chat">✕</button></div>' +
    '<div id="aag-chat-messages"></div>' +
    '<form id="aag-chat-form">' +
    '<textarea id="aag-chat-input" rows="1" placeholder="Ask a question…"></textarea>' +
    '<button id="aag-chat-send" type="submit">Send</button>' +
    '</form>';

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  var messagesEl = panel.querySelector('#aag-chat-messages');
  var formEl = panel.querySelector('#aag-chat-form');
  var inputEl = panel.querySelector('#aag-chat-input');
  var sendEl = panel.querySelector('#aag-chat-send');
  var closeEl = panel.querySelector('#aag-chat-close');

  var history = [];

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function linkify(text) {
    return escapeHtml(text).replace(/https?:\/\/[^\s<]+[^\s<.,!?)]/g, function (url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });
  }

  function addMessage(role, text) {
    var el = document.createElement('div');
    el.className = 'aag-msg ' + role;
    if (role === 'user') {
      el.textContent = text;
    } else {
      el.innerHTML = linkify(text);
    }
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  bubble.addEventListener('click', function () {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && messagesEl.children.length === 0) {
      addMessage('bot', "Hi! I'm the AI Advisory Group assistant. Ask me about our services, pricing, or book a free AI Opportunity Audit.");
    }
  });

  closeEl.addEventListener('click', function () {
    panel.classList.remove('open');
  });

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = inputEl.value.trim();
    if (!text) return;

    addMessage('user', text);
    history.push({ role: 'user', content: text });
    inputEl.value = '';
    sendEl.disabled = true;
    var pending = addMessage('bot', '…');

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (result.ok && result.data.reply) {
          pending.innerHTML = linkify(result.data.reply);
          pending.className = 'aag-msg bot';
          history.push({ role: 'assistant', content: result.data.reply });
        } else {
          pending.innerHTML = linkify(result.data.error || 'Something went wrong. Please try again.');
          pending.className = 'aag-msg error';
        }
      })
      .catch(function () {
        pending.innerHTML = linkify('Something went wrong. Please try again.');
        pending.className = 'aag-msg error';
      })
      .finally(function () {
        sendEl.disabled = false;
      });
  });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formEl.requestSubmit();
    }
  });
})();
