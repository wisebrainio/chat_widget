/* AI Assistant Widget */

(function () {

  if (window.__aiAssistantLoaded) return;
  window.__aiAssistantLoaded = true;

  const SCRIPT = document.currentScript;

  const BRAND = SCRIPT?.dataset?.brand || "AI Assistant";
  const ENDPOINT = SCRIPT?.dataset?.endpoint || "";
  const API_KEY = SCRIPT?.dataset?.apiKey || "";

  const SESSION_KEY = "ai_chat_session_id";


  function el(tag) {
    return document.createElement(tag);
  }


  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m]));
  }


  async function ensureTailwind() {

    if (window.tailwind) return;

    const cfg = document.createElement("script");
    cfg.innerHTML = 'tailwind=tailwind||{};tailwind.config={corePlugins:{preflight:false}}';
    document.head.appendChild(cfg);

    const s = document.createElement("script");
    s.src = "https://cdn.tailwindcss.com";

    document.head.appendChild(s);

    await new Promise(r => s.onload = r);

  }


  let sessionId = localStorage.getItem(SESSION_KEY) || null;


  async function callAPI(message) {

    const headers = new Headers();

    headers.append("Content-Type", "application/json");

    if (API_KEY) headers.append("X-API-Key", API_KEY);

    const payload = { message };

    if (sessionId) payload.sessionId = sessionId;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (json.sessionId) {
      sessionId = json.sessionId;
      localStorage.setItem(SESSION_KEY, sessionId);
    }

    return json.output || "(no response)";
  }



  function buildWidget() {

    /* Launcher */

    const launcher = el("button");

    launcher.innerHTML = "💬";

    launcher.style.position = "fixed";
    launcher.style.bottom = "20px";
    launcher.style.right = "20px";
    launcher.style.zIndex = "999999";
    launcher.style.width = "56px";
    launcher.style.height = "56px";
    launcher.style.borderRadius = "50%";
    launcher.style.background = "#4f46e5";
    launcher.style.color = "white";
    launcher.style.fontSize = "22px";
    launcher.style.border = "none";
    launcher.style.cursor = "pointer";
    launcher.style.boxShadow = "0 10px 25px rgba(0,0,0,.2)";


    /* Chat panel */

    const panel = el("div");

    panel.style.position = "fixed";
    panel.style.bottom = "90px";
    panel.style.right = "20px";
    panel.style.width = "380px";
    panel.style.height = "520px";
    panel.style.background = "white";
    panel.style.borderRadius = "14px";
    panel.style.boxShadow = "0 20px 40px rgba(0,0,0,.2)";
    panel.style.display = "none";
    panel.style.flexDirection = "column";
    panel.style.zIndex = "999999";


    /* Header */

    const header = el("div");

    header.innerHTML = `<b>${escapeHtml(BRAND)}</b>`;

    header.style.padding = "12px";
    header.style.borderBottom = "1px solid #eee";


    /* Messages */

    const messages = el("div");

    messages.style.flex = "1";
    messages.style.overflow = "auto";
    messages.style.padding = "10px";

    messages.innerHTML = `
<div style="background:#f3f4f6;padding:8px;border-radius:10px;margin-bottom:6px">
Hi 👋 I'm ${escapeHtml(BRAND)}
</div>
`;


    /* Composer */

    const form = el("form");

    form.style.display = "flex";
    form.style.borderTop = "1px solid #eee";

    const input = el("input");

    input.placeholder = "Type message...";
    input.style.flex = "1";
    input.style.border = "none";
    input.style.padding = "10px";

    const send = el("button");

    send.innerText = "Send";

    send.style.background = "#4f46e5";
    send.style.color = "white";
    send.style.border = "none";
    send.style.padding = "10px 14px";
    send.style.cursor = "pointer";

    form.appendChild(input);
    form.appendChild(send);


    /* Assemble */

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(form);

    document.body.appendChild(panel);
    document.body.appendChild(launcher);



    launcher.onclick = () => {
      panel.style.display = "flex";
      launcher.style.display = "none";
    };


    header.onclick = () => {
      panel.style.display = "none";
      launcher.style.display = "block";
    };



    form.onsubmit = async (e) => {

      e.preventDefault();

      const text = input.value.trim();

      if (!text) return;

      messages.innerHTML += `
<div style="text-align:right;margin-bottom:6px">
<span style="background:#4f46e5;color:white;padding:8px;border-radius:10px">
${escapeHtml(text)}
</span>
</div>
`;

      input.value = "";

      const typing = el("div");

      typing.innerHTML = "AI typing...";
      messages.appendChild(typing);

      messages.scrollTop = messages.scrollHeight;

      try {

        const reply = await callAPI(text);

        typing.remove();

        messages.innerHTML += `
<div style="background:#f3f4f6;padding:8px;border-radius:10px;margin-bottom:6px">
${escapeHtml(reply)}
</div>
`;

      } catch {

        typing.innerHTML = "Error contacting AI";

      }

      messages.scrollTop = messages.scrollHeight;

    };

  }


  (async function () {

    await ensureTailwind();

    buildWidget();

  })();

})();