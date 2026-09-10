const root = document.querySelector("[data-rq-chat-root]");

if (root) initializeChat(root);

function initializeChat(root) {
  const HISTORY_KEY = "rq-chat-history-v1";
  const PROVIDER_KEY = "rq-chat-provider-v1";
  const DRAFT_KEY = "rq-chat-draft-v1";
  const providers = { anthropic: "Claude", openai: "OpenAI" };
  const errors = {
    CONFIG: "L’assistant n’est pas encore disponible sur ce site.",
    BUSY: "L’assistant reçoit trop de demandes. Réessayez dans un instant.",
    TIMEOUT: "La réponse prend trop de temps. Veuillez réessayer.",
    OPENAI_CREDITS:
      "Le crédit disponible chez OpenAI est épuisé. Vous pouvez sélectionner Claude et renvoyer votre demande.",
    LIMIT:
      "La conversation dépasse les limites autorisées. Commencez une nouvelle conversation.",
    INVALID: "La demande est invalide. Vérifiez le modèle et les messages.",
    RESPONSE: "La réponse de l’assistant est illisible. Veuillez réessayer.",
  };
  // Static UI only. Conversation content never enters this template.
  root.innerHTML = `
    <section class="rq-chat__panel" id="rq-chat-panel" role="dialog"
      aria-labelledby="rq-chat-title" data-rq-chat-panel hidden>
      <header class="rq-chat__header">
        <h2 class="rq-chat__title" id="rq-chat-title">Assistant Projet Requiem</h2>
        <button class="rq-chat__close" type="button" aria-label="Réduire la conversation" data-rq-chat-close>−</button>
      </header>
      <div class="rq-chat__toolbar">
        <label class="rq-chat__provider-label" for="rq-chat-provider">Modèle IA
          <select class="rq-chat__provider" id="rq-chat-provider" data-rq-chat-provider>
            <option value="anthropic">Claude</option><option value="openai">OpenAI</option>
          </select>
        </label>
        <button class="rq-chat__new" type="button" data-rq-chat-new>Nouvelle conversation</button>
      </div>
      <div class="rq-chat__messages" role="log" aria-label="Conversation avec l’assistant"
        aria-live="polite" aria-relevant="additions" tabindex="0" data-rq-chat-messages data-lenis-prevent></div>
      <p class="rq-chat__status" role="status" aria-live="polite" data-rq-chat-status></p>
      <p class="rq-chat__error" role="alert" data-rq-chat-error></p>
      <p class="rq-chat__storage" role="status" data-rq-chat-storage hidden></p>
      <form class="rq-chat__form" data-rq-chat-form novalidate>
        <label class="rq-chat__input-label" for="rq-chat-input">Votre message</label>
        <textarea class="rq-chat__input" id="rq-chat-input" rows="2" maxlength="4000"
          placeholder="Écrivez votre message…" data-rq-chat-input data-lenis-prevent></textarea>
        <div class="rq-chat__composer-actions">
          <span class="rq-chat__count" data-rq-chat-count>0 / 4 000</span>
          <button class="rq-chat__send" type="submit" data-rq-chat-send>Envoyer</button>
        </div>
      </form>
    </section>
    <button class="rq-chat__launcher" type="button" aria-label="Ouvrir l’assistant Projet Requiem"
      aria-expanded="false" aria-controls="rq-chat-panel" data-rq-chat-launcher>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h7"/></svg>
    </button>`;
  const get = (name) => root.querySelector(`[data-rq-chat-${name}]`);
  const panel = get("panel"),
    launcher = get("launcher"),
    log = get("messages");
  const input = get("input"),
    provider = get("provider"),
    form = get("form");
  const status = get("status"),
    error = get("error"),
    send = get("send");
  const storage = get("storage");
  let messages = [],
    sending = false,
    controller = null,
    generation = 0;
  let markdown = null,
    purifier = null;

  function stored(action, key, value) {
    try {
      return sessionStorage[action](key, value);
    } catch {
      storage.hidden = false;
      storage.textContent =
        "La mémoire de cet onglet est indisponible. La conversation reste accessible sur cette page.";
      return null;
    }
  }
  function validMessage(message) {
    return (
      message &&
      ["user", "assistant"].includes(message.role) &&
      typeof message.content === "string" &&
      message.content.trim() &&
      message.content.length <= (message.role === "user" ? 4000 : 32000)
    );
  }
  try {
    const saved = JSON.parse(stored("getItem", HISTORY_KEY) || "[]");
    if (Array.isArray(saved))
      messages = saved
        .filter(validMessage)
        .slice(-30)
        .map(({ role, content }) => ({ role, content }));
  } catch {
    stored("removeItem", HISTORY_KEY);
  }
  const savedProvider = stored("getItem", PROVIDER_KEY);
  provider.value = Object.hasOwn(providers, savedProvider)
    ? savedProvider
    : "anthropic";
  stored("setItem", PROVIDER_KEY, provider.value);
  input.value = (stored("getItem", DRAFT_KEY) || "").slice(0, 4000);
  // A navigation/refresh cannot resume an in-flight HTTP request: restore it as a draft.
  if (messages.at(-1)?.role === "user") input.value = messages.pop().content;

  function save() {
    messages = messages.slice(-30);
    stored("setItem", HISTORY_KEY, JSON.stringify(messages));
    stored("setItem", DRAFT_KEY, input.value);
  }
  function renderContent(element, message) {
    if (message.role === "user" || !markdown || !purifier) {
      element.textContent = message.content;
      return;
    }
    try {
      const fragment = purifier.sanitize(markdown.parse(message.content), {
        ALLOWED_TAGS: ["p", "strong", "em", "ul", "ol", "li", "a", "br"],
        ALLOWED_ATTR: ["href", "title"],
        ALLOW_ARIA_ATTR: false,
        ALLOW_DATA_ATTR: false,
        RETURN_DOM_FRAGMENT: true,
      });
      for (const link of fragment.querySelectorAll("a")) {
        try {
          const href = link.getAttribute("href") || "";
          const url = new URL(href);
          if (
            !/^https?:\/\//i.test(href) ||
            !["http:", "https:"].includes(url.protocol)
          )
            throw new Error();
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
        } catch {
          link.replaceWith(document.createTextNode(link.textContent || ""));
        }
      }
      element.replaceChildren(fragment);
    } catch {
      element.textContent = message.content;
    }
  }
  function append(message) {
    const article = document.createElement("article");
    article.className = `rq-chat__message rq-chat__message--${message.role}`;
    const author = document.createElement("p");
    author.className = "rq-chat__author";
    author.textContent =
      message.role === "user" ? "Vous" : "Assistant Projet Requiem";
    const content = document.createElement("div");
    content.className = "rq-chat__content";
    renderContent(content, message);
    article.append(author, content);
    log.append(article);
  }
  function render() {
    log.replaceChildren();
    if (!messages.length) {
      const welcome = document.createElement("p");
      welcome.className = "rq-chat__welcome";
      welcome.textContent =
        "Bienvenue. Que souhaitez-vous savoir sur Projet Requiem ?";
      log.append(welcome);
    }
    messages.forEach(append);
  }
  function scrollLatest() {
    requestAnimationFrame(() => {
      log.scrollTop = log.scrollHeight;
    });
  }
  function updateCount() {
    get("count").textContent =
      `${input.value.length.toLocaleString("fr-FR")} / 4 000`;
  }
  function setSending(value) {
    sending = value;
    send.disabled = value;
    provider.disabled = value;
    input.readOnly = value;
    form.setAttribute("aria-busy", String(value));
    status.textContent = value ? "Réponse en cours…" : "";
  }
  function open() {
    panel.hidden = false;
    root.dataset.rqChatOpen = "true";
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Réduire la conversation");
    layout();
    scrollLatest();
    // Do not summon the mobile keyboard until the visitor taps the composer.
    (mobile.matches ? get("close") : input).focus({ preventScroll: true });
  }
  function close(restoreFocus = true) {
    panel.hidden = true;
    delete root.dataset.rqChatOpen;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Ouvrir l’assistant Projet Requiem");
    if (restoreFocus) launcher.focus({ preventScroll: true });
  }

  // The upstream accepts 30 messages of at most 4,000 characters each.
  // Keep recent complete turns within that contract; full replies remain visible locally.
  function requestMessages() {
    const recent = messages
      .slice(-29)
      .map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
    while (recent[0]?.role === "assistant") recent.shift();
    while (
      recent.reduce((sum, message) => sum + message.content.length, 0) >
        60000 &&
      recent.length > 1
    ) {
      recent.shift();
      while (recent[0]?.role === "assistant") recent.shift();
    }
    return recent;
  }
  async function submit() {
    if (sending) return;
    const content = input.value.trim();
    error.textContent = "";
    if (!content || content.length > 4000) {
      error.textContent = !content
        ? "Écrivez un message avant de l’envoyer."
        : "Votre message dépasse la limite de 4 000 caractères.";
      input.focus();
      return;
    }
    // Replacing a failed turn avoids sending a duplicate user message on retry.
    if (messages.at(-1)?.role === "user") {
      messages.pop();
      log.querySelector(".rq-chat__message:last-child")?.remove();
    }
    messages.push({ role: "user", content });
    input.value = "";
    save();
    log.querySelector(".rq-chat__welcome")?.remove();
    while (log.querySelectorAll(".rq-chat__message").length >= messages.length)
      log.firstElementChild?.remove();
    append(messages.at(-1));
    scrollLatest();
    updateCount();
    setSending(true);
    controller = new AbortController();
    const current = ++generation;
    const activeController = controller;
    const timer = setTimeout(() => activeController.abort(), 65000);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        redirect: "error",
        body: JSON.stringify({
          provider: provider.value,
          messages: requestMessages(),
        }),
        signal: activeController.signal,
      });
      const result = await response.json().catch(() => null);
      if (current !== generation) return;
      if (!response.ok) {
        error.textContent =
          (Object.hasOwn(errors, result?.code) && errors[result.code]) ||
          "L’assistant est momentanément indisponible. Veuillez réessayer.";
        throw new Error("Handled response");
      }
      if (
        typeof result?.reply !== "string" ||
        !result.reply.trim() ||
        result.reply.length > 32000
      ) {
        error.textContent = errors.RESPONSE;
        throw new Error("Invalid response");
      }
      const answer = { role: "assistant", content: result.reply.trim() };
      messages.push(answer);
      save();
      while (
        log.querySelectorAll(".rq-chat__message").length >= messages.length
      )
        log.firstElementChild?.remove();
      append(answer);
      scrollLatest();
      send.textContent = "Envoyer";
    } catch {
      if (current !== generation) return;
      if (!error.textContent)
        error.textContent = activeController.signal.aborted
          ? errors.TIMEOUT
          : "La connexion à l’assistant a échoué. Vérifiez votre connexion et réessayez.";
      input.value = content;
      send.textContent = "Réessayer";
      save();
      updateCount();
    } finally {
      clearTimeout(timer);
      if (current === generation) {
        controller = null;
        setSending(false);
      }
    }
  }
  launcher.addEventListener("click", () => (panel.hidden ? open() : close()));
  get("close").addEventListener("click", () => close());
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  input.addEventListener("input", () => {
    updateCount();
    error.textContent = "";
    stored("setItem", DRAFT_KEY, input.value);
  });
  provider.addEventListener("change", () => {
    if (!Object.hasOwn(providers, provider.value)) provider.value = "anthropic";
    stored("setItem", PROVIDER_KEY, provider.value);
    error.textContent = "";
    status.textContent = `${providers[provider.value]} sélectionné. La conversation est conservée.`;
  });
  get("new").addEventListener("click", () => {
    generation++;
    controller?.abort();
    controller = null;
    messages = [];
    input.value = "";
    stored("removeItem", HISTORY_KEY);
    stored("removeItem", DRAFT_KEY);
    error.textContent = "";
    setSending(false);
    status.textContent = "Nouvelle conversation ouverte.";
    send.textContent = "Envoyer";
    render();
    updateCount();
    input.focus({ preventScroll: true });
  });

  const mobile = matchMedia("(max-width: 768px)");
  const nav = document.querySelector(".main-nav");
  const navMenu = document.querySelector(".nav-menu");
  function layout() {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    root.toggleAttribute("data-rq-chat-compact", height <= 520);
    const keyboardInset = Math.max(
      0,
      window.innerHeight - height - (viewport?.offsetTop || 0),
    );
    root.style.setProperty("--rq-chat-vh", `${height}px`);
    root.style.setProperty("--rq-chat-keyboard", `${keyboardInset}px`);
    root.style.setProperty("--rq-chat-panel-shift", "0px");
    if (nav && !mobile.matches && !panel.hidden) {
      const navBox = nav.getBoundingClientRect();
      if (navBox.bottom > panel.getBoundingClientRect().top) {
        root.style.setProperty(
          "--rq-chat-panel-shift",
          `${navBox.width + 8}px`,
        );
      }
    }
  }
  function syncNavigation() {
    const drawerOpen = mobile.matches && navMenu?.classList.contains("is-open");
    if (drawerOpen && !panel.hidden) {
      const hadFocus = root.contains(document.activeElement);
      close(false);
      if (hadFocus)
        document.querySelector(".nav-toggle")?.focus({ preventScroll: true });
    }
    root.hidden = Boolean(drawerOpen);
    layout();
  }
  if (navMenu)
    new MutationObserver(syncNavigation).observe(navMenu, {
      attributes: true,
      attributeFilter: ["class"],
    });
  if (nav && typeof ResizeObserver !== "undefined")
    new ResizeObserver(layout).observe(nav);
  mobile.addEventListener("change", syncNavigation);
  window.addEventListener("resize", layout);
  window.visualViewport?.addEventListener("resize", layout);
  window.visualViewport?.addEventListener("scroll", layout);
  save();
  render();
  updateCount();
  syncNavigation();

  // Local, pinned dependencies; a download failure falls back to safe plain text.
  Promise.all([
    import("/assets/chat-vendor/marked.js"),
    import("/assets/chat-vendor/dompurify.js"),
  ])
    .then(([parser, sanitizer]) => {
      markdown = new parser.Marked({
        async: false,
        gfm: true,
        breaks: false,
        renderer: {
          html: ({ text }) =>
            text
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;"),
        },
      });
      purifier = sanitizer.default;
      // Upgrade restored messages in place without re-announcing the conversation.
      log.querySelectorAll(".rq-chat__message").forEach((article, index) => {
        if (messages[index])
          renderContent(
            article.querySelector(".rq-chat__content"),
            messages[index],
          );
      });
    })
    .catch(() => {});
}
