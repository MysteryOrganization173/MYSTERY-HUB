export const WEBSITE_CLIENT_EVENTS = ['website_builder_viewed','website_template_previewed','website_build_started','website_editor_opened'] as const;
export type WebsiteClientEvent = typeof WEBSITE_CLIENT_EVENTS[number];
export interface WebsiteAnalyticsInput { event: WebsiteClientEvent; visitorId: string; sessionId: string; metadata: { templateId?: string; siteId?: string; source?: 'builder' | 'editor' | 'settings' }; }
export interface AdminWebsiteRow { id: string; name: string; businessName: string; slug: string; user_id: string; ownerName: string; template_id: string; status: string; created_at: string; updated_at: string; published_at: string | null; assetCount: number; publicUrl: string | null; }
/** Only the protected single-site inspection returns account contacts. */
export interface AdminWebsiteInspection extends AdminWebsiteRow {
  owner: {name:string|null;email:string|null;phone:string|null};
  businessContact: {phone:string|null;whatsapp:string|null;email:string|null};
}
export interface WebsiteAdminSummary {
  sites: AdminWebsiteRow[]; total: number; limit: number; offset: number;
  metrics: { total: number; draft: number; published: number; free: number };
  recentCreated: AdminWebsiteRow[]; recentPublished: AdminWebsiteRow[];
  templates: { templateId: string; projects: number; published: number; previews: number; created: number }[];
  funnel: { uniqueVisitors: number; previews: number; buildStarts: number; created: number; published: number; uniqueBuildStarters: number; uniqueCreators: number; startToCreate: number | null; createToPublish: number | null };
  media: { configured: boolean; maxAssets: number; maxBytes: number; tracked: number; ready: number; cleanupPending: number };
}
