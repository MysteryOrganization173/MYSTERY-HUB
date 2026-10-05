# Website Builder Free V1 operations

This pass keeps Free at one website. Plus/Pro, domains, AI generation, subscriptions,
checkout and customer accounts inside generated sites remain unavailable. Pricing is unchanged.

## Deployment and configuration

The normal repeatable initializer adds `website_assets` and `analytics_events` plus indexes.
No existing website content is bulk migrated. Deploy backend and frontend together.
No manual production SQL is required by this pass. Do not run the test suite against the
application database: the existing runner removes inherited database settings, skips `.env`
loading and rejects external databases in test workers. PostgreSQL tests mock both connections
and queries against the reserved non-resolving fixture URL.

Configure these **server** environment variables through the existing deployment process:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET` (never a `VITE_` variable)
- Optional `WEBSITE_FREE_MAX_ASSETS` (default 20, maximum 100)
- Optional `WEBSITE_IMAGE_MAX_BYTES` (default 8 MiB, maximum 20 MiB)

Invalid limit overrides fall back to safe defaults. Missing media configuration returns a
truthful unavailable message; template/external URL images, editing and publishing still work.
No SDK or other dependency was added. Production Cloudinary credentials/configuration and
one controlled staging upload should be verified by the operator before enabling uploads.
This implementation was verified with mocked provider calls, not a live upload.

## Upload security boundary

1. An active owner requests an intent with filename, MIME and claimed byte size. Only JPEG,
   PNG and WebP are accepted. The server reserves a counted slot under the same PostgreSQL
   owner advisory lock used by site creation, saving, publishing, deletion and moderation.
2. The server signs a random fixed `mysteryhub/websites/<site-id>/<asset-id>` public ID,
   `overwrite=false` and an image format allowlist. A slash-qualified public ID works in
   both fixed and dynamic folder modes; no `folder`/prefix flags are needed.
3. Cloudinary signatures are valid for one hour from their timestamp. The signed timestamp
   is backdated 50 minutes to limit the capability to ten remaining minutes; local finalization
   also expires in ten minutes. Slots/tombstones remain reserved for 15 minutes to allow clock
   grace. Keep server clocks synchronized. An expired intent cannot be refreshed with a new
   signature for the same asset. A new intent uses a new random ID.
4. The browser sends the original file directly to the signed Cloudinary image endpoint.
   The upload response is not trusted as stored metadata. Finalization accepts only our asset ID
   and independently reads the resource using server credentials. It verifies identity, image
   resource/delivery type, format, actual bytes, version and dimensions, then constructs the
   canonical delivery URL. Oversized/invalid resources never become selectable ready assets.
   The source remains untransformed; displayed canonical images get `f_auto,q_auto,c_limit`
   and bounded widths. External URLs and already transformed legacy URLs are left intact.
5. Upload signatures do not sign `file` or `resource_type` (Cloudinary's API contract). Claims
   in the intent alone are not proof of MIME/size. Finalization is the application enforcement
   boundary. Configure the provider account's upload limits appropriately as well; malicious
   authorized users can attempt rejected uploads and consume provider bandwidth/storage before
   finalization. No browser-visible API secret or broad unsigned preset is used.

Provider documentation:
[signature contract](https://cloudinary.com/documentation/authentication_signatures),
[Upload API](https://cloudinary.com/documentation/image_upload_api_reference),
[Admin resource lookup](https://cloudinary.com/documentation/admin_api).

All media actions require an active owner session. Managed image URLs are resolved against
ready records for the same site, including transformed/alternate-extension attempts. Images
are public delivery assets, not a private document vault. Existing safe external image URLs
remain supported and never create counterfeit asset records.

## Delete and cleanup

Manual image deletion fails while the image is referenced anywhere in saved site content,
including disabled sections. Published sites serve this same saved content, so both draft
and public usages are protected. Remove/replace references and save before deleting.

Website deletion requires a typed site name or slug verified on the server. Inside one
transaction it detaches asset records into cleanup tombstones and deletes only the owned
website. This invalidates the public endpoint and releases the Free slot. Accounts, orders,
referrals, Marketplace and other customer data are untouched. Provider deletion happens only
after commit. Provider failures retain the tombstone and log only its internal asset ID.

Even a successful early provider delete retains a tombstone through upload replay grace,
because a late upload could recreate the resource. Admins can explicitly retry bounded cleanup
through `POST /api/admin/website-builder/media/cleanup` (20 records per request, 2/minute).
It handles expired pending uploads and deleting/failed records after 15 minutes. This is a
manual operational endpoint, not a startup job. Monitor Admin's pending-cleanup count and
run this authenticated maintenance action periodically. Without that maintenance, orphaned
provider resources may remain; they cannot be selected or revive a deleted website.

## Template and persistence policy

Template changes use a dedicated confirmed action and the last observed `updated_at` value.
The server computes target sections independently of the client. It preserves site ID, owner,
slug, status, core business/contact data, branding, hero/logo and media library. It copies safe
matching section types/variants into the target's valid ordered header/footer structure.
Unsupported specialized sections reset; legacy item lists survive only across matching layouts.
Target starter items/statistics use the existing saved-content contract so a full editor save
after migration remains valid; unsupported demo-only item specs/ratings are not persisted.
Targets without an existing composition use basic target-appropriate sections. The confirmation
preview shows that actual migration, not a promise to reproduce every bespoke demo widget.

The normal save endpoint cannot change template ID. New editor saves use optimistic revision
checks so an old editor cannot overwrite a template change. Saves acknowledge only the sent
snapshot; newer edits remain dirty. Publishing waits for a successful save. Legacy external
images are supported. Empty item/feature/stat lists do not resurrect starter content.
An unsuccessful autosave pauses retries for that unchanged edit; another edit or an explicit
Save retries it. This avoids repeatedly sending a stale revision after a conflict.
Legacy item controls expose only fields the selected existing renderer uses; editable sections
support their shared validated fields. Demonstration reservation/cart handlers in saved sites
hand off to the configured contact action rather than displaying false fulfilment success.
No form submissions, reservations or checkout are persisted/processed by Free V1.

## Analytics and Admin

Browser events are allowlisted: builder viewed, template previewed, build started, editor opened.
Random first-party visitor UUIDs persist locally; session UUIDs are session-scoped. Metadata is
limited to template ID, owned site ID and an enumerated source. No fingerprints, IP identity,
query strings, business text, contacts, images, passwords or tokens are stored in events.
An invalid supplied session is rejected rather than treated as a guest. Analytics failure
does not block building/publishing. Creation, publish, unpublish, deletion and template changes
are recorded by server routes, not fabricated browser events.

Admin lists use 7/30/90-day or all-time creation windows with bounded pagination and search,
status/template filters. Operational counts are labelled as current projects created in that
window. Recent publication lists use publication date. Funnel event totals are labelled events;
visitor counts deduplicate observed visitor/user links. Conversions count ordered matched users
or sites inside the window, not unrelated total ratios or a longitudinal cohort promise.
Anonymous tracking/storage blocking and cross-device visits naturally limit attribution.
Historical sites do not get invented creation events. Empty states show no fabricated rankings.

Admin can inspect safe operational projections and force-unpublish with slug confirmation.
Unpublish and safe audit logging share the DB transaction. Customer content is preserved.
Admin cannot edit arbitrary site content or permanently delete sites in this pass.

Rate limits reuse the existing process-local limiter: media intent/finalize 60/minute,
asset/template/Admin moderation 30/minute, website deletion 5/minute, analytics 60/minute.
Analytics uses a network key rather than a caller-chosen visitor ID. In a multi-instance
deployment rate limits are per process; DB owner locks and limits remain cross-process.
Adoption aggregations currently target modest V1 volumes; SQL aggregation/retention can be
introduced when analytics volume warrants it. No automatic retention/purge policy was added.
