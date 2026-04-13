import React, { useMemo } from "react";

import "./TopicLineChart.css";

const W = 640;
const PAD_L = 52;
const PAD_R = 24;
const PAD_T = 44;
/** Bottom margin for index 1, 2, … under the plot (topic names only in HTML legend) */
const PAD_B = 46;
const PLOT_H = PAD_T + 148 + PAD_B;
const VIEW_H = PLOT_H + 12;

/** Avoid "2. 2. světová…" when DB title already starts with same index as list item. */
function cleanLegendTopicTitle(raw, index) {
  let s = String(raw ?? "").trim() || "—";
  const n = index + 1;
  const re = new RegExp(`^\\s*${n}\\.\\s*`, "i");
  s = s.replace(re, "").trim();
  return s || "—";
}

/**
 * Line chart with circular markers — light blue plot area, green stroke (class stats / student detail).
 */
export default function TopicLineChart({ title, labels, values, formatYTick }) {
  const innerW = W - PAD_L - PAD_R;
  const innerH = PLOT_H - PAD_T - PAD_B;

  const { points, pathD, yTicks } = useMemo(() => {
    const n = values.length;
    const numeric = values.map((v) =>
      v == null || !Number.isFinite(Number(v)) ? 0 : Number(v)
    );
    let maxV = Math.max(...numeric, 0);
    if (maxV <= 0) maxV = 1;
    const headroom = 1.08;
    const cap = maxV * headroom;

    const scaleY = (v) => PAD_T + innerH - (v / cap) * innerH;
    const scaleX = (i) =>
      n <= 1 ? PAD_L + innerW / 2 : PAD_L + (innerW * i) / Math.max(1, n - 1);

    const pts = numeric.map((v, i) => ({
      x: scaleX(i),
      y: scaleY(v),
      raw: v,
    }));

    const d = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(" ");

    const tickCount = 4;
    const yTicksInner = [];
    for (let t = 0; t <= tickCount; t += 1) {
      const frac = t / tickCount;
      const val = cap * frac;
      yTicksInner.push({ y: scaleY(val), val });
    }

    return { points: pts, pathD: d, yTicks: yTicksInner };
  }, [values, innerH]);

  const n = values.length;
  const fmt = formatYTick || ((v) => String(Math.round(v * 10) / 10));

  return (
    <div className="tcsLineChart">
      {title ? <div className="tcsLineChartTitle">{title}</div> : null}
      <svg
        className="tcsLineChartSvg"
        viewBox={`0 0 ${W} ${VIEW_H}`}
        width="100%"
        height={VIEW_H}
        role="img"
        aria-label={title || "Graf"}
        style={{ overflow: "visible" }}
      >
        <rect x="0" y="0" width={W} height={PLOT_H} className="tcsLineChartBg" rx="10" />
        <rect
          x={PAD_L}
          y={PAD_T}
          width={innerW}
          height={innerH}
          className="tcsLineChartPlot"
          rx="6"
        />
        {yTicks.map((tk, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={PAD_L + innerW}
              y1={tk.y}
              y2={tk.y}
              className="tcsLineChartGrid"
            />
            <text
              x={PAD_L - 8}
              y={tk.y + 4}
              className="tcsLineChartAxisLabel"
              textAnchor="end"
            >
              {fmt(tk.val)}
            </text>
          </g>
        ))}
        {n > 0 && pathD ? (
          <path d={pathD} className="tcsLineChartLine" fill="none" />
        ) : null}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={5} className="tcsLineChartDot" />
        ))}
        {labels.map((_, i) => {
          const x = n <= 1 ? PAD_L + innerW / 2 : PAD_L + (innerW * i) / Math.max(1, n - 1);
          return (
            <text
              key={`ix-${i}`}
              x={x}
              y={PAD_T + innerH + 14}
              className="tcsLineChartXIndex"
              textAnchor="middle"
            >
              {i + 1}
            </text>
          );
        })}
      </svg>
      {n > 0 ? (
        <ol className="tcsLineChartTopicLegend" aria-label="Témata podle bodů v grafu">
          {labels.map((lab, i) => (
            <li key={i} className="tcsLineChartTopicLegendItem">
              {cleanLegendTopicTitle(lab, i)}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
