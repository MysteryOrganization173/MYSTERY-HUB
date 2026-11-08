/**
 * Christmas pack copy. Greetings only: nothing here offers a discount, a reward, a delivery time or a statistic, and
 * nothing replaces a service instruction or an error message. From 27 December the same pack speaks about New Year.
 */
import { isChristmasPhase, type SeasonPhase, type SeasonStatus } from '../../../shared/seasonal';

export const GREETING: Record<SeasonPhase, string> = {
  before: 'Christmas is coming to Mystery Hub',
  'christmas-season': 'Merry Christmas from Mystery Hub',
  'christmas-day': 'Merry Christmas! It’s Christmas Day',
  'boxing-day': 'Happy Boxing Day from Mystery Hub',
  'year-end': 'Season’s greetings from Mystery Hub',
  'new-years-eve': 'Happy New Year’s Eve',
  'new-years-day': 'Happy New Year 2027',
  'new-year': 'Happy New Year from Mystery Hub',
  after: 'Season’s greetings from Mystery Hub',
};

/** A serif line under the hero headline. */
export const HERO_LINE: Record<SeasonPhase, string> = {
  before: 'Celebrate the season, stay connected.',
  'christmas-season': 'Celebrate the season, stay connected.',
  'christmas-day': 'Wishing you a wonderful Christmas.',
  'boxing-day': 'Rest, visit, and keep in touch.',
  'year-end': 'Wrapping up the year together.',
  'new-years-eve': 'Here’s to everything 2027 brings.',
  'new-years-day': 'A bright start to 2027.',
  'new-year': 'A little more joy in every connection.',
  after: 'A little more joy in every connection.',
};

/** The day in plain words, worked out from today's Accra date. Never a promise, only the calendar. */
export function seasonCountdown(status: SeasonStatus): { big: string; small: string } {
  const { phase, daysToChristmas: c, daysToNewYear: n } = status;
  switch (phase) {
    case 'before':
    case 'christmas-season':
      return c === 1 ? { big: 'Tomorrow', small: 'Christmas Eve is here' } : { big: `${c} days`, small: 'until Christmas' };
    case 'christmas-day': return { big: 'Today', small: 'is Christmas Day' };
    case 'boxing-day': return { big: 'Today', small: 'is Boxing Day' };
    case 'year-end': return { big: `${n} days`, small: 'until 2027' };
    case 'new-years-eve': return { big: 'Tonight', small: 'we welcome 2027' };
    case 'new-years-day': return { big: '2027', small: 'Happy New Year' };
    default: return { big: '2027', small: 'Happy New Year' };
  }
}

export const isChristmasTime = (status: SeasonStatus) => isChristmasPhase(status.phase) || status.phase === 'before';

export type SeasonPage =
  | 'data' | 'marketplace' | 'creative' | 'website' | 'services' | 'afa' | 'checkers'
  | 'help' | 'about' | 'orders' | 'app' | 'earn' | 'wallet';

/** One short, context-aware line per page: a shopping page, a help page and an order page speak differently. */
export const PAGE_LINE: Record<SeasonPage, { christmas: string; newYear: string }> = {
  data: { christmas: 'Stay close this Christmas', newYear: 'Stay close in the new year' },
  marketplace: { christmas: 'Christmas shopping, simply', newYear: 'New year, new gear' },
  creative: { christmas: 'Designs for the season', newYear: 'Designs for the new year' },
  website: { christmas: 'A fresh start for your business', newYear: 'Start the year with a website' },
  services: { christmas: 'Everything for the season', newYear: 'Everything for the new year' },
  afa: { christmas: 'Season’s greetings', newYear: 'Happy New Year' },
  checkers: { christmas: 'Season’s greetings', newYear: 'Happy New Year' },
  help: { christmas: 'Holiday questions? Start here', newYear: 'New year questions? Start here' },
  about: { christmas: 'Merry Christmas from Accra', newYear: 'Happy New Year from Accra' },
  orders: { christmas: 'Christmas orders, tracked', newYear: 'New year orders, tracked' },
  app: { christmas: 'On your phone this Christmas', newYear: 'On your phone this year' },
  earn: { christmas: 'Share the season with friends', newYear: 'Share the new year with friends' },
  wallet: { christmas: 'Season’s greetings', newYear: 'Happy New Year' },
};

export const SHARE_TEXT = {
  christmas: 'Merry Christmas! I use Mystery Hub for data, airtime and more. Have a look:',
  newYear: 'Happy New Year! I use Mystery Hub for data, airtime and more. Have a look:',
};

/** A warm word for a genuinely confirmed outcome only (a verified payment or a delivered order). */
export const CONFIRMED_LINE = { christmas: 'Merry Christmas!', newYear: 'Happy New Year!' };
