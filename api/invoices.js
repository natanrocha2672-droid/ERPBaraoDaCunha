import { erpFetch, getBaseUrl, readBody, sendError } from './_erpnext.js';

function cleanTaxId(value) {
  return value?.replace(/\D/g, '') || undefined;
}

function queryString(fields, filters, limit = 1) {
  const params = new URLSearchParams();
  params.set('fields', JSON.stringify(fields));
  params.set('filters', JSON.stringify(filters));
  params.set('limit_page_length', String(limit));
  return params.toString();
}

function normalizeItemValue(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function findFirstLeaf(baseUrl, doctype) {
  const data = await erpFetch(baseUrl, `/api/resource/${encodeURIComponent(doctype)}?${queryString(['name','is_group'], [['is_group','=',0]], 1)}`);
  return data?.data?.[0]?.name;
}

async function resolveItemCode(baseUrl, input) {
  const value = input?.trim();
  if (!value) throw new Error('Informe o item.');
  for (const filters of [[['item_code', '=', value]], [['name', '=', value]], [['item_name', '=', value]]]) {
    const result = await erpFetch(baseUrl, `/api/resource/Item?${queryString(['name','item_code','item_name'], filters, 1)}`);
    const item = result?.data?.[0];
    if (item) return item.item_code || item.name;
  }
  const allItems = await erpFetch(baseUrl, `/api/resource/Item?${queryString(['name','item_code','item_name'], [['disabled','=',0]], 1000)}`);
  const normalizedInput = normalizeItemValue(value);
  const matched = (allItems?.data || []).find((item) => [item.name, item.item_code, item.item_name].some((candidate) => normalizeItemValue(candidate) === normalizedInput));
  if (matched) return matched.item_code || matched.name;
  throw new Error(`Não foi possível encontrar o item "${value}" no ERPNext.`);
}

async function ensureCustomer(baseUrl, body) {
  const encoded = encodeURIComponent(body.customerName.trim());
  try {
    const existing = await erpFetch(baseUrl, `/api/resource/Customer/${encoded}`);
    return existing?.data?.name || body.customerName.trim();
  } catch {
    const customerGroup = body.customerGroup?.trim() || await findFirstLeaf(baseUrl, 'Customer Group');
    const territory = body.territory?.trim() || await findFirstLeaf(baseUrl, 'Territory');
    if (!customerGroup) throw new Error('Nenhum Customer Group final foi encontrado no ERPNext.');
    if (!territory) throw new Error('Nenhum Territory final foi encontrado no ERPNext.');
    const doc = { customer_name: body.customerName.trim(), customer_type: body.customerType || 'Individual', customer_group: customerGroup, territory };
    const taxId = cleanTaxId(body.taxId);
    if (taxId) doc.tax_id = taxId;
    if (body.email) doc.email_id = body.email.trim();
    const created = await erpFetch(baseUrl, '/api/resource/Customer', { method: 'POST', body: JSON.stringify(doc) });
    return created?.data?.name || body.customerName.trim();
  }
}

function buildFiscalProfile(body) {
  const uf = String(body.customerUF || '').trim().toUpperCase();
  if (!uf || uf.length !== 2) throw new Error('Informe a UF do cliente para definir o CFOP.');
  return {
    regime: 'Simples Nacional',
    crt: '1',
    ncm: '73071990',
    cest: '',
    csosn: '500',
    unit: 'UN',
    origin: '0',
    customerUF: uf,
    cfop: uf === 'MG' ? '5405' : '6404'
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 'Método não permitido.', 405);
  try {
    const body = readBody(req);
    if (!body.customerName?.trim()) return sendError(res, 'Informe o nome do cliente.');
    if (!body.itemCode?.trim()) return sendError(res, 'Informe o item já cadastrado no ERPNext.');
    if (!body.dueDate) return sendError(res, 'Informe a data de vencimento.');
    if (!Number.isFinite(Number(body.qty)) || Number(body.qty) <= 0) return sendError(res, 'Quantidade inválida.');
    if (!Number.isFinite(Number(body.rate)) || Number(body.rate) <= 0) return sendError(res, 'Valor unitário inválido.');

    const baseUrl = getBaseUrl(body.baseUrl);
    const fiscal = buildFiscalProfile(body);
    const customer = await ensureCustomer(baseUrl, body);
    const resolvedItemCode = await resolveItemCode(baseUrl, body.itemCode);
    const today = new Date().toISOString().slice(0, 10);
    const fiscalSummary = `Perfil fiscal: CRT ${fiscal.crt} | NCM ${fiscal.ncm} | CFOP ${fiscal.cfop} | CSOSN ${fiscal.csosn} | UDM ${fiscal.unit} | UF destino ${fiscal.customerUF}`;

    const invoiceDoc = {
      customer,
      due_date: body.dueDate,
      posting_date: body.postingDate || today,
      currency: 'BRL',
      conversion_rate: 1,
      remarks: [body.description?.trim(), fiscalSummary].filter(Boolean).join('\n'),
      items: [{
        item_code: resolvedItemCode,
        qty: Number(body.qty),
        rate: Number(body.rate),
        uom: fiscal.unit,
        conversion_factor: 1,
        description: body.description?.trim() || undefined
      }]
    };

    if (body.company?.trim()) invoiceDoc.company = body.company.trim();
    const created = await erpFetch(baseUrl, '/api/resource/Sales Invoice', { method: 'POST', body: JSON.stringify(invoiceDoc) });
    let finalDoc = created?.data;
    let submitWarning;
    if (body.submit && finalDoc) {
      try {
        const submitted = await erpFetch(baseUrl, '/api/method/frappe.client.submit', { method: 'POST', body: JSON.stringify({ doc: finalDoc }) });
        finalDoc = submitted?.message || finalDoc;
      } catch (error) {
        submitWarning = `A nota foi criada como rascunho, mas não foi possível submeter automaticamente: ${error?.message || 'erro desconhecido'}`;
      }
    }

    const name = finalDoc?.name || created?.data?.name;
    const deskUrl = name ? `${baseUrl}/app/sales-invoice/${encodeURIComponent(name)}` : baseUrl;
    return res.status(200).json({ ok: true, invoice: finalDoc, name, deskUrl, submitWarning, resolvedItemCode, fiscal });
  } catch (error) {
    return sendError(res, error?.message || 'Erro ao gerar nota/fatura no ERPNext.', 500);
  }
}
