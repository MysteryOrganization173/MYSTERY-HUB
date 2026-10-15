import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { calculateFixedInstantBundlePrice, calculateFlexiInstantBundlePrice, INSTANT_BUNDLE_CONFIG } from '../data/instantBundlePricing.js';
import type { SbhInstantBundlePackage } from '../suppliers/successBizHub/types.js';

const developmentKey = randomBytes(32).toString('hex');
function key() {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('Payment quoting is unavailable.');
  return secret || developmentKey;
}
const sign = (value:string) => createHmac('sha256',key()).update('instant-quote-v1:'+value).digest('base64url');
export function exactFlexiAmount(value:unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) throw new Error('Enter an amount with at most two decimal places.');
  const amount = Number(value);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount*100)) || amount <= 0) throw new Error('Enter a valid amount.');
  return amount;
}
export function priceInstantPackage(pkg:SbhInstantBundlePackage, amount:unknown) {
  const isFlexi = !!(pkg.isFlexi || pkg.mode === 'flexi');
  const requestedAmount = isFlexi ? exactFlexiAmount(amount) : undefined;
  if(isFlexi && (![Number(pkg.minAmountMajor ?? 1),Number(pkg.maxAmountMajor ?? 500),pkg.payableRatio ?? 1].every(v=>typeof v==='number'&&Number.isFinite(v))
    || Number(pkg.minAmountMajor ?? 1)<=0 || Number(pkg.maxAmountMajor ?? 500)<Number(pkg.minAmountMajor ?? 1))) throw new Error('This package is temporarily unavailable.');
  const pricing = isFlexi
    ? calculateFlexiInstantBundlePrice(pkg.id,requestedAmount!,typeof pkg.payableRatio === 'number' ? pkg.payableRatio : 1,
        Number(pkg.minAmountMajor ?? 1),Number(pkg.maxAmountMajor ?? 500))
    : calculateFixedInstantBundlePrice(pkg.id,pkg.priceMinor);
  if(![pricing.customerTotalPesewas,pricing.productRetailPricePesewas,pricing.paymentProcessingFeePesewas].every(Number.isSafeInteger)||pricing.customerTotalPesewas<=0)throw new Error('This package is temporarily unavailable.');
  return {isFlexi,requestedAmount,pricing};
}
function quotedValues(pkg:SbhInstantBundlePackage, amount:unknown) {
  const {pricing,requestedAmount} = priceInstantPackage(pkg,amount);
  return {productId:`instant-${pkg.id}`,requestedAmount:requestedAmount ?? null,
    productRetailMinor:pricing.productRetailPricePesewas,feeMinor:pricing.paymentProcessingFeePesewas,
    totalMinor:pricing.customerTotalPesewas,currency:'GHS' as const,
    // Opaque revision: never expose the wholesale cost or commercial configuration.
    revision:sign(JSON.stringify({pkg,config:INSTANT_BUNDLE_CONFIG,pricing}))};
}
export function createInstantQuote(pkg:SbhInstantBundlePackage,amount:unknown,now=Date.now()) {
  const quote = {...quotedValues(pkg,amount),expiresAt:now+120_000};
  const body = Buffer.from(JSON.stringify(quote)).toString('base64url');
  return {...quote,token:body+'.'+sign(body)};
}
export function validateInstantQuote(token:unknown,pkg:SbhInstantBundlePackage,amount:unknown,now=Date.now()): boolean {
  if (typeof token !== 'string' || token.length > 4096) return false;
  try {
    const [body,signature,...extra] = token.split('.');
    const expected = Buffer.from(sign(body)); const actual = Buffer.from(signature || '');
    if (extra.length || actual.length !== expected.length || !timingSafeEqual(actual,expected)) return false;
    const quote = JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
    if (!Number.isSafeInteger(quote.expiresAt) || quote.expiresAt <= now || quote.expiresAt > now+120_000) return false;
    const current = quotedValues(pkg,amount);
    return Object.entries(current).every(([name,value]) => quote[name] === value);
  } catch { return false; }
}
