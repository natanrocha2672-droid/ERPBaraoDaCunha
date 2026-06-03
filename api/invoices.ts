import type { VercelRequest, VercelResponse } from '@vercel/node';
import { erpFetch, getBaseUrl, readBody, sendError } from './_erpnext';

type Body = {
  baseUrl?: string;
  companySettings?: Record<string, any>;
  customerName: string;
  customerType?: 'Individual' | 'Company';
  taxId?: string;
  email?: string;
  itemCode: string;
  description?: string;
  qty: number;
  rate: number;
  dueDate: string;
  postingDate?: string;
  company?: string;
  taxesAndChargesTemplate?: string;
  costCenter?: string;
  submit?: boolean;
};

function cleanTaxId(value?: string) {
  return value?.replace(/\D/g, '') || undefined;
}

async function ensureCustomer(baseUrl: string, body: Body) {
  const encoded = encodeURIComponent(body.customerName.trim());
  try {
    const existing = await erpFetch(baseUrl, `/api/resource/Customer/${encoded}`);
    return existing?.data?.name || body.customerName.trim();
  } catch {
    const doc: Record<string, any> = {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendError(res, 'Método não permitido.', 405);
  try {
    const body = readBody(req) as Body;
    if (!body.customerName?.trim()) return sendError(res, 'Informe o nome do cliente.');
    if (!body.itemCode?.trim()) return sendError(res, 'Informe o código do item já cadastrado no ERPNext.');
    if (!body.dueDate) return sendError(res, 'Informe a data de vencimento.');
    if (!Number.isFinite(Number(body.qty)) || Number(body.qty) <= 0) return sendError(res, 'Quantidade inválida.');
    if (!Number.isFinite(Number(body.rate)) || Number(body.rate) <= 0) return sendError(res, 'Valor unitário inválido.');

    const baseUrl = getBaseUrl(body.baseUrl);
    const customer = await ensureCustomer(baseUrl, body);
    const today = new Date().toISOString().slice(0, 10);
    const invoiceDoc: Record<string, any> = {
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

    const created = await erpFetch(baseUrl, '/api/resource/Sales Invoice', { method: 'POST', body: JSON.stringify(invoiceDoc) });
    let finalDoc = created?.data;
    let submitWarning: string | undefined;
    if (body.submit && finalDoc) {
      try {
        const submitted = await erpFetch(baseUrl, '/api/method/frappe.client.submit', { method: 'POST', body: JSON.stringify({ doc: finalDoc }) });
        finalDoc = submitted?.message || finalDoc;
      } catch (error: any) {
        submitWarning = `A nota foi criada como rascunho, mas não foi possível submeter automaticamente: ${error.message}`;
      }
    }
    const name = finalDoc?.name || created?.data?.name;
    const deskUrl = name ? `${baseUrl}/app/sales-invoice/${encodeURIComponent(name)}` : baseUrl;
    return res.status(200).json({ ok: true, invoice: finalDoc, name, deskUrl, submitWarning });
  } catch (error: any) {
    return sendError(res, error.message || 'Erro ao gerar nota/fatura no ERPNext.', 500);
  }
}
