const express = require("express");
const path = require("path");

const app = express();
// const PORT = 3000;
const PORT = process.env.PORT || 3000;

const data = require("./characters.json");

// Only these two browser builds are used by the isolated chat widget.
app.get("/assets/chat-vendor/marked.js", (req, res) => {
  res.sendFile(path.join(__dirname, "node_modules/marked/lib/marked.esm.js"));
});
app.get("/assets/chat-vendor/dompurify.js", (req, res) => {
  res.sendFile(path.join(__dirname, "node_modules/dompurify/dist/purify.es.mjs"));
});

const chatErrors = {
  METHOD: "Utilisez la méthode POST pour envoyer un message.",
  ORIGIN: "Cette demande ne provient pas du site. Rechargez la page.",
  TYPE: "Le message doit être envoyé au format JSON.",
  INVALID: "La demande est invalide. Vérifiez le modèle et les messages.",
  LIMIT: "La conversation dépasse les limites autorisées. Commencez une nouvelle conversation.",
  CONFIG: "L’assistant n’est pas encore disponible sur ce site.",
  BUSY: "L’assistant reçoit trop de demandes. Réessayez dans un instant.",
  TIMEOUT: "La réponse prend trop de temps. Veuillez réessayer.",
  UPSTREAM: "L’assistant est momentanément indisponible. Veuillez réessayer.",
  RESPONSE: "La réponse de l’assistant est illisible. Veuillez réessayer.",
  OPENAI_CREDITS: "Le crédit disponible chez OpenAI est épuisé. Vous pouvez sélectionner Claude et renvoyer votre demande.",
};
const chatFailure = (res, status, code) => res.status(status).json({ error: chatErrors[code], code });
const chatJson = express.json({ limit: "256kb", strict: true, inflate: false });
let activeChatRequests = 0;

// A fixed-destination adapter only: all chatbot logic remains in its own service.
app.all("/api/chat", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.set("Allow", "POST");
    return chatFailure(res, 405, "METHOD");
  }
  try {
    if (req.get("Sec-Fetch-Site") === "cross-site" ||
        (req.get("Origin") && new URL(req.get("Origin")).host !== req.get("host"))) {
      return chatFailure(res, 403, "ORIGIN");
    }
  } catch {
    return chatFailure(res, 403, "ORIGIN");
  }
  if (!req.is("application/json")) return chatFailure(res, 415, "TYPE");
  chatJson(req, res, (error) => {
    if (error) return chatFailure(res, error.status === 413 ? 413 : 400, error.status === 413 ? "LIMIT" : "INVALID");
    next();
  });
}, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => !["provider", "messages"].includes(key)) ||
      !["openai", "anthropic"].includes(body.provider) || !Array.isArray(body.messages) ||
      req.get("Authorization") || req.get("X-API-Key")) {
    return chatFailure(res, 400, "INVALID");
  }
  if (body.messages.length < 1 || body.messages.length > 30) return chatFailure(res, 400, "LIMIT");
  let totalLength = 0;
  for (const message of body.messages) {
    if (!message || typeof message !== "object" || Array.isArray(message) ||
        Object.keys(message).some((key) => !["role", "content"].includes(key)) ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" || !message.content.trim()) {
      return chatFailure(res, 400, "INVALID");
    }
    totalLength += message.content.length;
    if (message.content.length > 4000 || totalLength > 60000) return chatFailure(res, 400, "LIMIT");
  }
  if (body.messages[0].role !== "user" || body.messages.at(-1).role !== "user") {
    return chatFailure(res, 400, "INVALID");
  }

  let upstream;
  try {
    const base = new URL(process.env.CHATBOT_API_URL);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    if ((base.protocol !== "https:" && !(local && base.protocol === "http:")) ||
        base.username || base.password || base.search || base.hash || base.pathname !== "/" ||
        base.host.toLowerCase() === req.get("host")?.toLowerCase() ||
        base.hostname === process.env.RAILWAY_PUBLIC_DOMAIN) throw new Error("Invalid upstream");
    upstream = new URL("/api/chat", base);
  } catch {
    return chatFailure(res, 503, "CONFIG");
  }
  if (activeChatRequests >= 8) return chatFailure(res, 429, "BUSY");

  activeChatRequests++;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 60000);
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  res.on("close", disconnect);
  try {
    const response = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        provider: body.provider,
        messages: body.messages.map(({ role, content }) => ({ role, content })),
      }),
      redirect: "error",
      signal: controller.signal,
    });
    // Bound even chunked error responses; never pass raw upstream errors through.
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 256 * 1024) {
        controller.abort();
        return chatFailure(res, 502, "RESPONSE");
      }
      chunks.push(chunk);
    }
    let result;
    try { result = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { result = null; }
    if (!response.ok) {
      if (body.provider === "openai" && response.status === 402 && result?.error === chatErrors.OPENAI_CREDITS) {
        return chatFailure(res, 402, "OPENAI_CREDITS");
      }
      return chatFailure(res, response.status === 429 ? 429 : 502, response.status === 429 ? "BUSY" : "UPSTREAM");
    }
    if (!response.headers.get("content-type")?.includes("application/json") ||
        typeof result?.reply !== "string" || !result.reply.trim() || result.reply.length > 32000) {
      return chatFailure(res, 502, "RESPONSE");
    }
    res.json({ reply: result.reply.trim() });
  } catch {
    if (!res.destroyed) chatFailure(res, timedOut ? 504 : 502, timedOut ? "TIMEOUT" : "UPSTREAM");
  } finally {
    clearTimeout(timer);
    res.off("close", disconnect);
    activeChatRequests--;
  }
});

app.use(express.static(path.join(__dirname)));

// API route
app.get("/api/characters", (req, res) => {
  const charactersInfo = data.characters.map((character) => {
    return {
      name: character.name,
      age: character.age,
      pob: character.pob,
      nationality: character.nationality,
      affiliation: character.affiliation,
      job: character.job,
      family: character.family,
      status: character.status,
      sex: character.sex,
      bloodType: character.bloodType,
      isConfirmed: character.isConfirmed,
      images: character.images,
      thumbnail_image: character.thumbnail_image,
      model_video: character.model_video,
      description: character.description,
    };
  });

  res.json(charactersInfo);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
