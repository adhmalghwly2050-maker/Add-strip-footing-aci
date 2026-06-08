/**
 * IsolatedFootingVisualizer - Graphical views for Isolated Footings.
 * Designed using modern, clean SVG.
 */

import React from 'react';
import type { IsolatedFootingAnalysisResult } from '@/lib/isolatedFootingEngine';

interface Props {
  result: IsolatedFootingAnalysisResult;
}

export default function IsolatedFootingVisualizer({ result }: Props) {
  const { input, soilPressure, criticalSections } = result;
  const { B, L, Cx, Cy, H } = input;
  const { qmax, qmin, ex, ey, contactAreaRatio } = soilPressure;
  const { punching_b0 } = criticalSections;

  const d = Math.max(50, H - 75 - 12);

  // Layout aspect ratio mapping
  const pad = 40;
  const W = 360;
  const H_view = 260;

  // Scale calculations to fit B x L inside W x H_view
  const scale = Math.min((W - 2 * pad) / B, (H_view - 2 * pad) / L);
  const footingW = B * scale;
  const footingH = L * scale;
  const colW = Cx * scale;
  const colH = Cy * scale;

  const cx_val = W / 2;
  const cy_val = H_view / 2;

  // Footing boundaries
  const fx1 = cx_val - footingW / 2;
  const fx2 = cx_val + footingW / 2;
  const fy1 = cy_val - footingH / 2;
  const fy2 = cy_val + footingH / 2;

  // Column boundaries (including eccentricity/offset if defined)
  const colX = cx_val + (input.fxCol || 0) * scale;
  const colY = cy_val - (input.fyCol || 0) * scale; // invert Y for screen coords
  const cx1 = colX - colW / 2;
  const cx2 = colX + colW / 2;
  const cy1 = colY - colH / 2;
  const cy2 = colY + colH / 2;

  // Punching shear perimeter bounds (d/2 from column face)
  const pd = d * scale;
  const px1_raw = cx1 - pd / 2;
  const px2_raw = cx2 + pd / 2;
  const py1_raw = cy1 - pd / 2;
  const py2_raw = cy2 + pd / 2;

  // Cropped punching bounds to footing edges
  const px1_c = Math.max(px1_raw, fx1);
  const px2_c = Math.min(px2_raw, fx2);
  const py1_c = Math.max(py1_raw, fy1);
  const py2_c = Math.min(py2_raw, fy2);

  // Critical section for one-way shear (distance d from column face)
  const s1x_left = cx1 - pd;
  const s1x_right = cx2 + pd;
  const s1y_bot = cy2 + pd;
  const s1y_top = cy1 - pd;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* ── Visualizer 1: Soil Pressure Diagram & Contours ── */}
      <div className="border border-border rounded-lg bg-card p-4 flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold text-foreground mb-1">توزيع ضغط التربة والكنتور</h3>
          <p className="text-[10px] text-muted-foreground mb-4">يبيّن شدّة ضغط التماس أسفل القاعدة مع تمثيل كنتوري لنسب التحميل (kN/m²).</p>
        </div>
        
        <div className="relative flex items-center justify-center bg-muted/20 rounded border border-border/50 overflow-hidden" style={{ height: H_view }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H_view}`} className="absolute inset-0">
            {/* Draw footing */}
            <rect
              x={fx1}
              y={fy1}
              width={footingW}
              height={footingH}
              fill="#e2e8f0"
              stroke="#475569"
              strokeWidth="2"
              className="transition-all"
            />

            {/* Gradient Contour representation */}
            <defs>
              <linearGradient id="pressureGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            {/* Color mapping of active soil pressure */}
            {soilPressure.activeCells && soilPressure.activeCells.length > 0 ? (
              // Draw grid contour dots
              soilPressure.activeCells.map((cell, idx) => {
                const cellX = cx_val + cell.x * 1000 * scale;
                const cellY = cy_val - cell.y * 1000 * scale; // invert Y
                let color = "rgba(74, 222, 128, 0.1)"; // light green
                if (cell.q > qmax * 0.75) {
                  color = "rgba(239, 68, 68, 0.7)"; // red
                } else if (cell.q > qmax * 0.5) {
                  color = "rgba(245, 158, 11, 0.6)"; // orange
                } else if (cell.q > qmax * 0.2) {
                  color = "rgba(234, 179, 8, 0.4)"; // yellow
                } else if (cell.q === 0) {
                  color = "rgba(241, 245, 249, 0.1)"; // gray for uplift/zero
                }

                return (
                  <circle
                    key={idx}
                    cx={cellX}
                    cy={cellY}
                    r={Math.max(1.5, scale * 60)} // scaled size
                    fill={color}
                  />
                );
              })
            ) : (
              // Simple face gradient under full contact
              <rect
                x={fx1 + 1}
                y={fy1 + 1}
                width={footingW - 2}
                height={footingH - 2}
                fill="url(#pressureGrad)"
              />
            )}

            {/* Draw column boundary */}
            <rect
              x={cx1}
              y={cy1}
              width={colW}
              height={colH}
              fill="#1e293b"
              stroke="#475569"
              strokeWidth="1.5"
            />

            {/* Tension/Uplift boundary line */}
            {soilPressure.hasUplift && (
              <text x={fx1 + 10} y={fy2 - 10} className="font-mono text-[9px] fill-red-600 font-bold">
                منطقة انفصال التربة (Uplift)
              </text>
            )}

            {/* Peak Values Labels */}
            <text x={fx1 + 5} y={fy1 + 14} className="font-mono text-[9px] fill-slate-700 font-bold">
              q_max: {qmax.toFixed(1)}
            </text>
            <text x={fx2 - 5} y={fy2 - 6} textAnchor="end" className="font-mono text-[9px] fill-slate-700 font-bold">
              q_min: {qmin.toFixed(1)}
            </text>
          </svg>
        </div>

        <div className="mt-3 flex justify-between items-center text-[10px]">
          <div className="flex gap-2 items-center">
            <span className="w-2 h-2 rounded-full bg-red-500"></span><span>أقصى ضغط ({qmax.toFixed(0)})</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-2 h-2 rounded-full bg-slate-300"></span><span>انفصال/صفر ({qmin.toFixed(0)})</span>
          </div>
          <p className="font-mono font-bold text-foreground">التماس: {(contactAreaRatio * 100).toFixed(0)}%</p>
        </div>
      </div>

      {/* ── Visualizer 2: Critical Sections & Punching Perimeter ── */}
      <div className="border border-border rounded-lg bg-card p-4 flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold text-foreground mb-1">المقاطع الحرجة للقص والانحناء</h3>
          <p className="text-[10px] text-muted-foreground mb-4">توضيح حد الانحناء (تحت وجه العمود)، والقص العريض (d) وقص الثقب (d/2).</p>
        </div>

        <div className="relative flex items-center justify-center bg-muted/20 rounded border border-border/50 overflow-hidden" style={{ height: H_view }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H_view}`} className="absolute inset-0">
            {/* Draw footing */}
            <rect
              x={fx1}
              y={fy1}
              width={footingW}
              height={footingH}
              fill="#f1f5f9"
              stroke="#94a3b8"
              strokeWidth="1.5"
            />

            {/* Bending Critical Section (Vertical/Horizontal lines right on column face) */}
            <line x1={cx1} y1={fy1} x2={cx1} y2={fy2} stroke="#3b82f6" strokeWidth="1" strokeDasharray="3,3" />
            <line x1={cx2} y1={fy1} x2={cx2} y2={fy2} stroke="#3b82f6" strokeWidth="1" strokeDasharray="3,3" />
            <line x1={fx1} y1={cy1} x2={fx2} y2={cy1} stroke="#3b82f6" strokeWidth="1" strokeDasharray="3,3" />
            <line x1={fx1} y1={cy2} x2={fx2} y2={cy2} stroke="#3b82f6" strokeWidth="1" strokeDasharray="3,3" />

            {/* One-Way Shear critical section (at distance d from column face) */}
            {s1x_right < fx2 && <line x1={s1x_right} y1={fy1} x2={s1x_right} y2={fy2} stroke="#ea580c" strokeWidth="1.2" strokeDasharray="4,2" />}
            {s1x_left > fx1 && <line x1={s1x_left} y1={fy1} x2={s1x_left} y2={fy2} stroke="#ea580c" strokeWidth="1.2" strokeDasharray="4,2" />}
            {s1y_bot < fy2 && <line x1={fx1} y1={s1y_bot} x2={fx2} y2={s1y_bot} stroke="#ea580c" strokeWidth="1.2" strokeDasharray="4,2" />}
            {s1y_top > fy1 && <line x1={fx1} y1={s1y_top} x2={fx2} y2={s1y_top} stroke="#ea580c" strokeWidth="1.2" strokeDasharray="4,2" />}

            {/* Two-way punching shear perimeter (at distance d/2) */}
            <rect
              x={px1_c}
              y={py1_c}
              width={px2_c - px1_c}
              height={py2_c - py1_c}
              fill="rgba(239, 68, 68, 0.05)"
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="5,2"
            />

            {/* Column shape */}
            <rect
              x={cx1}
              y={cy1}
              width={colW}
              height={colH}
              fill="#475569"
              stroke="#334155"
              strokeWidth="1.5"
            />

            {/* Labels */}
            <text x={fx1 + 6} y={fy2 - 6} className="font-mono text-[8px] fill-slate-500 font-bold">
              d = {d.toFixed(0)} mm
            </text>
            <text x={W - 8} y={fy1 + 12} textAnchor="end" className="text-[8px] fill-red-600 font-bold">
              محيط الثقب b_0 = {punching_b0.toFixed(0)} mm
            </text>
          </svg>
        </div>

        <div className="mt-3 flex justify-between items-center text-[10px]">
          <div className="flex gap-2 items-center">
            <span className="w-2.5 h-0.5 inline-block bg-blue-500 border-b border-dashed"></span><span>الانحناء (وجه العمود)</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-2.5 h-0.5 inline-block bg-orange-600 border-b border-dashed"></span><span>القص العريض (d)</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-2.5 h-0.5 inline-block bg-red-500 border-b border-dashed"></span><span>محيط الثقب (d/2)</span>
          </div>
        </div>
      </div>

      {/* ── Visualizer 3: Eccentricity & Kern Diagram ── */}
      <div className="border border-border rounded-lg bg-card p-4 flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold text-foreground mb-1">اللامركزية ونواة التماس (Kern)</h3>
          <p className="text-[10px] text-muted-foreground mb-4">يقارن النقطة الفعلية للمحصلة بحد النواة (B/6, L/6) لضمان عدم حدوث شد.</p>
        </div>

        <div className="relative flex items-center justify-center bg-muted/20 rounded border border-border/50 overflow-hidden" style={{ height: H_view }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H_view}`} className="absolute inset-0">
            {/* Draw footing */}
            <rect
              x={fx1}
              y={fy1}
              width={footingW}
              height={footingH}
              fill="#f8fafc"
              stroke="#94a3b8"
              strokeWidth="1.5"
            />

            {/* Central Axes */}
            <line x1={cx_val} y1={fy1 - 10} x2={cx_val} y2={fy2 + 10} stroke="#cbd5e1" strokeWidth="0.8" />
            <line x1={fx1 - 10} y1={cy_val} x2={fx2 + 10} y2={cy_val} stroke="#cbd5e1" strokeWidth="0.8" />

            {/* Draw Kern Boundary (Rhombus shape at coordinate B/6 and L/6) */}
            {(() => {
              const kernW = (B / 6) * scale;
              const kernH = (L / 6) * scale;
              // Points of rhombus
              const topX = cx_val, topY = cy_val - kernH;
              const bottomX = cx_val, bottomY = cy_val + kernH;
              const leftX = cx_val - kernW, leftY = cy_val;
              const rightX = cx_val + kernW, rightY = cy_val;

              return (
                <polygon
                  points={`${topX},${topY} ${rightX},${leftY} ${bottomX},${bottomY} ${leftX},${leftY}`}
                  fill="rgba(34, 197, 94, 0.08)"
                  stroke="#22c55e"
                  strokeWidth="1"
                  strokeDasharray="4,2"
                />
              );
            })()}

            {/* Column stub center */}
            <circle cx={colX} cy={colY} r="3" fill="#64748b" />

            {/* Load Eccentricity point: calculated relative to footing center */}
            {(() => {
              // (ex, ey) coordinates in mm relative to footing center
              const eScrX = cx_val + ex * scale;
              const eScrY = cy_val - ey * scale;

              // Check if out of Kern limits
              const isOut = Math.abs(ex) > B / 6 || Math.abs(ey) > L / 6;

              return (
                <>
                  {/* Danger circle range if extreme */}
                  <circle
                    cx={eScrX}
                    cy={eScrY}
                    r="5"
                    fill={isOut ? "#ef4444" : "#22c55e"}
                    stroke="#fff"
                    strokeWidth="1.5"
                    className="animate-pulse"
                  />
                  {/* Cross-hair on load point */}
                  <line x1={eScrX - 8} y1={eScrY} x2={eScrX + 8} y2={eScrY} stroke={isOut ? "#b91c1c" : "#15803d"} strokeWidth="1" />
                  <line x1={eScrX} y1={eScrY - 8} x2={eScrX} y2={eScrY + 8} stroke={isOut ? "#b91c1c" : "#15803d"} strokeWidth="1" />

                  {/* Indicator labels */}
                  <text x={eScrX + 8} y={eScrY - 4} className="font-mono text-[9px] fill-foreground font-bold">
                    P: ({ex.toFixed(0)}, {ey.toFixed(0)})
                  </text>
                </>
              );
            })()}

            <text x={cx_val + (B/6)*scale + 4} y={cy_val + 10} className="text-[8px] fill-green-700">
              Kern limit (B/6)
            </text>
          </svg>
        </div>

        <div className="mt-3 flex justify-between items-center text-[10px]">
          <div className="flex gap-2 items-center">
            <span className="w-2.5 h-1 inline-block bg-green-500/20 border border-green-500 border-dashed"></span><span>منطقة النواة (حمولة مركزة)</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-2 h-2 rounded-full bg-red-500"></span><span>محصلة اللامركزية الفعلية</span>
          </div>
        </div>
      </div>

    </div>
  );
}
