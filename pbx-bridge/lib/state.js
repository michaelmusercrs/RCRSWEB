'use strict';

/**
 * Durable bridge state: a high-water mark (so restarts resume, not replay) and
 * a dead-letter log (events the portal rejected non-transiently, for manual
 * replay). Plain JSON on the WSL filesystem — no external dependency.
 */

const fs = require('fs');
const path = require('path');

class State {
  constructor(stateDir) {
    this.dir = stateDir;
    this.file = path.join(stateDir, 'watermark.json');
    this.deadLetterFile = path.join(stateDir, 'deadletter.jsonl');
    fs.mkdirSync(stateDir, { recursive: true });
    this.data = { watermark: null, lastRunAt: null };
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      /* first run */
    }
  }

  /** ISO string of the newest CDR calldate we've fully processed, or null. */
  get watermark() {
    return this.data.watermark;
  }

  setWatermark(iso) {
    if (!iso) return;
    if (!this.data.watermark || new Date(iso) > new Date(this.data.watermark)) {
      this.data.watermark = iso;
    }
  }

  save() {
    this.data.lastRunAt = new Date().toISOString();
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  deadLetter(event, error) {
    const line = JSON.stringify({ at: new Date().toISOString(), error: String(error), event }) + '\n';
    fs.appendFileSync(this.deadLetterFile, line);
  }
}

module.exports = { State };
