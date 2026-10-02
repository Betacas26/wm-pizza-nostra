export function register() {
  // The Vercel CLI dev plugin injects <claude-code-hint> hints into outgoing
  // fetch request headers using embedded newlines (\n) as separators. Node.js
  // undici rejects these because control characters (0x00-0x1f except 0x09) are
  // invalid in HTTP header values per RFC 9110. Patch Headers.prototype.append
  // and .set to strip those control characters before validation runs, so the
  // hint is accepted (garbled but harmless) and the real Supabase request goes
  // through with the correct Authorization header.
  if (typeof globalThis.Headers !== 'undefined') {
    const origAppend = globalThis.Headers.prototype.append;
    const origSet = globalThis.Headers.prototype.set;

    function stripControlChars(value: unknown): string {
      // Remove ASCII control chars except TAB (0x09): 0x00-0x08, 0x0a-0x1f, 0x7f
      return String(value).replace(/[\x00-\x08\x0a-\x1f\x7f]/g, '');
    }

    globalThis.Headers.prototype.append = function (name: string, value: string) {
      return origAppend.call(this, name, stripControlChars(value));
    };

    globalThis.Headers.prototype.set = function (name: string, value: string) {
      return origSet.call(this, name, stripControlChars(value));
    };
  }
}
