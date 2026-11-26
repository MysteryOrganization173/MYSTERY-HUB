/**
 * True only under the Node test runner (`node --test` sets NODE_TEST_CONTEXT; the project runner sets NODE_ENV=test).
 * Never true in production or in a browser build (`process` is absent there). Used only so the regression suite can
 * start from "nothing paused" and opt in to the shipped service controls explicitly.
 */
export const underNodeTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT || process.env?.NODE_ENV === 'test');
