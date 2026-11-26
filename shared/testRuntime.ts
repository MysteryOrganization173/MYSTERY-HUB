/**
 * True only under the Node test runner, which sets NODE_TEST_CONTEXT for every test file it runs. NODE_ENV=test alone
 * (for example a misconfigured staging server) never counts, so it can never drop the shipped emergency pause. Never
 * true in a browser build (`process` is absent there). Used only so the regression suite can start from "nothing
 * paused" and opt in to the shipped service controls explicitly.
 */
export const underNodeTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT);
