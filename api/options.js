import { erpFetch, getBaseUrl, readBody, sendError } from './_erpnext.js';

function qs(fields, filters, limit = 200) {
  const p = new URLSearchParams();
  p.set('fields', JSON.stringify(fields));
  if (filters) p.set('filters', JSON.stringify(filters));
  p.set('limit_page_length', String(limit));
  return p.toString();
}

async function safeList(baseUrl, path) {
  try {
    const data = await erpFetch(baseUrl, path);
    return data?.data || [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 'Método não permitido.', 405);
  try {
    const body = readBody(req);
    const baseUrl = getBaseUrl(body.baseUrl);
    const [companies, items, customerGroups, territories] = await Promise.all([
      safeList(baseUrl, `/api/resource/Company?${qs(['name'])}`),
      safeList(baseUrl, `/api/resource/Item?${qs(['name','item_code','item_name','disabled'], [['disabled','=',0]], 500)}`),
      safeList(baseUrl, `/api/resource/Customer Group?${qs(['name','is_group'], [['is_group','=',0]])}`),
      safeList(baseUrl, `/api/resource/Territory?${qs(['name','is_group'], [['is_group','=',0]])}`)
    ]);
    if (!companies.length && !items.length) return sendError(res, 'Não foi possível carregar empresas nem itens do ERPNext. Verifique a URL e as permissões da API.', 500);
    return res.status(200).json({ ok: true, companies, items, customerGroups, territories });
  } catch (error) {
    return sendError(res, error?.message || 'Não foi possível carregar os cadastros do ERPNext.', 500);
  }
}
