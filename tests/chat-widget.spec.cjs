const { test, expect } = require("@playwright/test");
const chat = (page, part) => page.locator(`[data-rq-chat-${part}]`);
const payload = (content = "Bonjour") => ({ provider: "anthropic", messages: [{ role: "user", content }] });

async function open(page, path = "/") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await chat(page, "launcher").click();
  await expect(chat(page, "panel")).toBeVisible();
}
async function send(page, content) {
  await chat(page, "input").fill(content);
  await chat(page, "send").click();
  await expect(chat(page, "send")).toBeEnabled();
}

for (const path of ["/", "/characters.html", "/trailer.html", "/credits.html"]) {
  test(`launcher, close, Escape, and page content: ${path}`, async ({ page }) => {
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await open(page, path);
    await expect(chat(page, "launcher")).toHaveAttribute("aria-expanded", "true");
    await chat(page, "close").click();
    await expect(chat(page, "panel")).toBeHidden();
    await expect(chat(page, "launcher")).toBeFocused();
    await chat(page, "launcher").click();
    await page.keyboard.press("Escape");
    await expect(chat(page, "panel")).toBeHidden();
    await expect(chat(page, "launcher")).toBeFocused();
    await expect(page.locator(".main-nav")).toBeVisible();
    if (path === "/characters.html") await expect(page.locator("[data-character-name]").first()).not.toBeEmpty();
    expect(failures).toEqual([]);
  });
}

test("session history, provider, follow-up, draft, navigation and new conversation", async ({ page, request }) => {
  const browserChatUrls = [];
  page.on("request", (req) => { if (req.url().includes("/api/chat")) browserChatUrls.push(req.url()); });
  await open(page);
  await expect(chat(page, "provider")).toHaveValue("anthropic");
  await send(page, "Question initiale");
  await expect(page.locator(".rq-chat__message--assistant")).toHaveCount(1);
  await send(page, "Question suivante");
  await expect(page.locator(".rq-chat__message--assistant").last()).toContainText("3 messages");
  const calls = await (await request.get("http://127.0.0.1:3101/calls")).json();
  const followup = calls.find((call) => call.body.messages.at(-1).content === "Question suivante");
  expect(followup.path).toBe("/api/chat");
  expect(followup.body.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  expect(followup.headers.authorization).toBeUndefined();
  await chat(page, "provider").selectOption("openai");
  await chat(page, "input").fill("Brouillon conservé");
  await page.reload({ waitUntil: "domcontentloaded" });
  await chat(page, "launcher").click();
  await expect(page.locator(".rq-chat__message")).toHaveCount(4);
  await expect(chat(page, "provider")).toHaveValue("openai");
  await expect(chat(page, "input")).toHaveValue("Brouillon conservé");
  await chat(page, "close").click();
  await page.locator('.nav-link[href="credits.html"]').click();
  await chat(page, "launcher").click();
  await expect(page.locator(".rq-chat__message")).toHaveCount(4);
  await expect(chat(page, "provider")).toHaveValue("openai");
  await chat(page, "new").click();
  await expect(page.locator(".rq-chat__message")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("rq-chat-history-v1"))).toBeNull();
  await expect(chat(page, "input")).toHaveValue("");
  await expect(chat(page, "provider")).toHaveValue("openai");
  expect(browserChatUrls.every((url) => url.startsWith("http://127.0.0.1:3100/"))).toBe(true);
});

test("safe Markdown and plain-text user messages", async ({ page }) => {
  await open(page);
  await send(page, "MARKDOWN");
  const answer = page.locator(".rq-chat__message--assistant").last();
  await expect(answer.locator("strong")).toHaveText("texte gras");
  await expect(answer.locator("em")).toHaveText("italique");
  await expect(answer.locator("ul li")).toHaveCount(2);
  await expect(answer.locator("ol li")).toHaveCount(2);
  await expect(answer.locator("a")).toHaveCount(1);
  await expect(answer.locator("a")).toHaveAttribute("href", "https://example.com");
  await expect(answer.locator("a")).toHaveAttribute("rel", "noopener noreferrer");
  await expect(answer.locator("script,img,iframe,object,[onclick],[onerror]")).toHaveCount(0);
  await send(page, '<img src=x onerror="window.chatXss=true"> **texte brut**');
  const user = page.locator(".rq-chat__message--user").last();
  await expect(user.locator("img,strong")).toHaveCount(0);
  await expect(user).toContainText("**texte brut**");
  expect(await page.evaluate(() => window.chatXss)).toBeUndefined();
});

test("loading, duplicate suppression, minimize during reply, safe errors and retry", async ({ page }) => {
  await open(page);
  await chat(page, "input").fill("SLOW");
  await chat(page, "send").click();
  await expect(chat(page, "status")).toHaveText("Réponse en cours…");
  await expect(chat(page, "send")).toBeDisabled();
  await chat(page, "close").click();
  await expect(chat(page, "send")).toBeEnabled();
  await expect(chat(page, "launcher")).toBeFocused();
  await chat(page, "launcher").click();
  await expect(page.locator(".rq-chat__message--assistant")).toHaveCount(1);
  await chat(page, "provider").selectOption("openai");
  await send(page, "Bonjour indisponible");
  await expect(chat(page, "error")).toContainText("crédit disponible chez OpenAI est épuisé");
  await expect(chat(page, "input")).toHaveValue("Bonjour indisponible");
  await chat(page, "provider").selectOption("anthropic");
  await chat(page, "send").click();
  await expect(chat(page, "send")).toBeEnabled();
  await expect(page.locator(".rq-chat__message--user")).toHaveCount(2);
  await send(page, "RAW_ERROR");
  await expect(chat(page, "error")).toContainText("momentanément indisponible");
  await expect(chat(page, "panel")).not.toContainText("SECRET");
});

test("new conversation cancels stale replies", async ({ page }) => {
  await open(page);
  await chat(page, "input").fill("SLOW");
  await chat(page, "send").click();
  await chat(page, "new").click();
  await expect(page.locator(".rq-chat__message")).toHaveCount(0);
  await page.waitForTimeout(1600);
  await expect(page.locator(".rq-chat__message")).toHaveCount(0);
  await expect(chat(page, "error")).toBeEmpty();
});

test("long replies scroll independently while Lenis and desktop navigation work", async ({ page }) => {
  await open(page);
  await send(page, "LONG");
  const scroll = chat(page, "messages");
  await expect(scroll).toHaveAttribute("data-lenis-prevent", "");
  const pageY = await page.evaluate(() => window.scrollY);
  await scroll.evaluate((el) => { el.scrollTop = 0; });
  await scroll.hover();
  await page.mouse.wheel(0, 400);
  await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageY);
  await expect(page.locator("html")).toHaveClass(/lenis/);
  await chat(page, "close").click();
  await page.mouse.move(300, 400);
  await page.mouse.wheel(0, 650);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(pageY + 100);
  await page.locator('.nav-link[href="characters.html"]').click();
  await expect(page).toHaveURL(/characters.html$/);
});

test("mobile drawer, viewport sizes, focus and composer visibility", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(chat(page, "close")).toBeFocused();
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 390, height: 360 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => {
      const box = await chat(page, "panel").boundingBox();
      return box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height;
    }).toBe(true);
    await expect(chat(page, "input")).toBeInViewport();
    await expect(chat(page, "send")).toBeInViewport();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".nav-toggle").click();
  await expect(page.locator(".nav-menu")).toHaveClass(/is-open/);
  await expect(chat(page, "root")).toBeHidden();
  await page.locator('.nav-link[href="characters.html"]').click();
  await expect(page).toHaveURL(/characters.html$/);
  await expect(chat(page, "launcher")).toBeVisible();
  await chat(page, "launcher").click();
  await page.keyboard.press("Escape");
  await expect(chat(page, "launcher")).toBeFocused();
});

test("unavailable sessionStorage and Markdown libraries fail safely", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("Unavailable"); } });
  });
  await page.route("**/assets/chat-vendor/*", (route) => route.abort());
  await open(page);
  await expect(chat(page, "storage")).toBeVisible();
  await send(page, "MARKDOWN");
  await expect(page.locator(".rq-chat__message--assistant")).toContainText("**texte gras**");
  await expect(page.locator(".rq-chat__message--assistant script")).toHaveCount(0);
  await chat(page, "new").click();
  await expect(page.locator(".rq-chat__message")).toHaveCount(0);
});

test("touch viewport keeps the composer above a simulated on-screen keyboard", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await open(page, "http://127.0.0.1:3100/");
    await chat(page, "input").tap();
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, "height", { configurable: true, get: () => 340 });
      window.visualViewport.dispatchEvent(new Event("resize"));
    });
    const box = await chat(page, "panel").boundingBox();
    const sendBox = await chat(page, "send").boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(340);
    expect(sendBox.y + sendBox.height).toBeLessThanOrEqual(340);
    await expect(chat(page, "root")).toHaveAttribute("data-rq-chat-compact", "");
  } finally { await context.close(); }
});

test("long saved conversations send bounded recent history and preserve full replies", async ({ page }) => {
  await page.addInitScript(() => {
    const history = Array.from({ length: 30 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: String(index).padEnd(index % 2 ? 8000 : 4000, "x") }));
    sessionStorage.setItem("rq-chat-history-v1", JSON.stringify(history));
  });
  await open(page);
  expect((await page.locator(".rq-chat__message--assistant .rq-chat__content").last().textContent()).trim().length).toBe(8000);
  const sent = page.waitForRequest((req) => req.url().endsWith("/api/chat") && req.method() === "POST");
  await send(page, "Question après un long échange");
  const body = (await sent).postDataJSON();
  expect(body.messages.length).toBeLessThanOrEqual(30);
  expect(body.messages[0].role).toBe("user");
  expect(body.messages.every((message) => message.content.length <= 4000)).toBe(true);
  expect(body.messages.reduce((sum, message) => sum + message.content.length, 0)).toBeLessThanOrEqual(60000);
  await expect(chat(page, "error")).toBeEmpty();
});

test("proxy validates methods, payloads, keys, limits and origin", async ({ request }) => {
  for (const method of ["GET", "PUT", "DELETE", "OPTIONS", "HEAD"]) {
    const response = await request.fetch("/api/chat", { method });
    expect(response.status()).toBe(405);
    expect(response.headers().allow).toBe("POST");
  }
  const cases = [
    { ...payload(), provider: "unknown" }, { ...payload(), apiKey: "not-accepted" },
    { ...payload(), url: "https://example.com" }, { provider: "anthropic", messages: [] },
    { provider: "anthropic", messages: [{ role: "system", content: "forbidden" }] },
    { provider: "anthropic", messages: [{ role: "user", content: 5 }] },
    payload(" "), payload("x".repeat(4001)),
    { provider: "anthropic", messages: Array.from({ length: 31 }, () => ({ role: "user", content: "x" })) },
    { provider: "anthropic", messages: Array.from({ length: 16 }, () => ({ role: "user", content: "x".repeat(4000) })) },
  ];
  for (const data of cases) expect((await request.post("/api/chat", { data })).status()).toBe(400);
  expect((await request.post("/api/chat", { data: payload(), headers: { Authorization: "Bearer not-accepted" } })).status()).toBe(400);
  expect((await request.post("/api/chat", { data: payload(), headers: { Origin: "https://example.com" } })).status()).toBe(403);
  // If configured upstream and incoming site host coincide, forwarding is refused.
  expect((await request.post("/api/chat", { data: payload(), headers: { Host: "127.0.0.1:3101" } })).status()).toBe(503);
  expect((await request.post("/api/chat", { data: "{}", headers: { "Content-Type": "text/plain" } })).status()).toBe(415);
  expect((await request.post("/api/chat", { data: "{", headers: { "Content-Type": "application/json" } })).status()).toBe(400);
  expect((await request.post("/api/chat", { data: payload("x".repeat(270000)) })).status()).toBe(413);
});

test("proxy rejects malformed upstream responses, redirects, and raw errors", async ({ request }) => {
  for (const content of ["WRONG_RESPONSE", "BAD_JSON", "OVERSIZED_RESPONSE", "RAW_ERROR", "REDIRECT"]) {
    const response = await request.post("/api/chat", { data: payload(content) });
    expect(response.status()).toBe(502);
    const body = await response.json();
    expect(body.error).toMatch(/assistant/);
    expect(JSON.stringify(body)).not.toMatch(/SECRET|sk-test|private|stack/i);
  }
});

test("proxy enforces its real request timeout", async ({ request }) => {
  const response = await request.post("/api/chat", { data: payload("TIMEOUT"), timeout: 70000 });
  expect(response.status()).toBe(504);
  expect((await response.json()).code).toBe("TIMEOUT");
});

test("live Claude response, follow-up, and OpenAI credit error through the website", async ({ page }) => {
  test.skip(!process.env.CHATBOT_LIVE_TEST, "Opt-in real provider calls; start local server on port 3102 first.");
  await open(page, "http://127.0.0.1:3102/");
  await send(page, "Bonjour. Pour cet échange, mon nom de code est Corbeau. Réponds brièvement en français.");
  await expect(page.locator(".rq-chat__message--assistant")).toHaveCount(1);
  await send(page, "Quel nom de code viens-je de te donner ? Réponds brièvement.");
  await expect(page.locator(".rq-chat__message--assistant").last()).toContainText(/Corbeau/i);
  await chat(page, "provider").selectOption("openai");
  await send(page, "Bonjour, réponds brièvement.");
  await expect(chat(page, "error")).toContainText("crédit disponible chez OpenAI est épuisé");
});
