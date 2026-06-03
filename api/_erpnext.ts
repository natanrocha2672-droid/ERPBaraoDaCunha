import type { VercelRequest, VercelResponse } from '@vercel/node';

const privateHosts = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.|0\.|169\.254\.|::1)/i;

export function sendError(res: VercelResponse, message: string, status = 400, detail?: unknown) {
  return res.status(status).json({ ok: false, error: message, detail });
}

export function getBaseUrl(input?: string) {
  const raw = (process.env.ERPNEXT_BASE_URL || input || '').trim().replace(/\/$/, '');
  if (!raw) throw new Error('Informe a URL do ERPNext ou configure ERPNEXT_BASE_URL na Vercel.');
  const url = new URL(raw);
  if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new Error('Por segurança, use uma URL HTTPS do ERPNext em produção.');
  if (privateHosts.test(url.hostname)) throw new Error('URL local ou privada não permitida.');
  return url.origin;
}

export function authHeader() {
  const key = process.env.ERPNext_API_KEY;
  const secret = process.env.ERPNext_API_SECRET;
  if (!key || !secret) throw new Error('Configure as credenciais do ERPNext nas variáveis de ambiente da Vercel.');
  return `token ${key}:${secret}`;
}

export async function erpFetch(baseUrl: string, path: string, init: RequestInit = {}) {
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
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) {
    const msg = data?._server_messages || data?.exception || data?.message || data?.raw || `Erro ${response.status} no ERPNext`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

export function readBody(req: VercelRequest) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
}
