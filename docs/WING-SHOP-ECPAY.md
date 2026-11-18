# GGTEMPLE — Wing Shop / ECPay Apple Pay scaffold

## Current status
**GM-only preview, not a live payment service.** The WING SHOP is visible
only to authenticated GMs, and its draw action is FREE for development.
All checkout/payment fulfilment endpoints remain disabled. No real currency
is charged or awarded and no client can activate payment by changing JS.

## Official ECPay sources
- Apple Pay checkout: https://developers.ecpay.com.tw/7328/
- Aio payment API: https://developers.ecpay.com.tw/2864/
- Payment notification ReturnURL: https://developers.ecpay.com.tw/2878/
- CheckMacValue verification: https://developers.ecpay.com.tw/2902/
- 2025 Apple Pay update: https://www.ecpay.com.tw/announcement/DetailAnnouncement?nID=5599

Provider-hosted Apple Pay checkout is an HTTPS **form POST** to
https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5 in testing,
or https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5 for production.
ECPay merchant activation and eligible buyer platform/browser are required.

## Cloudflare Worker routes, active as disabled placeholders
- GET /api/wing-pay/status: ECPay + ApplePay, currency TWD, enabled false.
- POST /api/wing-pay/checkout: HTTP 503; no transaction.
- POST /api/wing-pay/notify: HTTP 503; cannot grant wings.

## Required work before a real-money launch
1. Obtain merchant approval for ECPay and Apple Pay. Securely configure
   MerchantID, HashKey and HashIV as **server-only Cloudflare secrets**.
   Never put these in git, public JavaScript or website settings.
2. Configure HTTPS merchant domain and server-to-server ReturnURL.
3. Add a server-generated, unique MerchantTradeNo and durable SQL order
   ledger: player ID, wing SKU or disclosed random draw offer, TWD amount,
   pending/paid/refunded status, and idempotent fulfilment token.
4. Build the server-side AioCheckOut fields and SHA256 CheckMacValue
   EXACTLY as documented by ECPay. Redirect with an HTML form POST.
5. Handle the authenticated ReturnURL on the server only. Verify
   CheckMacValue, MerchantID, order number, original price, success code,
   and duplicate notification before making an **atomic** wing grant.
   Never trust a browser redirect, client-side price or any pay-success flag.
6. Test end-to-end on ECPay stage. Implement refund/chargeback process and
   explicit odds disclosure / review of applicable consumer and loot-box
   policies before enabling a paid random lottery.
7. Add and separately review a production checkout path; merely adding
   credentials cannot enable charging in this fail-closed scaffold.

## Wing catalog and authority
- Old wings-1 through wings-20 are preserved.
- 20 ADDITIONAL premium Papilio designs: wings-21 to wings-40.
- Four white Common / green Uncommon / blue Rare / purple Epic / gold Relic.
- Purple has the most elaborate patterns and separate luminous wing sails;
  white and green intentionally have simpler surfaces.
- All 40 wings are excluded from environmental and monster loot.
  Preexisting dropped wings are cleaned from the saved world.
- All wings remain excluded from the ordinary coin shop.
- GM preview is server-authorized: no paid access, no currency deductions,
  no duplicates, server-chosen weighted rarity and a maximum 20 new wings.
- Previously owned legitimate wings are not confiscated.
