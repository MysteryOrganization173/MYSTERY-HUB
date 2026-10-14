# Welcome Price card presentation

Based on main `c9774b2da4d210e630d3527515aafbe2b2b54423`. Frontend presentation only; no backend, schema, policy, payment, Wallet, referral or supplier changes.

The direct Data views share one account-scoped eligibility cache and pass its public offer fields to the notice and cards. Only a consistent, enabled, positive `eligible` server quote can show a Welcome Price. Amounts use integer pesewas and the server-configured discount. Prices at or below the discount remain regular. Regular bundle objects and checkout inputs are unchanged.

The existing policy applies the same offer across active standard direct Data products; its per-product condition is a positive discounted total. The read chooses MTN 1GB when present in the catalog, otherwise an available catalog product. A 404/409 can try one alternate; network/auth/service failures show regular prices. There is no quote per card and no new API. Checkout still independently requests its fresh product quote and sends the original authoritative amount/revision expectations.

Identity, phone/status, actual order-status and checkout transitions invalidate the presentation. Reads are cached for 30 seconds, periodically revalidated, and refreshed on focus. Different identities cannot read the previous snapshot, and request generations/abort signals reject delayed responses. Opening or closing checkout does not locally consume the offer; only a subsequent server response can change the displayed eligibility.

Direct Data contexts explicitly opt in through `directWelcomeOffer`. Ordinary reusable cards and reseller-themed cards retain regular prices. Instant, Airtime, AFA, Marketplace, managed reseller commerce and published customer websites are untouched. Signed-in Home currently renders the existing member dashboard without bundle cards; that layout remains unchanged. The reusable HomeFeaturedData component uses the same offer/notice/card mechanism wherever rendered; guest Home retains regular prices and its account invitation.

Verification: 22 new focused cases pass; commercial/checkout/Instant boundaries (including those cases) 158/158; mobile/checkout/reseller presentation boundaries 45/45. The small compression assertion file is 3 pass/1 fail on both candidate and unchanged main: inherited obsolete delivery-copy assertion, not a new regression. TypeScript/lint, production build and diff check pass.

Compiled synthetic app checked in genuine 360/390/430/1280px frames: detailed and compact prices, savings and Buy controls have no measured overlaps or horizontal overflow. Guest, eligible existing account, reserved, quote failure, focus refresh and actual logout were observed. Opening checkout showed a separately fetched GH₵4.49 total; no payment was submitted. Test fixtures and screenshots remain outside Git.

No deployment prerequisites or new environment variables. The existing backend API is compatible, so independent frontend On Commit deployment is safe. Production guest display and backend health can be checked without money movement. A live discounted-price acceptance check requires a known eligible authenticated customer; do not claim it from guest or staging evidence.
