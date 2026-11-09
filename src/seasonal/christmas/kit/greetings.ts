/**
 * Mystery Greetings: one entry state for every seasonal homepage, guest or signed in.
 *
 * Today it is not open. Its backend is PR #104 (unmerged, review only), and that PR's gates
 * (MYSTERY_GREETINGS_ENABLED, MYSTERY_GREETING_LINKS_ENABLED) default to off. Nothing here calls an endpoint that
 * `main` does not have.
 *
 * When the feature ships, this is the single place that changes: availability comes from PR #104's
 * `GET /api/experiences/templates` (`creationConfigured`), and `createHref` points at the one shared creator route.
 * Creation in PR #104 is anonymous (a creator token kept in the sender's browser, no account identity), so guests and
 * signed-in customers use the same creator and nobody has to sign in first.
 */
export type GreetingsEntry = { state: 'coming-soon' } | { state: 'open'; createHref: string };

export const GREETINGS_ENTRY: GreetingsEntry = { state: 'coming-soon' };
