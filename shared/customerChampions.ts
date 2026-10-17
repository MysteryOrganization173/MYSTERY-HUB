import type {AdminPeriod} from './adminOperations';
export interface ChampionRow {key:string;label:string;accountId:string|null;phone:string|null;spendingMinor:number;purchases:number;firstDeliveredAt:string;orderIds:string[];references:string[];exclusions:string[];previousAwards:number;code:string}
export interface ChampionsRanking {period:AdminPeriod;rows:ChampionRow[];excluded:ChampionRow[];tieRule:string;revision:string;sortBy:'spending'|'purchases'}
export interface GiveawayRound {id:string;request_id:string;actor_id:string;period:AdminPeriod;cutoff:string;snapshot:{ranking:ChampionsRanking;winners:Array<{key:string;prize:string}>};created_at:string}
export interface GiveawayAward {id:string;round_id:string;winner_key:string;prize:string;reference:string;note:string;actor_id:string;request_id:string;created_at:string}
