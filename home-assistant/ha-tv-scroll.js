/* Home Assistant TV Scroll Helper v1.1.0
 * Optional Home Assistant frontend extra_module_url resource for LG webOS.
 * Runs on LG webOS only and changes no configuration or authentication data.
 * No external dependencies, no network calls.
 */
(function () {
  'use strict';

  // LG uses "Web0S" (with the digit zero) in WebAppManager user agents.
  var isWebOS = /Web0S|webOS|LG SmartTV/i.test(navigator.userAgent);
  if (!isWebOS || window.__homeAssistantTvScrollV1) return;
  window.__homeAssistantTvScrollV1 = true;

  var SCROLL_STEP = 410;
  var MAX_SCAN = 2400;
  var lastScroller = null;
  var host = null;

  function isElement(element) {
    return element && element.nodeType === 1;
  }

  function isVisible(element) {
    if (!isElement(element) || !element.getBoundingClientRect) return false;
    var rect = element.getBoundingClientRect();
    return rect.width > 25 && rect.height > 25 &&
      rect.bottom > 0 && rect.top < window.innerHeight &&
      rect.right > 0 && rect.left < window.innerWidth;
  }

  function canScroll(element, direction) {
    if (!isElement(element) || !isVisible(element)) return false;
    var maximum = element.scrollHeight - element.clientHeight;
    if (maximum < 10) return false;
    var scrollable = element === document.scrollingElement;
    if (!scrollable) {
      var overflow = window.getComputedStyle(element).overflowY;
      scrollable = /^(auto|scroll|overlay)$/i.test(overflow);
    }
    if (!scrollable) return false;
    return direction > 0 ? element.scrollTop < maximum - 2 : element.scrollTop > 2;
  }

  function eventPath(event) {
    if (event && event.composedPath) return event.composedPath();
    var items = [];
    var current = event && event.target;
    while (current) {
      items.push(current);
      current = current.parentNode || current.host;
    }
    return items;
  }

  function hasInteractiveAncestor(event) {
    var path = eventPath(event);
    for (var i = 0; i < path.length; i++) {
      var node = path[i];
      if (!isElement(node)) continue;
      var tag = (node.localName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' ||
          node.isContentEditable || node.getAttribute('role') === 'slider' ||
          tag === 'ha-slider' || tag === 'mwc-slider') return true;
    }
    return false;
  }

  function isMapOrSliderEvent(event) {
    var path = eventPath(event);
    for (var i = 0; i < path.length; i++) {
      var node = path[i];
      if (!isElement(node)) continue;
      var tag = (node.localName || '').toLowerCase();
      var className = typeof node.className === 'string' ? node.className : '';
      // Don't steal wheel zoom/adjustment from maps or slider controls.
      if (/^(ha-map|hui-map-card|leaflet-container|ha-slider|mwc-slider|input|textarea)$/.test(tag) ||
          /(^|\s)(leaflet-container|maplibregl-map)(\s|$)/.test(className) ||
          node.getAttribute('role') === 'slider') return true;
    }
    return false;
  }

  function fromPath(event, direction) {
    var path = eventPath(event);
    for (var i = 0; i < path.length; i++) {
      if (canScroll(path[i], direction)) return path[i];
    }
    return null;
  }

  // HA uses nested open shadow roots. document.querySelector() alone cannot
  // find a Lovelace/Settings panel's actual scrolling container.
  function findMainScroller(direction) {
    if (canScroll(lastScroller, direction)) return lastScroller;
    var queue = [document];
    var count = 0;
    var best = null;
    var bestScore = -Infinity;
    while (queue.length && count < MAX_SCAN) {
      var root = queue.shift();
      var nodes = root.children || [];
      for (var i = 0; i < nodes.length && count < MAX_SCAN; i++) {
        var node = nodes[i];
        count++;
        if (canScroll(node, direction)) {
          var rect = node.getBoundingClientRect();
          var visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(0, rect.top);
          var visibleWidth = Math.min(rect.right, window.innerWidth) - Math.max(0, rect.left);
          // Prefer large central panels over small cards, but favor a scrollable dialog.
          var score = visibleWidth * visibleHeight;
          if (/dialog/i.test(node.localName || '') || node.getAttribute('role') === 'dialog') score *= 3;
          if (score > bestScore) { best = node; bestScore = score; }
        }
        // Breadth-first scanning avoids deep DOM recursion / stack overflow.
        if (node.shadowRoot) queue.push(node.shadowRoot);
        if (node.children && node.children.length) queue.push(node);
      }
    }
    lastScroller = best;
    return best;
  }

  function scrollBy(delta, event) {
    var direction = delta >= 0 ? 1 : -1;
    var el = event ? fromPath(event, direction) : null;
    if (!el) el = findMainScroller(direction);
    if (!el) return false;
    var maximum = el.scrollHeight - el.clientHeight;
    var target = Math.max(0, Math.min(maximum, el.scrollTop + delta));
    if (Math.abs(target - el.scrollTop) < 1) return false;
    // scrollTop is intentionally synchronous; webOS rendering controls compositing.
    el.scrollTop = target;
    lastScroller = el;
    return true;
  }

  function wheelHandler(event) {
    if (event.ctrlKey || isMapOrSliderEvent(event) || !event.deltaY) return;
    // Magic Remote wheel events can be small; normalize line/page units and notches.
    var raw = event.deltaY * (event.deltaMode === 1 ? 32 : (event.deltaMode === 2 ? window.innerHeight : 1));
    var delta = (raw < 0 ? -1 : 1) * Math.min(800, Math.max(120, Math.abs(raw)));
    if (scrollBy(delta, event)) event.preventDefault();
  }

  function focusedControl() {
    var el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    if (!el || el === document.body || el === document.documentElement ||
        el.localName === 'home-assistant') return false;
    var tag = (el.localName || '').toLowerCase();
    return /^(input|textarea|select|button|a)$/.test(tag) ||
      el.isContentEditable || /^(button|slider|textbox|combobox|menuitem|tab)$/.test(el.getAttribute('role') || '');
  }

  function keyHandler(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
        hasInteractiveAncestor(event)) return;
    var code = event.keyCode;
    var key = event.key;
    var delta = 0;
    // Keep keyboard focus navigation functional on buttons and controls.
    var plainFocus = !focusedControl();
    if ((key === 'ArrowDown' || code === 40) && plainFocus) delta = SCROLL_STEP * 0.65;
    if ((key === 'ArrowUp' || code === 38) && plainFocus) delta = -SCROLL_STEP * 0.65;
    if (key === 'PageDown' || code === 34) delta = SCROLL_STEP * 1.6;
    if (key === 'PageUp' || code === 33) delta = -SCROLL_STEP * 1.6;
    if (delta && scrollBy(delta, event)) event.preventDefault();
  }

  function createControls() {
    if (host || !document.body || !document.createElement) return;
    host = document.createElement('div');
    host.id = 'ha-tv-scroll-controls';
    host.setAttribute('aria-label', 'TV page scrolling controls');
    // A small always-visible fallback for cases where the LG wheel event never reaches HA.
    host.style.cssText = 'position:fixed;right:12px;bottom:90px;z-index:2147483646;pointer-events:auto;';
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    root.innerHTML = '<style>' +
      '.controls{display:flex;flex-direction:column;gap:7px;opacity:.58;transition:opacity .15s ease}' +
      '.controls:hover,.controls:focus-within{opacity:1}' +
      'button{width:64px;height:58px;border:1px solid #7ca6c0;border-radius:11px;' +
      'background:#102535;color:white;font:700 17px/1 Arial,sans-serif;cursor:pointer;' +
      'box-shadow:0 2px 12px rgba(0,0,0,.25)}' +
      'button:focus{outline:3px solid #00afff;outline-offset:2px}' +
      '</style>' +
      '<div class="controls"><button id="scroll-up" type="button" aria-label="Scroll up">Up</button>' +
      '<button id="scroll-down" type="button" aria-label="Scroll down">Down</button></div>';
    root.querySelector('#scroll-up').addEventListener('click', function (event) {
      event.preventDefault(); event.stopPropagation(); scrollBy(-SCROLL_STEP);
    });
    root.querySelector('#scroll-down').addEventListener('click', function (event) {
      event.preventDefault(); event.stopPropagation(); scrollBy(SCROLL_STEP);
    });
    document.body.appendChild(host);
  }

  window.addEventListener('wheel', wheelHandler, { capture: true, passive: false });
  window.addEventListener('keydown', keyHandler, true);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createControls, { once: true });
  } else {
    createControls();
  }
  // Manual diagnostics on the TV via remote DevTools.
  window.__haTvScroll = { scrollBy: scrollBy, findScroller: findMainScroller };
  console.info('[Home Assistant TV scroll] Ready for LG webOS');
}());
