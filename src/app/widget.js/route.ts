export const dynamic = "force-dynamic";

const widgetSource = String.raw`(() => {
  const script = document.currentScript || document.querySelector('script[data-workspace][src*="widget.js"]');
  if (!script) return;
  const workspacePublicId = script.dataset.workspace;
  const openOnLoad = script.dataset.open === "true";
  if (!workspacePublicId) {
    console.error("Intercom widget: data-workspace is required.");
    return;
  }
  const apiOrigin = new URL(script.src, window.location.href).origin;
  const storageKey = "intercom:visitor:" + workspacePublicId;
  let visitorToken = window.localStorage.getItem(storageKey) || "";
  let conversationId = "";
  let messages = [];
  let isOpen = false;
  let isSending = false;
  let lastTypingSignal = 0;

  const host = document.createElement("div");
  host.setAttribute("data-intercom-widget", "");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML =
    '<style>' +
    ':host{all:initial}*{box-sizing:border-box}.launcher{position:fixed;right:22px;bottom:22px;width:54px;height:54px;border:0;border-radius:50%;color:#fff;background:#c05a37;box-shadow:0 12px 30px rgba(28,24,18,.24);cursor:pointer;font:700 24px/1 Georgia,serif}.launcher:hover{transform:translateY(-1px)}.launcher::after{position:absolute;top:4px;right:4px;width:9px;height:9px;content:"";border:2px solid #fff;border-radius:50%;background:#1f8b5c}.panel{position:fixed;right:22px;bottom:22px;width:min(360px,calc(100vw - 36px));overflow:hidden;border:1px solid #e5e4e0;border-radius:12px;background:#fff;box-shadow:0 18px 46px rgba(28,24,18,.24);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1b1b1a}.panel[hidden],.launcher[hidden]{display:none}.header{display:flex;align-items:center;justify-content:space-between;padding:14px;color:#fff;background:#1b1b1a}.identity{display:flex;align-items:center;gap:8px}.mark{width:27px;height:27px;display:grid;place-items:center;border-radius:7px;background:#c05a37;font:700 15px/1 Georgia,serif}.identity strong,.identity span{display:block}.identity strong{font-size:12px}.identity span{margin-top:2px;color:#d7d5d0;font-size:10px}.online{display:inline-block;width:6px;height:6px;margin-right:4px;border-radius:50%;background:#69c68d}.close{border:0;color:#d7d5d0;background:transparent;cursor:pointer;font-size:21px}.messages{min-height:276px;max-height:48vh;overflow:auto;padding:13px;background:#f8f7f5}.bubble{max-width:84%;margin:7px 0;padding:9px 10px;border-radius:4px 9px 9px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.05);font-size:12px;line-height:1.45;white-space:pre-wrap}.bubble--visitor{margin-left:auto;border-radius:9px 4px 9px 9px;color:#fff;background:#1b1b1a}.empty{max-width:250px;margin:45px auto;color:#77776f;text-align:center;font-size:12px;line-height:1.55}.suggestions{display:grid;gap:4px;margin-top:12px;padding:8px;border:1px solid #eadcd5;border-radius:7px;background:#fffdfc}.suggestions small{color:#a3a39a;font-size:9px;font-weight:800;letter-spacing:.07em}.suggestions button{display:flex;justify-content:space-between;padding:3px 0;border:0;color:#9a4529;background:transparent;cursor:pointer;text-align:left;font-size:10.5px;font-weight:700}.composer{display:flex;gap:7px;padding:9px;border-top:1px solid #e5e4e0}.composer input{min-width:0;flex:1;border:0;outline:0;color:#1b1b1a;font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.composer button{width:29px;height:29px;border:0;border-radius:7px;color:#fff;background:#c05a37;cursor:pointer;font-size:16px}.composer button:disabled{opacity:.6;cursor:wait}.footer{padding:7px;color:#a3a39a;text-align:center;font-size:9.5px}.error{margin:8px 0;padding:7px;border-radius:5px;color:#b3372c;background:#fbeae7;font-size:10.5px}</style>' +
    '<button class="launcher" type="button" aria-label="Open support chat">i</button>' +
    '<section class="panel" hidden aria-label="Support chat"><header class="header"><div class="identity"><i class="mark">i</i><div><strong class="workspace-name">Support</strong><span><b class="online"></b>Typically replies in minutes</span></div></div><button class="close" type="button" aria-label="Minimize chat">−</button></header><div class="messages" aria-live="polite"></div><form class="composer"><input maxlength="8000" aria-label="Message" placeholder="Write a message…" /><button type="submit" aria-label="Send message">↑</button></form><footer>Powered by Intercom</footer></section>';
  const launcher = shadow.querySelector(".launcher");
  const panel = shadow.querySelector(".panel");
  const close = shadow.querySelector(".close");
  const list = shadow.querySelector(".messages");
  const name = shadow.querySelector(".workspace-name");
  const form = shadow.querySelector(".composer");
  const input = shadow.querySelector("input");
  const send = shadow.querySelector(".composer button");

  function request(path, options) {
    return fetch(apiOrigin + path, Object.assign({ credentials: "omit", headers: { "content-type": "application/json" } }, options)).then(async response => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The support widget could not connect.");
      return payload;
    });
  }

  function setOpen(open) {
    isOpen = open;
    panel.hidden = !open;
    launcher.hidden = open;
    if (open) input.focus();
  }

  function setMessages(nextMessages) {
    messages = nextMessages || [];
    list.textContent = "";
    if (!messages.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Ask a question, and we’ll connect you with the right person.";
      list.append(empty);
      return;
    }
    messages.forEach(message => {
      const bubble = document.createElement("p");
      bubble.className = "bubble" + (message.sender_type === "contact" ? " bubble--visitor" : "");
      bubble.textContent = message.body_text;
      list.append(bubble);
    });
    list.scrollTop = list.scrollHeight;
  }

  function renderError(message) {
    const error = document.createElement("p");
    error.className = "error";
    error.textContent = message;
    list.append(error);
  }

  async function suggest(query) {
    const previous = list.querySelector(".suggestions");
    if (previous) previous.remove();
    if (query.trim().length < 4 || !visitorToken) return;
    try {
      const payload = await request("/api/widget/knowledge-suggestions", { method: "POST", body: JSON.stringify({ workspacePublicId, visitorToken, query }) });
      if (!payload.articles || !payload.articles.length) return;
      const suggestions = document.createElement("div");
      suggestions.className = "suggestions";
      const label = document.createElement("small");
      label.textContent = "HELPFUL ARTICLES";
      suggestions.append(label);
      payload.articles.forEach(article => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = article.title + "  →";
        button.addEventListener("click", () => window.open(apiOrigin + "/help?article=" + encodeURIComponent(article.slug), "_blank", "noopener"));
        suggestions.append(button);
      });
      list.append(suggestions);
    } catch (_) { /* Suggestions are optional and must never block chatting. */ }
  }

  function signalTyping(active) {
    if (!visitorToken || !conversationId) return;
    const now = Date.now();
    if (active && now - lastTypingSignal < 1800) return;
    lastTypingSignal = now;
    request("/api/widget/typing", { method: "POST", body: JSON.stringify({ workspacePublicId, visitorToken, conversationId, typing: active }) }).catch(() => {});
  }

  async function bootstrap(includePage) {
    const page = includePage ? { url: window.location.href, title: document.title, ...(document.referrer ? { referrer: document.referrer } : {}) } : undefined;
    const payload = await request("/api/widget/bootstrap", { method: "POST", body: JSON.stringify({ workspacePublicId, ...(visitorToken ? { visitorToken } : {}), ...(page ? { page } : {}) }) });
    visitorToken = payload.visitorToken;
    window.localStorage.setItem(storageKey, visitorToken);
    conversationId = payload.conversation ? payload.conversation.id : "";
    name.textContent = payload.workspaceName + " support";
    setMessages(payload.messages);
  }

  async function refresh() {
    if (!visitorToken) return;
    try {
      const payload = await request("/api/widget/messages?workspacePublicId=" + encodeURIComponent(workspacePublicId) + "&visitorToken=" + encodeURIComponent(visitorToken), { method: "GET" });
      conversationId = payload.conversation ? payload.conversation.id : conversationId;
      setMessages(payload.messages);
    } catch (_) { /* A temporary network error should not destroy local UI. */ }
  }

  launcher.addEventListener("click", () => setOpen(true));
  close.addEventListener("click", () => setOpen(false));
  input.addEventListener("input", () => { suggest(input.value); signalTyping(Boolean(input.value.trim())); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const bodyText = input.value.trim();
    if (!bodyText || isSending) return;
    isSending = true;
    send.disabled = true;
    try {
      const payload = await request("/api/widget/messages", { method: "POST", body: JSON.stringify({ workspacePublicId, visitorToken, ...(conversationId ? { conversationId } : {}), bodyText, clientMessageId: crypto.randomUUID() }) });
      conversationId = payload.conversationId;
      visitorToken = payload.visitorToken || visitorToken;
      window.localStorage.setItem(storageKey, visitorToken);
      input.value = "";
      signalTyping(false);
      await refresh();
    } catch (error) {
      renderError(error instanceof Error ? error.message : "Message could not be sent.");
    } finally {
      isSending = false;
      send.disabled = false;
      input.focus();
    }
  });

  document.body.append(host);
  bootstrap(true).then(() => { if (openOnLoad) setOpen(true); }).catch(error => renderError(error instanceof Error ? error.message : "Could not load support chat."));
  window.setInterval(() => { if (isOpen) refresh(); }, 3500);
})();`;

export async function GET() {
  return new Response(widgetSource, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}
