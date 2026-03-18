import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Upload, LogOut, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Outlet } from "react-router-dom";

export default function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between h-full shadow-sm shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 font-semibold text-xl mb-10 text-slate-800">
            <ShieldAlert className="w-8 h-8 text-indigo-600" />
            <span>FairAudit AI</span>
          </div>

          <nav className="space-y-1">
            <NavLink to="/" end className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive ? "bg-indigo-50 text-indigo-600 font-medium" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`
            }>
              <LayoutDashboard className="w-5 h-5" /><span>Dashboard</span>
            </NavLink>
            <NavLink to="/upload" className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive ? "bg-indigo-50 text-indigo-600 font-medium" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`
            }>
              <Upload className="w-5 h-5" /><span>Dataset Upload</span>
            </NavLink>
          </nav>
        </div>

        <div className="p-6 border-t border-slate-100">
          {user && (
            <div className="mb-4 px-4 py-3 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          )}
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200">
            <LogOut className="w-5 h-5" /><span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8 md:p-10">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
