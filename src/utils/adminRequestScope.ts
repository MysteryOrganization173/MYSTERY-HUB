/** UI response ordering only. This never changes server action eligibility. */
export function createAdminRequestScope() {
  let context = '';
  let epoch = 0;
  const versions = new Map<string, number>();
  return {
    setContext(value: string) {
      if (context !== value) { context = value; epoch++; versions.clear(); }
    },
    invalidate(channel?: string) {
      if (channel) versions.set(channel, (versions.get(channel) || 0) + 1);
      else { epoch++; versions.clear(); }
    },
    begin(channel: string) {
      const version = (versions.get(channel) || 0) + 1;
      versions.set(channel, version);
      const started = epoch;
      return () => started === epoch && versions.get(channel) === version;
    },
  };
}
