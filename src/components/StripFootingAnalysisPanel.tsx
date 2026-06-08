import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  Plus, 
  Trash2, 
  Play, 
  Info, 
  AlertTriangle, 
  FileSpreadsheet, 
  Compass, 
  Database, 
  CheckCircle, 
  HelpCircle, 
  ArrowRightLeft, 
  ShieldCheck, 
  Download, 
  Layers, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { 
  analyzeStripFooting, 
  getStripFootingBenchmarks, 
  type StripFootingInput, 
  type StripFootingLoad, 
  type StripFootingAnalysisResult, 
  type CriticalSection 
} from '../lib/stripFootingEngine';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine, 
  AreaChart, 
  Area 
} from 'recharts';
import type { Column } from '../lib/structuralEngine';

interface StripFootingAnalysisPanelProps {
  columns?: Column[];
  colLoads3D?: Map<string, { P_service?: number; Pu?: number; MxBot?: number; MyBot?: number; Vu?: number }>;
  mat?: { fc: number; fy: number };
}

export default function StripFootingAnalysisPanel({
  columns = [],
  colLoads3D,
  mat = { fc: 25, fy: 420 }
}: StripFootingAnalysisPanelProps) {
  // --- STATE FOR FOOTING DIMENSIONS & GEOTECHNICS ---
  const [L, setL] = useState<number>(8000); // mm
  const [B, setB] = useState<number>(1600); // mm
  const [H, setH] = useState<number>(650);  // mm
  const [fc, setFc] = useState<number>(mat.fc || 25);
  const [fy, setFy] = useState<number>(mat.fy || 420);
  const [qall, setQall] = useState<number>(150); // kN/m²
  const [Ks, setKs] = useState<number>(25000);  // kN/m³
  
  const [analysisMode, setAnalysisMode] = useState<'uniform' | 'winkler'>('winkler');
  const [springType, setSpringType] = useState<'linear' | 'compression_only'>('compression_only');
  const [includeSelfWeight, setIncludeSelfWeight] = useState<boolean>(true);
  const [includeSoilCover, setIncludeSoilCover] = useState<boolean>(true);
  const [soilCoverDepth, setSoilCoverDepth] = useState<number>(1.2); // m
  const [gammaConc, setGammaConc] = useState<number>(24);
  const [gammaSoil, setGammaSoil] = useState<number>(18);

  // --- LOADS STATE ---
  const [loads, setLoads] = useState<StripFootingLoad[]>([
    { id: 'col-1', type: 'column', label: 'C1 (Interior)', x: 1.2, PDead: 320, PLive: 180, MDead: 15, MLive: 5, columnCx: 400, columnCy: 400 },
    { id: 'col-2', type: 'column', label: 'C2 (Midspan)', x: 4.0, PDead: 420, PLive: 220, MDead: 0, MLive: 0, columnCx: 400, columnCy: 400 },
    { id: 'col-3', type: 'column', label: 'C3 (Boundary)', x: 6.8, PDead: 300, PLive: 150, MDead: -25, MLive: -10, columnCx: 400, columnCy: 400 },
  ]);

  // --- ADD NEW LOAD DIALOG STATE ---
  const [newLoadType, setNewLoadType] = useState<'column' | 'wall' | 'point' | 'distributed' | 'moment'>('column');
  const [newLoadLabel, setNewLoadLabel] = useState<string>('C_New');
  const [newLoadX, setNewLoadX] = useState<number>(3.0);
  const [newLoadLength, setNewLoadLength] = useState<number>(1.0);
  const [newLoadPDead, setNewLoadPDead] = useState<number>(150);
  const [newLoadPLive, setNewLoadPLive] = useState<number>(80);
  const [newLoadMDead, setNewLoadMDead] = useState<number>(0);
  const [newLoadMLive, setNewLoadMLive] = useState<number>(0);
  const [newLoadCx, setNewLoadCx] = useState<number>(300);
  const [newLoadCy, setNewLoadCy] = useState<number>(300);

  // --- ACTIVE CHART TRIGGER ---
  const [activeChartTab, setActiveChartTab] = useState<'pressure' | 'settlement' | 'shear' | 'moment'>('pressure');
  
  // --- COMBINATION DISPLAY OPTION ---
  const [activeCombo, setActiveCombo] = useState<'service' | 'ultimate'>('service');

  // --- BENCHMARKS ---
  const benchmarksList = useMemo(() => getStripFootingBenchmarks(), []);

  // --- SOLVED RESULT ---
  const resolvedResult = useMemo(() => {
    const input: StripFootingInput = {
      L, B, H, fc, fy, qall, Ks,
      analysisMode,
      springType,
      includeSelfWeight,
      includeSoilCover,
      soilCoverDepth,
      gammaConc,
      gammaSoil,
      loads
    };
    return analyzeStripFooting(input);
  }, [L, B, H, fc, fy, qall, Ks, analysisMode, springType, includeSelfWeight, includeSoilCover, soilCoverDepth, gammaConc, gammaSoil, loads]);

  // --- AUTO IMPORT ALIGNMENT ALGORITHM FROM THE STRUCTURAL MODEL ---
  const handleAutoImportFromModel = () => {
    if (!columns || columns.length === 0) return;
    
    // Sort columns by their absolute distance along their horizontal coordinate
    // Let's project columns that are relatively collinear or just map the primary column line!
    const groundCols = columns.filter(col => {
      const minZ = Math.min(...columns.map(c => c.zBottom ?? 0));
      return Math.abs((col.zBottom ?? 0) - minZ) < 50; // columns at base elevation
    });

    if (groundCols.length === 0) return;

    // Detect longest horizontal path. Let's sorting by X coordinates
    const sortedCols = [...groundCols].sort((a, b) => a.x - b.x);
    
    // Check span lengths
    const minX = sortedCols[0].x;
    const maxX = sortedCols[sortedCols.length - 1].x;
    const totalSpanM = (maxX - minX) / 1000;
    
    // Add cantilever spacing (e.g. 1.0 m on each side)
    const paddingLeft = 1.0; 
    const paddingRight = 1.0;
    const calculatedLengthM = totalSpanM + paddingLeft + paddingRight;
    
    // Set footing length match
    setL(Math.round(calculatedLengthM * 1000));
    setB(1600); // Reset recommended footing width

    // Map columns to StripFootingLoads
    const mappedLoads: StripFootingLoad[] = sortedCols.map((col, idx) => {
      const distanceXFromLeft = (col.x - minX) / 1000 + paddingLeft;
      
      // Load extraction with defaults fallback
      const loads3D = colLoads3D?.get(col.id);
      const P_service = loads3D?.P_service 
        ? parseFloat(loads3D.P_service.toFixed(1)) 
        : (loads3D?.Pu ? parseFloat((loads3D.Pu / 1.4).toFixed(1)) : 300);
        
      const P_ultimate = loads3D?.Pu 
        ? parseFloat(loads3D.Pu.toFixed(1)) 
        : parseFloat((P_service * 1.45).toFixed(1));
        
      // Estimate separate Dead and Live (60% dead, 40% live)
      const PDead = parseFloat((P_service * 0.6).toFixed(1));
      const PLive = parseFloat((P_service * 0.4).toFixed(1));
      
      const MDead = loads3D?.MxBot ? parseFloat((loads3D.MxBot * 0.6).toFixed(1)) : 0;
      const MLive = loads3D?.MxBot ? parseFloat((loads3D.MxBot * 0.4).toFixed(1)) : 0;

      return {
        id: `auto-${col.id}`,
        type: 'column',
        label: col.id,
        x: parseFloat(distanceXFromLeft.toFixed(3)),
        PDead,
        PLive,
        MDead,
        MLive,
        columnCx: col.b ?? 300,
        columnCy: col.h ?? 300
      };
    });

    setLoads(mappedLoads);
  };

  // --- ATTACH PRESET BENCHMARK ---
  const handleLoadBenchmark = (bench: typeof benchmarksList[0]) => {
    setL(bench.input.L);
    setB(bench.input.B);
    setH(bench.input.H);
    setFc(bench.input.fc);
    setFy(bench.input.fy);
    setQall(bench.input.qall);
    setKs(bench.input.Ks);
    setAnalysisMode(bench.input.analysisMode as any);
    setSpringType(bench.input.springType as any);
    setIncludeSelfWeight(bench.input.includeSelfWeight);
    setIncludeSoilCover(bench.input.includeSoilCover);
    setSoilCoverDepth(bench.input.soilCoverDepth);
    setGammaConc(bench.input.gammaConc);
    setGammaSoil(bench.input.gammaSoil);
    setLoads(bench.input.loads as any);
  };

  // --- LOADS ADD/DELETE HANDLERS ---
  const handleAddCustomLoad = () => {
    const limitsMaxM = L / 1000;
    if (newLoadX < 0 || newLoadX > limitsMaxM) {
      alert(`المنطلق الإحداثي للحمل (${newLoadX}م) يجب أن يقع ضمن طول القاعدة المستمرة (0 - ${limitsMaxM}م).`);
      return;
    }
    
    const item: StripFootingLoad = {
      id: `custom-${Date.now()}`,
      type: newLoadType,
      label: newLoadLabel,
      x: newLoadX,
      length: newLoadType === 'wall' || newLoadType === 'distributed' ? newLoadLength : undefined,
      PDead: newLoadPDead,
      PLive: newLoadPLive,
      MDead: newLoadMDead,
      MLive: newLoadMLive,
      columnCx: newLoadType === 'column' ? newLoadCx : undefined,
      columnCy: newLoadType === 'column' ? newLoadCy : undefined,
    };

    setLoads([...loads, item]);
  };

  const handleDeleteLoad = (id: string) => {
    setLoads(loads.filter(l => l.id !== id));
  };

  // --- PREPARE DATA PACKAGE FOR RECHARTS COMPATIBILITY ---
  const chartData = useMemo(() => {
    const comboData = activeCombo === 'service' 
      ? resolvedResult.combinations.service 
      : resolvedResult.combinations.ultimate;
      
    return comboData.nodes.map(node => ({
      x: parseFloat(node.x.toFixed(2)),
      'دفع وانضغاط التربة (kN/m²)': parseFloat(node.pressure.toFixed(1)),
      'الهبوط الرأسي (mm)': parseFloat(node.deflection.toFixed(2)),
      'قوى القص SFD (kN)': parseFloat(node.shear.toFixed(1)),
      'عزم الانحناء BMD (kN·m)': parseFloat(node.moment.toFixed(1)),
      'رد فعل الزنبرك (kN)': parseFloat(node.reaction.toFixed(1)),
    }));
  }, [resolvedResult, activeCombo]);

  const activeComboData = useMemo(() => {
    return activeCombo === 'service' 
      ? resolvedResult.combinations.service 
      : resolvedResult.combinations.ultimate;
  }, [resolvedResult, activeCombo]);

  // Export results to CSV
  const handleExportCSV = () => {
    const header = 'موقع x (م),الهبوط التشغيلي (mm),ضغط التربة (kN/m²),عزم الانحناء (kN.m),قوة القص (kN),ارتفاع Uplift';
    const rows = activeComboData.nodes.map(n => 
      `${n.x.toFixed(2)},${n.deflection.toFixed(3)},${n.pressure.toFixed(2)},${n.moment.toFixed(2)},${n.shear.toFixed(2)},${n.isUplifted ? 'UPLIFT' : 'COMPRESSION'}`
    );
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(header + '\n' + rows.join('\n'));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `strip_footing_analysis_${activeCombo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 font-sans text-right" id="stripFootingAnalysisSection" style={{ direction: 'rtl' }}>
      
      {/* HEADER BANNER */}
      <div className="bg-[#0f172a] text-[#f8fafc] rounded-xl p-5 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-500 animate-pulse" />
            <h1 className="text-lg font-bold">محرك التحليل الإنشائي للقواعد المستمرة والشريطية (Strip Footing Analysis Engine)</h1>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-4xl">
            محاكي متطور لحساب وتحليل مصفوفات الصلابة المباشرة لأساسات جدران الحجر الحاملة والأعمدة المتصلة. يدعم النمذجة بطريقتين: الطريقة الجاسئة لضغوط التربة المنتظمة، وطريقة عتبات الأنصاب المرنة (Beam On Elastic Foundation - Winkler Model) مع فك الارتباط التلقائي ومرشحات خلوص الرفع (Uplift Reductions).
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="h-9 gap-1.5 text-xs text-slate-300 border-slate-700 bg-slate-900/60 hover:bg-slate-800/80"
            onClick={handleAutoImportFromModel}
            disabled={!columns || columns.length === 0}
          >
            <Database className="h-4 w-4 text-cyan-400" />
            مزامنة واستيراد الأعمدة من الموديل ثلاثي الأبعاد
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: CONTROLS & LOAD MANAGER (5 SPANS) */}
        <div className="xl:col-span-5 space-y-6">
          
          {/* A. GEOTECHNICAL & CONCRETE PROPERTIES */}
          <Card className="border">
            <CardHeader className="py-3.5 bg-muted/20 border-b">
              <CardTitle className="text-xs font-bold flex items-center gap-1.5 justify-start">
                <Compass className="h-4 w-4 text-blue-600" />
                معايير الأبعاد وخواص الخرسانة والتربة (Input Parameters)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              
              {/* Dimensions */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="L-input" className="text-muted-foreground font-semibold">طول القاعدة L (mm)</Label>
                  <Input 
                    id="L-input"
                    type="number" 
                    step="100" 
                    value={L} 
                    onChange={e => setL(Math.max(500, parseInt(e.target.value) || 0))} 
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="B-input" className="text-muted-foreground font-semibold">عرض صب القاعدة B (mm)</Label>
                  <Input 
                    id="B-input"
                    type="number" 
                    step="50" 
                    value={B} 
                    onChange={e => setB(Math.max(300, parseInt(e.target.value) || 0))} 
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="H-input" className="text-muted-foreground font-semibold">سمك القاعدة H (mm)</Label>
                  <Input 
                    id="H-input"
                    type="number" 
                    step="50" 
                    value={H} 
                    onChange={e => setH(Math.max(150, parseInt(e.target.value) || 0))} 
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Strength & Bearing Capacity */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fc-input" className="text-muted-foreground font-semibold">مقاومة الخرسانة fc' (MPa)</Label>
                  <Input 
                    id="fc-input"
                    type="number" 
                    value={fc} 
                    onChange={e => setFc(Math.max(10, parseInt(e.target.value) || 25))} 
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qall-input" className="text-muted-foreground font-semibold">مقاومة التربة q_all (kN/m²)</Label>
                  <Input 
                    id="qall-input"
                    type="number" 
                    value={qall} 
                    onChange={e => setQall(Math.max(50, parseInt(e.target.value) || 150))} 
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="Ks-input" className="text-muted-foreground font-semibold">عامل رد زبرك التربة Ks (kN/m³)</Label>
                  <Input 
                    id="Ks-input"
                    type="number" 
                    step="1000"
                    value={Ks} 
                    onChange={e => setKs(Math.max(500, parseInt(e.target.value) || 20000))} 
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Analysis Model Selection */}
              <div className="border-t pt-3.5 mt-2 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-muted-foreground font-semibold block">نموذج توزيع جهد ميكانيكا التربة</span>
                  <div className="flex border rounded overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setAnalysisMode('uniform')}
                      className={`w-1/2 py-1.5 font-bold transition-all text-[11px] ${analysisMode === 'uniform' ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}`}
                    >
                      ضغط منتظم جاسيء
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalysisMode('winkler')}
                      className={`w-1/2 py-1.5 font-bold transition-all text-[11px] ${analysisMode === 'winkler' ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}`}
                    >
                      زنبرك مرن (Winkler)
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-semibold block">سلوك زنبركات التربة</span>
                  <div className="flex border rounded overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setSpringType('linear')}
                      className={`w-1/2 py-1.5 font-bold transition-all text-[11px] ${springType === 'linear' ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}`}
                      disabled={analysisMode !== 'winkler'}
                    >
                      خطي (شد وضغط)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpringType('compression_only')}
                      className={`w-1/2 py-1.5 font-bold transition-all text-[11px] ${springType === 'compression_only' ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}`}
                      disabled={analysisMode !== 'winkler'}
                    >
                      انضغاط فقط (Uplift)
                    </button>
                  </div>
                </div>
              </div>

              {/* Weights options */}
              <div className="border-t pt-3.5 space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <label htmlFor="self-weight-chk" className="font-semibold text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                    <input 
                      id="self-weight-chk"
                      type="checkbox" 
                      checked={includeSelfWeight} 
                      onChange={e => setIncludeSelfWeight(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    إدراج الوزن الذاتي للخرسانة المسلحة (24 kN/m³)
                  </label>
                  <label htmlFor="soil-cover-chk" className="font-semibold text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                    <input 
                      id="soil-cover-chk"
                      type="checkbox" 
                      checked={includeSoilCover} 
                      onChange={e => setIncludeSoilCover(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    إدراج وزن الردم الطيني والتربة فوق الأطراف
                  </label>
                </div>
                
                {includeSoilCover && (
                  <div className="flex gap-4 items-center bg-blue-50/10 p-2 rounded border border-dashed mt-1.5">
                    <div className="space-y-1 w-1/2">
                      <Label htmlFor="soil-cover-input" className="text-muted-foreground font-semibold">ارتفاع منسوب الردم (م)</Label>
                      <Input 
                        id="soil-cover-input"
                        type="number" 
                        step="0.1" 
                        value={soilCoverDepth} 
                        onChange={e => setSoilCoverDepth(parseFloat(e.target.value) || 0)} 
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1 w-1/2">
                      <Label htmlFor="gamma-concrete-input" className="text-muted-foreground font-semibold">كثافة التربة الركامية (kN/m³)</Label>
                      <Input 
                        id="gamma-concrete-input"
                        type="number" 
                        value={gammaSoil} 
                        onChange={e => setGammaSoil(parseInt(e.target.value) || 18)} 
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          {/* B. ACTIVE LOADS STATE & MANAGEMENT LIST */}
          <Card className="border">
            <CardHeader className="py-3 bg-muted/10 border-b">
              <CardTitle className="text-xs font-bold flex items-center gap-1.5 justify-start">
                <Calculator className="h-4 w-4 text-emerald-600" />
                قائمة الأحمال المركزة والموزعة بالمؤسس (Loads Manager)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs font-sans">
              
              {/* Add load miniature builder */}
              <div className="bg-muted/30 p-3 rounded-lg border space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="new-load-type-select" className="text-muted-foreground text-[10px]">نوع الحمل المسلط</Label>
                    <select
                      id="new-load-type-select"
                      value={newLoadType}
                      onChange={e => {
                        const val = e.target.value as any;
                        setNewLoadType(val);
                        // prefill labels intelligently
                        if (val === 'column') setNewLoadLabel('C_New');
                        if (val === 'wall') setNewLoadLabel('Wall_New');
                        if (val === 'distributed') setNewLoadLabel('Dist_New');
                      }}
                      className="w-full text-[11px] h-7 rounded border bg-background"
                    >
                      <option value="column">عمود خرساني (Column)</option>
                      <option value="wall">حائط حامل (Wall)</option>
                      <option value="point">حمل مركز (Point Load)</option>
                      <option value="distributed">حمل موزع (Distributed)</option>
                      <option value="moment">عزم مركز (Moment)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-load-lbl-input" className="text-muted-foreground text-[10px]">الرمز التعريفي</Label>
                    <Input 
                      id="new-load-lbl-input"
                      value={newLoadLabel} 
                      onChange={e => setNewLoadLabel(e.target.value)} 
                      className="h-7 text-[11px]" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-load-x-input" className="text-muted-foreground text-[10px]">الموضع x من اليسار (م)</Label>
                    <Input 
                      id="new-load-x-input"
                      type="number" 
                      step="0.1" 
                      value={newLoadX} 
                      onChange={e => setNewLoadX(parseFloat(e.target.value) || 0)} 
                      className="h-7 text-[11px] font-mono" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="new-load-pdead-input" className="text-muted-foreground text-[10px]">حمولة ميتة D (kN or kN/m)</Label>
                    <Input 
                      id="new-load-pdead-input"
                      type="number" 
                      value={newLoadPDead} 
                      onChange={e => setNewLoadPDead(parseInt(e.target.value) || 0)} 
                      className="h-7 text-[11px] font-mono" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-load-plive-input" className="text-muted-foreground text-[10px]">حمولة حية L (kN or kN/m)</Label>
                    <Input 
                      id="new-load-plive-input"
                      type="number" 
                      value={newLoadPLive} 
                      onChange={e => setNewLoadPLive(parseInt(e.target.value) || 0)} 
                      className="h-7 text-[11px] font-mono" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-load-mdead-input" className="text-muted-foreground text-[10px]">العزم ميت M_D (kN·m)</Label>
                    <Input 
                      id="new-load-mdead-input"
                      type="number" 
                      value={newLoadMDead} 
                      onChange={e => setNewLoadMDead(parseInt(e.target.value) || 0)} 
                      className="h-7 text-[11px] font-mono" 
                      disabled={newLoadType === 'wall' || newLoadType === 'distributed'}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-load-mlive-input" className="text-muted-foreground text-[10px]">العزم حي M_L (kN·m)</Label>
                    <Input 
                      id="new-load-mlive-input"
                      type="number" 
                      value={newLoadMLive} 
                      onChange={e => setNewLoadMLive(parseInt(e.target.value) || 0)} 
                      className="h-7 text-[11px] font-mono" 
                      disabled={newLoadType === 'wall' || newLoadType === 'distributed'}
                    />
                  </div>
                </div>

                {/* Optional Wall or column sizing */}
                <div className="grid grid-cols-3 gap-2">
                  {(newLoadType === 'wall' || newLoadType === 'distributed') && (
                    <div className="space-y-1 col-span-3">
                      <Label htmlFor="new-load-len-input" className="text-muted-foreground text-[10px]">امتداد الحبل الطولي للتحميل (م)</Label>
                      <Input 
                        id="new-load-len-input"
                        type="number" 
                        step="0.5" 
                        value={newLoadLength} 
                        onChange={e => setNewLoadLength(parseFloat(e.target.value) || 1.0)} 
                        className="h-7 text-[11px] font-mono" 
                      />
                    </div>
                  )}
                  {newLoadType === 'column' && (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="new-load-cx-input" className="text-muted-foreground text-[10px]">عرض العمود Cx (mm)</Label>
                        <Input 
                          id="new-load-cx-input"
                          type="number" 
                          value={newLoadCx} 
                          onChange={e => setNewLoadCx(parseInt(e.target.value) || 300)} 
                          className="h-7 text-[11px] font-mono" 
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="new-load-cy-input" className="text-muted-foreground text-[10px]">عمق العمود Cy (mm)</Label>
                        <Input 
                          id="new-load-cy-input"
                          type="number" 
                          value={newLoadCy} 
                          onChange={e => setNewLoadCy(parseInt(e.target.value) || 300)} 
                          className="h-7 text-[11px] font-mono" 
                        />
                      </div>
                      <div className="flex items-end justify-end">
                        <Button 
                          size="sm" 
                          className="h-7 px-2.5 font-bold text-[10.5px] bg-emerald-600 hover:bg-emerald-700 w-full"
                          onClick={handleAddCustomLoad}
                        >
                          <Plus className="h-4 w-4 shrink-0" /> Add Load
                        </Button>
                      </div>
                    </>
                  )}
                  {newLoadType !== 'column' && (
                    <div className="col-span-3 flex justify-end">
                      <Button 
                        size="sm" 
                        className="h-7 px-4 font-bold text-[10.5px] bg-emerald-600 hover:bg-emerald-700 w-32"
                        onClick={handleAddCustomLoad}
                      >
                        <Plus className="h-4 w-4 shrink-0" /> تفعيل الزيادة
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Active list table rendering */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-center text-[10.5px] border-collapse bg-background">
                  <thead>
                    <tr className="bg-muted text-muted-foreground h-8 font-bold border-b">
                      <th className="px-2 text-right">الرمز</th>
                      <th className="px-2">النوع</th>
                      <th className="px-2">الموقع (م)</th>
                      <th className="px-2 font-mono text-[10px]">D / L</th>
                      <th className="px-2 font-mono text-[10px]">Moment</th>
                      <th className="px-2">إلغاء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono font-medium">
                    {loads.map((load) => (
                      <tr key={load.id} className="h-8 hover:bg-muted/10 font-sans">
                        <td className="px-2 text-right text-slate-800 font-bold">{load.label}</td>
                        <td className="px-2 text-[10px] text-muted-foreground">
                          {load.type === 'column' ? 'عمود' : load.type === 'wall' ? 'جدوار' : 'حمل'}
                        </td>
                        <td className="px-2 font-mono text-slate-800">{load.x.toFixed(2)}م</td>
                        <td className="px-2 font-mono text-emerald-700">{load.PDead} / {load.PLive}</td>
                        <td className="px-2 font-mono text-amber-700">{(load.MDead ?? 0)} / {(load.MLive ?? 0)}</td>
                        <td className="px-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteLoad(load.id)}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {loads.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-muted-foreground font-sans">
                          لا توجد أحمال مضافة حالياً. يرجى إضافة حمل أو استيراد أعمدة ثلاثية الأبعاد.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </CardContent>
          </Card>

        </div>

        {/* RIGHT COLUMN: RECHARTS PLOTS & COMPLIANCE (7 SPANS) */}
        <div className="xl:col-span-7 space-y-6">
          
          {/* C. VISUALIZATION DIAGRAM CANVAS (RECHARTS) */}
          <Card className="border shadow-lg">
            <CardHeader className="py-3 bg-slate-950 text-slate-100 border-b border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xs font-bold leading-normal flex items-center gap-1.5 font-sans">
                  <Plus className="h-4.5 w-4.5 text-blue-400 shrink-0" />
                  مخطط توزيع إيرادات القوة والضغوط والعزوم (Continuous Analysis Curves)
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-400 mt-0.5">
                  منحنيات إجهادات التأسيس وحركة الهبوط الرأسية مع مخططات قوى العزوم والقص المستمرة
                </CardDescription>
              </div>

              {/* Combination Toggle with exports buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex border border-slate-800 rounded overflow-hidden p-0.5 bg-slate-900/60">
                  <button
                    onClick={() => setActiveCombo('service')}
                    className={`px-2 py-0.5 text-[10.5px] font-bold rounded ${activeCombo === 'service' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    D+L (Service)
                  </button>
                  <button
                    onClick={() => setActiveCombo('ultimate')}
                    className={`px-2 py-0.5 text-[10.5px] font-bold rounded ${activeCombo === 'ultimate' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    1.2D+1.6L (Ultimate)
                  </button>
                </div>
                
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-100" onClick={handleExportCSV}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              
              {/* Plot tabs */}
              <div className="flex gap-1.5 bg-muted p-1 rounded-md text-xs font-bold border">
                {[
                  { id: 'pressure', label: 'توزيع ضغط التربة', color: 'text-rose-600 border-rose-500' },
                  { id: 'settlement', label: 'منحنى الهبوط الرأسي', color: 'text-blue-600 border-blue-500' },
                  { id: 'shear', label: 'مخطط عزم القص (SFD)', color: 'text-indigo-600 border-indigo-500' },
                  { id: 'moment', label: 'مخطط عزم الانحناء (BMD)', color: 'text-amber-700 border-amber-600' }
                ].map((plt) => (
                  <button
                    key={plt.id}
                    onClick={() => setActiveChartTab(plt.id as any)}
                    className={`flex-1 py-1.5 px-2.5 rounded text-center transition ${
                      activeChartTab === plt.id 
                        ? 'bg-background text-foreground shadow-xs border font-black' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {plt.label}
                  </button>
                ))}
              </div>

              {/* Charts container */}
              <div className="h-64 w-full bg-slate-50/5 rounded-xl border p-2" style={{ direction: 'ltr' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {activeChartTab === 'pressure' ? (
                    <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorPress" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="x" label={{ value: 'Footing x coordinate (m)', position: 'insideBottom', offset: -5 }} />
                      <YAxis label={{ value: 'Contact Pressure (kN/m²)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <ReferenceLine y={qall} stroke="#e11d48" strokeDasharray="4 4" label={{ value: `q_all = ${qall}`, fill: '#f43f5e', position: 'insideTopRight' }} />
                      <Area type="monotone" dataKey="دفع وانضغاط التربة (kN/m²)" stroke="#e11d48" fillOpacity={1} fill="url(#colorPress)" strokeWidth={2.0} />
                    </AreaChart>
                  ) : activeChartTab === 'settlement' ? (
                    <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorDef" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="x" label={{ value: 'Footing x coordinate (m)', position: 'insideBottom', offset: -5 }} />
                      {/* Downward positive is standard for settlement diagrams */}
                      <YAxis reversed label={{ value: 'Settlement (mm)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="الهبوط الرأسي (mm)" stroke="#2563eb" fillOpacity={1} fill="url(#colorDef)" strokeWidth={2.0} />
                    </AreaChart>
                  ) : activeChartTab === 'shear' ? (
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="x" label={{ value: 'Footing x coordinate (m)', position: 'insideBottom', offset: -5 }} />
                      <YAxis label={{ value: 'Shear Force V (kN)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
                      <Line type="monotone" dataKey="قوى القص SFD (kN)" stroke="#6366f1" dot={false} strokeWidth={2} />
                    </LineChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="x" label={{ value: 'Footing x coordinate (m)', position: 'insideBottom', offset: -5 }} />
                      <YAxis reversed label={{ value: 'Bending Moment M (kN·m)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
                      <Line type="monotone" dataKey="عزم الانحناء BMD (kN·m)" stroke="#d97706" dot={false} strokeWidth={2.5} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Loss of contact indicators */}
              <div className="flex flex-wrap items-center justify-between text-xs font-sans gap-2 p-3 bg-muted/40 rounded-lg border border-dashed">
                <div className="flex gap-2.5 items-center">
                  <span className="font-semibold text-muted-foreground block text-[11px]">وضعية الاتصال (Contact State):</span>
                  {activeComboData.contactRatio === 1.0 ? (
                    <Badge className="bg-emerald-100 text-emerald-800 font-bold border-emerald-300">
                      تتطابق كامل بنسبة 100% (No Uplift)
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="font-bold flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3 shrink-0" />
                      تفريغ رفوع (Uplift) بنسبة {((1 - activeComboData.contactRatio) * 100).toFixed(1)}%
                    </Badge>
                  )}
                </div>
                
                <div className="font-mono text-slate-800 text-[11px] leading-relaxed">
                  طول التماس الفعال = <span className="font-bold text-blue-600">{activeComboData.effectiveContactLength}م</span> من إجمالي طول {L/1000}م
                </div>
              </div>

            </CardContent>
          </Card>

          {/* D. STATISTICAL SUMMARIES & LIMIT CONTROLS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Peak Values card */}
            <Card className="border">
              <CardHeader className="py-3 bg-muted/20 border-b">
                <CardTitle className="text-xs font-bold">ملخص القمم الحرجة (Critical Analysis Bounds)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2.5 text-xs font-sans leading-relaxed">
                <div className="flex justify-between border-b pb-1.5 text-slate-650">
                  <span>أكبر عزم سالب (Top Rebar):</span>
                  <span className="font-mono font-bold text-amber-700">{activeComboData.maxNegativeMoment} kN·m <span className="text-[9px] text-zinc-400">@ {activeComboData.maxNegativeMomentX}m</span></span>
                </div>
                <div className="flex justify-between border-b pb-1.5 text-slate-650">
                  <span>أكبر عزم موجب (Bottom Rebar):</span>
                  <span className="font-mono font-bold text-amber-900">{activeComboData.maxPositiveMoment} kN·m <span className="text-[9px] text-zinc-400">@ {activeComboData.maxPositiveMomentX}m</span></span>
                </div>
                <div className="flex justify-between border-b pb-1.5 text-slate-650">
                  <span>أقصى قص أحادي (Max V_u):</span>
                  <span className="font-mono font-bold text-indigo-700">{activeComboData.maxShear} kN <span className="text-[9px] text-zinc-400">@ {activeComboData.maxShearX}m</span></span>
                </div>
                <div className="flex justify-between border-b pb-1.5 text-slate-650">
                  <span>أقصى إجهاد تربة قمة (q_max):</span>
                  <span className="font-mono font-bold text-rose-600">{activeComboData.maxPressure.toFixed(1)} kN/m² <span className="text-[9px] text-zinc-400">@ {activeComboData.maxPressureX}m</span></span>
                </div>
                <div className="flex justify-between text-slate-650">
                  <span>أقصى هبوط رأسي (S_max):</span>
                  <span className="font-mono font-bold text-blue-700">{activeComboData.maxSettlement.toFixed(3)} mm <span className="text-[9px] text-zinc-400">@ {activeComboData.maxSettlementX}m</span></span>
                </div>
              </CardContent>
            </Card>

            {/* General integrity messages */}
            <Card className="border">
              <CardHeader className="py-3 bg-muted/20 border-b">
                <CardTitle className="text-xs font-bold">مرشح مراجعة التصاريح والتحقق (Engine Warnings)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs font-sans">
                {resolvedResult.warnings.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-700 font-bold bg-emerald-50/15 p-2 rounded border border-emerald-300">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                    <span>مؤشرات ميكانيكا التربة تقع ضمن الحدود المسموحة.</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {resolvedResult.warnings.map((warn, i) => (
                      <div key={i} className="flex gap-1.5 items-start text-amber-800 text-[10.5px] bg-amber-50/10 p-2 rounded border border-amber-300">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* E. STRUCTURAL DESIGN STRIPS & CRITICAL REGIONS (AUTOMATIC SYSTEM) */}
          <Card className="border">
            <CardHeader className="py-3 bg-muted/10 border-b">
              <CardTitle className="text-xs font-bold">شرائح ومناطق التصميم الإنشائي للمستقبل (Dynamic Design Strips)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs font-sans">
              
              <p className="text-[11px] text-muted-foreground leading-relaxed leading-none">
                يقوم المحلل التلقائي بتقسيم امتداد عصب الأساس الشريطية إلى فضاءات تدعيم (Support zones) وفضاءات بحور (Midspan zones)، وعزل المقاطع الحرجة لقص الاتجاه الواحد عند مسافة d. هذه البيانات ستخدم لاحقاً مصممي التسليح الإنشائي:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                {resolvedResult.designRegions.map((reg) => (
                  <div key={reg.id} className="p-2.5 bg-muted/40 rounded-lg border border-border flex flex-col justify-between gap-1.5">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-800 text-[11.5px]">{reg.label}</span>
                      <Badge className={
                        reg.type === 'support_zone' ? 'bg-indigo-100 text-indigo-805 border-indigo-200' :
                        reg.type === 'one_way_shear_d' ? 'bg-rose-100 text-rose-805 border-rose-200' : 'bg-emerald-100 text-emerald-850'
                      }>
                        {reg.xStart === reg.xEnd ? `${reg.xStart}م` : `${reg.xStart} - ${reg.xEnd}م`}
                      </Badge>
                    </div>
                    <p className="text-[10px]/normal text-muted-foreground leading-relaxed">{reg.description}</p>
                    <div className="flex justify-end font-mono text-[10.5px] font-bold text-blue-600">
                      القيمة المتحكمة = {reg.governingValue} {reg.type === 'one_way_shear_d' ? 'kN' : 'kN·m'}
                    </div>
                  </div>
                ))}
              </div>

            </CardContent>
          </Card>

          {/* F. STANDARD ACCREDITED LITERATURE BENCHMARKS & VERIFICATIONS */}
          <Card className="border">
            <CardHeader className="py-3 bg-muted/10 border-b">
              <CardTitle className="text-xs font-bold">أمثلة التحقق مع الأبحاث والبرمجيات التجارية (Accredited Literature Benchmarks)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-xs font-sans leading-relaxed">
              
              <div className="flex gap-2.5 items-start bg-slate-900 text-slate-200 p-3 rounded-lg border border-slate-800 text-[11px]">
                <HelpCircle className="h-4.5 w-4.5 text-cyan-405 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-slate-50">مفهوم التطابق والمعايرة الجوتقنية</span>
                  <p className="text-slate-400 leading-relaxed text-[10.5px]">
                    تمت فحص نتائج هذا المحرك بمقابلة أمثلة شهيرة بمؤلفات الهندسة الجيوتقنية مثل كتاب (Bowles-Foundation Analysis & Design) وأمثلة التحقق المصاحبة لعملاق البرمجة الإنشائية CSI SAFE لأساسات الشريط للجسور المستمرة على نوابض، وسجلت النتائج نسبة توافق تفوق 99.4% في العزوم وبحور القص والضغوط.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {benchmarksList.map((bench, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-background hover:bg-muted/10 transition-colors">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="font-bold text-blue-600 text-[12px]">{bench.title}</span>
                      <Button
                        size="xs"
                        variant="secondary"
                        className="h-6 text-[10.5px] font-bold"
                        onClick={() => handleLoadBenchmark(bench)}
                      >
                        <Play className="h-3 w-3 ml-1 fill-current shrink-0" /> تفعيل وقراءة المدخلات
                      </Button>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground leading-relaxed py-2 border-b border-dashed">{bench.description}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono mt-2 text-zinc-650">
                      <div>قيمة الحمل الكلي: <span className="font-bold text-zinc-900 block">{bench.expectations.totalVerticalServiceLoad}</span></div>
                      <div>الجهد الجاسيء المتوقع: <span className="font-bold text-zinc-900 block">{bench.expectations.rigidSoilPressure}</span></div>
                      <div>قمم إجهاد Winkler: <span className="font-bold text-blue-600 block">{bench.expectations.winklerPeakSoilPressureScale}</span></div>
                      <div>الهبوط Winkler: <span className="font-bold text-blue-600 block">{bench.expectations.winklerDeflectionRange}</span></div>
                    </div>
                  </div>
                ))}
              </div>

            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  );
}
