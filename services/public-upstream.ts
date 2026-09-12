import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
] as [string, number][]) blockedV4.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new BlockList();
// Exclude special-purpose and transition networks that can encapsulate private IPv4.
blockedV6.addSubnet('2001::', 23, 'ipv6');
blockedV6.addSubnet('2001:db8::', 32, 'ipv6');
blockedV6.addSubnet('2002::', 16, 'ipv6');
blockedV6.addSubnet('3fff::', 20, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, 'ipv4');
  return family === 6 && globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6');
}

function forbidden(): Error & { status: number; code: string } {
  return Object.assign(new Error('远程自配 API 只能访问公网 HTTPS 地址；本机服务需由站主托管'), {
    status:403, code:'PRIVATE_UPSTREAM_FORBIDDEN'
  });
}

export async function resolvePublicAddress(target: URL, resolve = lookup): Promise<{ address: string; family: number }> {
  if (target.protocol !== 'https:' || target.username || target.password) throw forbidden();
  const hostname = target.hostname.replace(/^\[|\]$/g, '');
  const family = isIP(hostname);
  const addresses = family ? [{ address:hostname, family }] : await resolve(hostname, { all:true, verbatim:true });
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) throw forbidden();
  return addresses[0];
}
