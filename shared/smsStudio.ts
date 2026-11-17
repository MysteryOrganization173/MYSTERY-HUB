export const SMS_STUDIO_TEMPLATES = [
 {id:'return',title:'Customer comeback reminder',purpose:'marketing',body:"It's been a while! Need data again? We're here with MTN, Telecel and AirtelTigo bundles. Order anytime: {{site}}"},
 {id:'welcome',title:'First-purchase thank-you',purpose:'marketing',body:'Thank you for choosing us! Need data again? Explore our digital services and current bundles at {{site}}'},
 {id:'channel',title:'Official WhatsApp Channel announcement',purpose:'marketing',body:"We're still here! Follow our official WhatsApp Channel for data offers and important updates: {{channel_url}}"},
 {id:'friday',title:'Friday Mystery Drop',purpose:'marketing',body:"FRIDAY MYSTERY DROP! Check our official WhatsApp Channel for confirmed surprises and offer terms: {{channel_url}}"},
 {id:'availability',title:'Data bundle availability',purpose:'marketing',body:'Need data? Browse current MTN, Telecel and AirtelTigo bundle availability before ordering: {{site}}'},
 {id:'fast_delivery',title:'Fast delivery announcement',purpose:'marketing',body:'Bundles are moving fast today! Need data? Check our current MTN, Telecel and AirtelTigo offers: {{site}}',requiresPerformanceEvidence:true},
 {id:'maintenance',title:'Service maintenance notice',purpose:'operational',body:'Service Update: Please check the maintenance notice before placing your next order. Current service information: {{site}}/help'},
 {id:'outage',title:'Service outage',purpose:'operational',body:'Service Update: A service interruption may affect new orders. Please check current availability before ordering: {{site}}/help'},
 {id:'delay',title:'Order delay notice',purpose:'operational',body:'An order taking longer than expected? Please avoid placing the same order again. Our support team can help: {{site}}/help'},
 {id:'restored',title:'Service restored',purpose:'operational',body:'Service Update: Check the latest availability notice before your next order. Thank you for your patience. {{site}}'},
 {id:'network_disruption',title:'Temporary network disruption',purpose:'operational',body:'Service Update: Network disruption may affect availability. Please read the current notice before placing an order: {{site}}/help'},
 {id:'support',title:'Important customer notice',purpose:'operational',body:'Need help with an order or digital service? Find our current official support contacts here: {{site}}/help'},
 {id:'new_service',title:'New service launch',purpose:'marketing',body:'Explore digital services available on Mystery Hub. See what is currently available and choose what works for you: {{site}}'},
 {id:'offer',title:'Special offer / discount',purpose:'marketing',body:'Looking for value? Check our official site for confirmed offers, availability and full terms before ordering: {{site}}'},
 {id:'referral',title:'Referral announcement',purpose:'marketing',body:'Enjoy using Mystery Hub? Check the current referral programme and its terms in your account before sharing: {{site}}'},
 {id:'appreciation',title:'Customer appreciation',purpose:'marketing',body:'Thank you for being part of Mystery Hub. We appreciate your support and look forward to helping with your next digital purchase. {{site}}'},
 {id:'custom',title:'General custom message',purpose:'marketing',body:''},
] as const;
export const SMS_CAMPAIGN_GOALS = [
 ['availability','Announce service availability'],['comeback','Bring back inactive customers'],
 ['offer','Promote a verified offer'],['maintenance','Explain maintenance'],['restored','Announce restored service'],
 ['welcome','Welcome customers'],['channel','Invite customers to the official channel'],['thanks','Thank loyal buyers'],['custom','Create a custom campaign'],
] as const;
export const SMS_BUYING_GROUPS:Record<string,string>={recent:'Recently active',normal:'Buying normally',due:'Possibly due',unusual:'Unusually inactive',long_inactive:'Long inactive',one_time:'One-time buyer',insufficient:'Insufficient history'};

export const smsChannelMention=(value:string)=>/\{\{channel_url\}\}|(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\//i.test(value);
