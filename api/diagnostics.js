import { authHeader, getBaseUrl } from './_erpnext.js';

async function testResource(baseUrl, resource) {
  try {
    const response = await fetch(`${baseUrl}/api/resource/${encodeURIComponent(resource)}?limit_page_length=1`, {
      headers: { Authorization: authHeader(), Accept: 'application/json' },
      cache: 'no-store'
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, error: response.ok ? null : text.slice(0, 500) };
  } catch (error) {
    return { ok: false, status: 0, error: error?.message || String(error) };
  }
}

export default async function handler(req, res) {
  try {
    const hasPrimaryUrl = Boolean(process.env.ERPNEXT_BASE_URL);
    const hasAltUrl = Boolean(process.env.ERPNext_BASE_URL);
    const hasPrimaryKey = Boolean(process.env.ERPNext_API_KEY);
    const hasAltKey = Boolean(process.env.ERPNEXT_API_KEY);
    const hasPrimarySecret = Boolean(process.env.ERPNext_API_SECRET);
    const hasAltSecret = Boolean(process.env.ERPNEXT_API_SECRET);

    let baseUrl = null;
    let authOk = false;
    let apiOk = false;
    let apiError = null;
    let company = null;
    let item = null;

    try {
      baseUrl = getBaseUrl('');
      authHeader();
      authOk = true;
      const response = await fetch(`${baseUrl}/api/method/frappe.auth.get_logged_user`, {
        headers: { Authorization: authHeader(), Accept: 'application/json' },
        cache: 'no-store'
      });
      apiOk = response.ok;
      if (!response.ok) apiError = await response.text();
      company = await testResource(baseUrl, 'Company');
      item = await testResource(baseUrl, 'Item');
    } catch (error) {
      apiError = error?.message || String(error);
    }

    return res.status(200).json({
      ok: apiOk && Boolean(company?.ok) && Boolean(item?.ok),
      config: {
        hasPrimaryUrl,
        hasAltUrl,
        hasPrimaryKey,
        hasAltKey,
        hasPrimarySecret,
        hasAltSecret,
        normalizedBaseUrl: baseUrl,
        authOk,
        apiOk
      },
      permissions: { company, item },
      apiError
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Falha no diagnóstico.' });
  }
}
