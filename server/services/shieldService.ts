import { ShieldStore, claimView, validShieldQuote, type ShieldClaim, type ShieldQuote } from '../db/shieldStore.js';
import { evaluateShield, parseOriginalStatus, screenShieldOrder, shieldPolicy, type ShieldPolicy } from './shieldPolicy.js';
import { canonicalGhanaPhone } from '../utils/phone.js';
import type { OrderRecord } from '../types/orders.js';
import type { ShieldView } from '../../shared/mysteryShield.js';

type Submission =
  | { state: 'accepted'; supplierId: string }
  | { state: 'rejected' }
  | { state: 'unknown' };
type Outcome = {
  supplierId: string;
  state: 'pending' | 'delivered' | 'failed';
  chargeMinor?: number;
};

/** No production implementation is registered until the exact reward contract is verified. */
export interface ShieldGateway {
  readOriginal(supplierId: string): Promise<unknown>;
  quote(recipient: string): Promise<ShieldQuote | null>;
  submit(input: { claimId: string; recipient: string; packageId: string; maxChargeMinor: number }): Promise<Submission>;
  lookup(supplierId: string): Promise<Outcome>;
}

const unavailable: ShieldView = { state: 'unavailable' };
export class ShieldService {
  private active = 0;

  constructor(private readonly gateway?: ShieldGateway, private readonly policy: () => ShieldPolicy = shieldPolicy) {}

  /** Recheck ownership and evidence before customer-facing eligibility or a new reservation. */
  async check(reference: string, userId: string, claim = false): Promise<ShieldView | null> {
    const policy = this.policy();
    if (!policy.visible) return null;
    const order = await ShieldStore.ownedOrder(reference, userId);
    if (!order) return null;
    if (!await ShieldStore.ready()) return unavailable;
    const existing = await ShieldStore.existing(order.id);
    if (existing) return claimView(existing);

    const screened = screenShieldOrder(order, policy, Date.now(), order.shield_fixture);
    if (screened) return screened;
    if (!this.gateway || !policy.intake || !policy.fulfillment || this.active >= 2) return unavailable;
    this.active++;
    try {
      return await this.checkGateway(reference, userId, claim, policy, order, this.gateway);
    } catch {
      // No retries. If the supplier call was entered, the committed latch retains liability.
      if (claim) {
        const durable = await ShieldStore.existing(order.id).catch(() => null);
        if (durable) return claimView(durable);
      }
      return unavailable;
    } finally {
      this.active--;
    }
  }

  private async checkGateway(reference: string, userId: string, claim: boolean,
    policy: ShieldPolicy, order: OrderRecord, gateway: ShieldGateway): Promise<ShieldView> {
    const raw = await gateway.readOriginal(order.supplier_order_id!);
    const now = Date.now();
    const evidence = parseOriginalStatus(raw, order, now);
    const verified = evaluateShield(order, policy, now, false, evidence);
    if (!evidence || verified.state !== 'eligible') return verified;
    const recipient = canonicalGhanaPhone(order.recipient_phone)!;
    const quote = await gateway.quote(recipient);
    if (!validShieldQuote(quote, policy, Date.now())) return unavailable;
    if (!claim) {
      const current = await ShieldStore.ownedOrder(reference, userId);
      if (!current || current.id !== order.id || current.recipient_phone !== order.recipient_phone
          || current.supplier_offer_ref !== order.supplier_offer_ref) return { state: 'unverifiable' };
      const existing = await ShieldStore.existing(current.id);
      if (existing) return claimView(existing);
      const latest = evaluateShield(current, policy, Date.now(), current.shield_fixture, evidence);
      if (latest.state !== 'eligible') return latest;
      if (!validShieldQuote(quote, policy, Date.now())) return unavailable;
      return ShieldStore.claimability(policy, quote);
    }
    const reservation = await ShieldStore.reserve(reference, userId, policy, evidence, quote, order);
    if (!reservation.claim) return reservation.view;
    const saved = reservation.claim;
    const reply = await gateway.submit({
      claimId: saved.id, recipient, packageId: saved.package_id, maxChargeMinor: saved.reserved_minor,
    });
    if (reply.state === 'accepted' && /^[a-zA-Z0-9_-]{1,100}$/.test(reply.supplierId)) {
      await ShieldStore.recordSubmission(saved, 'submitted', reply.supplierId);
      return { state: 'submitted' };
    }
    const state = reply.state === 'rejected' ? 'failed' : 'uncertain';
    await ShieldStore.recordSubmission(saved, state, null);
    return { state };
  }

  /** Read-only supplier recovery capability. Unknown acceptance without an ID stays held. */
  async reconcile(claim: ShieldClaim): Promise<void> {
    if (!this.gateway || !claim.supplier_id || !['submitted', 'uncertain'].includes(claim.state)) return;
    const outcome = await this.gateway.lookup(claim.supplier_id);
    if (outcome.supplierId !== claim.supplier_id) return;
    if (outcome.state === 'failed') {
      await ShieldStore.recordOutcome(claim, 'failed', null);
    } else if (outcome.state === 'delivered' && Number.isSafeInteger(outcome.chargeMinor)
        && outcome.chargeMinor! >= 0 && outcome.chargeMinor! <= claim.reserved_minor) {
      await ShieldStore.recordOutcome(claim, 'delivered', outcome.chargeMinor!);
    }
  }
}
