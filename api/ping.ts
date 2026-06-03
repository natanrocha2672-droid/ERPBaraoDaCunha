import type { VercelRequest, VercelResponse } from '@vercel/node';
import { erpFetch, getBaseUrl, readBody, sendError } from './_erpnext';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendError(res, 'Método não permitido.', 405);
  try {
    const body = readBody(req);
    const baseUrl = getBaseUrl(body.baseUrl);
    const data = await erpFetch(baseUrl, '/api/method/frappe.auth.get_logged_user');
    return res.status(200).json({ ok: true, baseUrl, user: data?.message || 'Conectado' });
  } catch (error: any) {
    return sendError(res, error.message || 'Não foi possível conectar ao ERPNext.', 500);
  }
}
