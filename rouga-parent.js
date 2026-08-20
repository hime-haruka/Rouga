(function () {
  'use strict';

  var IFRAME_ORIGIN = 'https://hime-haruka.github.io';
  var IFRAME_PATH = 'hime-haruka.github.io/Rouga';
  var STYLE_ID = 'rouga-artmug-parent-style';
  var lastHeight = 0;

  function getIframe() {
    return document.querySelector(
      'section[name="am-root"] iframe[src*="' + IFRAME_PATH + '"], ' +
      '[name="am-root"] iframe[src*="' + IFRAME_PATH + '"], ' +
      'iframe[src*="' + IFRAME_PATH + '"], ' +
      '#detailViews [name="am-root"] iframe, ' +
      '[name="am-root"] iframe'
    );
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
html,body{
  overflow-x:hidden!important;
}

#detailViews [name="am-root"],
[name="am-root"]{
  text-align:start!important;
  padding:0!important;
  margin:0!important;
  line-height:normal!important;
  overflow:visible!important;
}

#detailViews [name="am-root"] *,
[name="am-root"] *{
  box-sizing:border-box;
}

#detailViews [name="stage"],
[name="stage"]{
  width:100%!important;
  overflow:visible!important;
}

#detailViews [name="am-root"] iframe,
[name="am-root"] iframe{
  display:block!important;
  width:100%!important;
  max-width:1180px!important;
  min-height:760px;
  height:760px;
  margin:0 auto!important;
  border:0!important;
  overflow:hidden!important;
}

.btn_open_btn,
.btn_open,
.btn_close{
  display:none!important;
  visibility:hidden!important;
  pointer-events:none!important;
}
`;
    document.head.appendChild(style);
  }

  function unlockDetail() {
    var box = document.querySelector('.detailinfo');
    if (!box) return;

    box.classList.remove('showstep1');
    box.style.maxHeight = 'none';
    box.style.height = 'auto';
    box.style.overflow = 'visible';

    var content = box.querySelector('.showcontent');
    if (content) {
      content.style.maxHeight = 'none';
      content.style.height = 'auto';
      content.style.overflow = 'visible';
    }
  }

  function removeMoreButtons(root) {
    (root || document)
      .querySelectorAll('.btn_open_btn,.btn_open,.btn_close')
      .forEach(function (el) { el.remove(); });
  }

  function hardBlockMoreButtons() {
    if (window.rougaArtmugHardBlockClicks) return;
    window.rougaArtmugHardBlockClicks = true;

    document.addEventListener('click', function (e) {
      var target = e.target && e.target.closest
        ? e.target.closest('.btn_open_btn,.btn_open,.btn_close')
        : null;

      if (!target) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }, true);
  }

  function resizeIframe(height) {
    var iframe = getIframe();
    if (!iframe) return;

    var nextHeight = Math.max(760, Math.ceil(Number(height) || 0));
    if (!nextHeight) return;
    if (Math.abs(nextHeight - lastHeight) < 4) return;

    lastHeight = nextHeight;

    iframe.style.height = nextHeight + 'px';
    iframe.style.minHeight = nextHeight + 'px';
    iframe.style.maxHeight = 'none';
    iframe.style.overflow = 'hidden';
    iframe.height = String(nextHeight);
    iframe.setAttribute('height', String(nextHeight));
    iframe.setAttribute('scrolling', 'no');
  }

  function bindMessages() {
    if (window.rougaArtmugMessageBind) return;
    window.rougaArtmugMessageBind = true;

    window.addEventListener('message', function (e) {
      if (e.origin !== IFRAME_ORIGIN) return;

      var iframe = getIframe();
      if (!iframe) return;
      if (iframe.contentWindow && e.source !== iframe.contentWindow) return;

      var data = e.data || {};
      if (data.source !== 'syura-css') return;

      if (data.type === 'SYURA_IFRAME_HEIGHT') {
        resizeIframe(data.height);
      }
    });
  }

  function prepareIframe() {
    var iframe = getIframe();
    if (!iframe) return;

    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.overflow = 'hidden';
    iframe.setAttribute('scrolling', 'no');
  }

  function observePage() {
    if (window.rougaArtmugObserver) return;

    window.rougaArtmugObserver = new MutationObserver(function () {
      removeMoreButtons();
      unlockDetail();
      prepareIframe();
    });

    window.rougaArtmugObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function neutralize() {
    injectStyle();
    removeMoreButtons();
    unlockDetail();
    hardBlockMoreButtons();
    bindMessages();
    prepareIframe();
    observePage();
  }

  if (document.readyState !== 'loading') {
    neutralize();
  } else {
    document.addEventListener('DOMContentLoaded', neutralize);
  }

  setTimeout(neutralize, 300);
  setTimeout(neutralize, 1000);
  setTimeout(neutralize, 2000);
})();
