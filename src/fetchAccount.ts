/** Minimal account-number/sequence read against a Cosmos SDK LCD. */
export async function fetchAccount(
  lcdUrl: string,
  address: string
): Promise<{ accountNumber: string; sequence: string }> {
  const url = `${lcdUrl}/cosmos/auth/v1beta1/accounts/${address}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LCD ${url} -> ${res.status}: ${body}`);
  }
  const body = (await res.json()) as {
    account?: { account_number?: string; sequence?: string };
  };
  if (!body.account) {
    throw new Error(`unexpected LCD account response shape: ${JSON.stringify(body)}`);
  }
  return {
    accountNumber: body.account.account_number ?? '0',
    sequence: body.account.sequence ?? '0',
  };
}
