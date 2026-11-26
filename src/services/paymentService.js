// =============================================================================
// VIETQR (NAPAS 24/7) & PAYOS PAYMENT SERVICE
// Hôm nay ăn gì · Taste of Vietnam v0.1 (Module M7 Sponsored Campaigns)
// Tuân thủ chuẩn EMVCo QR Code & Webhook Idempotency
// =============================================================================

import crypto from 'node:crypto';

// Cấu hình ngân hàng mặc định cho hệ thống Taste of Vietnam
const BANK_CONFIG = {
  bin: '970436', // Vietcombank BIN code
  accountNumber: '0121000889999',
  accountName: 'CONG TY HOM NAY AN GI VIET NAM',
  defaultBankName: 'Vietcombank',
};

/**
 * Sinh mã thanh toán chuẩn VietQR (Quick Response format cho NAPAS 247)
 * Cú pháp chuyển khoản định danh: HNAG <MÃ CHIẾN DỊCH> <MÃ ORDER>
 */
export function generateVietQrInvoice({
  campaignId = 'CMP-701',
  amountVnd = 500000,
  merchantName = 'Quán Ngon',
  description = null,
}) {
  const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  // PayOS yêu cầu orderCode là số nguyên dương (<= 9007199254740991)
  const orderCode = Date.now() * 1000 + crypto.randomInt(0, 1000);
  const transferMemo = description || `HNAG ${campaignId} ${orderId.slice(-6)}`;
  
  // Format link VietQR chuẩn của Napas/Vietcombank
  // https://img.vietqr.io/image/<BANK_BIN>-<ACCOUNT_NO>-compact2.png?amount=<AMOUNT>&addInfo=<MEMO>&accountName=<NAME>
  const qrImageUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bin}-${BANK_CONFIG.accountNumber}-compact2.png?amount=${amountVnd}&addInfo=${encodeURIComponent(transferMemo)}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`;

  // Payload định dạng EMVCo chuỗi ký tự text để Render vẽ QR CustomPainter trực tiếp
  const emvcoPayload = `00020101021238540010A00000072701240006${BANK_CONFIG.bin}0114${BANK_CONFIG.accountNumber}0208QRIBFTTA5303704540${amountVnd.toString().length}${amountVnd}5802VN62${transferMemo.length + 4}08${transferMemo.length}${transferMemo}6304`;

  return {
    order_id: orderId,
    order_code: orderCode,
    campaign_id: campaignId,
    amount_vnd: amountVnd,
    bank_name: BANK_CONFIG.defaultBankName,
    bank_bin: BANK_CONFIG.bin,
    account_number: BANK_CONFIG.accountNumber,
    account_holder: BANK_CONFIG.accountName,
    transfer_memo: transferMemo,
    qr_image_url: qrImageUrl,
    qr_emvco_raw: emvcoPayload,
    status: 'PENDING_PAYMENT',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 phút hết hạn
  };
}

/**
 * Chuỗi ký PayOS: sắp xếp key theo alphabet, nối `key=value` bằng `&`.
 * Giống hệt thư viện chính thức @payos/node (convertObjToQueryStr):
 *  - key có giá trị undefined bị bỏ qua
 *  - null / undefined / "null" / "undefined" -> chuỗi rỗng
 *  - mảng -> JSON.stringify (từng phần tử object cũng được sắp xếp key)
 * https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/
 */
function sortObjByKey(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = obj[k]; return acc; }, {});
}

export function buildPayosSignData(data) {
  const sorted = sortObjByKey(data || {});
  return Object.keys(sorted)
    .filter(k => k !== 'signature' && sorted[k] !== undefined)
    .map(k => {
      let value = sorted[k];
      if (value && Array.isArray(value)) value = JSON.stringify(value.map(v => sortObjByKey(v)));
      if ([null, undefined, 'undefined', 'null'].includes(value)) value = '';
      return `${k}=${value}`;
    })
    .join('&');
}

export function signPayosData(data, checksumKey) {
  return crypto.createHmac('sha256', checksumKey).update(buildPayosSignData(data)).digest('hex');
}

/**
 * Xác thực chữ ký webhook từ PayOS (HMAC-SHA256 trên các trường của `data`).
 * Không có checksumKey => luôn trả false (fail closed).
 */
export function verifyPaymentWebhookSignature(payload, signature, checksumKey = process.env.PAYOS_CHECKSUM_KEY) {
  if (!signature || typeof signature !== 'string' || !checksumKey) return false;
  try {
    const expected = Buffer.from(signPayosData(payload, checksumKey), 'utf8');
    const given = Buffer.from(signature.toLowerCase(), 'utf8');
    if (expected.length !== given.length) return false;
    return crypto.timingSafeEqual(expected, given);
  } catch (err) {
    return false;
  }
}

/**
 * Xử lý webhook thanh toán thành công và nạp tiền vào chiến dịch quảng cáo
 */
export function processSuccessfulPayment(store, { orderId, campaignId, amountVnd }) {
  store.paymentOrders = store.paymentOrders || {};

  // Idempotency: Nếu order này đã xử lý rồi thì không nạp tiền lần 2
  if (store.paymentOrders[orderId]?.status === 'COMPLETED') {
    return {
      success: true,
      already_processed: true,
      order: store.paymentOrders[orderId],
    };
  }

  // Cập nhật số dư chiến dịch quảng cáo (M7 Sponsored Ads)
  let updatedCampaign = null;
  const campaignsList = store.campaigns || store.ad_campaigns || [];
  const campaign = campaignsList.find(c => c.id === campaignId);
  if (campaign) {
    campaign.balance_vnd = (campaign.balance_vnd !== undefined ? campaign.balance_vnd : (campaign.budget_monthly_vnd || 0)) + Number(amountVnd);
    campaign.is_active = true;
    campaign.status = 'active';
    updatedCampaign = campaign;
  }

  const orderRecord = {
    order_id: orderId,
    campaign_id: campaignId,
    amount_vnd: Number(amountVnd),
    status: 'COMPLETED',
    paid_at: new Date().toISOString(),
    campaign_balance_after: updatedCampaign ? updatedCampaign.balance_vnd : null,
  };

  store.paymentOrders[orderId] = { ...(store.paymentOrders[orderId] || {}), ...orderRecord };

  // Ghi nhận sự kiện Analytics
  store.analyticsEvents = store.analyticsEvents || {};
  store.analyticsEvents.ad_recharge_success = (store.analyticsEvents.ad_recharge_success || 0) + 1;

  return {
    success: true,
    already_processed: false,
    order: orderRecord,
    campaign: updatedCampaign,
  };
}

// =============================================================================
// VIETQR TRANSFER TO A GIVEN ACCOUNT (M20 tipping): EMVCo/NAPAS 24/7 payload with
// CRC16-CCITT, for a recipient account the recipient saved themselves. This only
// builds the QR content; no money moves through Taste of Vietnam.
// =============================================================================
export const VIETQR_BANKS = {
  '970436': 'Vietcombank', '970415': 'VietinBank', '970418': 'BIDV', '970405': 'Agribank', '970407': 'Techcombank',
  '970422': 'MB Bank', '970416': 'ACB', '970432': 'VPBank', '970423': 'TPBank', '970403': 'Sacombank',
  '970437': 'HDBank', '970441': 'VIB', '970443': 'SHB', '970431': 'Eximbank', '970448': 'OCB'
};
const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
export function crc16ccitt(str) {
  let crc = 0xffff;
  for (const ch of Buffer.from(str, 'utf8')) {
    crc ^= ch << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
export function buildVietQrTransfer({ bankBin, accountNumber, accountName = '', amountVnd, memo = '' }) {
  if (!VIETQR_BANKS[bankBin]) throw new Error('unknown bank BIN');
  if (!/^\d{6,19}$/.test(String(accountNumber))) throw new Error('invalid account number');
  const amount = Math.round(Number(amountVnd));
  const info = String(memo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, '').slice(0, 25).trim();
  const merchant = tlv('38', tlv('00', 'A000000727') + tlv('01', tlv('00', bankBin) + tlv('01', String(accountNumber))) + tlv('02', 'QRIBFTTA'));
  const body = tlv('00', '01') + tlv('01', '12') + merchant + tlv('53', '704') + tlv('54', String(amount)) + tlv('58', 'VN') +
    (info ? tlv('62', tlv('08', info)) : '') + '6304';
  const payload = body + crc16ccitt(body);
  return {
    bank_bin: bankBin, bank_name: VIETQR_BANKS[bankBin], account_number: String(accountNumber), account_name: accountName,
    amount_vnd: amount, transfer_memo: info, qr_emvco_raw: payload,
    qr_image_url: `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(info)}&accountName=${encodeURIComponent(accountName)}`
  };
}
