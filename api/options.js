import { erpFetch, getBaseUrl, readBody, sendError } from './_erpnext.js';

function qs(fields, filters, limit = 200) {
  const p = new URLSearchParams();
  p.set('fields', JSON.stringify(fields));
  if (filters) p.set('filters', JSON.stringify(filters));
  p.set('limit_page_length', String(limit));
  return p.toString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 'Método não permitido.', 405);
  try {
    const body = readBody(req);
    const baseUrl = getBaseUrl(body.baseUrl);

    const [companies, items, customerGroups, territories, itemGroups, uoms] = await Promise.all([
      erpFetch(baseUrl, `/api/resource/Company?${qs(['name'])}`),
      erpFetch(baseUrl, `/api/resource/Item?${qs(['name','item_code','item_name','disabled'], [['disabled','=',0]], 500)}`),
      erpFetch(baseUrl, `/api/resource/Customer Group?${qs(['name','is_group'], [['is_group','=',0]])}`),
      erpFetch(baseUrl, `/api/resource/Territory?${qs(['name','is_group'], [['is_group','=',0]])}`),
      erpFetch(baseUrl, `/api/resource/Item Group?${qs(['name','is_group'], [['is_group','=',0]])}`),
      erpFetch(baseUrl, `/api/resource/UOM?${qs(['name'], null, 500)}`)
    ]);

    return res.status(200).json({
      ok: true,
      companies: companies?.data || [],
      items: items?.data || [],
      customerGroups: customerGroups?.data || [],
      territories: territories?.data || [],
      itemGroups: itemGroups?.data || [],
      uoms: uoms?.data || []
    });
  } catch (error) {
    return sendError(res, error?.message || 'Não foi possível carregar os cadastros do ERPNext.', 500);
  }
}
