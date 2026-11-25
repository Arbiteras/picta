(() => {
  "use strict";

  const { url, publishableKey } = window.pictaSupabaseConfig ?? {};
  if (!url || typeof publishableKey !== "string" || !publishableKey.startsWith("sb_publishable_")) return;

  window.pictaSupabase = window.supabase?.createClient(
    url,
    publishableKey,
    {
      auth: { flowType: "implicit" },
      global: {
        fetch: (url, options) => {
          const timeout = AbortSignal.timeout(16000);
          return fetch(url, {
            ...options,
            signal: options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout
          });
        }
      }
    }
  );
})();
