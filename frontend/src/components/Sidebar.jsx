import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Upload, LogOut, ShieldAlert } from "lucide-react";

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Basic logout logic for now
    navigate("/login");
  };

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col justify-between h-full shadow-lg">
      <div className="p-6">
        <div className="flex items-center gap-3 font-semibold text-xl mb-10 text-primary">
          <ShieldAlert className="w-8 h-8 text-indigo-600" />
          <span>FairAudit AI</span>
        </div>
        
        <nav className="space-y-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-indigo-50 text-indigo-600 font-medium"
                  : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </NavLink>
          
          <NavLink
            to="/upload"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-indigo-50 text-indigo-600 font-medium"
                  : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
              }`
            }
          >
            <Upload className="w-5 h-5" />
            <span>Dataset Upload</span>
          </NavLink>
        </nav>
      </div>

      <div className="p-6 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
