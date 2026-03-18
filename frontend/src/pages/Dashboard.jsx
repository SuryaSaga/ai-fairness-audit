import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title,
} from "chart.js";
import { Radar, Bar } from "react-chartjs-2";
import { Activity, AlertTriangle, CheckCircle, Shield, TrendingUp, Users, RefreshCw, Upload } from "lucide-react";
import { getReports } from "../lib/api";
import { useAuth } from "../context/AuthContext";

ChartJS.register(
  RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title
);

const GRADE_COLOR = { A: "text-green-600", "B+": "text-indigo-600", B: "text-blue-500", C: "text-amber-500", F: "text-red-600" };
const GRADE_TEXT = {
  A: "Excellent Fairness",
  "B+": "Acceptable Fairness",
  B: "Below Average Fairness",
  C: "Poor Fairness",
  F: "Critical Bias Detected",
};

export default function Dashboard() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchReports = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getReports();
      setReports(data);
      if (data.length > 0) setSelected(data[0]);
    } catch (err) {
      setError(err.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  // Build chart data from selected report
  const radarData = selected ? {
    labels: ["Disparate Impact", "Statistical Parity", "Equal Opportunity", "Predictive Equality", "Treatment Equality"],
    datasets: [{
      label: selected.dataset_name,
      data: [
        selected.metrics?.disparate_impact ?? 0,
        selected.metrics?.statistical_parity ?? 0,
        selected.metrics?.equal_opportunity ?? 0,
        selected.metrics?.predictive_equality ?? 0,
        selected.metrics?.treatment_equality ?? 0,
      ],
      backgroundColor: "rgba(99, 102, 241, 0.2)",
      borderColor: "rgba(99, 102, 241, 1)",
      borderWidth: 2,
      pointBackgroundColor: "rgba(99, 102, 241, 1)",
      pointBorderColor: "#fff",
    }],
  } : null;

  const barData = selected?.group_stats ? {
    labels: selected.group_stats.map((g) => g.group),
    datasets: [
      {
        label: "Approval Rate (%)",
        data: selected.group_stats.map((g) => g.approval_rate),
        backgroundColor: "rgba(99, 102, 241, 0.8)",
        borderRadius: 4,
      },
    ],
  } : null;

  const radarOptions = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: { color: "rgba(0,0,0,0.1)" }, grid: { color: "rgba(0,0,0,0.1)" },
        pointLabels: { color: "#64748b", font: { size: 12 } },
        ticks: { display: false, min: 0, max: 1 },
      },
    },
    plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 20 } } },
  };

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "top" } },
    scales: {
      y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` }, grid: { borderDash: [2, 4], color: "rgba(0,0,0,0.05)" } },
      x: { grid: { display: false } },
    },
  };

  // Empty state
  if (!loading && reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-5">
          <Upload className="w-10 h-10 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">No audits yet</h2>
        <p className="text-slate-500 mb-6 max-w-sm">Upload your first dataset to run a fairness audit and see the results here.</p>
        <button onClick={() => navigate("/upload")} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
          Upload Dataset
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bias Audit Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {user?.name ? `Hello, ${user.name}! ` : ""}Showing your latest fairness audit results.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchReports} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => navigate("/upload")} className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors">
            + New Audit
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">{error}</div>
      )}

      {/* Report selector if multiple */}
      {reports.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {reports.map((r) => (
            <button
              key={r.report_id}
              onClick={() => setSelected(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                selected?.report_id === r.report_id
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {r.dataset_name}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Fairness Grade</p>
                <div className={`text-4xl font-extrabold tracking-tighter ${GRADE_COLOR[selected.grade] || "text-slate-700"}`}>
                  {selected.grade || "—"}
                </div>
                <p className="text-xs text-slate-400 mt-2">{GRADE_TEXT[selected.grade] || ""}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600"><Shield className="w-6 h-6" /></div>
            </div>

            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Disparate Impact</p>
                <div className="text-3xl font-bold text-slate-800">{selected.metrics?.disparate_impact?.toFixed(2) ?? "—"}</div>
                <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${selected.metrics?.disparate_impact >= 0.8 ? "text-green-600" : "text-red-500"}`}>
                  {selected.metrics?.disparate_impact >= 0.8
                    ? <><CheckCircle className="w-3 h-3" /> Passes 80% Rule</>
                    : <><AlertTriangle className="w-3 h-3" /> Fails 80% Rule</>}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600"><Activity className="w-6 h-6" /></div>
            </div>

            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Records Audited</p>
                <div className="text-3xl font-bold text-slate-800">{selected.total_records ? selected.total_records.toLocaleString() : selected.summary?.match(/(\d+)/)?.[0] || "—"}</div>
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {selected.group_stats?.length || "?"} groups detected
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600"><Users className="w-6 h-6" /></div>
            </div>

            <div className={`bg-white border p-6 rounded-2xl shadow-sm flex items-start justify-between ${selected.metrics?.equal_opportunity < 0.8 ? "border-l-4 border-l-amber-500 border-slate-200" : "border-slate-200"}`}>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Equal Opportunity</p>
                <div className="text-3xl font-bold text-slate-800">{selected.metrics?.equal_opportunity != null ? `${(selected.metrics.equal_opportunity * 100).toFixed(0)}%` : "—"}</div>
                <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${selected.metrics?.equal_opportunity >= 0.8 ? "text-green-600" : "text-amber-600"}`}>
                  {selected.metrics?.equal_opportunity >= 0.8 ? <><TrendingUp className="w-3 h-3" /> Good</> : <><AlertTriangle className="w-3 h-3" /> Needs attention</>}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selected.metrics?.equal_opportunity >= 0.8 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                {selected.metrics?.equal_opportunity >= 0.8 ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Fairness Dimensions</h3>
              <p className="text-sm text-slate-500 mb-4">Multi-metric radar. Values closer to 1 = fairer.</p>
              <div className="flex-1 min-h-[280px] relative">
                {radarData && <Radar data={radarData} options={radarOptions} />}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Outcome Rates by Group</h3>
              <p className="text-sm text-slate-500 mb-4">Positive approval rates across demographic groups.</p>
              <div className="flex-1 min-h-[280px]">
                {barData && <Bar data={barData} options={barOptions} />}
              </div>
            </div>
          </div>

          {/* Actionable Recommendations */}
          {selected.recommendations && selected.recommendations.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">Actionable Recommendations</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selected.recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    <p className="text-sm text-slate-700 leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grade Banner */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="w-32 h-32 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex flex-col items-center justify-center shrink-0">
                <span className="text-5xl font-black drop-shadow-md">{selected.grade}</span>
                <span className="text-xs text-indigo-100 font-medium uppercase tracking-wider mt-1">Grade</span>
              </div>
              <div className="text-center md:text-left">
                <h2 className="text-2xl font-bold mb-2">{GRADE_TEXT[selected.grade] || "Audit Complete"}</h2>
                <p className="text-indigo-100 leading-relaxed max-w-2xl">{selected.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                  {selected.metrics && Object.entries(selected.metrics).map(([k, v]) => (
                    <span key={k} className={`px-3 py-1 backdrop-blur rounded-full text-xs font-medium ${v >= 0.8 ? "bg-green-500/30" : "bg-red-500/30"}`}>
                      {k.replace(/_/g, " ")}: {v >= 0.8 ? "Pass" : "Fail"}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
