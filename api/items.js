import { erpFetch, getBaseUrl, readBody, sendError } from './_erpnext.js';

function queryString(fields, filters, limit = 1) {
  const params = new URLSearchParams();
  params.set('fields', JSON.stringify(fields));
  params.set('filters', JSON.stringify(filters));
  params.set('limit_page_length', String(limit));
  return params.toString();
}

async function findItemByCode(baseUrl, itemCode) {
  const query = queryString(['name', 'item_code'], [['item_code', '=', itemCode]], 1);
  const result = await erpFetch(baseUrl, `/api/resource/Item?${query}`);
  return result?.data?.[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 'Método não permitido.', 405);

  try {
    const body = readBody(req);
    const itemCode = body.itemCode?.trim();
    const itemName = body.itemName?.trim();
    const itemGroup = body.itemGroup?.trim();
    const stockUom = body.stockUom?.trim();

    if (!itemCode) return sendError(res, 'Informe o código do item.');
    if (!itemName) return sendError(res, 'Informe o nome do item.');
    if (!itemGroup) return sendError(res, 'Selecione o grupo do item.');
    if (!stockUom) return sendError(res, 'Selecione a unidade do item.');

    const baseUrl = getBaseUrl(body.baseUrl);
    const existing = await findItemByCode(baseUrl, itemCode);
    const doc = {
      item_code: itemCode,
      item_name: itemName,
      item_group: itemGroup,
      stock_uom: stockUom,
      is_stock_item: body.isStockItem ? 1 : 0,
      disabled: 0
    };

    let result;
    let created = false;
    if (existing?.name) {
      result = await erpFetch(baseUrl, `/api/resource/Item/${encodeURIComponent(existing.name)}`, {
        method: 'PUT',
        body: JSON.stringify(doc)
      });
    } else {
      result = await erpFetch(baseUrl, '/api/resource/Item', {
        method: 'POST',
        body: JSON.stringify(doc)
      });
      created = true;
    }

    return res.status(200).json({
      ok: true,
      created,
      item: result?.data || result?.message || null,
      itemCode,
      message: created ? 'Item criado com sucesso.' : 'Item atualizado com sucesso.'
    });
  } catch (error) {
    return sendError(res, error?.message || 'Não foi possível criar ou atualizar o item.', 500);
  }
}
