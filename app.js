const App = (() => {
  const CONFIG = { slider: { autoMs: 4500 } };
  /* ---------- Utils ---------- */
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

  /* ---------- Drive image normalize ---------- */
  function normalizeDriveImageUrl(url) {
    if (!url) return "";
    const u = String(url).trim();
    if (!u) return "";
    if (u.includes("lh3.googleusercontent.com")) return u;

    const m = u.match(/\/file\/d\/([^/]+)/);
    if (m && m[1]) return `https://lh3.googleusercontent.com/d/${m[1]}`;
    return u;
  }

  /* ---------- CSV ---------- */
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

    const headers = (rows[0] || []).map((h) => h.trim());
    const out = [];

    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      if (!cols || cols.every((v) => String(v ?? "").trim() === "")) continue;

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

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* =========================================================
     Slider Section
  ========================================================= */
  function createSliderSection(options) {
    const { csvUrl, sectionKey, trackId, dotsId, prevId, nextId, errorId } = options;

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
      if (slides.length >= 2) timer = setInterval(() => go(idx + 1), CONFIG.slider.autoMs);
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
          .filter((r) => (r.section || "") === sectionKey)
          .map((r) => ({
            order: Number(r.order || 0),
            image: normalizeDriveImageUrl(r.image),
            alt: r.alt,
          }))
          .filter((s) => s.image)
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
     Notice Section
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
        .filter((r) => (r.section || "") === sectionKey)
        .map((r) => ({
          month: (r.month || "").trim(),
          slot1: slotClass(r.slot1),
          slot2: slotClass(r.slot2),
          note: (r.note || "").trim(),
        }))
        .filter((r) => r.month)
        .sort((a, b) => a.month.localeCompare(b.month));

      root.innerHTML = "";

      data.forEach((r) => {
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

      const data = rows
        .filter((r) => (r.section || "") === sectionKey)
        .map((r) => ({
          order: Number(r.order || 0),
          text: (r.text || r.content || r.item || "").trim(),
        }))
        .filter((r) => r.text)
        .sort((a, b) => a.order - b.order);

      root.innerHTML = "";
      data.forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = item.text;
        root.appendChild(li);
      });
    }

    function renderRefund(rows) {
      const root = qs(refundRootId);
      if (!root) return;

      const data = rows
        .filter((r) => (r.section || "") === sectionKey)
        .map((r) => ({
          order: Number(r.order || 0),
          stage: (r.stage || r.title || "").trim(),
          refund: (r.refund || r.value || "").trim(),
        }))
        .filter((r) => r.stage && r.refund)
        .sort((a, b) => a.order - b.order);

      root.innerHTML = "";
      data.forEach((item) => {
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
     Pricing Section
  ========================================================= */
  function createPricingSection(options) {
    const { csvUrl, rootId, errorId } = options;

    const GROUP_META = [
      { key: "rigging", label: "리깅 타입", mode: "cards" },
      { key: "additional", label: "추가 타입", mode: "rows" },
      { key: "asset", label: "에셋", mode: "rows" },
      { key: "option", label: "리깅 추가 옵션", mode: "list" },
      { key: "etc", label: "기타", mode: "list" },
    ];
    const groupIndex = new Map(GROUP_META.map((g, i) => [g.key, i]));

    function toNum(v) {
      const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : null;
    }

    function formatPrice(raw) {
      const v = String(raw ?? "").trim();
      if (!v) return "";
      const n = toNum(v);
      if (n === null) return v;
      return `${n.toLocaleString("ko-KR")}원`;
    }

    function el(tag, className) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      return node;
    }

    function renderGroupTitle(label) {
      const h = el("h3", "pricingGroupTitle");
      h.textContent = label;
      return h;
    }

    function renderRiggingCards(items) {
      const grid = el("div", "pricingCards");

      items.forEach((it) => {
        const card = el("div", "pricingCard");

        const head = el("div", "pricingCardHead");
        const title = el("div", "pricingTitle");
        title.textContent = it.title || "";

        const price = el("div", "pricingPrice");
        price.textContent = formatPrice(it.price);

        head.appendChild(title);
        head.appendChild(price);

        const meta = el("div", "pricingMeta");
        const period = String(it.period || "").trim();
        const rev = String(it.revision || "").trim();

        if (period) {
          const m = el("div", "pricingMetaRow");
          m.innerHTML = `<span class="k">작업 기간</span><span class="v">${escapeHtml(period)}</span>`;
          meta.appendChild(m);
        }
        if (rev) {
          const m = el("div", "pricingMetaRow");
          m.innerHTML = `<span class="v">${escapeHtml(rev)}</span>`;
          meta.appendChild(m);
        }

        const desc = el("div", "pricingDesc");
        desc.textContent = it.desc || "";

        card.appendChild(head);
        if (meta.childNodes.length) card.appendChild(meta);
        if (it.desc) card.appendChild(desc);

        grid.appendChild(card);
      });

      return grid;
    }

    function renderRows(items) {
      const wrap = el("div", "pricingRows");

      items.forEach((it) => {
        const row = el("div", "pricingRow");

        const left = el("div", "pricingRowLeft");
        const t = el("div", "pricingTitle");
        t.textContent = it.title || "";

        const d = el("div", "pricingDesc");
        d.textContent = it.desc || "";

        const sub = [];
        if (it.period) sub.push(`작업 기간: ${it.period}`);
        if (it.revision) sub.push(`수정: ${it.revision}`);
        if (it.usage) sub.push(`사용범위: ${it.usage}`);

        const subEl = el("div", "pricingSub");
        subEl.innerHTML = sub.map((s) => `<div>${escapeHtml(s)}</div>`).join("");

        left.appendChild(t);
        if (it.desc) left.appendChild(d);
        if (sub.length) left.appendChild(subEl);

        const right = el("div", "pricingRowRight");
        const p = el("div", "pricingPrice");
        p.textContent = formatPrice(it.price);
        right.appendChild(p);

        row.appendChild(left);
        row.appendChild(right);
        wrap.appendChild(row);
      });

      return wrap;
    }


  function renderList(items) {
    const ul = el("ul", "pricingList");

    items.forEach((it) => {
      const li = el("li", "pricingListItem");

      const title = it.title || "";
      const price = formatPrice(it.price);

      // 1) 제목/가격 라인
      const main = el("div", "pricingListMain");
      main.innerHTML = `
        <span class="t">${escapeHtml(title)}</span>
        <span class="p">${escapeHtml(price)}</span>
      `.trim();
      li.appendChild(main);

      // 2) desc
      const desc = String(it.desc || "").trim();
      if (desc) {
        const d = el("div", "pricingDesc");
        d.textContent = desc;
        li.appendChild(d);
      }

      // 3) sub(기간/수정/사용범위)
      const sub = [];
      const period = String(it.period || "").trim();
      const rev = String(it.revision || "").trim();
      const usage = String(it.usage || "").trim();

      if (period) sub.push(`작업 기간: ${period}`);
      if (rev) sub.push(`수정: ${rev}`);
      if (usage) sub.push(`사용범위: ${usage}`);

      if (sub.length) {
        const subEl = el("div", "pricingSub");
        subEl.innerHTML = sub.map((s) => `<div>${escapeHtml(s)}</div>`).join("");
        li.appendChild(subEl);
      }

      ul.appendChild(li);
    });

    return ul;
  }


    function normalizeRow(r) {
      const rawGroup = String(r.group || "").trim();

      const groupMap = {
        "리깅 타입": "rigging",
        "애니메이션/메모리얼": "additional",
        "애니메이션 / 메모리얼": "additional",
        "추가 타입": "additional",
        "에셋": "asset",
        "리깅 추가 옵션": "option",
        "기타": "etc",
      };

      const normalized = rawGroup.toLowerCase();

      const group =
        groupMap[rawGroup] ||
        groupMap[normalized] ||
        normalized;

      return {
        group,
        order: Number(r.order || 0),
        title: String(r.title || "").trim(),
        price: String(r.price || "").trim(),
        period: String(r.period || "").trim(),
        revision: String(r.revision || "").trim(),
        desc: String(r.desc || "").trim(),
        usage: String(r.usage || "").trim(),
      };
    }


    async function init() {
      try {
        hideError(errorId);

        const root = qs(rootId);
        if (!root) throw new Error(`가격 섹션 루트(#${rootId})를 찾지 못했습니다.`);

        const rows = await fetchCSV(csvUrl);
        const items = rows
          .map(normalizeRow)
          .filter((it) => it.group && it.title)
          .sort((a, b) => {
            const ga = groupIndex.has(a.group) ? groupIndex.get(a.group) : 999;
            const gb = groupIndex.has(b.group) ? groupIndex.get(b.group) : 999;
            if (ga !== gb) return ga - gb;
            return (a.order || 0) - (b.order || 0);
          });

        if (!items.length) throw new Error("가격 데이터가 없습니다. (group/title 확인)");

        const byGroup = new Map();
        items.forEach((it) => {
          if (!byGroup.has(it.group)) byGroup.set(it.group, []);
          byGroup.get(it.group).push(it);
        });

        root.innerHTML = "";
        GROUP_META.forEach((g) => {
          const list = byGroup.get(g.key);
          if (!list || !list.length) return;

          root.appendChild(renderGroupTitle(g.label));
          if (g.mode === "cards") root.appendChild(renderRiggingCards(list));
          else if (g.mode === "rows") root.appendChild(renderRows(list));
          else root.appendChild(renderList(list));
        });
      } catch (err) {
        console.error(err);
        showError(errorId, err.message || "가격 섹션 로딩 오류");
      }
    }

    return { init };
  }

  /* =========================================================
     Rigging Details Section
  ========================================================= */
  function createRiggingDetailsSection(options) {
    const { csvUrl, rootId, errorId } = options;

    function el(tag, className) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      return node;
    }

    function renderGrid(items) {
      const grid = el("div", "pricingCards");

      items.forEach((it) => {
        const card = el("div", "pricingCard");

        const head = el("div", "pricingCardHead");
        const title = el("div", "pricingTitle");
        title.textContent = it.title || "";
        head.appendChild(title);
        card.appendChild(head);

        if (it.image) {
          const a = document.createElement("a");
          a.href = it.image;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.style.display = "block";

          const img = document.createElement("img");
          img.src = it.image;
          img.alt = it.title || "";
          img.loading = "lazy";
          img.decoding = "async";
          img.style.width = "100%";
          img.style.height = "auto";
          img.style.borderRadius = "14px";
          img.style.border = "1px solid rgba(25,21,26,.10)";
          img.style.background = "rgba(255,255,255,.6)";

          a.appendChild(img);
          card.appendChild(a);
        }

        if (it.desc) {
          const d = el("div", "pricingDesc");
          d.innerHTML = escapeHtml(it.desc);
          card.appendChild(d);
        }

        grid.appendChild(card);
      });

      return grid;
    }

    function normalizeRow(r) {
      return {
        order: Number(r.order || 0),
        title: String(r.title || "").trim(),
        desc: String(r.desc || "").trim(),
        image: normalizeDriveImageUrl(r.image || ""),
      };
    }

    async function init() {
      try {
        hideError(errorId);

        const root = qs(rootId);
        if (!root) throw new Error(`리깅 세부사항 루트(#${rootId})를 찾지 못했습니다.`);

        const rows = await fetchCSV(csvUrl);
        const items = rows
          .map(normalizeRow)
          .filter((it) => it.title)
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        if (!items.length) throw new Error("리깅 세부사항 데이터가 없습니다. (title 확인)");

        root.innerHTML = "";
        root.appendChild(renderGrid(items));
      } catch (err) {
        console.error(err);
        showError(errorId, err.message || "리깅 세부사항 섹션 로딩 오류");
      }
    }

    return { init };
  }

/* =========================================================
   Portfolio Section
========================================================= */
function createPortfolioSection(options) {
  const { csvUrl, rootId, errorId } = options;

  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function getYouTubeId(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) {
        const id = u.pathname.split("/").filter(Boolean)[0];
        return id || "";
      }
      const v = u.searchParams.get("v");
      if (v) return v;

      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];

      return "";
    } catch {
      return "";
    }
  }

  function parseTags(raw) {
    const s = String(raw || "").trim();
    if (!s) return [];

    // #으로 시작하는 덩어리만 추출
    const matches = s.match(/#[^#]+/g);
    if (!matches) return [];

    return matches.map(t => t.trim());
  }

  function normalizeRow(r) {
    return {
      title: String(r.title || "").trim(),
      order: Number(r.order || 0),
      tags: parseTags(r.tags),
      url: String(r.url || "").trim(),
    };
  }

  function renderGrid(items) {
    const grid = el("div", "pricingCards");

    items.forEach((it) => {
      const link = el("a", "pricingCard");
      link.href = it.url || "#";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.style.textDecoration = "none";
      link.style.display = "block";

      const vid = getYouTubeId(it.url);
      if (vid) {
        const thumb = el("div", "portfolioThumb");

        const img = document.createElement("img");
        img.src = `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
        img.alt = it.title || "";
        img.loading = "lazy";
        img.decoding = "async";

        const hint = el("div", "portfolioHint");
        hint.textContent = "유튜브에서 보기";

        thumb.appendChild(img);
        thumb.appendChild(hint);
        link.appendChild(thumb);
      }

      const head = el("div", "pricingCardHead");
      const title = el("div", "pricingTitle");
      title.textContent = it.title || "";
      head.appendChild(title);
      link.appendChild(head);

      if (it.tags && it.tags.length) {
        const tags = el("div", "tags");
        it.tags.forEach((t) => {
          const chip = el("span", "tag");
          chip.textContent = t;
          tags.appendChild(chip);
        });
        tags.style.marginTop = "8px";
        tags.style.flexWrap = "wrap";
        link.appendChild(tags);
      }

      if (!it.url) {
        link.removeAttribute("href");
        link.style.cursor = "default";
        link.style.opacity = "0.7";
      }

      grid.appendChild(link);
    });

    return grid;
  }

  async function init() {
    try {
      hideError(errorId);

      const root = qs(rootId);
      if (!root) throw new Error(`포트폴리오 루트(#${rootId})를 찾지 못했습니다.`);

      const rows = await fetchCSV(csvUrl);
      const items = rows
        .map(normalizeRow)
        .filter((it) => it.title && it.url)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      if (!items.length) throw new Error("포트폴리오 데이터가 없습니다. (title/url 확인)");

      root.innerHTML = "";
      root.appendChild(renderGrid(items));
    } catch (err) {
      console.error(err);
      showError(errorId, err.message || "포트폴리오 섹션 로딩 오류");
    }
  }

  return { init };
}

/* =========================================================
   Collaboration Artists Section
========================================================= */
function createCollabSection(options) {
  const { csvUrl, rootId, errorId } = options;

  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function driveToDirectImageUrl(input) {
    if (!input) return "";

    const s = String(input).trim();

    if (/^https?:\/\/(lh3\.googleusercontent\.com|drive\.google\.com\/uc\?)/.test(s)) {
      return s;
    }

    let m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (!m) m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);

    const id = m && m[1];
    if (!id) return s;

    return `https://lh3.googleusercontent.com/d/${id}`;
  }

  function normalizeRow(r) {
    return {
      title: String(r.title || "").trim(),
      order: Number(r.order || 0),
      desc: String(r.desc || "").trim(),
      image: driveToDirectImageUrl(r.image || ""),
      url: String(r.url || "").trim(),
    };
  }

  function renderGrid(items) {
    const grid = el("div", "pricingCards collabCards");

    items.forEach((it) => {
      const a = document.createElement("a");
      a.href = it.url || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "pricingCard collabCard";
      a.style.textDecoration = "none";

      const thumb = el("div", "collabThumb");
      if (it.image) {
        thumb.style.backgroundImage = `url("${it.image.replaceAll('"', "%22")}")`;
      } else {
        thumb.classList.add("isEmpty");
      }

      const hover = el("div", "collabHover");
      hover.textContent = "작가님 페이지 보러가기";
      thumb.appendChild(hover);

      const body = el("div", "collabBody");

      const head = el("div", "pricingCardHead collabHead");
      const title = el("div", "pricingTitle collabTitle");
      title.textContent = it.title;
      head.appendChild(title);

      const desc = el("div", "pricingDesc collabDesc");
      desc.textContent = it.desc;

      body.appendChild(head);
      if (it.desc) body.appendChild(desc);

      a.appendChild(thumb);
      a.appendChild(body);

      grid.appendChild(a);
    });

    return grid;
  }

  async function init() {
    try {
      hideError(errorId);

      const root = qs(rootId);
      if (!root) throw new Error("협업 작가 루트를 찾지 못했습니다.");

      const rows = await fetchCSV(csvUrl);

      const items = rows
        .map(normalizeRow)
        // title, url은 필수. 이미지는 선택
        .filter((it) => it.title && it.url)
        .sort((a, b) => a.order - b.order);

      if (!items.length) throw new Error("협업 작가 데이터가 없습니다.");

      root.innerHTML = "";
      root.appendChild(renderGrid(items));
    } catch (err) {
      console.error(err);
      showError(errorId, err.message);
    }
  }

  return { init };
}

  return {
    createSliderSection,
    createNoticeSection,
    createPricingSection,
    createRiggingDetailsSection,
    createPortfolioSection,
    createCollabSection,
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
    statusCsvUrl:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZmmLJQtCd2PCqSggP-GtU7622YuIMcVKC8eeUhUVer80YX8ZkRo00NpCAHrhB3ig6LJo9t1ueNu0s/pub?gid=1856594490&single=true&output=csv",
    itemsCsvUrl:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZmmLJQtCd2PCqSggP-GtU7622YuIMcVKC8eeUhUVer80YX8ZkRo00NpCAHrhB3ig6LJo9t1ueNu0s/pub?gid=950713021&single=true&output=csv",
    refundCsvUrl:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZmmLJQtCd2PCqSggP-GtU7622YuIMcVKC8eeUhUVer80YX8ZkRo00NpCAHrhB3ig6LJo9t1ueNu0s/pub?gid=165899726&single=true&output=csv",
    statusRootId: "statusGrid",
    itemsRootId: "noticeItems",
    refundRootId: "refundTable",
    errorId: "noticeError",
  });
  noticeSection.init();

  const pricingSection = App.createPricingSection({
    csvUrl:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZmmLJQtCd2PCqSggP-GtU7622YuIMcVKC8eeUhUVer80YX8ZkRo00NpCAHrhB3ig6LJo9t1ueNu0s/pub?gid=1537584891&single=true&output=csv",
    rootId: "pricingRoot",
    errorId: "pricingError",
  });
  pricingSection.init();

  const riggingDetailsSection = App.createRiggingDetailsSection({
    csvUrl:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZmmLJQtCd2PCqSggP-GtU7622YuIMcVKC8eeUhUVer80YX8ZkRo00NpCAHrhB3ig6LJo9t1ueNu0s/pub?gid=1698335154&single=true&output=csv",
    rootId: "riggingDetailsRoot",
    errorId: "riggingDetailsError",
  });
  riggingDetailsSection.init();

  const portfolioSection = App.createPortfolioSection({
  csvUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZmmLJQtCd2PCqSggP-GtU7622YuIMcVKC8eeUhUVer80YX8ZkRo00NpCAHrhB3ig6LJo9t1ueNu0s/pub?gid=503424250&single=true&output=csv",
  rootId: "portfolioRoot",
  errorId: "portfolioError",
  });
  portfolioSection.init();
  
  const collabSection = App.createCollabSection({
  csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZmmLJQtCd2PCqSggP-GtU7622YuIMcVKC8eeUhUVer80YX8ZkRo00NpCAHrhB3ig6LJo9t1ueNu0s/pub?gid=84449745&single=true&output=csv",
  rootId: "collabRoot",
  errorId: "collabError",
  });
  collabSection.init();
});

  /* =========================================================
     Apply Form
  ========================================================= */
  (() => {
    const form = document.getElementById("applyForm");
    const btnCopy = document.getElementById("applyCopyBtn");
    const btnReset = document.getElementById("applyResetBtn");
    const errBox = document.getElementById("applyError");
    const guide = document.querySelector("#apply .applyGuide");
    const preview = document.getElementById("applyPreview");

    if (!form || !btnCopy || !btnReset) return;

    const showApplyError = (msg) => {
      if (!errBox) return;
      errBox.hidden = false;
      errBox.textContent = msg || "오류가 발생했습니다.";
    };

    const hideApplyError = () => {
      if (!errBox) return;
      errBox.hidden = true;
      errBox.textContent = "";
    };

    const getValue = (name) => {
      const el = form.elements.namedItem(name);
      if (!el) return "";
      if (typeof el.value === "string") return String(el.value || "").trim();
      return "";
    };

    const getCheckedRadio = (name) => {
      const checked = form.querySelector(`input[type="radio"][name="${CSS.escape(name)}"]:checked`);
      return checked ? String(checked.value || "").trim() : "";
    };

    const getCheckedTypes = () => {
      return Array.from(form.querySelectorAll('input[type="checkbox"][name="type"]:checked'))
        .map((x) => String(x.value || "").trim())
        .filter(Boolean);
    };

    const buildCopyText = () => {
      const nickname = getValue("nickname");
      const artistUrl = getValue("artistUrl");
      const streamUrl = getValue("streamUrl");
      const dueDate = getValue("dueDate");

      const processPrivate = getCheckedRadio("processPrivate") || "NO";
      const portfolioPrivate = getCheckedRadio("portfolioPrivate") || "NO";

      const types = getCheckedTypes();
      const options = getValue("options");
      const refs = getValue("refs");

      return [
        `＊ 닉네임 : ${nickname}`,
        `＊ 그림 작가님 주소 : ${artistUrl}`,
        `＊ 방송 주소 : ${streamUrl}`,
        `＊ 수령 희망 날짜 : ${dueDate}`,
        `＊ 작업 과정 비공개 : ${processPrivate}`,
        `＊ 포트폴리오 비공개 : ${portfolioPrivate}`,
        `＊ 신청 타입 : ${types.length ? types.join(" / ") : ""}`,
        `＊ 추가 옵션 / 표정들 : ${options}`,
        `＊ 참고자료 : ${refs}`,
        ``,
        `※ 원본 PSD 파일을 함께 첨부해 주세요!`,
      ].join("\n");
    };

    const refreshPreview = () => {
      const text = buildCopyText();
      if (preview) preview.value = text;
      return text;
    };

    const copyToClipboard = async (text) => {
      // 1) Modern clipboard
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      // 2) Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    };

    if (guide && !guide.textContent.trim()) {
    }

    form.addEventListener("input", () => {
      hideApplyError();
      refreshPreview();
    });
    form.addEventListener("change", () => {
      hideApplyError();
      refreshPreview();
    });

    // 초기화
    btnReset.addEventListener("click", () => {
      hideApplyError();
      form.reset();
      refreshPreview();
    });

    // 복사
    btnCopy.addEventListener("click", async () => {
      hideApplyError();
      const text = refreshPreview();

      try {
        const ok = await copyToClipboard(text);
        if (!ok) throw new Error("클립보드 복사에 실패했습니다.");
        const prev = btnCopy.textContent;
        btnCopy.textContent = "복사 완료!";
        btnCopy.disabled = true;
        setTimeout(() => {
          btnCopy.textContent = prev;
          btnCopy.disabled = false;
        }, 900);
      } catch (e) {
        console.error(e);
        showApplyError("복사에 실패했어요. (브라우저 권한/보안 컨텍스트 확인)");
      }
    });

    refreshPreview();
  })();
