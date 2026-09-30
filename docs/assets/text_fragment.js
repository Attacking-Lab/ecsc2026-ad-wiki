/*
 * Makes the changelog's text-fragment links behave: a real navigation, so the
 * browser applies the fragment at all, plus a highlight that outlives the
 * browser's own, which is dropped on the first interaction.
 *
 * Material's instant navigation calls preventDefault() on internal links and
 * re-applies the hash from JS, which never triggers fragment highlighting. Its
 * click handler sits on document.body, so a capture-phase listener one level
 * up gets to cancel the event first.
 *
 * The searched text cannot be recovered after navigating, since browsers strip
 * the fragment directive from location.hash, so it is handed over in session
 * storage instead.
 */
(function () {
  "use strict";

  var HOLD_MS = 10000;
  var FADE_MS = 700;
  var KEY = "md-text-fragment";
  var MARKER = ":~:text=";

  function searched(href) {
    var at = href.indexOf(MARKER);
    if (at === -1)
      return null;
    try {
      return decodeURIComponent(href.slice(at + MARKER.length).split("&")[0]);
    } catch (err) {
      return null;
    }
  }

  document.addEventListener("click", function (ev) {
    if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)
      return;
    if (!(ev.target instanceof Element))
      return;

    var link = ev.target.closest("a[href*='" + MARKER + "']");
    if (link === null || link.target)
      return;

    var text = searched(link.href);
    if (text === null)
      return;

    try {
      sessionStorage.setItem(KEY, text);
    } catch (err) {
      /* storage is unavailable in private mode - the native highlight remains */
    }

    ev.stopPropagation();
    ev.preventDefault();
    location.assign(link.href);
  }, true);

  function locate(text, root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var needle = text.toLowerCase();
    for (var node = walker.nextNode(); node; node = walker.nextNode()) {
      var at = node.data.toLowerCase().indexOf(needle);
      if (at !== -1)
        return { node: node, at: at };
    }
    return null;
  }

  function unwrap(mark) {
    var parent = mark.parentNode;
    if (parent === null)
      return;
    while (mark.firstChild)
      parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }

  function highlight(text) {
    var hit = locate(text, document.querySelector("article") || document.body);
    if (hit === null)
      return;

    var range = document.createRange();
    range.setStart(hit.node, hit.at);
    range.setEnd(hit.node, hit.at + text.length);

    var mark = document.createElement("mark");
    mark.className = "md-text-fragment";
    try {
      range.surroundContents(mark);
    } catch (err) {
      /* the match got split across tags by an edit - leave the page alone */
      return;
    }

    // Only when the browser did not scroll there itself, e.g. because it has no
    // text fragment support and fell back to the section anchor.
    var box = mark.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight)
      mark.scrollIntoView({ block: "center" });

    window.setTimeout(function () {
      mark.classList.add("md-text-fragment--done");
      window.setTimeout(unwrap, FADE_MS, mark);
    }, HOLD_MS);
  }

  // Drops the fragment directive from the address bar. Browsers have already
  // stripped it from location.hash by this point, so the bare section anchor is
  // what remains. replaceState keeps this off the history stack - navigating to
  // a hash instead (which is what the theme's own setLocationHash does, via a
  // synthesized anchor click) would push an entry and cost the reader a second
  // press of the back button to get back to the changelog.
  function tidy() {
    if (!history.replaceState)
      return;
    try {
      history.replaceState(
        history.state, "", location.pathname + location.search + location.hash
      );
    } catch (err) {
      /* a sandboxed or file:// document - the URL simply keeps the directive */
    }
  }

  var pending = null;
  try {
    pending = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch (err) {
    /* storage is unavailable in private mode */
  }
  if (pending) {
    highlight(pending);
    tidy();
  }
})();
