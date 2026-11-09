// EcoTech · Home (Smart Agriculture) — app.js
// Berisi: (1) adegan sensor di hero, (2) stepper siklus, (3) kuis "jadi pengendali", (4) scroll halus.
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // Pengacak dengan seed tetap: hasil simulasi selalu sama, jadi mudah diuji dan tidak "acak liar".
  function makeRng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Aturan kontrol yang sama dipakai di hero dan di kuis.
  var LOW = 40;   // di bawah ini: pompa ON
  var HIGH = 70;  // sama dengan atau di atas ini: pompa OFF

  /* ============================================================
     1. Adegan sensor di hero
     ============================================================ */
  function initScene() {
    var scene = document.getElementById("scene");
    if (!scene) return;

    var water = document.getElementById("soil-water");
    var num = document.getElementById("reading-num");
    var statusEl = document.getElementById("scene-status");
    var pumpText = document.getElementById("pump-text");
    var line = document.getElementById("spark-line");
    var dot = document.getElementById("spark-dot");
    var toggle = document.getElementById("scene-toggle");
    var speckles = document.getElementById("speckles");

    var N = 48, W = 240, H = 64;
    var rand = makeRng(20261109);
    var m = 64, pump = false, mode = null, hist = [];
    var running = !reduceMotion;   // pengguna yang minta gerakan dikurangi: mulai dalam keadaan jeda
    var inView = true, timer = null;

    // butiran tanah (dekorasi)
    if (speckles) {
      var r2 = makeRng(7), out = "";
      for (var i = 0; i < 46; i++) {
        var x = (r2() * 470 + 5).toFixed(1), y = (r2() * 160 + 136).toFixed(1), r = (r2() * 1.6 + 1).toFixed(1);
        out += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + (r2() > .5 ? "#16866C" : "#B8D9C0") + '" opacity=".35"/>';
      }
      speckles.innerHTML = out;
    }

    function step() {
      var noise = (rand() - 0.5) * 0.6;
      if (pump) m += 2.2 + noise; else m -= 0.9 + noise * 0.8;
      m = Math.max(4, Math.min(96, m));
      if (m < LOW) pump = true; else if (m >= HIGH) pump = false;
      hist.push(m);
      if (hist.length > N) hist.shift();
    }

    function render() {
      num.textContent = Math.round(m);
      water.style.transform = "scaleY(" + (m / 100).toFixed(3) + ")";
      scene.classList.toggle("pumping", pump);

      var next = pump ? "on" : "off";
      if (next !== mode) {            // teks status hanya berubah saat keputusan berganti
        mode = next;
        pumpText.textContent = pump ? "ON" : "OFF";
        statusEl.textContent = pump
          ? "Pompa menyala. Berhenti saat tanah mencapai " + HIGH + "%."
          : "Pompa mati. Menyala lagi saat tanah di bawah " + LOW + "%.";
      }

      var pts = hist.map(function (v, i) {
        return [(i / (N - 1)) * W, H - (v / 100) * H];
      });
      line.setAttribute("d", pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" "));
      var last = pts[pts.length - 1];
      dot.setAttribute("cx", last[0].toFixed(1));
      dot.setAttribute("cy", last[1].toFixed(1));
    }

    function sync() {
      var should = running && inView && !document.hidden;
      if (should && !timer) timer = setInterval(function () { step(); render(); }, 700);
      if (!should && timer) { clearInterval(timer); timer = null; }
      scene.classList.toggle("paused", !running);
      toggle.textContent = running ? "Jeda simulasi" : "Putar simulasi";
    }

    // riwayat awal: satu siklus penuh supaya grafik langsung terisi
    for (var k = 0; k < N; k++) step();
    pump = false;
    mode = null;

    // satu momen masuk: air naik dari kosong ke nilai awal
    if (!reduceMotion) {
      water.style.transform = "scaleY(0)";
      requestAnimationFrame(function () { requestAnimationFrame(render); });
    }
    render();

    toggle.addEventListener("click", function () { running = !running; sync(); });
    document.addEventListener("visibilitychange", sync);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting; sync();
      }).observe(scene);
    }
    sync();
  }

  /* ============================================================
     2. Stepper siklus
     ============================================================ */
  function initSteps() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.steps [role="tab"]'));
    if (!tabs.length) return;
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });

    function select(i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }

    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i, false); });
      t.addEventListener("keydown", function (e) {
        var n = tabs.length, k = e.key;
        if (k === "ArrowRight" || k === "ArrowDown") { e.preventDefault(); select((i + 1) % n, true); }
        else if (k === "ArrowLeft" || k === "ArrowUp") { e.preventDefault(); select((i - 1 + n) % n, true); }
        else if (k === "Home") { e.preventDefault(); select(0, true); }
        else if (k === "End") { e.preventDefault(); select(n - 1, true); }
      });
    });
    select(0, false);
  }

  /* ============================================================
     3. Kuis: jadi pengendali pompa
     ============================================================ */
  function initQuiz() {
    var body = document.getElementById("q-body");
    if (!body) return;

    var QUESTIONS = [
      { m: 28, pump: false, answer: true,
        why: "28% ada di bawah batas bawah 40%. Tanah terlalu kering, jadi pompa harus menyala." },
      { m: 55, pump: true, answer: true,
        why: "55% ada di antara dua batas, jadi pompa dibiarkan seperti semula. Ia tetap menyala sampai tanah mencapai 70%." },
      { m: 72, pump: true, answer: false,
        why: "72% sudah melewati batas atas 70%. Tanah cukup basah, pompa dimatikan." },
      { m: 55, pump: false, answer: false,
        why: "Angkanya sama dengan soal 2, tetapi pompa sedang mati dan tetap mati sampai tanah turun di bawah 40%. Itulah gunanya dua batas: pompa tidak hidup-mati terus di sekitar satu angka." }
    ];

    var finalEl = document.getElementById("q-final");
    var countEl = document.getElementById("q-count");
    var textEl = document.getElementById("q-text");
    var dotEl = document.getElementById("g-dot");
    var feedback = document.getElementById("feedback");
    var nextBtn = document.getElementById("q-next");
    var retryBtn = document.getElementById("q-retry");
    var scoreEl = document.getElementById("q-score");
    var scoreMsg = document.getElementById("q-score-msg");
    var btnOn = document.getElementById("a-on");
    var btnOff = document.getElementById("a-off");

    var i = 0, score = 0, answered = false;

    function show() {
      var q = QUESTIONS[i];
      answered = false;
      countEl.textContent = "Soal " + (i + 1) + " dari " + QUESTIONS.length;
      textEl.innerHTML = "Sensor membaca <strong>" + q.m + "%</strong>. Pompa sedang <strong>" + (q.pump ? "menyala" : "mati") + "</strong>.";
      dotEl.style.left = q.m + "%";
      feedback.innerHTML = "";
      nextBtn.hidden = true;
      [btnOn, btnOff].forEach(function (b) { b.disabled = false; b.classList.remove("right", "wrong"); });
      nextBtn.textContent = i === QUESTIONS.length - 1 ? "Lihat skor" : "Soal berikutnya";
    }

    function answer(choice) {
      if (answered) return;
      answered = true;
      var q = QUESTIONS[i];
      var ok = choice === q.answer;
      if (ok) score++;
      btnOn.disabled = btnOff.disabled = true;
      (q.answer ? btnOn : btnOff).classList.add("right");
      if (!ok) (choice ? btnOn : btnOff).classList.add("wrong");
      feedback.innerHTML = "<strong>" + (ok ? "Tepat." : "Belum tepat.") + "</strong> " + q.why;
      nextBtn.hidden = false;
      nextBtn.focus();
    }

    function finish() {
      body.hidden = true;
      finalEl.hidden = false;
      scoreEl.textContent = "Skor: " + score + " dari " + QUESTIONS.length;
      scoreMsg.textContent = score === QUESTIONS.length
        ? "Kamu sudah berpikir seperti pengendali irigasi otomatis. Di halaman Smart Irrigation, aturan yang sama kamu jalankan sendiri dengan slider."
        : "Kunci aturannya ada di zona tengah: antara 40% dan 70%, pompa tidak berubah. Ulangi soalnya dan perhatikan keadaan pompa sebelumnya.";
      scoreEl.setAttribute("tabindex", "-1");
      scoreEl.focus();
    }

    btnOn.addEventListener("click", function () { answer(true); });
    btnOff.addEventListener("click", function () { answer(false); });
    nextBtn.addEventListener("click", function () {
      if (i === QUESTIONS.length - 1) { finish(); return; }
      i++; show();
      textEl.setAttribute("tabindex", "-1"); textEl.focus();
    });
    retryBtn.addEventListener("click", function () {
      i = 0; score = 0;
      finalEl.hidden = true; body.hidden = false;
      show();
      textEl.setAttribute("tabindex", "-1"); textEl.focus();
    });

    show();
  }

  /* ============================================================
     4. Scroll halus untuk tautan dalam halaman (tanpa mengubah hash di iframe)
     ============================================================ */
  function initScroll() {
    Array.prototype.forEach.call(document.querySelectorAll("a[data-scroll]"), function (a) {
      a.addEventListener("click", function (e) {
        var t = document.getElementById(a.getAttribute("href").slice(1));
        if (!t) return;
        e.preventDefault();
        t.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        t.setAttribute("tabindex", "-1");
        t.focus({ preventScroll: true });
      });
    });
  }

  initScene();
  initSteps();
  initQuiz();
  initScroll();
})();
