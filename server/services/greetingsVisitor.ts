import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

interface VisitorRequest {
  socket: { remoteAddress?: string };
  rawHeaders: readonly string[];
}

interface GreetingsVisitor {
  key: string;
  established: boolean;
}

const unverified: GreetingsVisitor = { key: 'unverified', established: false };
const forwardedHeader = 'x-forwarded-for';
const MAX_FORWARDED_BYTES = 512;
const MAX_FORWARDED_HOPS = 8;

type Address = ReturnType<typeof ipaddr.process>;
function parseAddress(value: string): Address | null {
  // Node rejects short, octal and hexadecimal IPv4 forms. Zone IDs are local to a host.
  return value.length <= 45 && !value.includes('%') && isIP(value) ? ipaddr.process(value) : null;
}

function addressKey(address: Address): GreetingsVisitor {
  // IPv6 privacy addresses commonly rotate inside the same routed /64.
  const key = address instanceof ipaddr.IPv6
    ? `v6:${address.parts.slice(0, 4).map(part => part.toString(16)).join(':')}/64`
    : `v4:${address.toString()}`;
  return { key, established: true };
}

function compileProxies(raw: string) {
  const values = raw.split(',');
  if (raw.length > 512 || values.length > 16) return null;
  const v4: [ipaddr.IPv4, number][] = [];
  const v6: [ipaddr.IPv6, number][] = [];
  for (const value of values) {
    const match = value.trim().match(/^([^/]+)\/(\d{1,3})$/);
    if (!match || !isIP(match[1]) || match[1].includes('%')) return null;
    const address = ipaddr.parse(match[1]);
    const bits = Number(match[2]);
    if (address instanceof ipaddr.IPv4) {
      if (bits < 1 || bits > 32) return null;
      v4.push([address, bits]);
    } else {
      if (bits < 1 || bits > 128 || address.isIPv4MappedAddress()) return null;
      v6.push([address, bits]);
    }
  }
  return (address: Address) => address instanceof ipaddr.IPv4
    ? v4.some(range => address.match(range))
    : v6.some(range => address.match(range));
}

/** Only include sockets that were verified to append their observed peer, or replace XFF with it. */
export function createGreetingsVisitorResolver(cidrList: string, allowLocalSocket: boolean) {
  const trusted = cidrList ? compileProxies(cidrList) : null;
  const local = !cidrList && allowLocalSocket;
  return {
    configured: Boolean(trusted || local),
    resolve(req: VisitorRequest): GreetingsVisitor {
      const socket = parseAddress(req.socket.remoteAddress || '');
      if (!socket) return unverified;
      if (local && socket.range() === 'loopback') return addressKey(socket);
      if (!trusted?.(socket)) return unverified;

      let header: string | undefined;
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        if (req.rawHeaders[i].toLowerCase() !== forwardedHeader) continue;
        if (header !== undefined) return unverified;
        header = req.rawHeaders[i + 1];
      }
      if (!header || header.length > MAX_FORWARDED_BYTES) return unverified;
      const hops = header.split(',');
      if (hops.length > MAX_FORWARDED_HOPS) return unverified;
      // Only the trusted suffix is consumed. The first untrusted address is the
      // observed peer of that boundary. Everything earlier is caller-controlled.
      for (let i = hops.length - 1; i >= 0; i--) {
        const address = parseAddress(hops[i].trim());
        if (!address) return unverified;
        if (!trusted(address)) return address.range() === 'unicast' ? addressKey(address) : unverified;
      }
      return unverified;
    },
  };
}

let config: { raw: string; local: boolean; resolver: ReturnType<typeof createGreetingsVisitorResolver> } | undefined;
function deploymentResolver() {
  const raw = process.env.EXPERIENCES_TRUSTED_PROXY_CIDRS || '';
  const local = process.env.RENDER !== 'true' && ['test', 'development'].includes(process.env.NODE_ENV || '');
  if (!config || config.raw !== raw || config.local !== local) config = { raw, local, resolver: createGreetingsVisitorResolver(raw, local) };
  return config.resolver;
}
export const greetingVisitorTrustConfigured = () => deploymentResolver().configured;

const resolved = new WeakMap<VisitorRequest, GreetingsVisitor>();
export function greetingVisitor(req: VisitorRequest): GreetingsVisitor {
  let visitor = resolved.get(req);
  if (!visitor) {
    visitor = deploymentResolver().resolve(req);
    resolved.set(req, visitor);
  }
  return visitor;
}
