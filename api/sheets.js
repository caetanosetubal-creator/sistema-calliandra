const crypto = require('crypto');

const DEFAULT_SHEET_ID = '1i_BtzyxQymNOp_Ov_mWwuPa8BCX2oHoCvByYGxDX8yw';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end(JSON.stringify(payload));
}
function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function parseCreds() {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_CREDENTIALS || '';
  let creds = null;
  if (raw) {
    try { creds = JSON.parse(raw); } catch (e) { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido.'); }
  } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    creds = { client_email: process.env.GOOGLE_CLIENT_EMAIL, private_key: process.env.GOOGLE_PRIVATE_KEY };
  }
  if (!creds || !creds.client_email || !creds.private_key) {
    throw new Error('Credenciais do Google Sheets ausentes. Configure GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY na Vercel.');
  }
  creds.private_key = String(creds.private_key).replace(/\\n/g, '\n');
  return creds;
}
function sheetId() {
  return process.env.GOOGLE_SHEET_ID || process.env.SPREADSHEET_ID || process.env.SHEET_ID || DEFAULT_SHEET_ID;
}
async function getAccessToken() {
  const creds = parseCreds();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = { iss: creds.client_email, scope: SCOPES, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(creds.private_key).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const assertion = `${unsigned}.${signature}`;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('Resposta inválida do OAuth Google: ' + text.slice(0, 180)); }
  if (!resp.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Falha ao obter token do Google.');
  return data.access_token;
}
async function google(path, options = {}) {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId()}${path}`;
  const resp = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { throw new Error('Resposta inválida da API Google: ' + text.slice(0, 180)); }
  if (!resp.ok) throw new Error((data && data.error && data.error.message) || `Erro Google Sheets HTTP ${resp.status}`);
  return data;
}
function quoteSheet(title) {
  return `'${String(title).replace(/'/g, "''")}'`;
}
function rowsToObjects(values) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const headers = (values[0] || []).map((h, i) => String(h || `COL_${i + 1}`).trim() || `COL_${i + 1}`);
  const seen = {};
  const safeHeaders = headers.map(h => {
    const base = h;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] === 1 ? base : `${base}_${seen[base]}`;
  });
  return values.slice(1).filter(row => (row || []).some(v => String(v || '').trim() !== '')).map(row => {
    const obj = {};
    safeHeaders.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
    return obj;
  });
}
function objectToRow(headers, values) {
  const normalized = {};
  Object.keys(values || {}).forEach(k => { normalized[String(k).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')] = values[k]; });
  return headers.map(h => {
    if (values && values[h] !== undefined) return values[h];
    const key = String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    return normalized[key] !== undefined ? normalized[key] : '';
  });
}
async function metadata() {
  return google('?includeGridData=false');
}
async function getHeaders(title) {
  const range = encodeURIComponent(`${quoteSheet(title)}!1:1`);
  const data = await google(`/values/${range}?majorDimension=ROWS`);
  return (data.values && data.values[0]) || [];
}
async function getAll() {
  const meta = await metadata();
  const titles = (meta.sheets || []).map(s => s.properties.title);
  const ranges = titles.map(t => `ranges=${encodeURIComponent(`${quoteSheet(t)}!A1:ZZ1000`)}`).join('&');
  const batch = await google(`/values:batchGet?majorDimension=ROWS&${ranges}`);
  const output = {};
  (batch.valueRanges || []).forEach((vr, i) => { output[titles[i]] = rowsToObjects(vr.values || []); });
  return { ok: true, success: true, spreadsheetId: sheetId(), updatedAt: new Date().toISOString(), sheets: titles, data: output };
}
async function appendRow(sheet, values) {
  const headers = await getHeaders(sheet);
  if (!headers.length) throw new Error(`A aba ${sheet} não possui cabeçalho na linha 1.`);
  const row = objectToRow(headers, values || {});
  const range = encodeURIComponent(`${quoteSheet(sheet)}!A:ZZ`);
  const result = await google(`/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST', body: JSON.stringify({ values: [row] })
  });
  return { ok: true, success: true, action: 'appendRow', result };
}
async function updateRowById(sheet, values, id) {
  const headers = await getHeaders(sheet);
  if (!headers.length) throw new Error(`A aba ${sheet} não possui cabeçalho na linha 1.`);
  const idHeaders = ['id', 'id_lote', 'id_venda', 'id_contrato', 'ID'];
  const idIndex = headers.findIndex(h => idHeaders.map(x => x.toLowerCase()).includes(String(h).toLowerCase()));
  if (idIndex === -1) return appendRow(sheet, values);
  const range = encodeURIComponent(`${quoteSheet(sheet)}!A1:ZZ1000`);
  const current = await google(`/values/${range}?majorDimension=ROWS`);
  const rows = current.values || [];
  const rowIdx = rows.findIndex((row, idx) => idx > 0 && String(row[idIndex] || '') === String(id || values.id || values.id_lote || values.id_venda || values.id_contrato || ''));
  if (rowIdx === -1) return appendRow(sheet, values);
  const newRow = objectToRow(headers, values || {});
  const targetRow = rowIdx + 1;
  const target = encodeURIComponent(`${quoteSheet(sheet)}!A${targetRow}:ZZ${targetRow}`);
  const result = await google(`/values/${target}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: [newRow] }) });
  return { ok: true, success: true, action: 'updateRowById', row: targetRow, result };
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise(resolve => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); }
    });
  });
}
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
  try {
    const q = req.query || {};
    const body = req.method === 'POST' ? await readBody(req) : {};
    const action = String(body.action || q.action || 'getAll');
    if (action === 'getAll') return json(res, 200, await getAll());
    if (action === 'appendRow') return json(res, 200, await appendRow(body.sheet, body.values));
    if (action === 'updateRowById') return json(res, 200, await updateRowById(body.sheet, body.values, body.id));
    return json(res, 400, { ok: false, success: false, error: `Ação não suportada: ${action}` });
  } catch (error) {
    return json(res, 500, { ok: false, success: false, error: error.message || String(error) });
  }
};
