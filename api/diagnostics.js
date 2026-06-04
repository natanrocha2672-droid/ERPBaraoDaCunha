import { authHeader, getBaseUrl } from './_erpnext.js';

function qs(fields, filters, limit = 200) {
  const p = new URLSearchParams();
  p.set('fields', JSON.stringify(fields));
  if (filters) p.set('filters', JSON.stringify(filters));
  p.set('limit_page_length', String(limit));
  return p.toString();
}

async function testUrl(url) {
  try {
    const response = await fetch(url, {
      headers: { Authorization: authHeader(), Accept: 'application/json' },
      cache: 'no-store'
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    return {
      ok: response.ok,
      status: response.status,
      count: Array.isArray(data?.data) ? data.data.length : null,
      sample: Array.isArray(data?.data) ? data.data.slice(0, 3) : null,
      error: response.ok ? null : text.slice(0, 1000)
    };
  } catch (error) {
    return { ok: false, status: 0, count: null, sample: null, error: error?.message || String(error) };
  }
}

export default async function handler(req, res) {
  try {
    const baseUrl = getBaseUrl('');
    const loggedUser = await testUrl(`${baseUrl}/api/method/frappe.auth.get_logged_user`);
    const companyBasic = await testUrl(`${baseUrl}/api/resource/Company?limit_page_length=10`);
    const itemBasic = await testUrl(`${baseUrl}/api/resource/Item?limit_page_length=10`);
    const companyExact = await testUrl(`${baseUrl}/api/resource/Company?${qs(['name'])}`);
    const itemExact = await testUrl(`${baseUrl}/api/resource/Item?${qs(['name','item_code','item_name','disabled'], [['disabled','=',0]], 500)}`);

    return res.status(200).json({
      ok: loggedUser.ok && companyExact.ok && itemExact.ok,
      baseUrl,
      loggedUser,
      companyBasic,
      itemBasic,
      companyExact,
      itemExact
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Falha no diagnóstico.' });
  }
}
