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
  const transferMemo = description || `HNAG ${campaignId} ${orderId.slice(-6)}`;
  
  // Format link VietQR chuẩn của Napas/Vietcombank
  // https://img.vietqr.io/image/<BANK_BIN>-<ACCOUNT_NO>-compact2.png?amount=<AMOUNT>&addInfo=<MEMO>&accountName=<NAME>
  const qrImageUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bin}-${BANK_CONFIG.accountNumber}-compact2.png?amount=${amountVnd}&addInfo=${encodeURIComponent(transferMemo)}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`;

  // Payload định dạng EMVCo chuỗi ký tự text để Render vẽ QR CustomPainter trực tiếp
  const emvcoPayload = `00020101021238540010A00000072701240006${BANK_CONFIG.bin}0114${BANK_CONFIG.accountNumber}0208QRIBFTTA5303704540${amountVnd.toString().length}${amountVnd}5802VN62${transferMemo.length + 4}08${transferMemo.length}${transferMemo}6304`;

  return {
    order_id: orderId,
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
 * Xác thực chữ ký webhook từ PayOS / Cổng thanh toán (HMAC SHA-256)
 */
export function verifyPaymentWebhookSignature(payload, signature, checksumKey = 'default_checksum_key') {
  if (!signature) return false;
  try {
    // Sắp xếp các trường alphabet theo chuẩn PayOS
    const sortedKeys = Object.keys(payload).sort();
    const signData = sortedKeys
      .filter(k => k !== 'signature')
      .map(k => `${k}=${payload[k]}`)
      .join('&');

    const expectedSignature = crypto
      .createHmac('sha256', checksumKey)
      .update(signData)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
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

  store.paymentOrders[orderId] = orderRecord;

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
