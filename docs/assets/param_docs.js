/*
 * Annotates the scoring-page code snippets: identifiers that name a known
 * formula parameter get a hover shade and an explanatory tooltip, so readers
 * can decode the functions without leaving the page.
 *
 * Annotations land only at declaration sites: function parameters, `for` loop
 * variables (including tuple unpack), and statement-level assignments.
 */
(function () {
  "use strict";

  // Entries are looked up as `funcname.param` first, then as bare `param`, so
  // a variable whose meaning shifts between functions can be split across
  // scoped keys while shared names stay in one place.
  var GLOSSARY = {
    solves: "Number of teams that captured this flag (or solved this challenge).",
    teams: "Total number of teams in the contest, including the NOP team.",
    max_points: "Challenge value when only a single team solves it.",
    "defense_points_attack.max_points": "Peak DEF points for this attack, earned if the flag stays retrievable for every round of its validity window.",
    min_points: "Challenge value when every team solves it.",
    alpha: "Curve steepness: smaller values make the value drop faster over the first few solves.",
    "attack_points_capture.captures": "Number of teams that captured this specific flag.",
    "attack_points_flagstore.captures": "Number of attackers who stole this flag.",
    victims: "Distinct teams this attacker stole flags from in this flag store this round (never itself or the NOP team).",
    "defense_points_flagstore.victims": "Distinct teams this attacker stole flags from in this flag store this round (never NOP team).",
    attackers: "Teams that stole at least one flag from this flag store this round. A team becomes an attacker the moment it captures any flag that isn't its own or the NOP team's.",
    max_victims: "The most teams an attacker could have exploited.",
    put_round: "Round in which the flag was deployed.",
    live_round: "Round up to which points are being computed.",
    max_round: "Last round the flag value still changes.",
    flag_rounds_valid: "Number of rounds a flag stays valid: 5, the round it is placed plus the 4 rounds after it.",
    check_round: "A specific round number to check flag / service state in.",
    team: "The team whose points are being computed.",
    attacker: "Team currently being scored as an exploiter of this flag store.",
    service: "Name of the service the flag store belongs to.",
    flagstore: "Index of the flag store within its service.",
    flag: "Identifier of a specific captured flag.",
    stealers: "Number of teams that captured this specific flag.",
    flag_ok: "Predicate: was this flag retrievable and its service healthy in the given round?",
    rounds_retrievable: "Rounds in the validity window where this flag was retrievable and its service healthy.",
    flags_live: "Rounds in the validity window where this flag was retrievable and its service healthy.",
    jeopardy: "Per-team final scores from the Jeopardy CTF.",
    attackdefense: "Per-team final scores from the Attack/Defense CTF.",
    nop: "Score of the NOP team: the baseline earned without attacking or defending.",
    w: "Weight that rescales the A/D scores onto the Jeopardy range before merging."
  };

  var CONSTANTS = { flag_rounds_valid: true };

  function markDef(sp, fn) {
    var name = sp.textContent;
    var desc = (fn && GLOSSARY[fn + "." + name]) || GLOSSARY[name];
    if (!desc || sp.dataset.paramDoc) return;
    sp.dataset.paramDoc = "1";
    sp.classList.add("param-doc");
    sp.title = desc;
  }

  // Annotate only definition sites: function parameters (`def (...)`), `for`
  // loop variables (including tuple unpack), and statement-level assignments.
  function annotateBlock(hl) {
    // Ordered token stream. Pygments can merge punctuation (e.g. "):") into one
    // span, so split punctuation spans per character to track bracket depth.
    var toks = [];
    hl.querySelectorAll("span").forEach(function (sp) {
      if (sp.children.length) return;
      var t = sp.textContent;
      if (!t || !t.trim()) return;
      if (sp.classList.contains("p") && t.length > 1) {
        for (var j = 0; j < t.length; j++) toks.push({ text: t[j], name: false, op: false, kw: false, el: null });
      } else {
        // Treat `nf` (function-definition names) as names so we can grab the
        // enclosing scope after `def`; plain `n` covers regular identifiers.
        var isName = sp.classList.contains("n") || sp.classList.contains("nf");
        toks.push({ text: t, name: isName, op: sp.classList.contains("o"), kw: sp.classList.contains("k"), el: sp });
      }
    });

    var depth = 0, pendingDef = false, inParams = false, paramDepth = 0, expectName = false;
    var pendingFor = false, awaitingFnName = false, currentFn = null;

    for (var i = 0; i < toks.length; i++) {
      var tok = toks[i];
      var text = tok.text;

      if (tok.kw && text === "def") { pendingDef = true; awaitingFnName = true; continue; }
      if (tok.kw && text === "for") { pendingFor = true; continue; }

      // The identifier immediately after `def` names the enclosing scope for
      // any params + assignments that follow, until the next `def`.
      if (awaitingFnName && tok.name) { currentFn = text; awaitingFnName = false; continue; }

      // Module-level constants never have a definition site in the snippets,
      // so annotate them at every use.
      if (tok.name && CONSTANTS[text]) markDef(tok.el, currentFn);

      if (pendingFor) {
        // Pygments classes `in` as `ow` (operator word), not `k` (keyword);
        // match on text alone since `in` is unambiguous while collecting for-vars.
        if (text === "in") { pendingFor = false; continue; }
        if (tok.name) markDef(tok.el, currentFn);
        continue;
      }

      if (text === "(" || text === "[") {
        depth++;
        if (pendingDef && text === "(" && !inParams) {
          inParams = true; paramDepth = depth; expectName = true; pendingDef = false;
        }
        continue;
      }
      if (text === ")" || text === "]") {
        if (inParams && text === ")" && depth === paramDepth) { inParams = false; expectName = false; }
        depth--;
        continue;
      }

      if (inParams && depth === paramDepth) {
        // Top level of the parameter list: names right after `(` or `,`.
        if (text === ",") { expectName = true; continue; }
        if (text === ":" || text === "=") { expectName = false; continue; }
        if (expectName && tok.name) { markDef(tok.el, currentFn); expectName = false; continue; }
        if (tok.name) expectName = false;
        continue;
      }

      // Statement-level assignment target: `name =` (not `==`, not a kwarg).
      if (depth === 0 && tok.name) {
        var next = toks[i + 1];
        if (next && next.text === "=" && next.op) markDef(tok.el, currentFn);
      }
    }
  }

  function annotate(root) {
    root.querySelectorAll(".highlight").forEach(function (hl) {
      if (hl.dataset.paramDocDone) return;
      hl.dataset.paramDocDone = "1";
      annotateBlock(hl);
    });
  }

  if (typeof document$ !== "undefined" && document$.subscribe) {
    document$.subscribe(function () { annotate(document); });
  } else {
    document.addEventListener("DOMContentLoaded", function () { annotate(document); });
  }
})();
