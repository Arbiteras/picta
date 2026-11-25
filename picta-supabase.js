(() => {
  "use strict";

  window.pictaSupabase = window.supabase?.createClient(
    "https://ufhncvurcloacpkqocbq.supabase.co",
    "sb_publishable_YsFHQiZPI9UETrt8BNJtkg_fv45e91u",
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
