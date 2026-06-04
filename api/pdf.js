import { authHeader, getBaseUrl, sendError } from './_erpnext.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 'Método não permitido.', 405);
  try {
    const name = String(req.query.name || '').trim();
    const baseUrl = getBaseUrl(String(req.query.baseUrl || ''));
    const format = String(req.query.format || 'Standard').trim();
    if (!name) return sendError(res, 'Informe o nome da nota.', 400);

    const params = new URLSearchParams({
      doctype: 'Sales Invoice',
      name,
      format,
      no_letterhead: '0',
      letterhead: '1'
    });

    const response = await fetch(`${baseUrl}/api/method/frappe.utils.print_format.download_pdf?${params.toString()}`, {
      headers: { Authorization: authHeader() },
      cache: 'no-store'
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Erro ${response.status} ao gerar PDF.`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(buffer);
  } catch (error) {
    return sendError(res, error?.message || 'Não foi possível gerar o PDF da nota.', 500);
  }
}
