import type {CustomerNotificationsClient} from '../services/customerNotifications';
import {notificationPermissionState} from './notifications';
import {pushSupported, readServerDeviceState, subscribeThisDevice} from './push';
import {showNotificationOptIn, type Snooze} from './launchPolicy';

type Environment = Parameters<typeof subscribeThisDevice>[2];
export type OnboardingStep = 'enable' | 'offers' | 'registered' | 'denied' | 'dismissed' | 'error';
export interface OnboardingOptions {
  allowOffers: boolean; offersAnswered: boolean; signal: AbortSignal; environment?: Environment;
}
const current = (signal: AbortSignal) => { if (signal.aborted) throw new Error('Notification screen closed.'); };

/** Read-only assessment: never asks permission, subscribes or writes consent. */
export async function notificationOpportunity(client: CustomerNotificationsClient, token: string,
  options: OnboardingOptions & {snooze: Snooze; now: number}): Promise<'enable' | 'offers' | null> {
  current(options.signal);
  if (!client.available || !pushSupported(options.environment)) return null;
  const config = client.configuration ? await client.configuration() : {enabled: true};
  current(options.signal);
  if (!config.enabled) return null;
  const permission = notificationPermissionState(options.environment as never);
  if (!['default','granted'].includes(permission)) return null;
  const device = permission === 'granted' ? await readServerDeviceState(client, token, options.environment) : 'not_subscribed';
  current(options.signal);
  if (device === 'subscribed') {
    if (!options.allowOffers || options.offersAnswered) return null;
    const preferences = await client.preferences(token); current(options.signal);
    return preferences.promotional ? null : 'offers';
  }
  if (device !== 'not_subscribed') return null;
  return showNotificationOptIn({installed:true,signedIn:true,permission,registered:false,snooze:options.snooze,now:options.now}) ? 'enable' : null;
}

/** One explicit tap completes permission -> subscription -> authenticated confirmation. */
export async function activateNotificationOnboarding(client: CustomerNotificationsClient, token: string,
  options: OnboardingOptions): Promise<{step:OnboardingStep;message?:string}> {
  const result = await subscribeThisDevice(client, token, options.environment, options.signal);
  current(options.signal);
  if (result.server !== 'subscribed') return {step:result.permission === 'denied' ? 'denied' : result.permission === 'default' ? 'dismissed' : 'error',message:result.message};
  if (!options.allowOffers || options.offersAnswered) return {step:'registered'};
  try {
    const preferences = await client.preferences(token); current(options.signal);
    return {step:preferences.promotional ? 'registered' : 'offers'};
  } catch {
    current(options.signal);
    return {step:'offers',message:'Your phone is registered. Your choices will be checked again before saving.'};
  }
}

/** Only the separate affirmative button calls this. Preserve the latest order-update choice. */
export async function acceptNotificationOffers(client: CustomerNotificationsClient, token: string, signal: AbortSignal) {
  current(signal);
  const latest = await client.preferences(token); current(signal);
  const result = await client.savePreferences(token,{transactional:latest.transactional,promotional:true,expectedVersion:latest.version});
  current(signal);
  if (!result.ok) throw new Error(result.message);
  if (result.value.promotional !== true) throw new Error('Your offers preference was not confirmed. Please try again.');
}
