// Styles of both cards. Colors come from the HA theme; the accent colors are --eoc-* variables with defaults.
// Colored text is mixed with the theme's text color so it stays readable on light and dark themes.

export const STYLE = `
:host {
  display: block;
  --eoc-pv: var(--eoc-pv-color, #f5b942);
  --eoc-bat: var(--eoc-battery-color, #5fd08a);
  --eoc-imp: var(--eoc-import-color, #ff9a5c);
  --eoc-exp: var(--eoc-export-color, #5aa9ff);
  --eoc-house: var(--eoc-house-color, #cba6f7);
  --eoc-fc: var(--eoc-forecast-color, #94e2d5);
  --eoc-night: var(--eoc-night-color, rgba(180, 190, 254, 0.11));
  --eoc-night-icon: var(--eoc-night-icon-color, #b4befe);
  --eoc-text: var(--primary-text-color, #212121);
  --eoc-sub: var(--secondary-text-color, #727272);
  --eoc-card: var(--ha-card-background, var(--card-background-color, #fff));
  --eoc-tile: var(--secondary-background-color, rgba(127, 127, 127, 0.08));
  --eoc-border: var(--divider-color, rgba(127, 127, 127, 0.25));
  --eoc-line: var(--divider-color, rgba(127, 127, 127, 0.25));
  --eoc-accent: var(--eoc-accent-color, var(--primary-color, #03a9f4));
  --eoc-accent-soft: color-mix(in srgb, var(--eoc-accent) 16%, transparent);
}
ha-card { padding: 16px; display: flex; flex-direction: column; gap: 14px; color: var(--eoc-text); overflow: hidden; }
button { font: inherit; color: inherit; }
button:focus-visible { outline: 2px solid var(--eoc-accent); outline-offset: 2px; }
.tile { border-radius: 12px; background: var(--eoc-tile); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.tile-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.tile-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; color: var(--eoc-sub); }
.icon { width: 18px; height: 18px; fill: currentColor; flex: none; }
.tile-title .icon { width: 16px; height: 16px; }
.muted { color: var(--eoc-sub); }
.small { font-size: 12px; }
.empty { font-size: 12.5px; color: var(--eoc-sub); }
.tx-pv { color: color-mix(in srgb, var(--eoc-pv) 62%, var(--eoc-text)); }
.tx-bat { color: color-mix(in srgb, var(--eoc-bat) 62%, var(--eoc-text)); }
.tx-imp { color: color-mix(in srgb, var(--eoc-imp) 62%, var(--eoc-text)); }
.tx-exp { color: color-mix(in srgb, var(--eoc-exp) 62%, var(--eoc-text)); }
.tx-house { color: color-mix(in srgb, var(--eoc-house) 62%, var(--eoc-text)); }

/* header */
.header { display: flex; align-items: center; gap: 12px; }
.logo { width: 40px; height: 40px; border-radius: 50%; flex: none; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); --mdc-icon-size: 22px; }
.logo .icon { width: 22px; height: 22px; }
.titles { flex: 1 1 0; min-width: 72px; }
.name { font-size: 16px; font-weight: 500; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { font-size: 12px; color: var(--eoc-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pill { align-self: flex-start; margin-top: 1px; flex: 0 1 auto; min-width: 0; max-width: 62%; overflow: hidden; display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; white-space: nowrap; background: color-mix(in srgb, var(--c) 15%, transparent); color: color-mix(in srgb, var(--c) 62%, var(--eoc-text)); }
.pill > span:last-child { overflow: hidden; text-overflow: ellipsis; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c); flex: none; display: inline-block; }

.zoom { flex: none; cursor: pointer; width: 40px; height: 40px; margin: -4px -8px -4px 0; padding: 0; border: 0; border-radius: 50%; background: transparent; display: grid; place-items: center; color: var(--eoc-sub); }
.zoom .icon { width: 20px; height: 20px; }
.zoom:hover { background: color-mix(in srgb, var(--eoc-sub) 16%, transparent); color: var(--eoc-text); }

/* live flow */
.flow { padding: 10px 0 8px; gap: 0; }
.flow-head { display: flex; align-items: center; justify-content: space-between; padding: 0 14px 4px; font-size: 13px; }
.flow-head .live { gap: 6px; }
.flow-head .live::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--eoc-bat); }
.stage { position: relative; width: 100%; max-width: 388px; height: 324px; margin: 0 auto; }
.stage svg.lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.track { vector-effect: non-scaling-stroke; fill: none; stroke: var(--eoc-line); stroke-width: 2.5; stroke-linecap: round; }
.flowline { vector-effect: non-scaling-stroke; fill: none; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 3 7; animation: eoc-flow var(--dur, 0.9s) linear infinite; }
.flowline.static { animation: none; stroke-dasharray: none; }
@keyframes eoc-flow { to { stroke-dashoffset: -20; } }
@media (prefers-reduced-motion: reduce) { .flowline { animation: none; stroke-dasharray: none; } }
.node { position: absolute; width: 60px; height: 60px; margin: -30px 0 0 -30px; box-sizing: border-box; border-radius: 50%; border: 2px solid var(--eoc-line); background: var(--eoc-card); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; color: var(--eoc-sub); }
.node.on { border-color: var(--c); color: var(--c); }
.node b { font-size: 12px; font-weight: 700; color: var(--eoc-text); white-space: nowrap; }
.label { position: absolute; transform: translateX(-50%); text-align: center; line-height: 16px; white-space: nowrap; }
.label .t { font-size: 12.5px; font-weight: 500; }
.label .s { font-size: 11.5px; color: var(--eoc-sub); }
.socbar { width: 96px; height: 6px; border-radius: 3px; background: var(--eoc-line); margin: 4px auto 3px; overflow: hidden; }
.socbar div { height: 6px; background: var(--c); }

/* period switcher */
.period { display: flex; flex-direction: column; gap: 6px; }
.seg { display: flex; padding: 3px; border-radius: 12px; background: var(--eoc-tile); }
.seg button { flex: 1 1 0; min-width: 0; height: 38px; border: 0; border-radius: 9px; background: transparent; font-weight: 500; font-size: 13px; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--eoc-accent); color: var(--text-primary-color, var(--eoc-card)); }
.nav { display: flex; align-items: center; gap: 4px; }
.nav .arrow { width: 40px; height: 44px; border: 0; border-radius: 10px; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.nav .arrow:first-child { margin-left: -8px; }
.nav .arrow:disabled { color: var(--eoc-line); cursor: default; }
.nav .date { flex: none; width: 132px; text-align: center; font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nav .now { flex: none; margin-left: auto; height: 34px; padding: 0 12px; border: 0; border-radius: 999px; font-size: 12px; font-weight: 500; cursor: pointer; background: var(--eoc-accent-soft); color: color-mix(in srgb, var(--eoc-accent) 70%, var(--eoc-text)); }
.nav .now:disabled { background: transparent; color: var(--eoc-sub); cursor: default; }

/* readouts */
.readout { box-sizing: content-box; padding: 6px 10px; border-radius: 10px; background: var(--eoc-card); font-size: 12px; line-height: 16px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; }
.readout div { overflow: hidden; text-overflow: ellipsis; }
.readout .r-title { font-weight: 500; }
.readout .r-line { color: var(--eoc-sub); }
.readout.three { height: 48px; }
.readout.two { height: 32px; }

/* power chart */
.pchart { display: flex; gap: 6px; align-items: stretch; }
.yaxis { width: 28px; height: 140px; display: flex; flex-direction: column; justify-content: space-between; font-size: 10.5px; color: var(--eoc-sub); flex: none; font-variant-numeric: tabular-nums; }
.yaxis.l { text-align: right; }
.plot { position: relative; flex: 1 1 auto; min-width: 0; height: 140px; touch-action: pan-y; cursor: crosshair; }
.plot svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.xaxis { display: flex; justify-content: space-between; font-size: 11px; color: var(--eoc-sub); }
.xaxis.p { margin: -4px 34px 0; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { min-height: 32px; padding: 0 10px; border: 1px solid var(--eoc-border); border-radius: 999px; background: var(--eoc-card); font-size: 11.5px; font-weight: 500; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.chip::before { content: ""; width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
.chip[aria-pressed="false"] { background: transparent; color: var(--eoc-sub); }
.chip[aria-pressed="false"]::before { background: var(--eoc-line); }

/* balance */
.bal { display: flex; flex-direction: column; gap: 6px; }
.bal-head { display: flex; justify-content: space-between; font-size: 12.5px; }
.bal-head b { font-weight: 700; }
.bar { height: 12px; border-radius: 6px; background: var(--eoc-line); overflow: hidden; }
.bar .fill { display: flex; height: 12px; gap: 2px; border-radius: 6px; overflow: hidden; }
.bar .fill div { background: var(--c); }
.legend { display: flex; gap: 6px 12px; flex-wrap: wrap; font-size: 11.5px; color: var(--eoc-sub); }
.legend span { display: flex; align-items: center; gap: 5px; }
.legend span::before { content: ""; width: 8px; height: 8px; border-radius: 2px; background: var(--c); }
.legend.lines span::before { width: 10px; height: 4px; }
.rings { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding-top: 4px; border-top: 1px solid var(--eoc-border); }
.ring { display: flex; flex-direction: column; align-items: center; gap: 4px; padding-top: 8px; }
.ring .r { position: relative; width: 54px; height: 54px; }
.ring .r span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 700; }
.ring .l { font-size: 11.5px; color: var(--eoc-sub); text-align: center; }

/* history */
.modes { display: flex; gap: 4px; }
.modes button { min-height: 32px; padding: 0 10px; border: 1px solid var(--eoc-border); border-radius: 999px; background: transparent; color: var(--eoc-sub); font-size: 12px; font-weight: 500; cursor: pointer; }
.modes button[aria-pressed="true"] { background: var(--eoc-accent-soft); border-color: var(--eoc-accent); color: color-mix(in srgb, var(--eoc-accent) 70%, var(--eoc-text)); }
.hchart { position: relative; height: 124px; }
.night { position: absolute; top: 0; height: 124px; border-radius: 6px; background: var(--eoc-night); color: var(--eoc-night-icon); display: flex; justify-content: center; align-items: flex-start; padding-top: 5px; box-sizing: border-box; pointer-events: none; overflow: hidden; }
.cols { position: relative; display: flex; align-items: flex-end; height: 124px; gap: var(--gap, 3px); }
.col { flex: 1 1 0; min-width: 0; height: 124px; padding: 0; border: 0; border-radius: 4px; background: transparent; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; cursor: pointer; }
.col.sel { background: color-mix(in srgb, var(--eoc-accent) 12%, transparent); }
.col.future { background: color-mix(in srgb, var(--eoc-line) 35%, transparent); cursor: default; }
.col .v { font-size: 10.5px; font-weight: 700; color: var(--eoc-sub); line-height: 14px; height: 14px; white-space: nowrap; }
.stack { width: 72%; display: flex; flex-direction: column-reverse; border-radius: 3px 3px 0 0; overflow: hidden; }
.stack.down { flex-direction: column; border-radius: 0 0 3px 3px; }
.stack div { background: var(--c); flex: none; }
.updown { width: 100%; height: 124px; display: flex; flex-direction: column; align-items: center; }
.updown .u { display: flex; align-items: flex-end; justify-content: center; width: 100%; }
.updown .d { display: flex; align-items: flex-start; justify-content: center; width: 100%; }
.zero { position: absolute; left: 0; right: 0; height: 1px; background: var(--eoc-sub); opacity: 0.55; pointer-events: none; }
.overlay { position: absolute; left: 0; width: 100%; pointer-events: none; overflow: visible; }

/* footer */
.foot { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.foot .tile { padding: 10px 12px; gap: 2px; }
.foot .k { font-size: 11.5px; color: var(--eoc-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.foot .v { font-size: 15px; font-weight: 700; white-space: nowrap; }
.foot .v span { font-size: 11.5px; font-weight: 400; color: var(--eoc-sub); }
.fc { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--eoc-sub); }
.fc .bar { flex: 1 1 auto; height: 6px; }
.fc .bar div { height: 6px; background: var(--eoc-pv); }
.fc b { flex: none; color: var(--eoc-text); font-weight: 500; }

/* mini card */
.mini { padding: 12px 12px 12px 16px; flex-direction: row; align-items: center; gap: 14px; }
.mini .socring { position: relative; width: 56px; height: 56px; flex: none; }
.mini .socring svg { width: 56px; height: 56px; }
.mini .socring span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 600; }
.mini .body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.mini .row1 { display: flex; align-items: center; gap: 8px; min-width: 0; }
.mini .row1 .name { flex: none; max-width: 65%; }
.mini .row1 .pill { max-width: none; flex: 0 1 auto; }
.mini .pill { align-self: center; margin-top: 0; }
.mini .row2 { display: flex; gap: 10px; font-size: 13px; color: var(--eoc-sub); white-space: nowrap; overflow: hidden; }
.mini .row2 b { font-weight: 500; }
.mini .zoom { width: 44px; height: 44px; margin: 0; border-radius: 12px; background: var(--eoc-tile); }
.mini .zoom[aria-expanded="true"] .icon { transform: none; }
`;
