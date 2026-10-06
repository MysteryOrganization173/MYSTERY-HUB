/** Cancelling invalidates identity before any delayed result can be applied. */
export class AiRequestGate {
  private current: AbortController | null = null;

  get busy() { return this.current !== null; }

  begin() {
    this.cancel();
    const request = new AbortController();
    this.current = request;
    return request;
  }

  accepts(request: AbortController) {
    return this.current === request && !request.signal.aborted;
  }

  finish(request: AbortController) {
    if (this.current === request) this.current = null;
  }

  cancel() {
    const old = this.current;
    this.current = null;
    old?.abort();
  }
}
