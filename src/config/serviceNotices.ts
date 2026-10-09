/**
 * Centralized Service Notices Configuration
 * Prepared for future database/admin dashboard dynamic toggles.
 * Never scatter provider notices across components.
 */

export interface ServiceNoticeConfig {
  enabled: boolean;
  severity: 'info' | 'warning' | 'alert';
  title: string;
  summary: string;
  message: string;
  duplicatePolicyNote: string;
  trackingNote: string;
}

export interface NetworkServiceNotices {
  mtn: ServiceNoticeConfig;
  telecel: ServiceNoticeConfig;
  airteltigo: ServiceNoticeConfig;
}

export const serviceNotices: NetworkServiceNotices = {
  mtn: {
    enabled: true,
    severity: 'warning',
    title: 'MTN Network Processing Notice',
    summary: 'Many orders complete within roughly 15–45 minutes.',
    message:
      'MTN orders are normally processed as quickly as network conditions allow. Many orders complete within roughly 15–45 minutes, but current MTN processing conditions can sometimes cause longer delays. In exceptional cases, processing may take up to 48 hours.',
    duplicatePolicyNote:
      'Please wait for an active MTN order to complete before placing another bundle for the same number.',
    trackingNote:
      'Your order remains trackable until it is delivered or resolved.',
  },
  telecel: {
    enabled: false,
    severity: 'info',
    title: 'Telecel Ghana Network Status',
    summary: 'Standard automated delivery active.',
    message: 'Telecel bundle processing is operating normally.',
    duplicatePolicyNote: '',
    trackingNote: 'Your order remains trackable until it is delivered or resolved.',
  },
  airteltigo: {
    enabled: true,
    severity: 'info',
    title: 'AirtelTigo iShare',
    summary: 'Delivery to your AirtelTigo number',
    message: 'Delivery starts after payment is confirmed. Network conditions can cause delays; track your order for updates.',
    duplicatePolicyNote: '',
    trackingNote: 'Your order remains trackable until it is delivered or resolved.',
  },
};
