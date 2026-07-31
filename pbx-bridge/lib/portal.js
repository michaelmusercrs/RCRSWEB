'use strict';

/**
 * Outbound HTTPS client to the portal. The ONLY network egress of the bridge.
 * Uses the global fetch (Node 18+). Auth is the shared CALLS_WEBHOOK_API_KEY.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Portal {
  constructor({ baseUrl, apiKey, dryRun = false, log = console }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.dryRun = dryRun;
    this.log = log;
  }

  /**
   * POST one normalized call event. Retries transient failures (network / 5xx /
   * 503 not-configured / 401 in case the key is being rotated). A 400 is a bad
   * payload and is surfaced immediately for dead-lettering.
   * Returns { ok, status, permanent }.
   */
  async postEvent(event, { retries = 5 } = {}) {
    if (this.dryRun) {
      this.log.log('[dry-run] would POST', JSON.stringify(event));
      return { ok: true, status: 0, permanent: false };
    }
    const url = `${this.baseUrl}/api/calls/webhook`;
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
          body: JSON.stringify(event),
        });
        if (res.ok) return { ok: true, status: res.status, permanent: false };
        if (res.status === 400) return { ok: false, status: 400, permanent: true };
        // 401/403/5xx/503 → transient (key rotation, cold start, deploy)
        if (attempt > retries) return { ok: false, status: res.status, permanent: false };
      } catch (err) {
        if (attempt > retries) return { ok: false, status: 0, permanent: false, error: String(err) };
      }
      await sleep(Math.min(30000, 1000 * 2 ** (attempt - 1)));
    }
  }

  /**
   * Stream an audio file to the portal, which puts it in PRIVATE Blob and
   * returns its pathname. The Blob token never leaves the portal. Returns
   * { ok, pathname }.
   */
  async uploadAudio(buffer, { kind, callUuid, ext, contentType }) {
    if (this.dryRun) {
      this.log.log(`[dry-run] would upload ${kind} for ${callUuid} (${buffer.length} bytes)`);
      return { ok: true, pathname: `phone/${kind}/dry-run/${callUuid}` };
    }
    const qs = new URLSearchParams({ kind, callUuid, ext: ext || '' }).toString();
    const url = `${this.baseUrl}/api/calls/recording-upload?${qs}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': contentType || 'application/octet-stream', 'x-api-key': this.apiKey },
        body: buffer,
      });
      if (!res.ok) return { ok: false, status: res.status };
      const json = await res.json();
      return { ok: true, pathname: json.pathname, url: json.url };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  /** Liveness ping (the portal watchdog cron watches for these). */
  async heartbeat(meta = {}) {
    if (this.dryRun) return { ok: true };
    try {
      const res = await fetch(`${this.baseUrl}/api/calls/bridge-heartbeat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
        body: JSON.stringify({ at: new Date().toISOString(), ...meta }),
      });
      return { ok: res.ok, status: res.status };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}

module.exports = { Portal };
