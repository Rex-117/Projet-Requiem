// Local test double for the HTTP contract; this contains no chatbot logic.
const http = require("node:http");
const { spawn } = require("node:child_process");
let calls = [];
const mock = http.createServer(async (req, res) => {
  if (req.url === "/calls") {
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(calls));
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  calls.push({ path: req.url, body, headers: req.headers });
  const content = body.messages.at(-1).content;
  res.setHeader("Content-Type", "application/json");
  if (content === "TIMEOUT") return;
  if (content === "RAW_ERROR") {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "SECRET SDK STACK sk-test-key" }));
  }
  if (content === "WRONG_RESPONSE") return res.end(JSON.stringify({ answer: "not the contract" }));
  if (content === "BAD_JSON") return res.end("<html>private error</html>");
  if (content === "OVERSIZED_RESPONSE") return res.end("x".repeat(270000));
  if (content === "REDIRECT") {
    res.writeHead(302, { Location: "http://127.0.0.1:3100/api/chat" });
    return res.end();
  }
  if (body.provider === "openai") {
    res.statusCode = 402;
    return res.end(JSON.stringify({ error: "Le crédit disponible chez OpenAI est épuisé. Vous pouvez sélectionner Claude et renvoyer votre demande." }));
  }
  if (content === "SLOW") await new Promise((resolve) => setTimeout(resolve, 1200));
  const reply = content === "MARKDOWN"
    ? 'Un **texte gras** et *italique*.\n\n- Un élément\n- Deux éléments\n\n1. Premier\n2. Second\n\n[Source](https://example.com) [Interdit](javascript:alert(1)) [Courriel](mailto:test@example.com)\n\n<script>window.chatXss=true</script><img src=x onerror="window.chatXss=true"><iframe src="https://example.com"></iframe>\n\n<a href="javascript:alert(1)" onclick="window.chatXss=true">HTML brut</a>'
    : content === "LONG" ? ("Paragraphe assez long pour vérifier le défilement indépendant.\n\n").repeat(180)
    : `Réponse de test. **Contexte : ${body.messages.length} messages.**`;
  res.end(JSON.stringify({ reply }));
});
const children = [];
mock.listen(3101, "127.0.0.1", () => {
  children.push(spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT: "3100", CHATBOT_API_URL: "http://127.0.0.1:3101" },
    stdio: "inherit", windowsHide: true,
  }));
});
function stop() { children.forEach((child) => child.kill()); mock.close(); }
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
process.on("exit", stop);
