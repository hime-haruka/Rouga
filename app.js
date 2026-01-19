/* =========================================================
   App Namespace (전역 충돌 방지)
========================================================= */
const App = (() => {
  /* =========================
     Config
  ========================= */
  const CONFIG = {
    slider: {
      autoMs: 4500,
    },
  };

  /* =========================
     Utils
  ========================= */
  function qs(id) {
    return document.getElementById(id);
  }

  function showError(id, message) {
    const el = qs(id);
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
  }

  function hideError(id) {
    const el = qs(id);
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
  }

  /* =========================
     Image URL Normalize
  ========================= */
  function normalizeDriveImageUrl(url) {
    if (!url) return "";
    if (url.includes("lh3.googleusercontent.com")) return url.trim();

    const m = url.match(/\/file\/d\/([^/]+)/);
    if (m && m[1]) return `https://lh3.googleusercontent.com/d/${m[1]}`;

    return url.trim();
  }

  /* =========================
     CSV Parser
  ========================= */
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      const next = s[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && c === ",") {
        row.push(cell);
        cell = "";
        continue;
      }

      if (!inQuotes && c === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }

      cell += c;
    }

    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }

    const headers = (rows[0] || []).map(h => h.trim());
    const out = [];

    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      if (!cols || cols.every(v => String(v ?? "").trim() === "")) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = String(cols[idx] ?? "").trim();
      });
      out.push(obj);
    }
    return out;
  }

  async function fetchCSV(url) {
    if (!url) throw new Error("CSV URL이 비어 있습니다.");
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV 로딩 실패 (HTTP ${res.status})`);
    return parseCSV(await res.text());
  }

  /* =========================================================
     Slider Section (독립 모듈)
  ========================================================= */
  function createSliderSection(options) {
    const {
      csvUrl,
      sectionKey,
      trackId,
      dotsId,
      prevId,
      nextId,
      errorId,
    } = options;

    let slides = [];
    let idx = 0;
    let timer = null;

    function update() {
      const track = qs(trackId);
      if (!track) return;
      track.style.transform = `translateX(${-idx * 100}%)`;

      document.querySelectorAll(`#${dotsId} .dot`).forEach((d, i) => {
        d.classList.toggle("isActive", i === idx);
      });
    }

    function restartAuto() {
      if (timer) clearInterval(timer);
      if (slides.length >= 2) {
        timer = setInterval(() => go(idx + 1), CONFIG.slider.autoMs);
      }
    }

    function go(nextIdx) {
      if (!slides.length) return;
      idx = (nextIdx + slides.length) % slides.length;
      update();
      restartAuto();
    }

    function render() {
      const track = qs(trackId);
      const dots = qs(dotsId);
      if (!track || !dots) return;

      track.innerHTML = "";
      dots.innerHTML = "";

      slides.forEach((s, i) => {
        const slide = document.createElement("div");
        slide.className = "slide";

        const img = document.createElement("img");
        img.src = s.image;
        img.alt = s.alt || "";
        img.loading = "lazy";
        img.decoding = "async";

        slide.appendChild(img);
        track.appendChild(slide);

        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "dot" + (i === idx ? " isActive" : "");
        dot.addEventListener("click", () => go(i));
        dots.appendChild(dot);
      });

      update();
      restartAuto();
    }

    async function init() {
      try {
        hideError(errorId);

        const rows = await fetchCSV(csvUrl);
        slides = rows
          .filter(r => (r.section || "") === sectionKey)
          .map(r => ({
            order: Number(r.order || 0),
            image: normalizeDriveImageUrl(r.image),
            alt: r.alt,
          }))
          .filter(s => s.image)
          .sort((a, b) => a.order - b.order);

        if (!slides.length) throw new Error("슬라이드 데이터가 없습니다.");

        idx = 0;
        render();

        qs(prevId)?.addEventListener("click", () => go(idx - 1));
        qs(nextId)?.addEventListener("click", () => go(idx + 1));
      } catch (err) {
        console.error(err);
        showError(errorId, err.message);
      }
    }

    return { init };
  }

  /* =========================================================
     Notice Section (작업현황 + 필독사항 + 환불정책)
     - notice_items 탭에서 REQUIRED/type 컬럼을 삭제한 상태에 맞춤
     - items는 sectionKey 매칭 후 order 순으로 text 전부 출력
  ========================================================= */
  function createNoticeSection(options) {
    const {
      sectionKey,
      statusCsvUrl,
      itemsCsvUrl,
      refundCsvUrl,
      statusRootId,
      itemsRootId,
      refundRootId,
      errorId,
    } = options;

    function slotClass(v) {
      const s = String(v || "").trim().toUpperCase();
      if (s === "CLOSED" || s === "X" || s === "●" || s === "FULL") return "closed";
      return "open";
    }
    function slotSymbol(cls) {
    return cls === "closed" ? "♥" : "●";
    }


    function renderStatus(rows) {
      const root = qs(statusRootId);
      if (!root) return;

      const data = rows
        .filter(r => (r.section || "") === sectionKey)
        .map(r => ({
          month: (r.month || "").trim(), // 예: 2026-01
          slot1: slotClass(r.slot1),
          slot2: slotClass(r.slot2),
          note: (r.note || "").trim(),
        }))
        .filter(r => r.month)
        .sort((a, b) => a.month.localeCompare(b.month));

      root.innerHTML = "";

      data.forEach(r => {
        const row = document.createElement("div");
        row.className = "statusRow";

        const month = document.createElement("div");
        month.className = "statusMonth";
        month.textContent = r.month;

        const slots = document.createElement("div");
        slots.className = "statusSlots";

        const d1 = document.createElement("span");
        d1.className = `slotDot ${r.slot1}`;
        d1.textContent = slotSymbol(r.slot1);

        const d2 = document.createElement("span");
        d2.className = `slotDot ${r.slot2}`;
        d2.textContent = slotSymbol(r.slot2);

        slots.appendChild(d1);
        slots.appendChild(d2);

        if (r.note) {
          const note = document.createElement("span");
          note.className = "statusNote";
          note.textContent = r.note;
          slots.appendChild(note);
        }

        row.appendChild(month);
        row.appendChild(slots);
        root.appendChild(row);
      });
    }

    function renderItems(rows) {
      const root = qs(itemsRootId);
      if (!root) return;

      // REQUIRED/type 컬럼 삭제 반영:
      // order/text(+content fallback)만으로 전부 출력
      const data = rows
        .filter(r => (r.section || "") === sectionKey)
        .map(r => ({
          order: Number(r.order || 0),
          text: (r.text || r.content || r.item || "").trim(),
        }))
        .filter(r => r.text)
        .sort((a, b) => a.order - b.order);

      root.innerHTML = "";
      data.forEach(item => {
        const li = document.createElement("li");
        li.innerHTML = item.text;
        root.appendChild(li);
      });
    }

    function renderRefund(rows) {
      const root = qs(refundRootId);
      if (!root) return;

      const data = rows
        .filter(r => (r.section || "") === sectionKey)
        .map(r => ({
          order: Number(r.order || 0),
          stage: (r.stage || r.title || "").trim(),
          refund: (r.refund || r.value || "").trim(),
        }))
        .filter(r => r.stage && r.refund)
        .sort((a, b) => a.order - b.order);

      root.innerHTML = "";
      data.forEach(item => {
        const row = document.createElement("div");
        row.className = "refundRow";

        const stage = document.createElement("div");
        stage.className = "refundStage";
        stage.textContent = item.stage;

        const value = document.createElement("div");
        value.className = "refundValue";
        value.textContent = item.refund;

        row.appendChild(stage);
        row.appendChild(value);
        root.appendChild(row);
      });
    }

    async function init() {
      try {
        hideError(errorId);

        const [statusRows, itemsRows, refundRows] = await Promise.all([
          fetchCSV(statusCsvUrl),
          fetchCSV(itemsCsvUrl),
          fetchCSV(refundCsvUrl),
        ]);

        renderStatus(statusRows);
        renderItems(itemsRows);
        renderRefund(refundRows);
      } catch (err) {
        console.error(err);
        showError(errorId, err.message || "공지사항 섹션 로딩 오류");
      }
    }

    return { init };
  }

  /* =========================================================
     Public API
  ========================================================= */
  return {
    createSliderSection,
    createNoticeSection,
  };
})();





/* =========================================================
   Init
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const commissionSlider = App.createSliderSection({
    csvUrl:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZmmLJQtCd2PCqSggP-GtU7622YuIMcVKC8eeUhUVer80YX8ZkRo00NpCAHrhB3ig6LJo9t1ueNu0s/pub?output=csv",
    sectionKey: "commission_summary",
    trackId: "track",
    dotsId: "dots",
    prevId: "prev",
    nextId: "next",
    errorId: "error",
  });
  commissionSlider.init();

  const noticeSection = App.createNoticeSection({
    sectionKey: "notice",

    statusCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZmmLJQtCd2PCqSggP-GtU7622YuIMcVKC8eeUhUVer80YX8ZkRo00NpCAHrhB3ig6LJo9t1ueNu0s/pub?gid=1856594490&single=true&output=csv",
    itemsCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZmmLJQtCd2PCqSggP-GtU7622YuIMcVKC8eeUhUVer80YX8ZkRo00NpCAHrhB3ig6LJo9t1ueNu0s/pub?gid=950713021&single=true&output=csv",
    refundCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZmmLJQtCd2PCqSggP-GtU7622YuIMcVKC8eeUhUVer80YX8ZkRo00NpCAHrhB3ig6LJo9t1ueNu0s/pub?gid=165899726&single=true&output=csv",

    statusRootId: "statusGrid",
    itemsRootId: "noticeItems",
    refundRootId: "refundTable",
    errorId: "noticeError",
  });
  noticeSection.init();
});
