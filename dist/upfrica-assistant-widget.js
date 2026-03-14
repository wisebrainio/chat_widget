/* Upfrica Assistant Widget — v1.0
 * Drop-in chat widget using Tailwind (Play CDN) + vanilla JS.
 * Adds a floating launcher bottom-right; responsive chat panel with mobile full-screen feel.
 * Session continuity: stores/uses sessionId from your backend response.
 */
(function () {
  // Prevent double-injection
  if (window.__upfricaAssistantLoaded) return;
  window.__upfricaAssistantLoaded = true;

  // Read config from the current <script> tag
  const SCRIPT = document.currentScript;
  const BRAND = (SCRIPT?.dataset?.brand || "Upfrica assistant").trim();
  const ENDPOINT = (SCRIPT?.dataset?.endpoint || "https://n8n.wisebrain.io/webhook/ai/").trim();
  const API_KEY = (SCRIPT?.dataset?.apiKey || "").trim(); // if empty, no header sent
  const SESSION_STORAGE_KEY = "upfrica_chat_session_id";

  // Utility: create element with classes/attrs
  const el = (tag, opts = {}) => {
    const n = document.createElement(tag);
    if (opts.class) n.className = opts.class;
    if (opts.html != null) n.innerHTML = opts.html;
    if (opts.attrs) Object.entries(opts.attrs).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  };

  // Tailwind loader (Play CDN) with preflight disabled
  const ensureTailwind = () =>
    new Promise((resolve) => {
      // If tailwind already present, use it
      if (window.tailwind) return resolve();
      // Add config to disable preflight to avoid global resets on host pages
      const cfg = el("script", {
        html:
          'tailwind = tailwind || {}; tailwind.config = { corePlugins: { preflight: false } };',
      });
      document.head.appendChild(cfg);

      const s = el("script", {
        attrs: { src: "https://cdn.tailwindcss.com" },
      });
      s.onload = () => resolve();
      s.onerror = () => resolve(); // continue even if CDN blocked; widget will still render unstyled
      document.head.appendChild(s);
    });

  // Add widget-specific small CSS (typing dots, thin scrollbar)
  const injectAuxStyles = () => {
    const style = el("style", {
      html: `
        .upf-scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .upf-scrollbar-thin::-webkit-scrollbar-thumb { background: #c7c7c7; border-radius: 9999px; }
        .upf-dot { width: .375rem; height: .375rem; }
        @keyframes upf-blink {
          0% { opacity: .2; transform: translateY(0); }
          20% { opacity: 1; transform: translateY(-2px); }
          100% { opacity: .2; transform: translateY(0); }
        }
        .upf-dot-1 { animation: upf-blink 1.2s infinite .0s; }
        .upf-dot-2 { animation: upf-blink 1.2s infinite .2s; }
        .upf-dot-3 { animation: upf-blink 1.2s infinite .4s; }
      `,
    });
    document.head.appendChild(style);
  };

  // SVG icon (AI bot)
  const aiIconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4">
      <path d="M12 3v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
      <rect x="3" y="7" width="18" height="12" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
      <circle cx="9" cy="13" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="13" r="1.5" fill="currentColor"/>
      <rect x="8" y="16" width="8" height="2" rx="1" fill="currentColor"/>
    </svg>
  `;

  const escapeHtml = (str) =>
    String(str).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  // Build UI
  const buildUI = () => {
    // Launcher
    const launcher = el("button", {
      class:
        "fixed bottom-4 right-4 z-[999998] rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition p-4",
      attrs: { "aria-label": `Open ${BRAND}` },
      html: `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4a2 2 0 00-2 2v16l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/>
        </svg>
      `,
    });

    // Panel (mobile: full screen with small inset; desktop: mobile-sized docked)
    const panel = el("section", {
      class: "fixed inset-2 sm:inset-auto sm:bottom-4 sm:right-4 z-[999999] hidden",
      attrs: { "aria-live": "polite", "aria-label": `${BRAND} chat panel` },
    });

    const card = el("div", {
      class:
        "flex h-[calc(100vh-1rem*2)] w-[calc(100vw-1rem*2)] sm:h-[560px] sm:w-[380px] md:w-[420px] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl",
    });

    // Header
    const header = el("header", {
      class:
        "shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 rounded-t-2xl bg-white",
      html: `
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 grid place-items-center text-white">
            ${aiIconSvg}
          </div>
          <h2 class="font-semibold tracking-tight">${escapeHtml(BRAND)}</h2>
        </div>
        <div class="flex items-center gap-2">
          <button data-minimize
                  class="p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  title="Minimize">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="11" width="16" height="2" rx="1"/>
            </svg>
          </button>
          <button data-close
                  class="p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  title="Close">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.225 4.811L4.811 6.225 10.586 12l-5.775 5.775 1.414 1.414L12 13.414l5.775 5.775 1.414-1.414L13.414 12l5.775-5.775-1.414-1.414L12 10.586 6.225 4.811z"/>
            </svg>
          </button>
        </div>
      `,
    });

    // Messages area
    const messages = el("main", {
      class:
        "flex-1 overflow-y-auto px-3 py-4 space-y-3 upf-scrollbar-thin",
      attrs: { style: "scroll-padding-bottom: 6rem;" },
    });

    // Initial greeting
    messages.appendChild(
      assistantBubble(
        `Hi! I’m <strong>${escapeHtml(BRAND)}</strong>. Ask me anything — I’ll reply here. 👋`
      )
    );

    // Composer
    const form = el("form", {
      class: "relative shrink-0 border-t border-gray-200",
      attrs: { id: "upf-composer" },
      html: `
        <div class="p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <div class="flex items-end gap-2 bg-gray-100 rounded-xl px-2 py-2">
            <textarea rows="1" placeholder="Type your message…" autocomplete="off"
              class="w-full resize-none bg-transparent outline-none text-sm placeholder:text-gray-500 max-h-40"
              id="upf-input"></textarea>
            <button type="submit"
              class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-white text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
              id="upf-send" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 -rotate-45" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
              Send
            </button>
          </div>
        </div>
      `,
    });

    // Assemble
    card.appendChild(header);
    card.appendChild(messages);
    card.appendChild(form);
    panel.appendChild(card);
    document.body.appendChild(panel);
    document.body.appendChild(launcher);

    // Wire up behavior
    const input = form.querySelector("#upf-input");
    const sendBtn = form.querySelector("#upf-send");
    const minimizeBtn = header.querySelector("[data-minimize]");
    const closeBtn = header.querySelector("[data-close]");

    const scrollToBottom = (smooth = true) => {
      messages.scrollTo({
        top: messages.scrollHeight + 9999,
        behavior: smooth ? "smooth" : "auto",
      });
    };

    const autoGrow = () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 160) + "px";
    };

    const enableSendIfNeeded = () => {
      sendBtn.disabled = input.value.trim().length === 0;
    };

    const openChat = () => {
      panel.classList.remove("hidden");
      launcher.classList.add("hidden");
      setTimeout(() => input.focus(), 50);
      scrollToBottom(true);
    };

    const closeChat = () => {
      panel.classList.add("hidden");
      launcher.classList.remove("hidden");
    };

    launcher.addEventListener("click", openChat);
    minimizeBtn.addEventListener("click", closeChat);
    closeBtn.addEventListener("click", closeChat);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.classList.contains("hidden")) closeChat();
    });

    input.addEventListener("input", () => {
      autoGrow();
      enableSendIfNeeded();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) form.requestSubmit();
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      // Reset input
      input.value = "";
      autoGrow();
      enableSendIfNeeded();

      // User bubble
      messages.appendChild(userBubble(text));
      scrollToBottom(true);

      // Typing indicator
      const t = typingBubble();
      messages.appendChild(t);
      scrollToBottom(true);

      // Disable send while waiting
      sendBtn.disabled = true;

      let replyText;
      try {
        replyText = await callAssistantApi(text);
      } catch (err) {
        console.error("Upfrica widget API error:", err);
        replyText = `Sorry, I couldn’t reach the assistant. Please try again.`;
      }

      // Render reply
      t.remove();
      messages.appendChild(assistantBubble(escapeHtml(replyText).replace(/\n/g, "<br>")));
      scrollToBottom(true);

      // Re-enable if input has content again
      sendBtn.disabled = input.value.trim().length === 0;
    });

    // Expose a tiny API to open programmatically if needed
    window.UpfricaAssistant = {
      open: openChat,
      close: closeChat,
    };

    /**************
     * BUBBLES    *
     **************/
    function userBubble(text) {
      const wrap = el("div", { class: "flex items-end justify-end gap-2" });
      wrap.innerHTML = `
        <div class="max-w-[85%] rounded-2xl rounded-tr-none bg-indigo-600 text-white px-3 py-2 text-sm whitespace-pre-wrap">${escapeHtml(
          text
        )}</div>
        <div class="shrink-0 h-7 w-7 rounded-full bg-gray-300 grid place-items-center text-xs">You</div>
      `;
      return wrap;
    }

    function assistantBubble(htmlSafe) {
      const wrap = el("div", { class: "flex items-start gap-2" });
      wrap.innerHTML = `
        <div class="shrink-0 mt-1 h-8 w-8 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white grid place-items-center">
          ${aiIconSvg}
        </div>
        <div class="max-w-[85%] rounded-2xl rounded-tl-none bg-gray-100 px-3 py-2 text-sm leading-relaxed">${htmlSafe}</div>
      `;
      return wrap;
    }

    function typingBubble() {
      const wrap = el("div", { class: "flex items-start gap-2", attrs: { "data-typing": "true" } });
      wrap.innerHTML = `
        <div class="shrink-0 mt-1 h-8 w-8 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white grid place-items-center">
          ${aiIconSvg}
        </div>
        <div class="max-w-[85%] rounded-2xl rounded-tl-none bg-gray-100 px-3 py-2">
          <div class="flex items-center gap-1">
            <span class="upf-dot upf-dot-1 inline-block rounded-full bg-gray-500"></span>
            <span class="upf-dot upf-dot-2 inline-block rounded-full bg-gray-500"></span>
            <span class="upf-dot upf-dot-3 inline-block rounded-full bg-gray-500"></span>
          </div>
        </div>
      `;
      return wrap;
    }
  };

  // API call w/ session handling
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY) || null;

  async function callAssistantApi(userText) {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    if (API_KEY) headers.append("X-API-Key", API_KEY);

    const payload = { message: userText };
    if (sessionId) payload.sessionId = sessionId;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const ct = res.headers.get("content-type") || "";
    const raw = ct.includes("application/json") ? await res.json() : JSON.parse(await res.text());

    // Expecting: { output: string, sessionId: string }
    if (raw && raw.sessionId && raw.sessionId !== sessionId) {
      sessionId = raw.sessionId;
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
    const output = raw && raw.output ? String(raw.output) : "(No response text)";
    return output;
  }

  // Boot
  (async function init() {
    await ensureTailwind();
    injectAuxStyles();
    buildUI();
  })();
})();
