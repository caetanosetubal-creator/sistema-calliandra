const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxbqXBC5VAlVCifAXsXsNJO1NiX8BbnZbV1dsmkTgXwBt-U4Iu8XHwGvdMURPiJN-fA/exec";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    if (req.method === "GET") {
      const action = req.query?.action;

      if (action) {
        const payload = { ...req.query };
        const result = await callAppsScript(payload);
        return res.status(200).json(result);
      }

      return res.status(200).json({
        ok: true,
        message: "Proxy Calliandra ativo",
        endpoint: "/api/sheets",
        teste_getAll: "/api/sheets?action=getAll"
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Método não permitido"
      });
    }

    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const result = await callAppsScript(payload);

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro interno no proxy",
      name: error?.name || null
    });
  }
}

async function callAppsScript(payload) {
  const action = String(payload.action || "").trim();

  if (action === "getAll") {
    const postResult = await postToAppsScript(payload);

    if (hasUsefulData(postResult.raw)) {
      return postResult;
    }

    const getResult = await getFromAppsScript("getAll");

    if (hasUsefulData(getResult.raw)) {
      return getResult;
    }

    return {
      ok: false,
      error: "Apps Script respondeu, mas não trouxe as abas do sistema.",
      detalhe: "Verifique se o Apps Script possui action getAll retornando lotes, vendas, corretores, midia, gastos e acoes.",
      post: postResult.raw,
      get: getResult.raw
    };
  }

  return await postToAppsScript(payload);
}

async function postToAppsScript(payload) {
  const upstream = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload),
    redirect: "follow"
  });

  const text = await upstream.text();
  const raw = safeJson(text);

  if (!raw) {
    return {
      ok: false,
      error: "Resposta inválida do Apps Script em POST",
      rawText: text
    };
  }

  return normalizeResponse(raw);
}

async function getFromAppsScript(action) {
  const url = `${SCRIPT_URL}?action=${encodeURIComponent(action)}`;

  const upstream = await fetch(url, {
    method: "GET",
    redirect: "follow"
  });

  const text = await upstream.text();
  const raw = safeJson(text);

  if (!raw) {
    return {
      ok: false,
      error: "Resposta inválida do Apps Script em GET",
      rawText: text
    };
  }

  return normalizeResponse(raw);
}

function normalizeResponse(raw) {
  const data =
    raw.data ||
    raw.dados ||
    raw.result ||
    {};

  return {
    ok: Boolean(raw.ok || raw.success || hasUsefulData(raw)),
    success: Boolean(raw.ok || raw.success || hasUsefulData(raw)),
    message: raw.message || raw.mensagem || null,
    user: raw.user || raw.usuario || null,
    usuario: raw.usuario || raw.user || null,
    data,
    error: raw.error || raw.erro || null,
    raw
  };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hasUsefulData(raw) {
  if (!raw) return false;

  const data =
    raw.data ||
    raw.dados ||
    raw.result ||
    raw;

  return Boolean(
    Array.isArray(data.lotes) ||
    Array.isArray(data.Lotes) ||
    Array.isArray(data.LOTES) ||
    Array.isArray(data.vendas) ||
    Array.isArray(data.contratos) ||
    Array.isArray(data.corretores) ||
    Array.isArray(data.parceiros)
  );
}
