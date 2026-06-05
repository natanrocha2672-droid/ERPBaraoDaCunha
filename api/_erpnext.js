const privateHosts = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.|0\.|169\.254\.|::1)/i;

export function sendError(res, message, status = 400, detail) {
  return res.status(status).json({ ok: false, error: message, detail });
}

function normalizeBaseUrl(value) {
  let raw = String(value || '').trim();
  raw = raw.replace(/^['"]+|['"]+$/g, '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

export function getBaseUrl(input) {
  const raw = normalizeBaseUrl(input || process.env.ERPNEXT_BASE_URL || process.env.ERPNext_BASE_URL || '');
  if (!raw) throw new Error('Informe a URL do ERPNext ou configure ERPNEXT_BASE_URL na Vercel.');

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('A URL do ERPNext é inválida. Use algo como https://suaempresa.frappe.cloud');
  }

  if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new Error('Por segurança, use uma URL HTTPS do ERPNext em produção.');
  if (privateHosts.test(url.hostname)) throw new Error('URL local ou privada não permitida.');
  return url.origin;
}

export function authHeader() {
  const key = process.env.ERPNext_API_KEY || process.env.ERPNEXT_API_KEY;
  const secret = process.env.ERPNext_API_SECRET || process.env.ERPNEXT_API_SECRET;
  if (!key || !secret) throw new Error('Configure ERPNext_API_KEY e ERPNext_API_SECRET nas variáveis de ambiente da Vercel.');
  return `token ${key}:${secret}`;
}

function extractMessage(data, status) {
  if (data?._server_messages) {
    try {
      const outer = JSON.parse(data._server_messages);
      const messages = outer.map((entry) => {
        try { return JSON.parse(entry)?.message || entry; } catch { return entry; }
      }).filter(Boolean);
      if (messages.length) return messages.join(' ');
    } catch {}
  }
  return data?.exception || data?.message || data?.raw || `Erro ${status} no ERPNext`;
}

export async function erpFetch(baseUrl, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers || {})
    },
    cache: 'no-store'
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) {
    const msg = extractMessage(data, response.status);
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  if (data?.raw && /^\s*<!doctype html|^\s*<html/i.test(data.raw)) {
    throw new Error('A URL informada não aponta para a API do site ERPNext. Use o domínio do site que abre o ERPNext, sem /desk ou /app.');
  }
  return data;
}

export function readBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
}
