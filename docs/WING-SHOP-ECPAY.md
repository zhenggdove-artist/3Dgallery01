# GGTEMPLE — 2026-11-19 Wing Atelier and ECPay

## Product
The gacha / random lottery has been completely retired on the server.
Every successful real-money order (NT$30) purchases exactly **one** original
personal wing drawing credit, **not** an item or five random draws.

The logged-in player's left-hand dock shows the **GIFT** button only when
`wingDesignCredits > 0`. It opens the same 768×640 freehand painter as GM.
Saving calls `redeem-wing-design`; the server validates the submitted strokes,
creates a personal `gm-wing-UUID`, inserts into the owner's BAG, equips it,
and consumes exactly one verified credit in the same durable state write.
The item does **not** enter `SHOP_ITEMS` or any public listing or draw pool.
One credit can never be used twice. Cosmetic wing gameplay attributes are
server-capped: tier 3, glide, impulse 10.15, gravity 0.585, flap 300ms.
Do not trust client-supplied stats, credits, claimed payment success or price.

## Regular coin shop
Exactly fourteen material wings:
- BLUE: wooden planks, three balloons per side, tattered rags, scrap metal, adhesive tape.
- GOLD: chicken feather, plastic sheet, furry, koi streamer.
- PURPLE: peacock, swan, cyberpunk, steampunk, monster eyes.

Quality refers to equipment tier/design complexity, **not actual color**.
Legacy catalog `wings-1..20`, `wings-21..27` and other excluded designs are
retired, including legacy ownership/equipment references on profile migration.
All fourteen remaining wings are purchasable in the ordinary coin SHOP and
do not drop from monsters or the ground.

## ECPay architecture
Cloudflare Worker / Durable Object `TEMPLE_ROOM` provides:
- `GET /api/wing-pay/status` (authenticated) — return allowed checkout mode.
- `POST /api/wing-pay/checkout` (authenticated) — create a unique immutable
  NT$30 order in Durable Object SQLite `wing_design_orders` and return
  signed AioCheckOut/V5 fields.
- `GET /api/wing-pay/order?id=<MerchantTradeNo>` — owner-only verification
  after returning from ECPay; no browser-side entitlement assignment.
- `POST /api/wing-pay/notify` — validate merchant ID, SHA256 CheckMacValue,
  exact order number, correct price, transaction ID and RtnCode; reject
  simulation callbacks and increment one server-side design credit once in
  a Durable Object transaction. Repeated callbacks never double-grant.

The ECPay hosted checkout is a hidden HTML POST using `target="_self"`
to avoid iOS popup blockers. The buyer returns to `TEMPLE_GAME_URL` with
a `wingOrder` query identifier. The order is also saved in sessionStorage
until an authenticated verification confirms payment.

### Production activation — not yet enabled
Real payments **cannot** be enabled or verified in production without
a real approved ECPay merchant account. These are **server-only** Cloudflare
Worker secrets / settings (never commit or expose in GitHub Pages):
- `ECPAY_MERCHANT_ID` — approved live MerchantID.
- `ECPAY_HASH_KEY` — live production HashKey.
- `ECPAY_HASH_IV` — live production HashIV.
- `ECPAY_PRODUCTION_ENABLED=true` — explicit guarded production switch.
- `TEMPLE_GAME_URL` — HTTPS URL where players return after checkout.

The feature requires the ECPay merchant to be activated and authorized to
sell the digital wing drawing entitlement, suitable real domain/return URLs,
and a production merchant contract. Without the switch *and* all three
credentials, `checkoutEnabled=false` and POST checkout fails 503.
Do not silently switch to the public sandbox keys in production.

Production gateway:
https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5

For an isolated staging Worker backed by a **different** Durable Object,
`ECPAY_WING_STAGE_ENABLED=true` permits authenticated GM test transactions.
Stage is never real-money and must not be connected to live player credits.
Stage gateway:
https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5

**Before charging customers:** configure an approved merchant account, check
the production callback endpoint from ECPay's servers, perform a real low-value
purchase with authorized payment, verify exactly one gift appears and disappears
after a save, and separately test refund/reversal, cancellation, reconciliation,
and chargeback flows. These merchant-side tests cannot be done without the
merchant credentials and payment approval. The code currently does not perform
automatic credit reversal after refunds. Complete payment acceptance, consumer
disclosures and refund handling before public production activation.

Official ECPay documentation:
- Aio payment: https://developers.ecpay.com.tw/2864/
- ReturnURL: https://developers.ecpay.com.tw/2878/
- CheckMacValue: https://developers.ecpay.com.tw/2902/
- Test credentials: https://developers.ecpay.com.tw/2856/

## Visual effects
`WeaponVFX.forwardBeams` owns persistent long forward spell effects independent
of the native 00GameDevs #08/#29 shader. The client draws an actual luminous
cylinder core, shell, moving pulse and tendrils from the live staff muzzle along
the attack direction and its server range, updating as the player aims. The
visual effect does not change the server's hitbox or cause damage independently.

## CI
Run `npm run check` and `npm test`, then both Chromium browser and WebKit
gameplay smoke. Test the physical ECPay gateway separately on a staging Worker.
