import type { CaptionEvent, CaptionPayload } from './caption-types';

// Reactive caption state. Partials are live (replaced per speaker); finals are the
// committed transcript, deduped + ordered by sequenceNumber (handles out-of-order arrival).
export class CaptionStore {
  finals = $state<CaptionPayload[]>([]);
  partials = $state<Record<string, CaptionPayload>>({}); // keyed by speakerId

  private seenSeq = new Set<number>();

  apply(evt: CaptionEvent): void {
    if (evt.event === 'caption') {
      // live partial replaces the speaker's current line
      this.partials = { ...this.partials, [evt.payload.speakerId]: evt.payload };
      return;
    }
    // caption_final
    const p = evt.payload;
    if (this.seenSeq.has(p.sequenceNumber)) return; // dedupe
    this.seenSeq.add(p.sequenceNumber);

    // clear the matching partial line and insert final in sequence order
    const { [p.speakerId]: _drop, ...rest } = this.partials;
    this.partials = rest;

    const next = [...this.finals, p].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    this.finals = next;
  }

  // Seed already-persisted rows (e.g. on page load) ahead of the live feed —
  // dedupes against seenSeq so a row that's both loaded here and re-broadcast
  // live never appears twice.
  loadHistory(payloads: CaptionPayload[]): void {
    const fresh = payloads.filter((p) => !this.seenSeq.has(p.sequenceNumber));
    fresh.forEach((p) => this.seenSeq.add(p.sequenceNumber));
    this.finals = [...this.finals, ...fresh].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  reset(): void {
    this.finals = [];
    this.partials = {};
    this.seenSeq.clear();
  }
}
