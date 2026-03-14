/* AI Assistant Widget — v1.0
 * Drop-in chat widget using Tailwind (Play CDN) + vanilla JS.
 * Floating launcher bottom-right with responsive chat panel.
 * Session continuity using backend sessionId.
 */

(function () {

  if (window.__aiAssistantLoaded) return;
  window.__aiAssistantLoaded = true;

  const SCRIPT = document.currentScript;

  const BRAND = (SCRIPT?.dataset?.brand || "AI Assistant").trim();
  const ENDPOINT = (SCRIPT?.dataset?.endpoint || "").trim();
  const API_KEY = (SCRIPT?.dataset?.apiKey || "").trim();

  const SESSION_STORAGE_KEY = "ai_chat_session_id";


  function el(tag, opts = {}) {
    const n = document.createElement(tag);

    if (opts.class) n.className = opts.class;
    if (opts.html) n.innerHTML = opts.html;

    if (opts.attrs) {
      Object.entries(opts.attrs).forEach(([k, v]) => {
        n.setAttribute(k, v);
      });
    }

    return n;
  }


  const ensureTailwind = () =>
    new Promise((resolve) => {

      if (window.tailwind) return resolve();

      const cfg = el("script", {
        html:
          'tailwind = tailwind || {}; tailwind.config = { corePlugins: { preflight: false } };',
      });

      document.head.appendChild(cfg);

      const s = el("script", {
        attrs: { src: "https://cdn.tailwindcss.com" },
      });

      s.onload = resolve;
      s.onerror = resolve;

      document.head.appendChild(s);
    });


  const injectStyles = () => {

    const style = el("style", {
      html: `
      .ai-scrollbar::-webkit-scrollbar { width:6px;height:6px }
      .ai-scrollbar::-webkit-scrollbar-thumb { background:#c7c7c7;border-radius:9999px }

      .ai-dot{width:6px;height:6px}

      @keyframes ai-blink{
      0%{opacity:.2;transform:translateY(0)}
      20%{opacity:1;transform:translateY(-2px)}
      100%{opacity:.2;transform:translateY(0)}
      }

      .ai-dot-1{animation:ai-blink 1.2s infinite 0s}
      .ai-dot-2{animation:ai-blink 1.2s infinite .2s}
      .ai-dot-3{animation:ai-blink 1.2s infinite .4s}
      `,
    });

    document.head.appendChild(style);
  };


  const aiIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4">
  <path d="M12 3v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
  <rect x="3" y="7" width="18" height="12" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
  <circle cx="9" cy="13" r="1.5" fill="currentColor"/>
  <circle cx="15" cy="13" r="1.5" fill="currentColor"/>
  <rect x="8" y="16" width="8" height="2" rx="1" fill="currentColor"/>
  </svg>
  `;


  const escapeHtml = (str) =>
    String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));


  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY) || null;


  async function callAPI(message) {

    const headers = new Headers();

    headers.append("Content-Type", "application/json");

    if (API_KEY) headers.append("X-API-Key", API_KEY);

    const payload = { message };

    if (sessionId) payload.sessionId = sessionId;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (json.sessionId && json.sessionId !== sessionId) {
      sessionId = json.sessionId;
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }

    return json.output || "(No response)";
  }


  function buildUI() {

    const launcher = el("button", {
      class:
        "fixed bottom-4 right-4 z-[999998] p-4 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg",
      html: `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 2H4a2 2 0 00-2 2v16l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/>
      </svg>
      `,
    });


    const panel = el("section", {
      class: "fixed inset-2 sm:bottom-4 sm:right-4 sm:w-[420px] sm:h-[560px] hidden z-[999999]",
    });


    const card = el("div", {
      class:
        "flex flex-col h-full bg-white border border-gray-200 rounded-2xl shadow-2xl",
    });


    const header = el("header", {
      class:
        "flex items-center justify-between px-4 py-3 border-b",
      html: `
      <div class="flex items-center gap-2">
      <div class="h-8 w-8 rounded-lg bg-indigo-600 text-white grid place-items-center">${aiIcon}</div>
      <span class="font-semibold">${escapeHtml(BRAND)}</span>
      </div>

      <button data-close class="p-2 hover:bg-gray-100 rounded-lg">
      ✕
      </button>
      `,
    });


    const messages = el("main", {
      class: "flex-1 overflow-y-auto p-4 space-y-3 ai-scrollbar",
    });


    messages.appendChild(
      assistantBubble(
        `Hi! I'm <strong>${escapeHtml(BRAND)}</strong>. Ask me anything 👋`
      )
    );


    const form = el("form", {
      class: "border-t p-2 flex gap-2",
      html: `
      <textarea id="ai-input" rows="1" class="flex-1 resize-none outline-none p-2 text-sm"></textarea>

      <button id="ai-send" disabled
      class="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm">
      Send
      </button>
      `,
    });


    card.appendChild(header);
    card.appendChild(messages);
    card.appendChild(form);

    panel.appendChild(card);

    document.body.appendChild(panel);
    document.body.appendChild(launcher);


    const input = form.querySelector("#ai-input");
    const send = form.querySelector("#ai-send");
    const close = header.querySelector("[data-close]");


    const scrollBottom = () =>
      messages.scrollTo({
        top: messages.scrollHeight,
        behavior: "smooth",
      });


    launcher.onclick = () => {
      panel.classList.remove("hidden");
      launcher.classList.add("hidden");
      input.focus();
    };


    close.onclick = () => {
      panel.classList.add("hidden");
      launcher.classList.remove("hidden");
    };


    input.oninput = () => {
      send.disabled = input.value.trim().length === 0;
    };


    form.onsubmit = async (e) => {

      e.preventDefault();

      const text = input.value.trim();

      if (!text) return;

      input.value = "";

      send.disabled = true;

      messages.appendChild(userBubble(text));

      const typing = typingBubble();

      messages.appendChild(typing);

      scrollBottom();

      try {

        const reply = await callAPI(text);

        typing.remove();

        messages.appendChild(
          assistantBubble(
            escapeHtml(reply).replace(/\n/g, "<br>")
          )
        );

      } catch {

        typing.remove();

        messages.appendChild(
          assistantBubble("Error contacting AI assistant.")
        );
      }

      scrollBottom();
    };
  }


  function userBubble(text) {

    const wrap = el("div", { class: "flex justify-end" });

    wrap.innerHTML = `
    <div class="bg-indigo-600 text-white text-sm px-3 py-2 rounded-2xl max-w-[80%]">${escapeHtml(text)}</div>
    `;

    return wrap;
  }


  function assistantBubble(html) {

    const wrap = el("div", { class: "flex gap-2 items-start" });

    wrap.innerHTML = `
    <div class="h-7 w-7 bg-indigo-600 text-white rounded-full grid place-items-center">${aiIcon}</div>
    <div class="bg-gray-100 px-3 py-2 rounded-2xl text-sm max-w-[80%]">${html}</div>
    `;

    return wrap;
  }


  function typingBubble() {

    const wrap = el("div", { class: "flex gap-2 items-start" });

    wrap.innerHTML = `
    <div class="h-7 w-7 bg-indigo-600 text-white rounded-full grid place-items-center">${aiIcon}</div>
    <div class="bg-gray-100 px-3 py-2 rounded-2xl">
    <div class="flex gap-1">
    <span class="ai-dot ai-dot-1 bg-gray-500 rounded-full"></span>
    <span class="ai-dot ai-dot-2 bg-gray-500 rounded-full"></span>
    <span class="ai-dot ai-dot-3 bg-gray-500 rounded-full"></span>
    </div>
    </div>
    `;

    return wrap;
  }


  (async function init() {

    await ensureTailwind();

    injectStyles();

    buildUI();

  })();


  window.AIAssistant = {
    open: () => document.querySelector("section")?.classList.remove("hidden"),
  };

})();