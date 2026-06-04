import { erpFetch, getBaseUrl, readBody, sendError } from './_erpnext.js';

function cleanTaxId(value) {
  return value?.replace(/\D/g, '') || undefined;
}

async function ensureCustomer(baseUrl, body) {
  const encoded = encodeURIComponent(body.customerName.trim());
  try {
    const existing = await erpFetch(baseUrl, `/api/resource/Customer/${encoded}`);
    return existing?.data?.name || body.customerName.trim();
  } catch {
    const doc = {
      customer_name: body.customerName.trim(),
      customer_type: body.customerType || 'Individual',
      customer_group: 'All Customer Groups',
      territory: 'All Territories'
    };
    const taxId = cleanTaxId(body.taxId);
    if (taxId) doc.tax_id = taxId;
    if (body.email) doc.email_id = body.email.trim();
    const created = await erpFetch(baseUrl, '/api/resource/Customer', {
      method: 'POST',
      body: JSON.stringify(doc)
    });
    return created?.data?.name || body.customerName.trim();
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 'Método não permitido.', 405);
  try {
    const body = readBody(req);
    if (!body.customerName?.trim()) return sendError(res, 'Informe o nome do cliente.');
    if (!body.itemCode?.trim()) return sendError(res, 'Informe o código do item já cadastrado no ERPNext.');
    if (!body.dueDate) return sendError(res, 'Informe a data de vencimento.');
    if (!Number.isFinite(Number(body.qty)) || Number(body.qty) <= 0) return sendError(res, 'Quantidade inválida.');
    if (!Number.isFinite(Number(body.rate)) || Number(body.rate) <= 0) return sendError(res, 'Valor unitário inválido.');

    const baseUrl = getBaseUrl(body.baseUrl);
    const customer = await ensureCustomer(baseUrl, body);
    const today = new Date().toISOString().slice(0, 10);
    const invoiceDoc = {
      customer,
      due_date: body.dueDate,
      posting_date: body.postingDate || today,
      items: [{
        item_code: body.itemCode.trim(),
        qty: Number(body.qty),
        rate: Number(body.rate),
        description: body.description?.trim() || undefined,
        cost_center: body.costCenter?.trim() || undefined
      }]
    };

    if (body.company?.trim()) invoiceDoc.company = body.company.trim();
    if (body.taxesAndChargesTemplate?.trim()) invoiceDoc.taxes_and_charges = body.taxesAndChargesTemplate.trim();

    const created = await erpFetch(baseUrl, '/api/resource/Sales Invoice', {
      method: 'POST',
      body: JSON.stringify(invoiceDoc)
    });

    let finalDoc = created?.data;
    let submitWarning;
    if (body.submit && finalDoc) {
      try {
        const submitted = await erpFetch(baseUrl, '/api/method/frappe.client.submit', {
          method: 'POST',
          body: JSON.stringify({ doc: finalDoc })
        });
        finalDoc = submitted?.message || finalDoc;
      } catch (error) {
        submitWarning = `A nota foi criada como rascunho, mas não foi possível submeter automaticamente: ${error?.message || 'erro desconhecido'}`;
      }
    }

    const name = finalDoc?.name || created?.data?.name;
    const deskUrl = name ? `${baseUrl}/app/sales-invoice/${encodeURIComponent(name)}` : baseUrl;
    return res.status(200).json({ ok: true, invoice: finalDoc, name, deskUrl, submitWarning });
  } catch (error) {
    return sendError(res, error?.message || 'Erro ao gerar nota/fatura no ERPNext.', 500);
  }
}
