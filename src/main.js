import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const GLYPHS = "01<>/\\[]{}#*+=_-~!?$%&ｱｲｳｴｵｶｷｸｹｺ";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const text = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();

let scene = null;

function loadScene() {
  import("./scene.js")
    .then(({ initScene }) => {
      scene = initScene({ motion: !reduceMotion });
    })
    .catch((error) => console.warn("Background scene failed to load; keeping the CSS background.", error));
}

function initSmoothScroll() {
  const lenis = new Lenis({ autoRaf: false, lerp: 0.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

function initProgress() {
  const header = $(".site-header");
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => header.style.setProperty("--progress", self.progress.toFixed(4)),
  });
}

function glitch(el, duration = 450) {
  if (!el) return;
  el.classList.add("is-glitching");
  gsap.delayedCall(duration / 1000, () => el.classList.remove("is-glitching"));
}

function glitchLoop() {
  const targets = [$(".wordmark .glitch"), $(".title-accent")];
  const tick = () => {
    const pool = scene ? [...targets, scene.canvas] : targets;
    glitch(pool[Math.floor(Math.random() * pool.length)]);
    gsap.delayedCall(gsap.utils.random(2.2, 5.5), tick);
  };
  gsap.delayedCall(3, tick);

  const photo = $("#profile-picture-container");
  if (!photo) return;
  const photoTick = () => {
    glitch(photo);
    gsap.delayedCall(gsap.utils.random(3, 6), photoTick);
  };
  gsap.delayedCall(gsap.utils.random(3, 6), photoTick);
}

/* ------------------------------------------------------------------ boot */

function shouldBoot() {
  try {
    if (sessionStorage.getItem("mqxym-booted")) return false;
    sessionStorage.setItem("mqxym-booted", "1");
  } catch {
    // Storage blocked: boot every time, that's fine.
  }
  return true;
}

function runBoot() {
  return new Promise((resolve) => {
    const boot = document.createElement("div");
    boot.className = "boot";
    boot.setAttribute("aria-hidden", "true");
    boot.innerHTML = `
      <div class="boot__half boot__half--top"></div>
      <div class="boot__half boot__half--bottom"></div>
      <div class="boot__flash"></div>
      <div class="boot__inner">
        <div class="boot__word"></div>
        <div class="boot__bar"><i></i></div>
        <div class="boot__hex"></div>
      </div>`;
    document.body.append(boot);

    const word = $(".boot__word", boot);
    const hex = $(".boot__hex", boot);
    const randomHex = () =>
      Array.from({ length: 4 }, () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0")).join(" ");

    const tl = gsap.timeline({
      onComplete: () => {
        boot.remove();
        resolve();
      },
    });

    tl.to(word, { duration: 0.9, scrambleText: { text: "mqxym", chars: GLYPHS, revealDelay: 0.25, speed: 0.7 } })
      .to($(".boot__bar i", boot), { scaleX: 1, duration: 1.05, ease: "power2.inOut", onUpdate: () => (hex.textContent = randomHex()) }, 0)
      .add(() => glitch(word), 0.95)
      .to(".boot__inner", { opacity: 0, scaleY: 0.02, duration: 0.22, ease: "power4.in" }, 1.15)
      .to(".boot__flash", { scaleX: 1, duration: 0.25, ease: "expo.out" }, 1.3)
      .to(".boot__half--top", { yPercent: -100, duration: 0.7, ease: "expo.inOut" }, 1.42)
      .to(".boot__half--bottom", { yPercent: 100, duration: 0.7, ease: "expo.inOut" }, 1.42)
      .to(".boot__flash", { opacity: 0, scaleY: 6, duration: 0.5 }, 1.5);

    const skip = () => tl.timeScale(5);
    boot.addEventListener("click", skip);
    window.addEventListener("keydown", skip, { once: true });
  });
}

/* ----------------------------------------------------------------- intro */

function intro() {
  const splits = [];
  const restores = [];
  const tl = gsap.timeline({
    defaults: { ease: "expo.out", duration: 1.1 },
    onComplete: () => {
      splits.forEach((split) => split.revert());
      restores.forEach((fn) => fn());
    },
  });

  const scramble = (el, at, duration = 1) => {
    if (!el) return;
    const original = el.textContent;
    const final = text(el);
    el.textContent = "";
    restores.push(() => (el.textContent = original));
    tl.to(el, { duration, ease: "none", scrambleText: { text: final, chars: GLYPHS, revealDelay: duration * 0.35, speed: 0.6 } }, at);
  };

  tl.from(".site-header", { yPercent: -100, opacity: 0, duration: 0.9 }, 0)
    .add(() => glitch($(".wordmark .glitch")), 0.4);

  // Profile card
  tl.from(".profile", { x: -70, rotationY: -28, opacity: 0, transformPerspective: 1000, duration: 1.3 }, 0.1)
    .from("#profile-picture-container", { scale: 0.6, opacity: 0, rotation: -8, duration: 1 }, 0.35)
    .add(() => glitch($("#profile-picture-container")), 0.9)
    .from([...$$(".profile > :not(#profile-picture-container)")], { y: 18, opacity: 0, stagger: 0.07, duration: 0.8 }, 0.5);

  // Bio terminal
  tl.from("#bio", { x: 70, rotationY: 18, opacity: 0, transformPerspective: 1200, duration: 1.3 }, 0.2);
  scramble($("#bio .eyebrow"), 0.55, 0.8);

  const title = $("#intro-title");
  const line = $(".title-line", title);
  const accent = $(".title-accent", title);
  if (line && accent) {
    title.setAttribute("aria-label", `${text(line)} ${text(accent)}`);
    restores.push(() => title.removeAttribute("aria-label"));
    gsap.set(title, { perspective: 700 });
    const chars = SplitText.create(line, { type: "chars", aria: "none" });
    splits.push(chars);
    tl.from(chars.chars, { yPercent: 90, rotationX: -90, opacity: 0, transformOrigin: "50% 100%", stagger: 0.028, duration: 0.9 }, 0.7);
    scramble(accent, 1.05, 1.1);
    tl.add(() => glitch(accent), 2.15);
  }

  $$("#bio > p:not(.eyebrow)").forEach((p, i) => {
    const split = SplitText.create(p, { type: "lines", mask: "lines", aria: "none" });
    splits.push(split);
    tl.from(split.lines, { yPercent: 110, duration: 0.9, stagger: 0.08 }, 1.1 + i * 0.12);
  });

  tl.from("#bio blockquote", { x: -30, opacity: 0, duration: 0.9 }, 1.3);

  root.classList.remove("anim-pending");
  return tl;
}

/* -------------------------------------------------------- scroll reveals */

function scrollReveals() {
  const heading = $(".section-heading");
  if (heading) {
    const h2 = $("h2", heading);
    const eyebrow = $(".eyebrow", heading);
    const eyebrowText = text(eyebrow);
    const split = SplitText.create(h2, { type: "chars", aria: "auto" });
    gsap.set(heading, { "--draw": 0 });
    gsap.set(split.chars, { opacity: 0, yPercent: 60 });
    gsap.set([eyebrow, $(".section-note", heading)], { opacity: 0 });

    ScrollTrigger.create({
      trigger: heading,
      start: "top 85%",
      once: true,
      onEnter: () => {
        gsap
          .timeline({ defaults: { ease: "expo.out" }, onComplete: () => split.revert() })
          .to(heading, { "--draw": 1, duration: 1.4, ease: "power3.inOut" }, 0)
          .call(() => (eyebrow.textContent = ""), null, 0)
          .set(eyebrow, { opacity: 1 }, 0)
          .to(eyebrow, { duration: 0.7, ease: "none", scrambleText: { text: eyebrowText, chars: GLYPHS, revealDelay: 0.2 } }, 0)
          .to(split.chars, { opacity: 1, yPercent: 0, duration: 0.8, stagger: 0.035 }, 0.1)
          .to($(".section-note", heading), { opacity: 1, duration: 0.8 }, 0.5);
      },
    });
  }

  const groups = $$(".link-group");
  groups.forEach((group) => {
    gsap.set(group, { opacity: 0, y: 70, rotationX: 12, transformPerspective: 1000 });
    gsap.set($$("li", group), { opacity: 0, x: -24 });
  });

  const reveal = (group, delay = 0) => {
    if (group.dataset.revealed) return;
    group.dataset.revealed = "1";
    const h3 = $("h3", group);
    const label = text(h3);
    gsap
      .timeline({ delay, defaults: { ease: "expo.out" } })
      .to(group, { opacity: 1, y: 0, rotationX: 0, duration: 1.1 }, 0)
      .call(() => (h3.textContent = ""), null, 0.1)
      .to(h3, { duration: 0.7, ease: "none", scrambleText: { text: label, chars: GLYPHS, revealDelay: 0.25 } }, 0.1)
      .to($$("li", group), { opacity: 1, x: 0, duration: 0.7, stagger: 0.06 }, 0.25);
  };

  ScrollTrigger.batch(groups, {
    start: "top 90%",
    once: true,
    onEnter: (batch) => batch.forEach((group, i) => reveal(group, i * 0.12)),
  });
  // Keyboard users tabbing ahead of the scroll position shouldn't land on invisible links.
  groups.forEach((group) => group.addEventListener("focusin", () => reveal(group), { once: true }));

  gsap.from("#footer > span", {
    opacity: 0,
    y: 20,
    stagger: 0.12,
    duration: 0.9,
    ease: "expo.out",
    scrollTrigger: { trigger: "#footer", start: "top 98%", once: true },
  });

  gsap.matchMedia().add("(min-width: 761px)", () => {
    const scrub = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
    gsap.to(".profile", { yPercent: -14, ease: "none", scrollTrigger: scrub });
    gsap.to("#bio", { yPercent: -5, ease: "none", scrollTrigger: { ...scrub } });
  });
}

/* ----------------------------------------------------------- interaction */

function spotlight(el) {
  el.addEventListener("pointermove", (event) => {
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--my", `${event.clientY - rect.top}px`);
  });
}

function tilt(el, max) {
  gsap.set(el, { transformPerspective: 1000 });
  const rx = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3" });
  const ry = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3" });
  el.addEventListener("pointermove", (event) => {
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rx(-py * max);
    ry(px * max);
  });
  el.addEventListener("pointerleave", () => {
    rx(0);
    ry(0);
  });
}

function interactions() {
  const panels = [$(".profile"), $("#bio"), ...$$(".link-group")].filter(Boolean);
  panels.forEach(spotlight);

  if (!finePointer) return;

  tilt($(".profile"), 10);
  tilt($("#bio"), 3);
  $$(".link-group").forEach((group) => tilt(group, 5));

  $$(".link-group a").forEach((link) => {
    const label = link.textContent;
    const final = text(link);
    link.addEventListener("pointerenter", () => {
      gsap.to(link, {
        duration: 0.5,
        overwrite: true,
        scrambleText: { text: final, chars: GLYPHS, revealDelay: 0.08, speed: 1 },
        onComplete: () => (link.textContent = label),
      });
    });
  });
}

function sceneAccents() {
  $$(".link-group").forEach((group) => {
    const on = () => scene?.setAccent(getComputedStyle(group).getPropertyValue("--c").trim());
    const off = () => scene?.setAccent(null);
    group.addEventListener("pointerenter", on);
    group.addEventListener("pointerleave", off);
    group.addEventListener("focusin", on);
    group.addEventListener("focusout", off);
  });
}

function cursor() {
  const ring = document.createElement("div");
  ring.className = "cursor";
  ring.setAttribute("aria-hidden", "true");
  ring.innerHTML = '<div class="cursor__ring"></div>';
  const dot = document.createElement("div");
  dot.className = "cursor-dot";
  dot.setAttribute("aria-hidden", "true");
  document.body.append(ring, dot);

  const ringX = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power3" });
  const ringY = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power3" });
  const dotX = gsap.quickSetter(dot, "x", "px");
  const dotY = gsap.quickSetter(dot, "y", "px");

  const show = (visible) => [ring, dot].forEach((el) => el.classList.toggle("is-visible", visible));

  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return;
      ringX(event.clientX);
      ringY(event.clientY);
      dotX(event.clientX);
      dotY(event.clientY);
      show(true);
    },
    { passive: true }
  );
  document.documentElement.addEventListener("pointerleave", () => show(false));
  document.addEventListener("pointerover", (event) => {
    ring.classList.toggle("is-hover", Boolean(event.target.closest?.("a, button")));
  });
}

/* ------------------------------------------------------------------ init */

async function fontsReady() {
  if (!document.fonts?.ready) return;
  await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))]);
}

async function init() {
  clearTimeout(window.__animFallback);
  const pending = root.classList.contains("anim-pending");

  loadScene();
  initProgress();

  if (reduceMotion) {
    root.classList.remove("anim-pending");
    $$(".link-group").forEach(spotlight);
    sceneAccents();
    return;
  }

  initSmoothScroll();
  if (finePointer) cursor();

  try {
    if (pending && shouldBoot()) {
      await Promise.all([runBoot(), fontsReady()]);
    } else {
      await fontsReady();
    }
    if (pending) intro();
    scrollReveals();
    interactions();
    sceneAccents();
    glitchLoop();
    ScrollTrigger.refresh();
  } catch (error) {
    console.warn("Animation setup failed; showing the static page.", error);
    gsap.set(".site-header, main *", { clearProps: "opacity,transform,visibility" });
  } finally {
    root.classList.remove("anim-pending");
  }
}

init();
