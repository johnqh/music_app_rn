/**
 * The network client the account's sections use.
 *
 * The slash is the part worth pinning. React Native's `URL` puts one after
 * the path, the server does not route it, and every credits request the app
 * made was a 404 that showed as a dash where the balance should have been.
 */
import { jest } from '@jest/globals';
import type { NetworkClient } from '@sudobility/types';
import { authenticated, withoutTrailingSlash } from './useAccountClients';

jest.mock('@/config/server', () => ({ getNetworkClient: () => ({}) }));
// ESM-only packages jest's resolver cannot follow; neither is under test.
jest.mock('@sudobility/consumables_client', () => ({}), { virtual: true });
jest.mock('@sudobility/entity_client', () => ({}), { virtual: true });

describe('withoutTrailingSlash', () => {
  it('takes the slash off the end of a path', () => {
    expect(
      withoutTrailingSlash('http://localhost:8032/api/v1/consumables/balance/'),
    ).toBe('http://localhost:8032/api/v1/consumables/balance');
  });

  it('takes it off before a query, and keeps the query', () => {
    expect(
      withoutTrailingSlash(
        'https://api.test/consumables/purchases/?limit=20&offset=0',
      ),
    ).toBe('https://api.test/consumables/purchases?limit=20&offset=0');
  });

  it('leaves an address that has none as it is', () => {
    const url = 'https://api.test/api/v1/consumables/balance?entity=a/b/';
    expect(withoutTrailingSlash(url)).toBe(url);
  });

  it('leaves the slash that is the whole path', () => {
    expect(withoutTrailingSlash('https://api.test/')).toBe('https://api.test/');
  });
});

describe('authenticated', () => {
  type Call = (...args: unknown[]) => Promise<{ ok: boolean }>;
  function inner() {
    return {
      get: jest.fn<Call>(async () => ({ ok: true })),
      post: jest.fn<Call>(async () => ({ ok: true })),
      put: jest.fn<Call>(async () => ({ ok: true })),
      delete: jest.fn<Call>(async () => ({ ok: true })),
    };
  }

  it('asks the address without the slash, with the bearer, on every method', async () => {
    const network = inner();
    const client = authenticated(
      network as unknown as NetworkClient,
      async () => 'token-1',
    );
    await client.get('https://api.test/a/');
    await client.post('https://api.test/b/', { x: 1 });
    await client.put('https://api.test/c/', { y: 2 });
    await client.delete('https://api.test/d/');

    const headers = { headers: { Authorization: 'Bearer token-1' } };
    expect(network.get).toHaveBeenCalledWith('https://api.test/a', headers);
    expect(network.post).toHaveBeenCalledWith(
      'https://api.test/b',
      { x: 1 },
      headers,
    );
    expect(network.put).toHaveBeenCalledWith(
      'https://api.test/c',
      { y: 2 },
      headers,
    );
    expect(network.delete).toHaveBeenCalledWith('https://api.test/d', headers);
  });

  it('reads the token per request, never once', async () => {
    const network = inner();
    const tokens = ['first', 'second'];
    const client = authenticated(
      network as unknown as NetworkClient,
      async () => tokens.shift() ?? null,
    );
    await client.get('https://api.test/a');
    await client.get('https://api.test/a');
    expect(network.get.mock.calls.map(call => call[1])).toEqual([
      { headers: { Authorization: 'Bearer first' } },
      { headers: { Authorization: 'Bearer second' } },
    ]);
  });

  it('sends no bearer when there is no token, rather than an empty one', async () => {
    const network = inner();
    const client = authenticated(
      network as unknown as NetworkClient,
      async () => null,
    );
    await client.get('https://api.test/a');
    expect(network.get).toHaveBeenCalledWith('https://api.test/a', {});
  });
});
