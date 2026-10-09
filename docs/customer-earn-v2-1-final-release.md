# Final Customer Experience + Mystery Earn V2.1 release gate

## Verified inputs and scope

Starting production main: da36f1e874911bc92499be1762dfbacc0a3543f5.
Approved integrated source: eb9a7124198932a59eb7344d8c063e2da139f245.
Approved V2.1 source: 8d1b63e29270e92fc8b8d5726bbb65feb8e3b2f0.
Candidate branch: integrate/customer-earn-v2-1-final-release.
An isolated thirteenth worktree was created from freshly fetched main and fast-forwarded to V2.1. The existing twelve working trees and feature histories are preserved. Publication/merge hashes and post-release observations are recorded separately in the delivery record and final chat, avoiding a self-referential commit hash.

Verified ancestors: Customer Copy P0 4eee486, privacy-safe Homepage P1 publication 87c7c12, Account V1 0a24a63, combined customer release 77887d3, Earn V2 f731b52, integrated privacy/customer candidate eb9a712, V2.1 8d1b63e and deployed privacy fcc8276.
Excluded checkout commits b0e85b33fd804cc654cdc2d38fe13e2d7ed027cf and 6535c43d4d47033ca8192ab4b173d288d2200602 are not ancestors and their reseller checkout files remain unchanged from main.

Complete main-to-candidate inventory: 74 changed paths. These are the 71 previously approved customer/Earn source paths, two narrow security paths below, and this release record. The previously approved source deletes obsolete memberHomeAuth.test.ts while replacing that coverage in customerAccountExperience.test.ts and customerReleaseIntegration.test.ts; this continuation does not remove or weaken any test. Exact inventory is saved outside Git in scope-inventory.json. No environment, secret, screenshot, build, log, coverage or synthetic browser artifact is included.

Only follow-up implementation changes:

- server/services/financeService.ts: restricted new achievement claims rejected under the existing owner transaction lock.
- server/suppliers/__tests__/financeApi.test.ts: ten claim restriction/authorization/idempotency regression cases.
- docs/customer-earn-v2-1-final-release.md: this record.

## Achievement security review

The router requires active authenticated sessions, forced-password enforcement and sensitive-operation rate limiting. It derives the account from req.user.id, ignoring body owner/value/progress. These layers do not enforce finance_accounts.restricted. FinanceTx.append only rejects restricted Wallet debits, so a positive achievement credit could bypass the frontend's existing restricted-claim policy.

The smallest correction reads tx.account().restricted inside claimAchievement's existing serialized transaction and rejects a new claim with 409 Account needs reconciliation. Completed claims return their original operation before the guard; replay does not mutate a ledger or credit money. This preserves existing idempotency, even after restriction or definition edits. Definitions, thresholds, reward snapshots, eligibility, journal append and Wallet accounting are unchanged. Both badge-only and money-bearing new claims honor the same existing frontend restriction. No new restriction type or policy configuration is invented.

Focused cases verify restricted badge/cash rejection at HTTP and direct service boundaries; no changed balances, progress, operations or ledger; eligible authoritative credit; forged progress rejection; zero-value badge; replay after restriction/definition edits; missing/invalid auth; cross-account isolation; and concurrent one-credit retries.

Schema, stores, backend routes/middleware, payment verification, supplier fulfillment, shared economics, API clients, dependency files and managed reseller checkout are byte-identical to production main. Existing public masked projection, delivery redaction, authenticated ownership, Admin RBAC, rate limits and no-store protections remain. The only backend application diff is the claim guard. No database migration or external database access occurred.

## Final tests and build

Claim/finance selection: 121/121 passed.
Broad focused selection: 810/810 passed; no failures or skips. Includes customer/auth/account, Earn/referral, finance, checkout, Marketplace, Builder foundation, AFA/Success Biz Hub and production integrity coverage. Full suite includes remaining Builder, privacy, schema and supplier cases.
Final full isolated suite: 1,487 total; 1,483 passed; three failures; one optional PostgreSQL skip; zero cancellations. Compared with V2.1's 1,477/1,473 baseline, this adds ten passing cases and no new failing identities.
The same three failures were freshly reproduced on untouched V2.1 source: failed-set run 152 total, 149 passed, three failed. They are the stale bundle delivery-copy assertion, old Website Builder sample-name/file failure and Windows line-ending-sensitive Website Free SQL comparison. No assertion was weakened and no inherited failure was fixed in this release.

Actual package scripts used: npm run test, npm test, npm run lint (tsc --noEmit), npm run build. The isolated runner deletes inherited DATABASE_URL and test database opt-in; external services are stubbed/blocked in claim tests. TypeScript and production build passed. Diff whitespace check passed. Existing Vite native configuration/chunk warnings are unchanged.
Built frontend assets are byte-for-byte identical to approved V2.1: index-BMLdWbfb.js and index-DRwBF2QT.css. Static audit confirms referenced assets exist and finds no bundled payment-secret pattern, database URL, Windows path, integration fixture or Dev Simulation copy.

## Actual visual release evidence

Compiled React app served only on loopback port 4233, without an application backend or production environment. All application API traffic was intercepted with synthetic accounts/orders/finance and unexpected mutations refused. External Paystack execution was disabled. No actual customer reference, payment, achievement claim or supplier request was used.

Widths 320, 360, 390, 430, 768, 1024 and 1280px passed guest/member and Earn layout checks. Short 360x640 was included. Auth signup/login was additionally verified at every width. Screenshots from the final compiled candidate were visually inspected in release-visual-review-1/2/3.png contact sheets and original evidence. Guest hero, combined greeting/Wallet/latest order, quick services, member activity, no duplicate guest homepage, Builder CTA/search navigation, template preview, mobile navigation, assistant, auth errors/login/logout/session expiry/forced password, member tracking, zero/error/loading states and retry were checked. Member requests use authenticated account orders; public tracking fixture is masked. No horizontal overflow or permanently covered claim button.

Earn verification includes 0/10, 1/10, 5/10, 10/10 and claimed states; badges and configured Wallet rewards; unavailable, restricted, all claimed, no enabled achievements, long names and monetary units. Actual progress transitions, immediate reduced motion/decreases, keyboard claims/disclosures/focus, duplicate clicks, clipboard/fallback/native-share cancellation, account switches, delayed request ordering, fees/confirmations, Wallet preservation and assistant clearance passed. No old basic achievement interface reappeared and no balance is fabricated during loading/error.

Five guest images including the genuine Cloudinary hero loaded without a broken image. The frontend remains exactly the approved visual implementation. Physical devices, assistive-technology certification, native WhatsApp handoff and production financial transactions were not tested or claimed.

Evidence directory: C:\Users\AB\Documents\ChatGPT\MYSTERY HUB\customer-earn-v2-1-release-evidence.
Logs: claim-tests.log, focused.log, full.log, unchanged-source-baseline.log, typescript.log, build.log.
Browser records: browser-results.json, qa-results.json, auth-responsive.json, assistant-result.json, images.json.
The exact source diff, scope inventory, build audit and public precheck are recorded alongside them.

## Gates A–O and hosting evidence

A Git: freshly verified exact main/source, preserved history and isolated worktree.
B Scope: only approved customer/Earn changes plus the narrow security correction and report.
C Privacy: deployed hotfix retained; backend privacy paths and clients unchanged.
D Checkout exclusion: both unapproved commits absent; reseller payment implementation unchanged.
E Claim policy: authoritative locked server guard now rejects new restricted claims; existing replay retained.
F Focused regression: 810/810 pass, including claim/security coverage.
G Full regression: no new failures; all three inherited failures reproduced on unchanged source.
H TypeScript/build: passed.
I Visual: all specified widths, short mobile, auth, Earn and customer journeys passed.
J Frontend build/publish: founder confirms main, repository root, npm run build, dist, mysterybundlehub.com.
K Frontend automation: initially inaccessible independently because Render opened its login page. Founder subsequently confirmed from current Settings: frontend Auto-Deploy is On Commit. This is current human verification, not an inferred historical deployment setting.
L Backend automation: founder-verified main service, npm install && npm run build, npm run start, Auto-Deploy On Commit; last confirmed live da36f1e. No setting is altered.
M Financial/authorization risk: identified claim gap corrected; relevant security/finance/provider/privacy checks pass. No new financial or supplier behavior or migrations.
N Main: must recheck immediately before publication/merge; stop if different from da36f1e.
O Rollback: non-destructive merge revert described below; original main retained in ancestry.

Pre-release public observations: mysterybundlehub.com returned HTTP 200 with its then-current assets index-DeQ0wo0c.js/index-ByOTGINB.css. mysteryhub-api.onrender.com/api/health returned HTTP 200 and status ok. Health does not identify deployed revision. Render dashboard was not independently authenticated; no deployment logs or secrets were read.

## Merge and rollback procedure

If the final main recheck remains exact and all gates above pass, publish the candidate normally, verify remote HEAD, then construct an explicit two-parent release merge in the isolated worktree. First parent must be da36f1e and second parent must be the published candidate. Merge tree must equal candidate tree exactly. Push that merge to refs/heads/main normally, never force. Preserve all original twelve worktree heads; the existing local main checkout may remain at old main, clean, while origin/main advances. This avoids switching or overwriting any existing worktree. Retain source/candidate branches.

Before pushing, save starting main and candidate/merge/tree hashes in delivery-record.json outside Git. To roll back if separately authorized: fetch current main, use an isolated rollback branch/worktree at latest main, run git revert -m 1 <verified-release-merge-sha>, review/test the targeted revert and confirm fcc8276 remains in ancestry and privacy code remains intact, then push normally through the approved workflow. A merge revert removes only this release relative to its first parent. If later work causes conflicts, stop. No published reset, force push or automatic rollback.

After push, verify remote main matches the merge SHA and approved sources/feature exclusion remain correct. Read only public frontend asset/HTML and documented API health. Exact frontend assets support public UI publication; they do not prove a Render dashboard deployment revision or backend guard revision. Report frontend/backend deployment status with that distinction. If logs/revisions cannot be independently accessed, request founder screenshots for both services, startup/database initialization and deployed SHA. Never equate Git push or HTTP 200 with a fully verified production release.
