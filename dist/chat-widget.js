/* AI Assistant Widget — fixed bottom-right, isolated via Shadow DOM */
(function () {
  if (window.__aiAssistantLoaded) return;
  window.__aiAssistantLoaded = true;

  function getCurrentScriptSafe() {
    if (document.currentScript) return document.currentScript;
    const scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1] || null;
  }

  const SCRIPT = getCurrentScriptSafe();

  const BRAND = (SCRIPT?.dataset?.brand || "AI Assistant").trim();
  const ENDPOINT = (SCRIPT?.dataset?.endpoint || "").trim();
  const API_KEY = (SCRIPT?.dataset?.apiKey || "").trim();
  const SESSION_STORAGE_KEY = "ai_chat_session_id";

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m];
    });
  }

  function readSession() {
    try {
      return localStorage.getItem(SESSION_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  }

  function writeSession(value) {
    try {
      if (value) localStorage.setItem(SESSION_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  let sessionId = readSession();

  async function callAssistantApi(userText) {
    if (!ENDPOINT) {
      throw new Error("Missing data-endpoint on widget script tag.");
    }

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

    const contentType = res.headers.get("content-type") || "";
    let raw;

    if (contentType.includes("application/json")) {
      raw = await res.json();
    } else {
      const text = await res.text();
      try {
        raw = JSON.parse(text);
      } catch {
        raw = { output: text };
      }
    }

    if (!res.ok) {
      const msg =
        raw?.message ||
        raw?.error ||
        `Assistant request failed with status ${res.status}`;
      throw new Error(msg);
    }

    const nextSessionId =
      raw?.sessionId ||
      raw?.session_id ||
      raw?.data?.sessionId ||
      raw?.data?.session_id ||
      null;

    if (nextSessionId && nextSessionId !== sessionId) {
      sessionId = nextSessionId;
      writeSession(sessionId);
    }

    const output =
      raw?.output ??
      raw?.reply ??
      raw?.message ??
      raw?.text ??
      raw?.data?.output ??
      "(No response text)";

    return String(output);
  }

  function createBubble(role, html) {
    const row = document.createElement("div");
    row.className = role === "user" ? "aiw-row aiw-row-user" : "aiw-row";

    if (role === "assistant") {
      row.innerHTML = `
        <div class="aiw-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="aiw-bot-icon">
            <path d="M12 3v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
            <rect x="3" y="7" width="18" height="12" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
            <circle cx="9" cy="13" r="1.5" fill="currentColor"/>
            <circle cx="15" cy="13" r="1.5" fill="currentColor"/>
            <rect x="8" y="16" width="8" height="2" rx="1" fill="currentColor"/>
          </svg>
        </div>
        <div class="aiw-bubble aiw-bubble-assistant">${html}</div>
      `;
    } else {
      row.innerHTML = `
        <div class="aiw-bubble aiw-bubble-user">${html}</div>
      `;
    }

    return row;
  }

  function createTypingBubble() {
    const row = document.createElement("div");
    row.className = "aiw-row";
    row.setAttribute("data-typing", "true");
    row.innerHTML = `
      <div class="aiw-avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24" class="aiw-bot-icon">
          <path d="M12 3v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
          <rect x="3" y="7" width="18" height="12" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
          <circle cx="9" cy="13" r="1.5" fill="currentColor"/>
          <circle cx="15" cy="13" r="1.5" fill="currentColor"/>
          <rect x="8" y="16" width="8" height="2" rx="1" fill="currentColor"/>
        </svg>
      </div>
      <div class="aiw-bubble aiw-bubble-assistant">
        <div class="aiw-typing">
          <span class="aiw-dot aiw-dot-1"></span>
          <span class="aiw-dot aiw-dot-2"></span>
          <span class="aiw-dot aiw-dot-3"></span>
        </div>
      </div>
    `;
    return row;
  }

  function mountWidget() {
    const host = document.createElement("div");
    host.id = "ai-assistant-widget-host";
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });

    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483647 !important;
          pointer-events: none !important;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }

        *, *::before, *::after {
          box-sizing: border-box;
        }

        .aiw-launcher {
          position: fixed !important;
          right: 16px !important;
          bottom: 16px !important;
          width: 60px !important;
          height: 60px !important;
          border: 0 !important;
          border-radius: 9999px !important;
          background: linear-gradient(135deg, #4f46e5, #9333ea) !important;
          color: #ffffff !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 20px 45px rgba(15, 23, 42, 0.25) !important;
          pointer-events: auto !important;
          transition: transform 0.18s ease, box-shadow 0.18s ease !important;
        }

        .aiw-launcher:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 24px 50px rgba(15, 23, 42, 0.28) !important;
        }

        .aiw-launcher svg {
          width: 26px !important;
          height: 26px !important;
          display: block !important;
        }

        .aiw-panel {
          position: fixed !important;
          right: 16px !important;
          bottom: 88px !important;
          width: min(420px, calc(100vw - 32px)) !important;
          height: min(560px, calc(100vh - 104px)) !important;
          display: none !important;
          flex-direction: column !important;
          border-radius: 22px !important;
          overflow: hidden !important;
          background: #ffffff !important;
          border: 1px solid rgba(226, 232, 240, 0.95) !important;
          box-shadow: 0 28px 70px rgba(15, 23, 42, 0.22) !important;
          pointer-events: auto !important;
        }

        .aiw-panel.aiw-open {
          display: flex !important;
        }

        .aiw-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px !important;
          padding: 14px 16px !important;
          border-bottom: 1px solid #e5e7eb !important;
          background: #ffffff !important;
        }

        .aiw-brand {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          min-width: 0 !important;
        }

        .aiw-brand-badge {
          width: 38px !important;
          height: 38px !important;
          border-radius: 14px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: linear-gradient(135deg, #4f46e5, #9333ea) !important;
          color: #ffffff !important;
          flex: 0 0 auto !important;
        }

        .aiw-brand-badge svg,
        .aiw-avatar svg {
          width: 18px !important;
          height: 18px !important;
          display: block !important;
        }

        .aiw-title {
          color: #0f172a !important;
          font-size: 15px !important;
          font-weight: 700 !important;
          line-height: 1.2 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .aiw-subtitle {
          color: #64748b !important;
          font-size: 12px !important;
          margin-top: 2px !important;
          line-height: 1.2 !important;
        }

        .aiw-actions {
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
          flex: 0 0 auto !important;
        }

        .aiw-icon-btn {
          width: 34px !important;
          height: 34px !important;
          border-radius: 10px !important;
          border: 0 !important;
          background: #f8fafc !important;
          color: #475569 !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .aiw-icon-btn:hover {
          background: #eef2ff !important;
          color: #4338ca !important;
        }

        .aiw-messages {
          flex: 1 1 auto !important;
          overflow-y: auto !important;
          padding: 16px !important;
          background: #fcfcff !important;
          scroll-behavior: smooth !important;
        }

        .aiw-messages::-webkit-scrollbar {
          width: 8px !important;
        }

        .aiw-messages::-webkit-scrollbar-thumb {
          background: #cbd5e1 !important;
          border-radius: 9999px !important;
        }

        .aiw-row {
          display: flex !important;
          align-items: flex-start !important;
          gap: 10px !important;
          margin-bottom: 12px !important;
        }

        .aiw-row-user {
          justify-content: flex-end !important;
        }

        .aiw-avatar {
          width: 32px !important;
          height: 32px !important;
          border-radius: 9999px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: linear-gradient(135deg, #4f46e5, #9333ea) !important;
          color: #ffffff !important;
          flex: 0 0 auto !important;
          margin-top: 2px !important;
        }

        .aiw-bubble {
          max-width: min(82%, 320px) !important;
          padding: 10px 12px !important;
          border-radius: 18px !important;
          font-size: 14px !important;
          line-height: 1.5 !important;
          word-break: break-word !important;
          white-space: normal !important;
        }

        .aiw-bubble-assistant {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          border-top-left-radius: 6px !important;
        }

        .aiw-bubble-user {
          background: #4f46e5 !important;
          color: #ffffff !important;
          border-top-right-radius: 6px !important;
        }

        .aiw-typing {
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          min-height: 18px !important;
        }

        .aiw-dot {
          width: 6px !important;
          height: 6px !important;
          border-radius: 9999px !important;
          background: #64748b !important;
          display: inline-block !important;
          opacity: 0.35 !important;
          animation: aiw-blink 1.2s infinite !important;
        }

        .aiw-dot-2 { animation-delay: 0.2s !important; }
        .aiw-dot-3 { animation-delay: 0.4s !important; }

        @keyframes aiw-blink {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.28; }
          40% { transform: translateY(-2px); opacity: 1; }
        }

        .aiw-form {
          flex: 0 0 auto !important;
          border-top: 1px solid #e5e7eb !important;
          background: #ffffff !important;
          padding: 12px !important;
        }

        .aiw-composer {
          display: flex !important;
          align-items: flex-end !important;
          gap: 10px !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 16px !important;
          padding: 8px !important;
        }

        .aiw-input {
          flex: 1 1 auto !important;
          min-height: 22px !important;
          max-height: 160px !important;
          resize: none !important;
          border: 0 !important;
          outline: none !important;
          background: transparent !important;
          color: #0f172a !important;
          font-size: 14px !important;
          line-height: 1.5 !important;
          padding: 6px 8px !important;
          margin: 0 !important;
          overflow-y: auto !important;
        }

        .aiw-input::placeholder {
          color: #94a3b8 !important;
        }

        .aiw-send {
          border: 0 !important;
          border-radius: 12px !important;
          background: #4f46e5 !important;
          color: #ffffff !important;
          padding: 10px 14px !important;
          min-width: 86px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          flex: 0 0 auto !important;
        }

        .aiw-send[disabled] {
          opacity: 0.55 !important;
          cursor: not-allowed !important;
        }

        .aiw-send svg {
          width: 14px !important;
          height: 14px !important;
          display: block !important;
        }

        @media (max-width: 640px) {
          .aiw-launcher {
            right: 12px !important;
            bottom: 12px !important;
            width: 58px !important;
            height: 58px !important;
          }

          .aiw-panel {
            inset: 8px !important;
            width: auto !important;
            height: auto !important;
            right: auto !important;
            bottom: auto !important;
            border-radius: 20px !important;
          }

          .aiw-bubble {
            max-width: 88% !important;
          }
        }
      </style>

      <button class="aiw-launcher" id="aiw-launcher" aria-label="Open ${escapeHtml(BRAND)}">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20 2H4a2 2 0 0 0-2 2v16l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"></path>
        </svg>
      </button>

      <section class="aiw-panel" id="aiw-panel" aria-live="polite" aria-label="${escapeHtml(BRAND)} chat panel">
        <header class="aiw-header">
          <div class="aiw-brand">
            <div class="aiw-brand-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 3v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
                <rect x="3" y="7" width="18" height="12" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
                <circle cx="9" cy="13" r="1.5" fill="currentColor"/>
                <circle cx="15" cy="13" r="1.5" fill="currentColor"/>
                <rect x="8" y="16" width="8" height="2" rx="1" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <div class="aiw-title">${escapeHtml(BRAND)}</div>
              <div class="aiw-subtitle">Ask anything — I’ll reply here.</div>
            </div>
          </div>

          <div class="aiw-actions">
            <button class="aiw-icon-btn" id="aiw-minimize" type="button" aria-label="Minimize">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <rect x="4" y="11" width="16" height="2" rx="1"></rect>
              </svg>
            </button>
            <button class="aiw-icon-btn" id="aiw-close" type="button" aria-label="Close">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M6.225 4.811 4.811 6.225 10.586 12l-5.775 5.775 1.414 1.414L12 13.414l5.775 5.775 1.414-1.414L13.414 12l5.775-5.775-1.414-1.414L12 10.586 6.225 4.811z"></path>
              </svg>
            </button>
          </div>
        </header>

        <main class="aiw-messages" id="aiw-messages"></main>

        <form class="aiw-form" id="aiw-form">
          <div class="aiw-composer">
            <textarea
              class="aiw-input"
              id="aiw-input"
              rows="1"
              placeholder="Type your message…"
              autocomplete="off"
            ></textarea>

            <button class="aiw-send" id="aiw-send" type="submit" disabled>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
              </svg>
              Send
            </button>
          </div>
        </form>
      </section>
    `;

    const launcher = shadow.getElementById("aiw-launcher");
    const panel = shadow.getElementById("aiw-panel");
    const messages = shadow.getElementById("aiw-messages");
    const form = shadow.getElementById("aiw-form");
    const input = shadow.getElementById("aiw-input");
    const send = shadow.getElementById("aiw-send");
    const minimize = shadow.getElementById("aiw-minimize");
    const close = shadow.getElementById("aiw-close");

    function scrollToBottom(smooth) {
      messages.scrollTo({
        top: messages.scrollHeight + 9999,
        behavior: smooth ? "smooth" : "auto",
      });
    }

    function autoGrow() {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    }

    function syncSendState() {
      send.disabled = input.value.trim().length === 0;
    }

    function openChat() {
      panel.classList.add("aiw-open");
      launcher.style.display = "none";
      setTimeout(() => {
        input.focus();
        scrollToBottom(false);
      }, 30);
    }

    function closeChat() {
      panel.classList.remove("aiw-open");
      launcher.style.display = "inline-flex";
    }

    messages.appendChild(
      createBubble(
        "assistant",
        `Hi! I’m <strong>${escapeHtml(BRAND)}</strong>. Ask me anything — I’ll reply here. 👋`
      )
    );

    launcher.addEventListener("click", openChat);
    minimize.addEventListener("click", closeChat);
    close.addEventListener("click", closeChat);

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel.classList.contains("aiw-open")) {
        closeChat();
      }
    });

    input.addEventListener("input", () => {
      autoGrow();
      syncSendState();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!send.disabled) form.requestSubmit();
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const text = input.value.trim();
      if (!text) return;

      input.value = "";
      autoGrow();
      syncSendState();

      messages.appendChild(createBubble("user", escapeHtml(text)));
      scrollToBottom(true);

      const typing = createTypingBubble();
      messages.appendChild(typing);
      scrollToBottom(true);

      send.disabled = true;

      try {
        const reply = await callAssistantApi(text);
        typing.remove();
        messages.appendChild(
          createBubble(
            "assistant",
            escapeHtml(reply).replace(/\n/g, "<br>")
          )
        );
      } catch (err) {
        typing.remove();
        messages.appendChild(
          createBubble(
            "assistant",
            escapeHtml(
              err?.message || "Sorry, I couldn’t reach the assistant."
            )
          )
        );
      }

      scrollToBottom(true);
      syncSendState();
    });

    window.AIAssistant = {
      open: openChat,
      close: closeChat,
      resetSession: () => {
        sessionId = null;
        clearSession();
      },
    };
  }

  function initWhenReady() {
    if (document.body) {
      mountWidget();
    } else {
      document.addEventListener("DOMContentLoaded", mountWidget, { once: true });
    }
  }

  initWhenReady();
})();