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

## ECPay sandbox checkout development branch (2026-11-19)

Branch: feature/ecpay-wing-stage-only-20261119. NOT production enabled.
The live GGTEMPLE remains unchanged until this branch is reviewed and merged.
The Worker additionally requires ECPAY_WING_STAGE_ENABLED=true in an isolated
sandbox Worker environment. Otherwise checkout always fails closed.

- Uses only ECPay's public testing MerchantID/HashKey/HashIV from
  https://developers.ecpay.com.tw/2856/ ; never use production keys.
- NT$30 / five draws, restricted to authenticated Firebase GM sessions.
- GET /api/wing-pay/status: session-authenticated sandbox availability.
- POST /api/wing-pay/checkout: GM only, unique signed ECPay sandbox order;
  stored in the existing Durable Object SQLite, not a new D1 database.
- GET /api/wing-pay/order?id=...: owner-only order status.
- POST /api/wing-pay/notify: validates SHA256 CheckMacValue, MerchantID,
  order number, exact amount, positive payment status, and credits only once.
  SimulatePaid=1 is ignored because simulation is NOT payment.
- Stage credits persist in wingPaidDraws; non-admin wing draws spend the
  initial five free draws first, then paid draw credits.
- The SUPPORT panel shows a sandbox checkout button to the GM only.
- The gateway is ECPay hosted test checkout, not embedded Apple Pay.
- The sandbox switch CANNOT activate real-money payment.

BEFORE REAL-MONEY LAUNCH: get ECPay approval for the paid random virtual
cosmetic category, publish actual wing probability tables, rotate any
production HashKey/HashIV that appeared in screenshots, implement separately
reviewed production reconciliation and refund/chargeback controls. Never use
the stage switch as a production activation method.

Run npm run check and npm test. The unit tests cover ECPay's documented MAC
test vector, tampering, order ownership and duplicate callback handling.
For manual test, deploy a separate staging Worker with its own Durable Object
and enable the stage switch ONLY there; do not point it at live player saves.
