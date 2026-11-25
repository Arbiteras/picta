(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const playerUrl = new URL("assets/vendor/lottie/lottie-light-5.13.0.min.js", document.currentScript.src);
  const active = new Map();
  let playerPromise;

  function loadPlayer() {
    playerPromise ??= new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = playerUrl.href;
      const timeout = window.setTimeout(fail, 5000);

      function fail() {
        window.clearTimeout(timeout);
        script.remove();
        reject(new Error("No se pudo cargar el reproductor."));
      }

      script.addEventListener("load", () => {
        window.clearTimeout(timeout);
        if (window.lottie) resolve(window.lottie);
        else fail();
      }, { once: true });
      script.addEventListener("error", fail, { once: true });
      document.head.append(script);
    }).catch((error) => {
      playerPromise = null;
      throw error;
    });
    return playerPromise;
  }

  function waitForAnimation(animation, event, signal) {
    return new Promise((resolve, reject) => {
      signal.throwIfAborted();
      animation.addEventListener(event, resolve);
      animation.addEventListener("error", reject);
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  }

  async function loadDocument(target, signal) {
    const url = new URL(target.dataset.lottie, document.baseURI);
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error("No se pudo cargar la animación.");
    const animationData = await response.json();

    await Promise.all(animationData.assets.filter((asset) => asset.p && !asset.e).map((asset) => {
      asset.p = new URL((asset.u || "") + asset.p, url).href;
      asset.u = "";
      const image = new Image();
      image.src = asset.p;
      return image.decode();
    }));

    return animationData;
  }

  async function play(target, { restart = false } = {}) {
    if (reducedMotion.matches) return false;
    const previous = active.get(target);
    if (previous && !restart) return false;
    previous?.stop();
    const controller = new AbortController();
    const signal = controller.signal;
    let animation;
    let timeout;
    const loop = target.hasAttribute("data-motion-loop");
    if (loop) target.classList.remove("is-motion-failed");
    let ready = false;
    let visible = true;
    let persistent = false;

    const playback = {
      stop,
      show(next) {
        visible = next;
        if (!ready || !loop) return;
        if (visible && !document.hidden) animation.play();
        else animation.pause();
      },
      updateVisibility() { this.show(visible); }
    };

    function stop() {
      if (active.get(target) !== playback) return;
      active.delete(target);
      window.clearTimeout(timeout);
      controller.abort();
      target.classList.remove("is-motion-playing");
      animation?.destroy();
    }

    active.set(target, playback);
    timeout = window.setTimeout(stop, 8000);

    try {
      const [player, animationData] = await Promise.all([loadPlayer(), loadDocument(target, signal)]);
      if (signal.aborted || !target.isConnected || !target.getClientRects().length) return false;

      animation = player.loadAnimation({
        container: target.querySelector(".picta-motion-layer"),
        renderer: "svg",
        loop,
        autoplay: false,
        animationData
      });
      await waitForAnimation(animation, "DOMLoaded", signal);
      animation.goToAndStop(0, true);
      ready = true;
      if (loop) {
        window.clearTimeout(timeout);
        target.classList.add("is-motion-playing");
        playback.show(visible);
        persistent = true;
        return true;
      }
      const finished = waitForAnimation(animation, "complete", signal);
      target.classList.add("is-motion-playing");
      animation.play();
      await finished;
      if (target.dataset.motionEnd) {
        const image = target.querySelector(".picta-motion-static");
        const resting = image.cloneNode();
        resting.src = target.dataset.motionEnd;
        await resting.decode();
        if (!signal.aborted) image.replaceWith(resting);
      }
      return true;
    } catch {
      if (loop && !reducedMotion.matches) target.classList.add("is-motion-failed");
      return false;
    } finally {
      if (!persistent) stop();
    }
  }

  window.pictaMotion = { play };

  const welcomeTargets = document.querySelectorAll("[data-motion-autoplay]");
  const observer = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (target.hasAttribute("data-motion-loop")) {
        if (active.has(target)) active.get(target).show(isIntersecting);
        else if (isIntersecting && !reducedMotion.matches) void play(target);
        continue;
      }
      const replay = target.hasAttribute("data-motion-replay");
      if (!isIntersecting) {
        if (replay) active.get(target)?.stop();
        continue;
      }
      if (reducedMotion.matches) continue;
      if (!replay) observer.unobserve(target);
      void play(target);
    }
  }, { threshold: 0.35 });

  welcomeTargets.forEach((target) => observer.observe(target));

  document.addEventListener("visibilitychange", () => active.forEach((playback) => playback.updateVisibility()));

  reducedMotion.addEventListener("change", ({ matches }) => {
    if (matches) active.forEach((playback) => playback.stop());
    else welcomeTargets.forEach((target) => {
      observer.unobserve(target);
      observer.observe(target);
    });
  });
})();
