# Mystery Hub 3.4.1: customer experience polish and unified notifications

Two releases. This file records what changed, why, and what stays the same.

## Release 1: navigation, My Account, registration and receipt email, Smart Buy Again

### One menu
- **Before:** below 1280px a signed-in customer had two menu buttons: an avatar dropdown and a hamburger drawer.
  - Each had its own profile header and its own Sign Out.
  - The drawer repeated Home, Data and Website from the bottom bar.
- **Now, below 1280px:** one button opens one menu.
  - For members the button carries their initial, so it reads as the account menu.
  - The menu runs top to bottom: the member's name and phone, four account shortcuts (My Orders, Wallet, My Business, Earn), Explore, then Account & help (My Account, Help & FAQs, Ask Mystery AI, Share, Sign Out).
  - Pages the bottom bar already shows (Home, Data & Airtime, and for visitors Earn and Track an order) appear in the menu only from 768px, where the bottom bar is hidden.
  - Two deliberate exceptions: My Orders and Earn stay among the account shortcuts, as the brief lists them; and Website Builder stays in Explore at every width, because it opens the design gallery while the bottom bar's Website takes an owner to My Business.
  - Visitors get Explore, Help (with Notifications for this browser), then Login and Sign Up.
- **From 1280px:** the full header links stay, with a compact account dropdown: My Orders, Mystery Wallet, My Business, Website Builder (the design gallery), Mystery Earn, My Account, Share and Sign Out.
  - It closes when the window narrows below 1280px.
- **Behaviour kept:**
  - the page lock and inert background while the menu is open;
  - Escape closes it and returns focus to the button, and so do tapping outside and Back;
  - on browsers without `:has()`, a class on the root element hides the bottom bar instead;
  - it closes when the window grows to desktop;
  - the current page is announced (`aria-current`);
  - the December shell hooks (`.mh-menu-trigger`, `.mh-mobile-menu-panel`, `.mh-menu-link`, `.mh-menu-ai`, `.mh-menu-auth`, the `menu-header` and `logo-hat` slots) still apply.
- **New behaviour:**
  - the bottom bar steps aside while the menu is open, so it never covers the menu's last items;
  - signing in or out closes any open menu.
- The Wallet, Mystery AI and Earn header icons now start at 768px, where the bottom bar ends.

### My Account
- A sheet: full screen on phones with a title bar that stays put, and a centred panel from 640px. It is still opened by `openAccount`, so every existing entry point and deep link works.
- **Sections:**
  - a profile header (name, phone, member since);
  - **Personal details:** name, sign-in phone and sign-in email, plus the receipt email;
  - **Security:** change password; sign out on this device; sign out of all devices, which asks first;
  - **Notifications:** the existing settings, behind one button;
  - **Rewards:** referral code with Copy, member since, and Mystery Earn.
- **Forms:** each section starts as a summary, and a change opens one focused form in place.
  - Focus goes into the form when it opens and back to its button when it closes.
  - Every form shows saving, success and error states.
  - There is no dialog inside the dialog.
- **Unchanged server rules:**
  - changing the sign-in email or phone needs the current password;
  - changing the password signs out other devices;
  - the forced new-password flow and its own dialog;
  - switching accounts remounts the sheet.
- The footer's Notifications entry opens My Account with the Notifications section already open.
- The phone's Back closes the sheet.
- A save that comes back after the customer signed out or switched account is ignored, so the old profile never reappears.

### Registration email
- The email field is shown openly: **Email address (recommended)**, with "For payment receipts and easier future checkouts. You can also sign in with it."
  - The second sentence is there because this address is also a sign-in detail; a receipts-only address is the receipt email below.
- It stays optional; registration without it works as before.

### Receipt email
- **The preference:** a new nullable column, `users.receipt_email`. It is added at start-up and mirrored in `schema.sql`.
  - It is a contact for payment receipts only and never a sign-in identifier.
  - `PUT /api/auth/receipt-email {email}` saves it, and `{email: null}` forgets it. Only the signed-in customer can do this, with no password and no session change. It is refused while a new password is required.
  - It has its own rate limit.
- **Checkout:**
  - It starts with the remembered receipt email, then the sign-in email.
  - The receipt address can still be changed for each order.
  - For a signed-in customer typing a new address, an unticked **Remember this email for future receipts** box appears.
  - When ticked, the address is saved only once the server has created the order. A rejected or unanswered attempt remembers nothing. The order always uses the typed address.
  - Clearing or changing the address back hides and unticks the box.
  - If saving fails, the customer is told and the payment is unaffected.
- **Other checkouts:** Marketplace, AFA registration and Results Checkers start from the same address. Airtime and Instant, which show no receipt field, send it to Paystack the way they sent the sign-in email before.
- **My Account** shows the receipt email under Personal details with Change and Remove, and says it isn't used to sign in.
- **What does not change:** Paystack initialization, verification and amounts. Checkout never edits sign-in details.

### Smart Buy Again
- **The lookup:** `GET /api/account/orders/:reference/reorder` is read-only and `no-store`.
  - It answers only for the signed-in customer's own order, named by its public reference. Any other order, payment reference or internal id answers 404.
- **Which orders qualify:** delivered, settled (`success`, `not_required` or `recorded`), not under review, with no resolution record.
  - Data, Airtime and Instant only.
  - Never a website-store purchase.
- **How each service is resolved:**
  - **Data:** the product id stored on the order goes through the catalogue's own alias table, then today's commercial catalogue. Never the name or the old price.
  - **Airtime:** the stored face value with today's fee.
  - **Instant:** the stored `instant-<package>` id against the live catalogue, read exactly as payment initialization reads it. Flexi asks the customer to choose the amount again.
- **What leaves the server:** public catalogue facts only. No supplier cost, ratio, route or offer reference.
- **What the customer sees:**
  - Buy again opens the ordinary checkout review with the product, network and previous recipient filled in.
  - Data totals come from the checkout's own server quote; Pay stays unavailable until it arrives.
  - Payment initialization re-prices and re-checks everything, so all checkout protections apply as before: recipient validation, the network warning, the active MTN order rule, payment recovery and idempotency. Nothing is charged by tapping Buy again.
  - When the product cannot be repeated (retired, switched off, out of stock, Flexi, service down, or an unreadable amount), one sentence explains why and the right catalogue opens on that network.
- **Where it appears:** the member home (standard and December) and the order status sheet. On the order status sheet it is for signed-in customers only; visitors keep the plain catalogue link.
  - Closing the sheet, or opening another order, cancels a lookup still in flight; the button is disabled while it checks.
  - An order the server does not know as the account's (bought before signing in, or tracked by reference) quietly opens that service's catalogue, as Buy again always did.
  - The lookup reads the order by owner and public reference only (`WHERE public_reference = $1 AND user_id = $2`).

### Independent review
- A separate reviewer found no high-severity issue. It raised one low–medium finding (a stale profile after a fast sign-out), five low findings and five notes.
- All were addressed as described above. The menu exceptions are deliberate and documented.

### Evidence (local, synthetic data)
- `server/suppliers/__tests__/customerExperience341.test.ts`: the reorder service and route, the receipt email, the client mapping, the menu and the sheet.
- `scripts/reviewCustomerExperience341.cjs`: browser acceptance at 320, 360 (short), 390, 430, 768, 1280 and 1440, plus the installed app and the December shell. It covers My Account, registration, the receipt email and Buy Again for every service.
  - It blocks the payment request, and fails if Buy Again sends one by itself.

## Release 2: Notification Center, one "Allow Notifications", settings polish

### The bell and the Notification Center
- **Members** get a bell in the header at every width. It carries no number or dot: nothing in Mystery Hub knows whether a phone showed a message or anyone read it, so nothing is counted.
- **The Notification Center** is full screen on phones and a panel under the header from 640px.
  - It lists the account's own notifications, newest first: title, message, kind (Order update, Announcement or Account) and time.
  - It has a loading state, an empty state ("No notifications yet"), an error state with Try again, and Show older in pages of 25.
- **Opening a row:**
  - an order update opens that order, found in the account's own order list;
  - an announcement opens its approved page;
  - account messages open nothing.
- **Closing:** Escape, ×, a tap outside the panel and Back close it. Focus returns to the bell, and signing out closes it.
- **Where it opens:** on every screen that has My Account (the main site, My Business, the website editor and Admin).
- **Back:** a row that opens a page waits until the center has left history, so Back never meets a stray entry.
- **Notification settings** at the bottom opens My Account at Notifications.
- **Server:** the inbox now says what kind each row is and, for order updates, names the order's public reference. The join is limited to the account's own orders. There is no new table and no read state.
- **Visitors** get no bell and no inbox. Their menu and footer keep the browser-news sheet. While visitor news is switched off, the sheet says it is not available without an account yet.

### One "Allow Notifications"
- **Where:** the same card appears in the Notification Center and in My Account, wherever this device is not registered yet. The invitation keeps its own card with the same words.
- **The words:**
  - "Stay updated."
  - "Get order updates, service news and occasional offers."
  - Allow Notifications, with Not now in the center.
  - A member who said no to offers before is offered order updates only ("Get updates about your orders on this device.").
- **One tap does exactly what the invitation does:**
  - asks the browser;
  - registers the device;
  - records consent for the purposes the sentence names, with the same copy version (`invite-3.4-1`) and source.
- **Offers are never revived:** allowing notifications never turns news and offers back on after a "no". The server enforces this too; only the News and offers switch turns them back on.
- **Other behaviour:**
  - Browser permission alone is never treated as "on"; "on" appears only after the server confirms.
  - Not now rests the invitation the same way as in the invitation.
  - A registration that was interrupted (permission granted, no device on the server) shows the same card, and finishing it records the same consent.
  - While the operator has paused sending, the card says so ("If you turn them on, this device gets them once sending resumes") and promises no date.

### Settings polish (My Account › Notifications)
- **In plain words:**
  - on, with "Turn off for this device";
  - not on yet, with the shared card;
  - blocked, with directions for this browser or, in the iPhone Home Screen app, for Settings;
  - not available here;
  - the iPhone Safari tab, with the Home Screen path;
  - "We couldn’t check notifications right now", with Try again, when the server cannot be reached.
- **Unchanged:** the two switches (order updates; news and offers) and the SMS choices.
- **The recent feed moved:** it is now in the Notification Center. My Account links to it ("See recent notifications"), and the center links back.
- **Account switching and sign-out** reset everything to the new account. The section heading is not repeated inside the account sheet.

### Evidence (local, synthetic data)
- `server/suppliers/__tests__/notificationCenter341.test.ts`: times, targets, inbox parsing, the member offer rule, the shared card's words and consent path, settings and the bell.
- `notificationsPostgres`: the inbox names only the account's own orders.
- `scripts/reviewNotificationCenter341.cjs`, at 320–1440:
  - visitors have no bell;
  - members' bell and center, with every state;
  - rows open the right place;
  - Allow from the center and from My Account, with the consent rows checked in the database;
  - offers stay off after a "no";
  - paused and blocked;
  - sign-out.
  - The browser permission and the push subscription are simulated; nothing leaves the machine.
