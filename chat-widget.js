// Newport AI Advisory — site-wide chat widget
// Talks to the /api/chat serverless function hosted on Vercel (cross-origin,
// since this site itself is served from GitHub Pages). Themed to match the
// site's dark emerald / cream / gold palette (see index.html :root vars).
(function () {
  var API_URL = 'https://ai-advisory-group-chat-api.vercel.app/api/chat';

  if (!document.querySelector('link[data-aag-fonts]')) {
    var fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.setAttribute('data-aag-fonts', '1');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Crimson+Pro:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap';
    document.head.appendChild(fontLink);
  }

  var style = document.createElement('style');
  style.textContent = [
    '#aag-chat-bubble{position:fixed;bottom:24px;right:24px;width:58px;height:58px;border-radius:50%;background:#c9a96e;color:#091a18;border:none;cursor:pointer;box-shadow:0 6px 24px rgba(9,26,24,.4),0 0 0 1px rgba(232,220,200,.15);z-index:99998;font-size:26px;display:flex;align-items:center;justify-content:center;transition:transform .2s ease,box-shadow .2s ease;}',
    '#aag-chat-bubble:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 8px 28px rgba(9,26,24,.5),0 0 0 1px rgba(201,169,110,.4);}',

    '#aag-chat-panel{position:fixed;bottom:94px;right:24px;width:min(360px,calc(100vw - 40px));height:min(520px,calc(100vh - 150px));background:#0d2220;border:1px solid rgba(232,220,200,.12);border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,.5);z-index:99999;display:none;flex-direction:column;overflow:hidden;font-family:"Crimson Pro",Georgia,serif;}',
    '#aag-chat-panel.open{display:flex;}',

    '#aag-chat-header{background:#091a18;border-bottom:1px solid rgba(232,220,200,.12);padding:16px 18px;display:flex;justify-content:space-between;align-items:center;}',
    '#aag-chat-header-title{font-family:"Playfair Display",Georgia,serif;font-size:16px;font-weight:700;color:#e8dcc8;letter-spacing:.3px;}',
    '#aag-chat-header-sub{font-family:"IBM Plex Mono",monospace;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(232,220,200,.55);margin-top:3px;}',
    '#aag-chat-close{background:none;border:none;color:rgba(232,220,200,.55);font-size:18px;cursor:pointer;line-height:1;transition:color .2s;}',
    '#aag-chat-close:hover{color:#e8dcc8;}',

    '#aag-chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:radial-gradient(ellipse 120% 60% at 50% -10%,rgba(20,70,55,.35),transparent 60%);}',
    '.aag-msg-wrap{display:flex;flex-direction:column;gap:8px;max-width:88%;}',
    '.aag-msg-wrap.aag-user-wrap{align-self:flex-end;align-items:flex-end;}',
    '.aag-msg-wrap.aag-bot-wrap{align-self:flex-start;align-items:flex-start;}',

    '.aag-msg{padding:10px 14px;border-radius:4px;font-size:14.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;}',
    '.aag-msg.user{background:#c9a96e;color:#091a18;}',
    '.aag-msg.bot{background:rgba(232,220,200,.08);color:#e8dcc8;border:1px solid rgba(232,220,200,.1);}',
    '.aag-msg.error{background:rgba(200,60,60,.14);color:#e8a0a0;border:1px solid rgba(200,60,60,.3);}',
    '.aag-msg a{color:#c9a96e;text-decoration:underline;}',

    '.aag-cta{display:inline-block;padding:11px 18px;background:rgba(201,169,110,.12);border:1px solid rgba(201,169,110,.4);border-radius:2px;font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#c9a96e;text-decoration:none;transition:background .2s ease;}',
    '.aag-cta:hover{background:rgba(201,169,110,.22);}',

    '#aag-chat-form{display:flex;border-top:1px solid rgba(232,220,200,.12);padding:10px;gap:8px;background:#091a18;}',
    '#aag-chat-input{flex:1;background:rgba(232,220,200,.06);border:1px solid rgba(232,220,200,.15);border-radius:4px;padding:9px 11px;font-size:14px;color:#e8dcc8;resize:none;font-family:"Crimson Pro",Georgia,serif;}',
    '#aag-chat-input::placeholder{color:rgba(232,220,200,.4);}',
    '#aag-chat-input:focus{outline:none;border-color:rgba(201,169,110,.5);}',
    '#aag-chat-send{background:#c9a96e;color:#091a18;border:none;border-radius:4px;padding:0 16px;cursor:pointer;font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:600;transition:background .2s ease;}',
    '#aag-chat-send:hover:not(:disabled){background:#d8bb85;}',
    '#aag-chat-send:disabled{opacity:.5;cursor:default;}'
  ].join('\n');
  document.head.appendChild(style);

  // Cal.com embed: loaded lazily (only once the visitor actually opens the
  // chat) so booking the audit opens as an in-page popup instead of
  // navigating away to a new tab.
  var CAL_LINK = 'newportaiadvisory/30min';
  var calReady = false;
  function ensureCalLoaded() {
    if (calReady) return;
    calReady = true;
    (function (C, A, L) {
      var p = function (a, ar) { a.q.push(ar); };
      var d = C.document;
      C.Cal = C.Cal || function () {
        var cal = C.Cal; var ar = arguments;
        if (!cal.loaded) {
          cal.ns = {}; cal.q = cal.q || [];
          d.head.appendChild(d.createElement('script')).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          var api = function () { p(api, arguments); };
          var namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === 'string') {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ['initNamespace', namespace]);
          } else {
            p(cal, ar);
          }
          return;
        }
        p(cal, ar);
      };
    })(window, 'https://app.cal.com/embed/embed.js', 'init');
    Cal('init', { origin: 'https://cal.com' });
    Cal('ui', { styles: { branding: { brandColor: '#c9a96e' } }, hideEventTypeDetails: false, layout: 'month_view' });
  }

  var bubble = document.createElement('button');
  bubble.id = 'aag-chat-bubble';
  bubble.setAttribute('aria-label', 'Open chat');
  bubble.textContent = '💬';

  var panel = document.createElement('div');
  panel.id = 'aag-chat-panel';
  panel.innerHTML =
    '<div id="aag-chat-header">' +
      '<div><div id="aag-chat-header-title">Newport AI Advisory</div><div id="aag-chat-header-sub">AI Assistant</div></div>' +
      '<button id="aag-chat-close" aria-label="Close chat">✕</button>' +
    '</div>' +
    '<div id="aag-chat-messages"></div>' +
    '<form id="aag-chat-form">' +
      '<textarea id="aag-chat-input" rows="1" placeholder="Ask us anything…"></textarea>' +
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

  // converts markdown-style [text](url) links and bare https:// URLs into
  // real anchors, after escaping everything else (XSS-safe). Uses
  // placeholders so a URL already consumed by the markdown-link pass can't
  // get re-matched and double-wrapped by the bare-URL pass.
  function linkify(text) {
    var escaped = escapeHtml(text);
    var placeholders = [];
    function stash(html) {
      var token = ' ' + placeholders.length + ' ';
      placeholders.push(html);
      return token;
    }
    escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, label, url) {
      return stash('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>');
    });
    escaped = escaped.replace(/https?:\/\/[^\s<]+[^\s<.,!?)]/g, function (url) {
      return stash('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>');
    });
    return escaped.replace(/ (\d+) /g, function (_, i) {
      return placeholders[Number(i)];
    });
  }

  // extracts [[button: Label | url]] tokens from assistant text, returning
  // the remaining plain text plus a list of {label, url} buttons.
  function extractButtons(text) {
    var buttons = [];
    var buttonRegex = /\[\[button:\s*([^|\]]+?)\s*\|\s*((?:https?:\/\/|mailto:)[^\s\]]+)\s*\]\]/g;
    var cleanText = text.replace(buttonRegex, function (_, label, url) {
      buttons.push({ label: label.trim(), url: url.trim() });
      return '';
    })
      // a button tag removed from the middle of the text leaves a gap of
      // blank lines behind — collapse runs of 3+ newlines down to one
      // blank line so it doesn't render as a big empty gap
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return { text: cleanText, buttons: buttons };
  }

  function buildWrap(role) {
    var wrap = document.createElement('div');
    wrap.className = 'aag-msg-wrap ' + (role === 'user' ? 'aag-user-wrap' : 'aag-bot-wrap');
    messagesEl.appendChild(wrap);
    return wrap;
  }

  function fillWrap(wrap, role, rawText) {
    wrap.innerHTML = '';
    if (role === 'user') {
      var userBubble = document.createElement('div');
      userBubble.className = 'aag-msg user';
      userBubble.textContent = rawText;
      wrap.appendChild(userBubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return;
    }

    var parsed = extractButtons(rawText);
    if (parsed.text) {
      var bubble = document.createElement('div');
      bubble.className = 'aag-msg ' + (role === 'error' ? 'error' : 'bot');
      bubble.innerHTML = linkify(parsed.text);
      wrap.appendChild(bubble);
    }
    parsed.buttons.forEach(function (b) {
      var a = document.createElement('a');
      a.className = 'aag-cta';
      a.href = b.url;
      a.rel = 'noopener noreferrer';
      a.textContent = b.label + ' →';
      if (b.url.indexOf('cal.com/' + CAL_LINK) !== -1) {
        // open the booking flow as an in-page popup instead of a new tab
        a.addEventListener('click', function (e) {
          e.preventDefault();
          ensureCalLoaded();
          Cal('modal', { calLink: CAL_LINK });
        });
      } else {
        a.target = '_blank';
      }
      wrap.appendChild(a);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(role, text) {
    var wrap = buildWrap(role);
    fillWrap(wrap, role, text);
    return wrap;
  }

  bubble.addEventListener('click', function () {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      ensureCalLoaded(); // preload so the booking button opens instantly when clicked
      if (messagesEl.children.length === 0) {
        addMessage('bot', "Hi! I'm here to help with anything about Newport AI Advisory — pricing, services, how it works, or getting started. What's on your mind?");
      }
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

    var pendingWrap = buildWrap('bot');
    var pendingBubble = document.createElement('div');
    pendingBubble.className = 'aag-msg bot';
    pendingBubble.textContent = '…';
    pendingWrap.appendChild(pendingBubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;

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
          fillWrap(pendingWrap, 'bot', result.data.reply);
          history.push({ role: 'assistant', content: result.data.reply });
        } else {
          fillWrap(pendingWrap, 'error', result.data.error || 'Something went wrong. Please try again.');
        }
      })
      .catch(function () {
        fillWrap(pendingWrap, 'error', 'Something went wrong. Please try again.');
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
