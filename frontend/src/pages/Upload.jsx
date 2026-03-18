import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload as UploadIcon, FileUp, CheckCircle2, FileText, AlertCircle, XCircle, ChevronRight, Settings2, RefreshCw } from "lucide-react";
import { uploadDataset, previewDataset } from "../lib/api";

export default function Upload() {
  const [step, setStep] = useState(1); // 1: Select, 2: Map, 3: Result
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({ outcome: "", group: "", label: "" });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  
  const handleFile = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError("");
    setUploading(true);
    try {
      const data = await previewDataset(selectedFile);
      setPreview(data);
      // Auto-detect defaults
      const cols = data.columns.map(c => c.name.toLowerCase());
      const outcomeKeywords = ["shortlisted", "hired", "hired", "selected", "prediction", "predicted", "outcome", "label", "decision", "approved", "result", "score"];
      const groupKeywords = ["race", "gender", "sex", "age_group", "ethnicity", "nationality", "group", "protected"];
      
      let detectedOutcome = data.columns.find(c => outcomeKeywords.some(kw => c.name.toLowerCase().includes(kw)))?.name || data.columns[0]?.name;
      let detectedGroup = data.columns.find(c => groupKeywords.some(kw => c.name.toLowerCase().includes(kw)) && c.name !== detectedOutcome)?.name || data.columns[1]?.name;
      
      setMapping({ outcome: detectedOutcome, group: detectedGroup, label: "" });
      setStep(2);
    } catch (err) {
      setError(err.message || "Failed to read file preview.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) handleFile(e.dataTransfer.files[0]);
  };
  
  const handleFileChange = (e) => { if (e.target.files?.length > 0) handleFile(e.target.files[0]); };

  const handleUpload = async () => {
    setUploading(true);
    setProgress(0);
    setError("");
    try {
      const data = await uploadDataset(file, (pct) => setProgress(pct), mapping);
      setResult(data);
      setStep(3);
    } catch (err) {
      setError(err.message || "Audit failed. Check your column mappings.");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => { setFile(null); setResult(null); setError(""); setProgress(0); setStep(1); setPreview(null); };

  return (
    <div className="max-w-4xl mx-auto w-full pb-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Upload Dataset</h1>
        <p className="text-slate-500 mt-2">Step {step} of 3: {step === 1 ? "Select Data" : step === 2 ? "Configure Mapping" : "Audit Results"}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Step Indicator */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 py-3 px-4 text-center text-sm font-medium border-b-2 transition-colors ${step === s ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400"}`}>
              {s === 1 ? "1. Select File" : s === 2 ? "2. Map Columns" : "3. Audit Results"}
            </div>
          ))}
        </div>

        <div className="p-8">
          {step === 1 && (
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
                isDragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:bg-slate-50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <input type="file" onChange={handleFileChange} className="hidden" accept=".csv,.json" ref={fileInputRef} disabled={uploading} />
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                {uploading ? <RefreshCw className="w-8 h-8 animate-spin" /> : <FileUp className="w-8 h-8" />}
              </div>
              <h3 className="text-lg font-semibold mb-2 text-slate-800">{uploading ? "Reading File..." : "Click to upload or drag and drop"}</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">CSV or JSON files. Max 50MB.</p>
              {error && <p className="text-red-500 text-sm mt-4 font-medium">{error}</p>}
            </div>
          )}

          {step === 2 && preview && (
            <div className="space-y-6">
              <div className="flex items-center p-4 bg-indigo-50 rounded-lg border border-indigo-100 gap-4">
                <FileText className="w-6 h-6 text-indigo-600" />
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">{preview.columns.length} columns detected</p>
                </div>
                <button onClick={reset} className="text-sm text-slate-500 hover:text-red-500 font-medium">Change File</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Outcome Column (Required)</label>
                    <p className="text-xs text-slate-500 mb-2">The column containing model predictions (e.g. 0/1, hired/rejected).</p>
                    <select 
                      value={mapping.outcome} 
                      onChange={(e) => setMapping({...mapping, outcome: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                      <option value="">Select Column...</option>
                      {preview.columns.map(c => <option key={c.name} value={c.name}>{c.name} ({c.type})</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Sensitive Group (Required)</label>
                    <p className="text-xs text-slate-500 mb-2">Demographic attribute to audit for bias (e.g. Gender, Race).</p>
                    <select 
                      value={mapping.group} 
                      onChange={(e) => setMapping({...mapping, group: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                      <option value="">Select Column...</option>
                      {preview.columns.map(c => <option key={c.name} value={c.name}>{c.name} ({c.type})</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">True Label (Optional)</label>
                    <p className="text-xs text-slate-500 mb-2">Ground truth values for advanced accuracy-based metrics.</p>
                    <select 
                      value={mapping.label} 
                      onChange={(e) => setMapping({...mapping, label: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                      <option value="">None / Auto-detect</option>
                      {preview.columns.map(c => <option key={c.name} value={c.name}>{c.name} ({c.type})</option>)}
                    </select>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Sample Preview</h4>
                  <div className="space-y-3">
                    {preview.columns.slice(0, 6).map(c => (
                      <div key={c.name} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                        <span className="font-medium text-slate-600">{c.name}</span>
                        <span className="text-slate-400 italic">"{c.sample}"</span>
                      </div>
                    ))}
                    {preview.columns.length > 6 && <p className="text-[10px] text-center text-slate-400 mt-2">+{preview.columns.length - 6} more columns</p>}
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-lg flex items-start gap-3">
                  <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={reset} className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">Cancel</button>
                <button 
                  onClick={handleUpload} 
                  disabled={uploading || !mapping.outcome || !mapping.group}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processing...</> : <><UploadIcon className="w-4 h-4" /> Run Fairness Audit</>}
                </button>
              </div>

              {uploading && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-indigo-600 uppercase">
                    <span>Audit in progress…</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && result && (
            <div className="space-y-6">
              <div className="bg-green-50 text-green-700 border border-green-200 p-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">Audit Complete!</h4>
                  <p className="text-sm mt-1">{result.summary}</p>
                </div>
              </div>

              {/* Grade Banner */}
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-xl p-6 text-white flex items-center gap-6">
                <div className="w-20 h-20 bg-white/15 rounded-xl flex flex-col items-center justify-center shrink-0">
                  <span className="text-4xl font-black">{result.grade}</span>
                  <span className="text-xs text-indigo-100 mt-1 uppercase tracking-wider">Grade</span>
                </div>
                <div>
                  <p className="font-semibold text-lg">{result.dataset_name}</p>
                  <p className="text-indigo-100 text-sm mt-1">{result.total_records?.toLocaleString()} records audited · Group column: <strong>{result.group_col}</strong></p>
                </div>
              </div>

              {/* Metrics list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.metrics && Object.entries(result.metrics).map(([k, v]) => (
                  <div key={k} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                      {k.replace(/_/g, " ")}
                    </p>
                    <p className={`text-2xl font-bold ${v >= 0.80 ? "text-green-600" : v >= 0.65 ? "text-amber-500" : "text-red-600"}`}>
                      {(v * 100).toFixed(1)}%
                    </p>
                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-1.5 rounded-full ${v >= 0.80 ? "bg-green-500" : v >= 0.65 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${v * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={reset} className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors">Upload Another</button>
                <button onClick={() => navigate("/")} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">View Dashboard</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
