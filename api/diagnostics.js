import { authHeader, getBaseUrl } from './_erpnext.js';

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
    } catch (error) {
      apiError = error?.message || String(error);
    }

    return res.status(200).json({
      ok: apiOk,
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
      apiError
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Falha no diagnóstico.' });
  }
}
