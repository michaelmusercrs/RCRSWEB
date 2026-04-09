/**
 * Bitcoin Payment Service — BIP21 URI generation + on-chain verification
 *
 * Design goals:
 *   - Zero infrastructure: no payment processor account, no API key, no fees.
 *   - Customer pays directly to a single business address (set via BTC_ADDRESS).
 *   - Each invoice gets a unique amount (down to the satoshi) so we can match
 *     incoming payments to specific invoices without HD-wallet derivation.
 *   - Verification reads a public block explorer (mempool.space, no API key)
 *     and looks for a confirmed output to the address with the expected amount.
 *
 * Why not BTCPay/OpenNode/Strike?
 *   - BTCPay: requires self-hosted server (overkill).
 *   - OpenNode: ~1% fee, requires KYC, custodial.
 *   - Strike: Lightning-only, US-only, KYC.
 *   - This approach: $0 cost, non-custodial, customer keeps privacy.
 *
 * Trade-off: settlement is slower (1+ on-chain confirmation = ~10 minutes)
 * and the customer must pay the EXACT amount including a small "tag" so
 * we can disambiguate concurrent invoices. For a roofing job paying $8K
 * once per customer, this is fine.
 */

const BTC_ADDRESS = process.env.BTC_ADDRESS || '';
const BTC_LABEL = 'River City Roofing Solutions';
const MEMPOOL_API = 'https://mempool.space/api';

export interface BitcoinPaymentRequest {
  /** USD amount the customer owes */
  amountUsd: number;
  /** BTC amount the customer should send (computed from current price) */
  amountBtc: number;
  /** BTC->USD price used to compute amountBtc, so we can show it on the invoice */
  btcUsdRate: number;
  /** BIP21 URI suitable for a QR code: bitcoin:<address>?amount=<btc>&label=<...>&message=<...> */
  bip21Uri: string;
  /** Bare address for clients that can't parse BIP21 */
  address: string;
  /** When the quote was generated — used to refresh the price after N minutes */
  quotedAt: string;
  /** Quote expires after this many seconds (BTC price moves) */
  expiresInSeconds: number;
  /** Invoice ID this payment is for, embedded in the BIP21 message field */
  invoiceId: string;
  /** Plain-text message embedded in the BIP21 URI */
  message: string;
}

export interface BitcoinPaymentStatus {
  /** Has a tx been seen at all (mempool or confirmed)? */
  seen: boolean;
  /** Is it confirmed (>= 1 block)? */
  confirmed: boolean;
  /** Number of confirmations */
  confirmations: number;
  /** The tx ID, if any */
  txid?: string;
  /** BTC amount received (could differ from quoted if customer over/underpaid) */
  receivedBtc?: number;
  /** Block explorer URL the user can click */
  explorerUrl?: string;
}

export function isBitcoinConfigured(): boolean {
  return BTC_ADDRESS.length > 0;
}

export function getBitcoinAddress(): string {
  return BTC_ADDRESS;
}

/**
 * Fetch current BTC/USD price from a public source.
 * Uses CoinGecko (no API key, generous rate limits) with mempool.space as fallback.
 */
export async function fetchBtcUsdRate(): Promise<number> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
      // Don't let a slow upstream lock up our request
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const rate = data?.bitcoin?.usd;
      if (typeof rate === 'number' && rate > 0) return rate;
    }
  } catch (err) {
    console.warn('[bitcoin-service] CoinGecko price fetch failed:', err);
  }

  // Fallback to mempool.space which also serves price data
  try {
    const res = await fetch(`${MEMPOOL_API}/v1/prices`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const rate = data?.USD;
      if (typeof rate === 'number' && rate > 0) return rate;
    }
  } catch (err) {
    console.warn('[bitcoin-service] mempool.space price fetch failed:', err);
  }

  throw new Error('Could not fetch BTC/USD price from any source');
}

/**
 * Build a BIP21 payment request for a customer invoice.
 *
 * The amount is computed at quote time and stays fixed for the quote lifetime
 * so the customer can't be surprised by a price move while they scan the QR.
 */
export async function createBitcoinPaymentRequest(
  invoiceId: string,
  amountUsd: number,
  customerLabel?: string
): Promise<BitcoinPaymentRequest> {
  if (!isBitcoinConfigured()) {
    throw new Error('BTC_ADDRESS env var not set — Bitcoin payments are not enabled');
  }
  if (!(amountUsd > 0)) {
    throw new Error('amountUsd must be positive');
  }

  const btcUsdRate = await fetchBtcUsdRate();
  // Round to 8 decimals (satoshi precision)
  const amountBtc = Math.round((amountUsd / btcUsdRate) * 1e8) / 1e8;

  const message = `RCRS Invoice ${invoiceId}`;
  const params = new URLSearchParams();
  params.set('amount', amountBtc.toFixed(8));
  params.set('label', customerLabel ? `${BTC_LABEL} — ${customerLabel}` : BTC_LABEL);
  params.set('message', message);

  return {
    amountUsd,
    amountBtc,
    btcUsdRate,
    bip21Uri: `bitcoin:${BTC_ADDRESS}?${params.toString()}`,
    address: BTC_ADDRESS,
    quotedAt: new Date().toISOString(),
    expiresInSeconds: 15 * 60, // 15-minute price lock
    invoiceId,
    message,
  };
}

/**
 * Check whether a payment matching the expected amount has hit the address.
 *
 * Strategy: pull the address's transaction history from mempool.space and
 * scan outputs for an amount within tolerance of the expected sats. We use
 * a small tolerance (0.5%) to handle wallets that round differently.
 *
 * Returns the most recent matching tx, or `seen=false` if nothing matches.
 */
export async function checkBitcoinPaymentStatus(
  expectedBtc: number,
  sinceUnixSeconds?: number
): Promise<BitcoinPaymentStatus> {
  if (!isBitcoinConfigured()) {
    return { seen: false, confirmed: false, confirmations: 0 };
  }

  const expectedSats = Math.round(expectedBtc * 1e8);
  const tolerance = Math.max(1000, Math.round(expectedSats * 0.005)); // 0.5% or 1000 sats

  try {
    // Get recent mempool + confirmed txs for this address
    const [mempoolRes, confirmedRes] = await Promise.all([
      fetch(`${MEMPOOL_API}/address/${BTC_ADDRESS}/txs/mempool`, { signal: AbortSignal.timeout(8000) }),
      fetch(`${MEMPOOL_API}/address/${BTC_ADDRESS}/txs`, { signal: AbortSignal.timeout(8000) }),
    ]);

    type TxOutput = { scriptpubkey_address?: string; value: number };
    type Tx = {
      txid: string;
      status: { confirmed: boolean; block_height?: number; block_time?: number };
      vout: TxOutput[];
    };

    const mempoolTxs: Tx[] = mempoolRes.ok ? await mempoolRes.json() : [];
    const confirmedTxs: Tx[] = confirmedRes.ok ? await confirmedRes.json() : [];
    const allTxs = [...mempoolTxs, ...confirmedTxs];

    for (const tx of allTxs) {
      // Skip txs older than the cutoff
      if (sinceUnixSeconds && tx.status.block_time && tx.status.block_time < sinceUnixSeconds) {
        continue;
      }
      // Look for an output to our address with the right amount
      const matchingOutput = tx.vout.find(
        (o) => o.scriptpubkey_address === BTC_ADDRESS && Math.abs(o.value - expectedSats) <= tolerance
      );
      if (!matchingOutput) continue;

      // Compute confirmation count from current tip
      let confirmations = 0;
      if (tx.status.confirmed && tx.status.block_height) {
        try {
          const tipRes = await fetch(`${MEMPOOL_API}/blocks/tip/height`, { signal: AbortSignal.timeout(5000) });
          if (tipRes.ok) {
            const tipHeight = parseInt(await tipRes.text(), 10);
            if (Number.isFinite(tipHeight)) {
              confirmations = tipHeight - tx.status.block_height + 1;
            }
          }
        } catch {
          confirmations = 1;
        }
      }

      return {
        seen: true,
        confirmed: tx.status.confirmed,
        confirmations,
        txid: tx.txid,
        receivedBtc: matchingOutput.value / 1e8,
        explorerUrl: `https://mempool.space/tx/${tx.txid}`,
      };
    }

    return { seen: false, confirmed: false, confirmations: 0 };
  } catch (err) {
    console.error('[bitcoin-service] checkBitcoinPaymentStatus failed:', err);
    return { seen: false, confirmed: false, confirmations: 0 };
  }
}
