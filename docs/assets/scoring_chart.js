/*
 * Interactive runtime charts for the scoring page (replaces the pre-built
 * scoring_jeopardy.svg). One small SVG engine drives several curves selected
 * by the container's data-scoring-chart attribute:
 *
 *   jeopardy: the raw dynamic-scoring curve
 *   attack:   expected ATK points (estimates the unknown submission counts)
 *   defense:  expected DEF points (estimates the unknown per-round payouts)
 *
 * The viewBox width tracks the container's pixel width (height fixed) so the
 * drawing fills the space at a 1:1 scale with no non-uniform stretching. Each
 * chart exposes its parameters through a collapsible slider panel.
 */
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  // Fixed vertical layout; the plot's right edge X1 is derived per-render.
  var H = 340, X0 = 48, RM = 24, Y0 = 20, Y1 = 298, MIN_W = 360;

  function fmtInt(v) { return String(Math.round(v)); }
  function fmt1(v) { return v.toFixed(1); }
  function fmt2(v) { return v.toFixed(2); }
  function fmt3(v) { return v.toFixed(3); }

  // The dynamic-scoring formula, straight from the simulator (adctf-scoring).
  function dynamic_points(solves, teams, max_points, min_points, alpha) {
    var score_ratio = min_points / max_points;
    var solve_ratio = Math.max(0, solves - 1) / Math.max(1, teams - 1);
    return max_points * Math.pow(score_ratio, Math.pow(solve_ratio, alpha));
  }

  // Smallest "nice" number >= x, for a tidy y-axis top.
  function niceCeil(x) {
    if (!(x > 0)) return 1;
    var base = Math.pow(10, Math.floor(Math.log10(x)));
    var f = x / base;
    var steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < steps.length; i++) {
      if (f <= steps[i] + 1e-9) return steps[i] * base;
    }
    return 10 * base;
  }

  // Jeopardy shape used by the attack/defense estimates (A/D defaults).
  function jeo(x, teams) { return dynamic_points(x, teams, 10, 1, 0.705); }

  var CHARTS = {
    jeopardy: {
      title: "dynamic_points",
      aria: "Challenge value versus number of solving teams",
      xLabel: "solves", yLabel: "points", tipX: "solves", tipY: "points",
      defaults: { teams: 42, max_points: 10, min_points: 1, alpha: 0.705 },
      sliders: [
        { key: "teams",     label: "teams",     min: 2,   max: 100, step: 1,     fmt: fmtInt },
        { key: "max_points", label: "max_points", min: 1,   max: 20, step: 1,     fmt: fmtInt },
        { key: "min_points", label: "min_points", min: 0,   max: 20, step: 0.5,   fmt: fmt1 },
        { key: "alpha",     label: "alpha",     min: 0.1, max: 2,  step: 0.005, fmt: fmt3 }
      ],
      clamp: function (s) { if (s.min_points > s.max_points) s.min_points = s.max_points; },
      xMax: function (s) { return Math.round(s.teams); },
      yMax: function (s) { return s.max_points; },
      compute: function (x, s) { return dynamic_points(x, Math.round(s.teams), s.max_points, s.min_points, s.alpha); }
    },

    // Expected attack points per flag store, mirroring attack_points_flagstore.
    // We don't know how many teams will submit each stolen flag, so we assume
    // every attacker submits it: a flag stolen while `a` teams exploit the
    // store is worth dynamic_points(a, teams), summed over the `victims`
    // captured flags. On top of the per-flag values, the attacker also gets a
    // DEF-bonus equal to defense_points_attack_max(victims, a, teams) — one
    // attacker's share of the peak DEF payout for this flag store. Assumes
    // perfect uptime, so the availability factor equals 1.
    //
    // Two axis modes: either `attackers` drives the x-axis and `victims` sits
    // on the slider, or vice versa. Click the swap-marked slider label to
    // move it onto the axis (the other parameter takes its place as slider).
    attack: {
      title: "attack_points_flagstore",
      yLabel: "ATK points", tipY: "points",
      // Assumed identities: victims count matches the captures set, and every
      // attacker also submits the flag they stole (equating `stealers` to
      // `attackers` in attack_points_flagstore's inner loop).
      note: "len(captured) == victims\ncaptures == attackers\nlive_round = put_round + flag_rounds_valid",
      // Adds a checkbox to swap the plot to the marginal (per-step) rate,
      // shown as absolute values so the drop-off reads left-to-right.
      marginalToggle: true,
      // Subtracts defense_points_attack_max(victims, attackers, teams) from
      // the ATK curve when victims is on the x-axis: the plot then reads as
      // the ATK you keep net of the DEF a victim earns. Mutually exclusive
      // with the marginal toggle.
      attackDefToggle: true,
      defaults: { teams: 42 },
      axes: [
        {
          aria: "Estimated attack points versus number of attacking teams",
          xLabel: "attackers", tipX: "attackers",
          defaults: { victims: 30 },
          sliders: [
            { key: "teams",   label: "teams",   min: 2, max: 42, step: 1, fmt: fmtInt },
            { key: "victims", label: "victims", min: 1, max: 42, step: 1, fmt: fmtInt, nosnap: true, swap: true }
          ],
          clamp: function (s) { var T = Math.round(s.teams); if (s.victims > T - 2) s.victims = Math.max(1, T - 2); },
          xMax: function (s) { return Math.max(1, Math.round(s.teams) - 2); },
          yMax: function (s) {
            var T = Math.round(s.teams), V = Math.round(s.victims), M = Math.max(1, T - 2);
            // Peak is at attackers = 1: full DEF-bonus plus each flag at max value.
            return niceCeil(jeo(M - V + 1, M) * M + V * 10);
          },
          compute: function (x, s) {
            var T = Math.round(s.teams), V = Math.round(s.victims), M = Math.max(1, T - 2);
            var defBonus = jeo(M - V + 1, M) * M / x;
            var flagValue = V * jeo(x, T);
            return defBonus + flagValue;
          }
        },
        {
          aria: "Estimated attack points versus number of victim teams",
          xLabel: "victims", tipX: "victims",
          defaults: { attackers: 5 },
          sliders: [
            { key: "teams",     label: "teams",     min: 2, max: 42, step: 1, fmt: fmtInt },
            { key: "attackers", label: "attackers", min: 1, max: 42, step: 1, fmt: fmtInt, nosnap: true, swap: true }
          ],
          clamp: function (s) { var T = Math.round(s.teams); if (s.attackers > T - 2) s.attackers = Math.max(1, T - 2); },
          xMax: function (s) { return Math.max(1, Math.round(s.teams) - 2); },
          yMax: function (s) {
            var T = Math.round(s.teams), M = Math.max(1, T - 2), A = Math.max(1, Math.round(s.attackers));
            // Compute is monotonically increasing in victims; peak at victims = M.
            return niceCeil(jeo(1, M) * M / A + M * jeo(A, T));
          },
          compute: function (x, s) {
            var T = Math.round(s.teams), M = Math.max(1, T - 2), A = Math.max(1, Math.round(s.attackers));
            var defBonus = jeo(M - x + 1, M) * M / A;
            var flagValue = x * jeo(A, T);
            return defBonus + flagValue;
          }
        }
      ]
    },

    // Expected defense points per flag store as the victim count varies, summed
    // over all attackers you defend against. max_victims is teams - 2 (every
    // team but yourself and NOP); the per-attacker 1/a factor cancels against
    // the a attackers, so the total is independent of attacker count. The
    // per-round payout depends on checker status / flag availability we can't
    // know ahead of time, so we fold it into an availability probability p:
    //   dynamic_points((teams-2) - victims + 1, teams-2) * (teams-2) * p
    defense: {
      title: "defense_points_flagstore",
      aria: "Estimated defense points versus number of victim teams",
      xLabel: "victims", yLabel: "DEF points", tipX: "victims", tipY: "points",
      // Model assumption: every attacker steals from the same victim set, so
      // the per-attacker 1/a factor cancels the sum over attackers.
      note: "const. victims per attacker\nattackers cancel out\nlive_round = put_round + flag_rounds_valid",
      defaults: { teams: 42, availability: 1 },
      sliders: [
        { key: "teams",        label: "teams",        min: 2, max: 42, step: 1,    fmt: fmtInt },
        { key: "availability", label: "availability", min: 0, max: 1,  step: 0.05, fmt: fmt2 }
      ],
      xMax: function (s) { return Math.max(1, Math.round(s.teams) - 2); },
      yMax: function (s) {
        var M = Math.max(1, Math.round(s.teams) - 2);
        return niceCeil(jeo(1, M) * M * s.availability);
      },
      compute: function (x, s) {
        var M = Math.max(1, Math.round(s.teams) - 2);
        return jeo(M - x + 1, M) * M * s.availability;
      }
    },

    // sla_points_flagstore(put_round, live_round, flag_ok) awards max_points
    // per retrievable round, divided across the flag_rounds_valid-long window,
    // then bumped by an `sla_scale` factor to keep SLA competitive with ATK/DEF.
    // Mid-game it ramps linearly to sla_scale*max_points at flag_rounds_valid
    // checks past put_round, then plateaus: a flagstore only ever earns SLA
    // credit for its first flag_rounds_valid checks, however long it stays
    // healthy after that. Assumes perfect retrievability (flag_ok always
    // true), like the attack/defense estimates.
    //
    // Early *absolute* rounds of the game are worth more per check: check
    // round r is only covered by the min(r + 1, flag_rounds_valid) flags put
    // in [r - flag_rounds_valid + 1, r], so each check is weighted
    // 1/min(r + 1, flag_rounds_valid) rather than a flat 1/flag_rounds_valid.
    // That normalisation makes every round of the game hand a healthy team
    // exactly sla_scale*max_points per flag store, game start included — the
    // scarcity of live flags near round 0 no longer dilutes it.
    //
    // Consequence for a single flag store: credit is *not* capped at
    // sla_scale*max_points. A flag store put at round 0 with
    // flag_rounds_valid=5 accrues H_5 = 1 + 1/2 + ... + 1/5 = 2.28x that,
    // spread over its checks as usual (nothing is paid up front at x = 0).
    // The boost fades one round earlier than the window: from
    // put_round >= flag_rounds_valid - 1 on, every check is already weighted
    // 1/flag_rounds_valid and the curve is the plain ramp.
    sla: {
      title: "sla_points_flagstore",
      aria: "SLA points versus checks since put_round, for a given put_round",
      xLabel: "live_round − put_round", yLabel: "SLA points",
      tipX: "check_round", tipY: "points",
      note: "",
      // put_round defaults to flag_rounds_valid so the plain mid-game ramp
      // is what loads, and the boost only appears once the slider is pulled
      // below flag_rounds_valid - 1.
      defaults: (function () {
        var d = { flag_rounds_valid: 5, max_points: 10, sla_scale: 5.0 };
        d.put_round = d.flag_rounds_valid;
        return d;
      })(),
      accumulatedToggle: true,
      allInPlayToggle: true,
      // Controls the all-in-play view ignores, greyed out while it is on.
      allInPlayDisables: ["put_round"],
      sliders: [
        { key: "put_round", label: "put_round", min: 0, max: 40, step: 1, fmt: fmtInt }
      ],
      xMin: 0,
      xTickStep: 1,
      xMax: function (s) { return Math.round(s.flag_rounds_valid) + 1; },
      // Ticks stay 0-based to match the axis label; the tooltip is where the
      // absolute check_round is read off, so moving put_round shifts the
      // curve's shape without also sliding the axis out from under it.
      tipXValue: function (p, s) { return Math.round(s.put_round) + p.x; },
      // Tracks the curve's own plateau instead of a fixed cap, since the
      // early-game weighting pushes it above sla_scale*max_points.
      yMax: function (s) { return niceCeil(CHARTS.sla.compute(Math.round(s.flag_rounds_valid), s)); },
      compute: function (x, s) {
        var v = Math.round(s.flag_rounds_valid);
        var putRound = Math.round(s.put_round);
        var checks = Math.min(x, v);
        var points = 0;
        for (var r = putRound; r < putRound + checks; r++) {
          points += 1 / Math.min(r + 1, v);
        }
        return s.sla_scale * s.max_points * points;
      }
    }
  };

  function el(name, attrs) {
    var node = document.createElementNS(SVGNS, name);
    if (attrs) { for (var k in attrs) node.setAttribute(k, attrs[k]); }
    return node;
  }

  function xScale(x, xmin, xmax, X1) {
    if (xmax <= xmin) return X0;
    return X0 + ((x - xmin) / (xmax - xmin)) * (X1 - X0);
  }
  function yScale(v, ymax) {
    var t = ymax > 0 ? v / ymax : 0;
    return Y1 - Math.min(1, Math.max(0, t)) * (Y1 - Y0);
  }

  // x-axis ticks. Default: xmin, then every multiple of 5, always including
  // xmax. With `step` set, walks integer steps from xmin — used for short
  // integer ranges like the SLA validity window.
  function xTicks(xmin, xmax, step) {
    var ticks = [xmin];
    if (step) {
      for (var t = xmin + step; t <= xmax; t += step) ticks.push(t);
    } else {
      for (var t = 5; t <= xmax; t += 5) ticks.push(t);
    }
    if (ticks[ticks.length - 1] !== xmax) ticks.push(xmax);
    return ticks;
  }

  function tickFmt(v) {
    if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
    return String(Math.round(v * 10) / 10);
  }

  function buildPlot(config, state, W) {
    var X1 = W - RM;
    var xmin = config.xMin != null ? config.xMin : 1;
    var xmax = config.xMax(state);
    var ymax = config.yMax(state);
    var g = document.createDocumentFragment();

    // Horizontal gridlines + y labels (5 divisions).
    for (var i = 0; i <= 5; i++) {
      var val = (ymax * i) / 5;
      var y = yScale(val, ymax);
      g.appendChild(el("line", { x1: X0, y1: y.toFixed(1), x2: X1, y2: y.toFixed(1), stroke: "#ffffff18", "stroke-width": 1 }));
      var ylbl = el("text", { x: X0 - 8, y: (y + 4).toFixed(1), fill: "#ffffffb0", "font-size": 12, "text-anchor": "end" });
      ylbl.textContent = tickFmt(val);
      g.appendChild(ylbl);
    }

    // Vertical gridlines + x labels.
    xTicks(xmin, xmax, config.xTickStep).forEach(function (s) {
      var x = xScale(s, xmin, xmax, X1);
      g.appendChild(el("line", { x1: x.toFixed(1), y1: Y0, x2: x.toFixed(1), y2: Y1, stroke: "#ffffff18", "stroke-width": 1 }));
      var xlbl = el("text", { x: x.toFixed(1), y: Y1 + 18, fill: "#ffffffb0", "font-size": 12, "text-anchor": "middle" });
      xlbl.textContent = config.xTickFmt ? config.xTickFmt(s, state) : String(s);
      g.appendChild(xlbl);
    });

    // Reference lines (dim, dotted) — e.g. "max sla" cross-reference.
    if (config.refLines) {
      config.refLines.forEach(function (r) {
        var y = yScale(r.y, ymax);
        g.appendChild(el("line", {
          x1: X0.toFixed(1), y1: y.toFixed(1),
          x2: X1.toFixed(1), y2: y.toFixed(1),
          stroke: "#ffffff55", "stroke-width": 1, "stroke-dasharray": "2 4"
        }));
        if (r.label) {
          var lt = el("text", {
            x: (X1 - 4).toFixed(1), y: (y - 4).toFixed(1),
            fill: "#ffffff88", "font-size": 11, "text-anchor": "end"
          });
          lt.textContent = r.label;
          g.appendChild(lt);
        }
      });
    }

    // Axes.
    g.appendChild(el("line", { x1: X0, y1: Y0, x2: X0, y2: Y1, stroke: "#ffffff40", "stroke-width": 1.5 }));
    g.appendChild(el("line", { x1: X0, y1: Y1, x2: X1, y2: Y1, stroke: "#ffffff40", "stroke-width": 1.5 }));
    var xlab = el("text", { x: (X0 + X1) / 2, y: 336, fill: "#ffffffb0", "font-size": 13, "text-anchor": "middle" });
    xlab.textContent = config.xLabel;
    g.appendChild(xlab);
    var ylab = el("text", { x: 14, y: 159, fill: "#ffffffb0", "font-size": 13, "text-anchor": "middle", transform: "rotate(-90 14 159)" });
    ylab.textContent = config.yLabel;
    g.appendChild(ylab);

    // Curve + interactive points. In step mode we insert an intermediate
    // vertex at (new x, previous y) so the polyline traces horizontally to
    // the next sample before jumping vertically to its value.
    var pts = [];
    var polyPts = [];
    for (var xi = xmin; xi <= xmax; xi++) {
      var vv = config.compute(xi, state);
      var px = xScale(xi, xmin, xmax, X1), py = yScale(vv, ymax);
      if (config.step && pts.length) {
        var prev = pts[pts.length - 1];
        polyPts.push(px.toFixed(1) + "," + prev.py.toFixed(2));
      }
      pts.push({ x: xi, v: vv, px: px, py: py });
      polyPts.push(px.toFixed(1) + "," + py.toFixed(2));
    }
    g.appendChild(el("polyline", { points: polyPts.join(" "), fill: "none", stroke: "#57C1FF", "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round" }));

    pts.forEach(function (p) { g.appendChild(buildPoint(p, X1, config, state)); });

    return g;
  }

  function buildPoint(p, X1, config, state) {
    var grp = el("g", { class: "pt" });
    grp.appendChild(el("line", { class: "guide", x1: p.px.toFixed(1), y1: p.py.toFixed(2), x2: p.px.toFixed(1), y2: Y1, stroke: "#57C1FF", "stroke-width": 1, "stroke-dasharray": "3 3" }));
    grp.appendChild(el("circle", { class: "dot", cx: p.px.toFixed(1), cy: p.py.toFixed(2), r: 2.6, fill: "#57C1FF" }));
    grp.appendChild(el("circle", { class: "hit", cx: p.px.toFixed(1), cy: p.py.toFixed(2), r: 9 }));

    // Tooltip: shift left by half its width, flip above the point in the
    // lower half of the plot, and clamp inside the plot box.
    var tx = Math.min(X1 - 118, Math.max(50, p.px - 58));
    var below = (p.py + 58) <= 159;
    var ty = Math.min(Y1 - 46, Math.max(Y0, below ? p.py + 12 : p.py - 58));

    var tip = el("g", { class: "tip" });
    tip.appendChild(el("rect", { x: tx.toFixed(1), y: ty.toFixed(1), width: 116, height: 46, rx: 5 }));
    tip.appendChild(tipText("k", tx + 10, ty + 19, "start", config.tipX));
    tip.appendChild(tipText("v", tx + 106, ty + 19, "end", String(config.tipXValue ? config.tipXValue(p, state) : p.x)));
    tip.appendChild(tipText("k", tx + 10, ty + 36, "start", config.tipY));
    tip.appendChild(tipText("v", tx + 106, ty + 36, "end", fmt2(p.v)));
    grp.appendChild(tip);

    // On hover, lift only the tip to the end of the plot group so it isn't
    // painted over by neighbouring dots or hit circles. Tip has
    // pointer-events: none, so re-parenting it does not disturb grp's :hover.
    grp.addEventListener("mouseenter", function () {
      if (grp.parentNode) grp.parentNode.appendChild(tip);
      tip.classList.add("shown");
    });
    grp.addEventListener("mouseleave", function () {
      tip.classList.remove("shown");
    });
    return grp;
  }

  // The ∑ glyph rides high on the baseline next to lowercase code text, so
  // it gets its own span the CSS can vertically center.
  function setTitle(node, title) {
    node.textContent = "";
    title.split("∑").forEach(function (part, i) {
      if (i > 0) {
        var sum = document.createElement("span");
        sum.className = "scoring-live__sum";
        sum.textContent = "∑";
        node.appendChild(sum);
      }
      node.appendChild(document.createTextNode(part));
    });
  }

  function tipText(cls, x, y, anchor, txt) {
    var t = el("text", { class: cls, x: x.toFixed(1), y: y.toFixed(1), "text-anchor": anchor });
    t.textContent = txt;
    return t;
  }

  function chevronIcon() {
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  }

  function slidersIcon() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<line x1="4" y1="8" x2="20" y2="8"/><circle cx="9" cy="8" r="2.4" fill="currentColor" stroke="none"/>' +
      '<line x1="4" y1="16" x2="20" y2="16"/><circle cx="15" cy="16" r="2.4" fill="currentColor" stroke="none"/></svg>';
  }

  function swapIcon() {
    return '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M5 9h13l-3-3m3 3l-3 3"/><path d="M19 15H6l3-3m-3 3l3 3"/></svg>';
  }

  function initChart(root, config) {
    // Axis-swappable charts declare a `config.axes` list; the active mode is
    // merged over the base config each render so xLabel/compute/sliders track
    // the current axis assignment.
    var axisIdx = 0;
    function activeCfg() {
      var merged;
      if (!config.axes) {
        merged = Object.assign({}, config);
      } else {
        var mode = config.axes[axisIdx];
        merged = Object.assign({}, config, mode);
        merged.defaults = Object.assign({}, config.defaults || {}, mode.defaults || {});
      }
      var isMarginal = !!state.__marginal;
      var isVictimsAxis = merged.xLabel === "victims";
      if (config.marginalToggle && isMarginal) {
        // Marginal (backward-difference) view: |compute(x) - compute(x-1)|.
        // Each plotted x reads as "value of adding the x-th victim / attacker"
        // rather than "value of stepping past x". Absolute-value keeps the
        // curve on-screen regardless of monotonicity direction.
        var origCompute = merged.compute;
        // With no captures / no attackers there are no flags in play, so the
        // formula's 1/x singularity and jeo tail can be safely collapsed to 0.
        var safeCompute = function (x, s) {
          if (x <= 0) return 0;
          return origCompute(x, s);
        };
        var xmin = 1;
        merged.compute = function (x, s) {
          return Math.abs(safeCompute(x, s) - safeCompute(x - 1, s));
        };
        merged.xMin = xmin;
        merged.yMax = function (s) {
          var xmax = merged.xMax(s), peak = 0;
          for (var xi = xmin; xi <= xmax; xi++) {
            var d = Math.abs(safeCompute(xi, s) - safeCompute(xi - 1, s));
            if (d > peak) peak = d;
          }
          return niceCeil(Math.max(peak, 1));
        };
        merged.yLabel = "|Δ points|";
        merged.tipY = "|Δ points|";
      }
      // Subtract defense_points_attack_max from the ATK curve. Only meaningful
      // on the victims axis (where the subtracted DEF is per-victim); UI
      // enforces mutex with the marginal toggle, activeCfg guards anyway.
      if (config.attackDefToggle && state.__subDef && isVictimsAxis && !isMarginal) {
        var origComputeSD = merged.compute;
        merged.compute = function (x, s) {
          var T = Math.round(s.teams);
          var M = Math.max(1, T - 2);
          var A = Math.max(1, Math.round(s.attackers));
          var defMax = jeo(M - x + 1, M) * M / A;
          return origComputeSD(x, s) - defMax;
        };
        merged.yMax = function (s) {
          // Post-subtraction curve reduces to x * jeo(A, T); peak at x=M.
          var T = Math.round(s.teams);
          var M = Math.max(1, T - 2);
          var A = Math.max(1, Math.round(s.attackers));
          return niceCeil(Math.max(1, M * jeo(A, T)));
        };
        merged.yLabel = "ATK − DEF points";
        merged.tipY = "points";
      }
      // "Over all in play" view: step back from one flag store's own credit
      // to what a round of the game is worth across every flag still in play. Check round r is covered by the
      // min(r + 1, flag_rounds_valid) flags live at that point, each weighted
      // 1/min(r + 1, flag_rounds_valid), so a healthy team banks exactly
      // sla_scale*max_points per flag store every round — game start
      // included. put_round cancels out of that sum entirely, which is why
      // its slider is disabled here.
      if (config.allInPlayToggle && state.__allInPlay) {
        merged.title = "∑ sla_points_flagstore";
        merged.aria = "SLA points earned per round of the game, for one flag store";
        merged.xLabel = "live_round";
        merged.yLabel = "SLA points / round";
        merged.tipX = "live_round";
        merged.tipY = "points/round";
        merged.tipXValue = null;
        merged.xMax = function (s) { return 2 * Math.round(s.flag_rounds_valid); };
        merged.yMax = function (s) { return s.sla_scale * s.max_points; };
        // No flags are in play before the first put, so round 0 pays nothing.
        merged.compute = function (x, s) { return x <= 0 ? 0 : s.sla_scale * s.max_points; };
      }
      // "Worth per round" view: show what each round contributes on its own
      // instead of the running total. Unlike the marginal toggles above this
      // one defaults ON (state.__accumulated starts true), so unchecking it
      // is what switches away from the total.
      if (config.accumulatedToggle && !state.__accumulated && !state.__allInPlay) {
        var origComputeAcc = merged.compute;
        merged.compute = function (x, s) {
          if (x <= 0) return origComputeAcc(0, s);
          return origComputeAcc(x, s) - origComputeAcc(x - 1, s);
        };
        // A single check is never worth more than one round's full reward, so
        // the axis is pinned there rather than to the visible peak — curves
        // for different put_rounds then stay comparable at a glance.
        merged.yMax = function (s) { return s.sla_scale * s.max_points; };
        merged.yLabel = "SLA points / round";
        merged.tipY = "points/round";
      }
      // Max-SLA reference line. Rendered wherever the SLA cap is a useful
      // benchmark for a single-round decision:
      //   defense chart: always (marginal DEF vs SLA).
      //   attack chart, attackers-x, raw: is one more attacker worth an SLA-
      //     equivalent trade for this flag store?
      //   attack chart, victims-x, marginal: is one more victim worth the
      //     max SLA you would lose for that flag store?
      // Pulled from CHARTS.sla so a single source of truth drives all three.
      var wantSlaRef = false;
      if (config === CHARTS.defense) wantSlaRef = true;
      else if (config === CHARTS.attack) {
        if (isMarginal && isVictimsAxis) wantSlaRef = true;
        else if (!isMarginal && !isVictimsAxis) wantSlaRef = true;
      }
      if (wantSlaRef && CHARTS.sla) {
        var sd = CHARTS.sla.defaults;
        // The victims-delta view compares against the SLA you could lose at
        // most, so only there the line keeps its "max sla" reading.
        var slaRefLabel = (isMarginal && isVictimsAxis) ? "max sla" : "sla baseline";
        merged.refLines = [{ y: sd.sla_scale * sd.max_points, label: slaRefLabel }];
        var origYMax = merged.yMax;
        merged.yMax = function (s) {
          var y = origYMax(s);
          merged.refLines.forEach(function (r) {
            var ry = niceCeil(r.y);
            if (ry > y) y = ry;
          });
          return y;
        };
      }
      return merged;
    }

    // Initialise before activeCfg() runs — its marginal-mode branch reads
    // state.__marginal via closure.
    var state = {};
    if (config.accumulatedToggle) state.__accumulated = true;
    if (config.allInPlayToggle) state.__allInPlay = false;
    Object.assign(state, activeCfg().defaults);

    var svg = el("svg", {
      viewBox: "0 0 720 " + H,
      preserveAspectRatio: "none",
      "font-family": "Space Grotesk, system-ui, sans-serif",
      class: "scoring-chart",
      role: "img",
      "aria-label": activeCfg().aria
    });
    var plot = el("g", { class: "plot" });
    svg.appendChild(plot);

    // viewBox width tracks the container so 1 user unit == 1 px (no distortion).
    state.width = 720;
    var titleEl = null;
    function render() {
      var cfg = activeCfg();
      if (titleEl) setTitle(titleEl, cfg.title);
      svg.setAttribute("aria-label", cfg.aria);
      var W = Math.max(MIN_W, Math.round(state.width));
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      while (plot.firstChild) plot.removeChild(plot.firstChild);
      plot.appendChild(buildPlot(cfg, state, W));
    }

    var chart = document.createElement("div");
    chart.className = "scoring-live__chart";
    if (config.title) {
      titleEl = document.createElement("div");
      titleEl.className = "scoring-live__title";
      setTitle(titleEl, config.title);
      chart.appendChild(titleEl);
    }
    chart.appendChild(svg);

    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(function (entries) {
        var w = entries[0].contentRect.width;
        if (w > 0 && Math.abs(w - state.width) >= 1) {
          state.width = w;
          render();
        }
      });
      ro.observe(chart);
    }
    render();

    function setCollapsed(on) { root.classList.toggle("collapsed", on); }

    var row = document.createElement("div");
    row.className = "scoring-live__row";
    row.appendChild(chart);
    root.appendChild(row);

    var panel = null, showBtn = null;

    // Swap the active axis; new-mode keys inherit their default only if unset,
    // so a user's chosen value survives round-trips through the toggle.
    function toggleAxis() {
      if (!config.axes) return;
      axisIdx = (axisIdx + 1) % config.axes.length;
      var cfg = activeCfg();
      var d = cfg.defaults || {};
      Object.keys(d).forEach(function (k) {
        if (state[k] == null) state[k] = d[k];
      });
      if (cfg.clamp) cfg.clamp(state);
      mountPanel();
      render();
    }

    function mountPanel() {
      if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
      panel = null;
      var cfg = activeCfg();
      if (cfg.sliders && cfg.sliders.length) {
        panel = buildControls(state, render, setCollapsed, cfg, toggleAxis);
        if (showBtn) root.insertBefore(panel, showBtn);
        else root.appendChild(panel);
      }
    }

    // Charts without tunable parameters skip the slider panel and its toggle.
    var initialCfg = activeCfg();
    if (initialCfg.sliders && initialCfg.sliders.length) {
      mountPanel();

      showBtn = document.createElement("button");
      showBtn.type = "button";
      showBtn.className = "scoring-ctrl__show";
      showBtn.setAttribute("aria-label", "Show parameters");
      showBtn.innerHTML = slidersIcon();
      showBtn.addEventListener("click", function () { setCollapsed(false); });
      root.appendChild(showBtn);

      setCollapsed(true);
    }
  }

  function buildControls(state, render, setCollapsed, config, toggleAxis) {
    var panel = document.createElement("div");
    panel.className = "scoring-ctrl";

    var head = document.createElement("div");
    head.className = "scoring-ctrl__title";
    var title = document.createElement("span");
    title.textContent = "parameters";
    var collapse = document.createElement("button");
    collapse.type = "button";
    collapse.className = "scoring-ctrl__collapse";
    collapse.setAttribute("aria-label", "Hide parameters");
    collapse.innerHTML = chevronIcon();
    collapse.addEventListener("click", function () { setCollapsed(true); });
    head.appendChild(title);
    head.appendChild(collapse);
    panel.appendChild(head);

    var inputs = {}, outs = {}, rows = {};

    function refresh() {
      config.sliders.forEach(function (cfg) {
        inputs[cfg.key].value = state[cfg.key];
        outs[cfg.key].textContent = cfg.fmt(state[cfg.key]);
      });
    }

    config.sliders.forEach(function (cfg) {
      var row = document.createElement("label");
      row.className = "scoring-ctrl__row";

      var h = document.createElement("span");
      h.className = "scoring-ctrl__head";
      var name = document.createElement("span");
      name.className = "scoring-ctrl__name";
      if (cfg.swap && toggleAxis) {
        name.classList.add("scoring-ctrl__name--swap");
        name.setAttribute("role", "button");
        name.setAttribute("tabindex", "0");
        name.setAttribute("title", "Plot on x-axis");
        name.innerHTML = cfg.label + swapIcon();
        var doSwap = function (e) {
          e.preventDefault();
          e.stopPropagation();
          toggleAxis();
        };
        name.addEventListener("click", doSwap);
        name.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") doSwap(e);
        });
      } else {
        name.textContent = cfg.label;
      }
      var out = document.createElement("span");
      out.className = "scoring-ctrl__val";
      out.textContent = cfg.fmt(state[cfg.key]);
      h.appendChild(name);
      h.appendChild(out);

      var slider = document.createElement("span");
      slider.className = "scoring-ctrl__slider";

      var input = document.createElement("input");
      input.type = "range";
      input.min = cfg.min;
      input.max = cfg.max;
      input.step = cfg.step;
      input.value = state[cfg.key];

      // Tick marking the default value that the slider snaps to (unless opted out).
      var def = config.defaults[cfg.key];
      var snapWindow = cfg.nosnap ? 0 : (cfg.max - cfg.min) * 0.03;

      input.addEventListener("input", function () {
        var raw = parseFloat(input.value);
        if (Math.abs(raw - def) <= snapWindow) raw = def;
        state[cfg.key] = raw;
        if (config.clamp) config.clamp(state);
        refresh();
        render();
      });

      slider.appendChild(input);
      if (!cfg.nosnap) {
        var frac = (def - cfg.min) / (cfg.max - cfg.min);
        var tick = document.createElement("span");
        tick.className = "scoring-ctrl__snap";
        tick.style.left = "calc(6.5px + " + frac + " * (100% - 13px))";
        slider.appendChild(tick);
      }
      row.appendChild(h);
      row.appendChild(slider);
      panel.appendChild(row);

      inputs[cfg.key] = input;
      outs[cfg.key] = out;
      rows[cfg.key] = row;
    });

    var marginalBox = null, subDefBox = null, accumulatedBox = null;
    var isVictimsCtrl = config.xLabel === "victims";

    // Grey out (and lock) whatever the all-in-play view ignores, so the panel says
    // which knobs still do something rather than leaving dead ones live.
    function syncAllInPlay() {
      var on = !!state.__allInPlay;
      (config.allInPlayDisables || []).forEach(function (key) {
        if (!rows[key]) return;
        rows[key].classList.toggle("scoring-ctrl__row--off", on);
        inputs[key].disabled = on;
      });
      if (accumulatedBox) {
        accumulatedBox.closest(".scoring-ctrl__row").classList.toggle("scoring-ctrl__row--off", on);
        accumulatedBox.disabled = on;
      }
    }

    if (config.accumulatedToggle) {
      var accRow = document.createElement("label");
      accRow.className = "scoring-ctrl__row scoring-ctrl__row--toggle";
      accumulatedBox = document.createElement("input");
      accumulatedBox.type = "checkbox";
      accumulatedBox.checked = !!state.__accumulated;
      accumulatedBox.addEventListener("change", function () {
        state.__accumulated = accumulatedBox.checked;
        render();
      });
      var accLabel = document.createElement("span");
      accLabel.textContent = "accumulated";
      accRow.appendChild(accumulatedBox);
      accRow.appendChild(accLabel);
      panel.appendChild(accRow);
    }

    if (config.allInPlayToggle) {
      var aipRow = document.createElement("label");
      aipRow.className = "scoring-ctrl__row scoring-ctrl__row--toggle";
      var allInPlayBox = document.createElement("input");
      allInPlayBox.type = "checkbox";
      allInPlayBox.checked = !!state.__allInPlay;
      allInPlayBox.addEventListener("change", function () {
        state.__allInPlay = allInPlayBox.checked;
        syncAllInPlay();
        render();
      });
      var aipLabel = document.createElement("span");
      aipLabel.textContent = "sum(flags in play)";
      aipRow.appendChild(allInPlayBox);
      aipRow.appendChild(aipLabel);
      panel.appendChild(aipRow);
    }

    syncAllInPlay();

    if (config.marginalToggle) {
      var togRow = document.createElement("label");
      togRow.className = "scoring-ctrl__row scoring-ctrl__row--toggle";
      marginalBox = document.createElement("input");
      marginalBox.type = "checkbox";
      marginalBox.checked = !!state.__marginal;
      marginalBox.addEventListener("change", function () {
        state.__marginal = marginalBox.checked;
        if (marginalBox.checked && subDefBox) {
          state.__subDef = false;
          subDefBox.checked = false;
        }
        render();
      });
      var togLabel = document.createElement("span");
      togLabel.textContent = "|Δ points|";
      togRow.appendChild(marginalBox);
      togRow.appendChild(togLabel);
      panel.appendChild(togRow);
    }

    // "- attack DEF" is only meaningful on the victims axis (subtracts a
    // per-victim DEF term), so we only render it there.
    if (config.attackDefToggle && isVictimsCtrl) {
      var sdRow = document.createElement("label");
      sdRow.className = "scoring-ctrl__row scoring-ctrl__row--toggle";
      subDefBox = document.createElement("input");
      subDefBox.type = "checkbox";
      subDefBox.checked = !!state.__subDef;
      subDefBox.addEventListener("change", function () {
        state.__subDef = subDefBox.checked;
        if (subDefBox.checked && marginalBox) {
          state.__marginal = false;
          marginalBox.checked = false;
        }
        render();
      });
      var sdLabel = document.createElement("span");
      sdLabel.textContent = "- attack DEF";
      sdRow.appendChild(subDefBox);
      sdRow.appendChild(sdLabel);
      panel.appendChild(sdRow);
    }

    if (config.note) {
      var note = document.createElement("div");
      note.className = "scoring-ctrl__note";
      note.textContent = config.note;
      panel.appendChild(note);
    }

    return panel;
  }

  function initAll() {
    document.querySelectorAll(".scoring-live[data-scoring-chart]").forEach(function (root) {
      if (root.dataset.scoringInit) return;
      root.dataset.scoringInit = "1";
      var config = CHARTS[root.getAttribute("data-scoring-chart")] || CHARTS.jeopardy;
      initChart(root, config);
    });
  }

  // A click outside an open parameter panel closes it. Registered once so it
  // survives instant navigation without accumulating per-chart listeners.
  document.addEventListener("click", function (e) {
    document.querySelectorAll(".scoring-live[data-scoring-chart]:not(.collapsed)").forEach(function (root) {
      var panel = root.querySelector(".scoring-ctrl");
      var show = root.querySelector(".scoring-ctrl__show");
      if ((panel && panel.contains(e.target)) || (show && show.contains(e.target))) return;
      root.classList.add("collapsed");
    });
  });

  // Material for MkDocs re-runs this on every (instant) navigation.
  if (typeof document$ !== "undefined" && document$.subscribe) {
    document$.subscribe(initAll);
  } else {
    document.addEventListener("DOMContentLoaded", initAll);
  }
})();
