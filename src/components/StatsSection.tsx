import React from "react";
import { Target } from "lucide-react"; // Assuming you're using lucide-react icons

interface Stats {
  totalSpent: number; // in milliseconds
  completedCount: number;
  activeCount: number;
  totalCount: number;
}

interface StatsSectionProps {
  stats: Stats;
  darkMode?: boolean;
}

const StatsSection: React.FC<StatsSectionProps> = ({
  stats,
  darkMode = false,
}) => {
  const efficiency =
    stats.totalCount > 0
      ? Math.round((stats.completedCount / stats.totalCount) * 100)
      : 0;

  return (
    <section className="grid grid-cols-4 gap-3 sm:gap-4 shrink-0">
      {/* Total Focus Card */}
      <div
        className={`${
          darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
        } p-4 py-2 rounded-xl border shadow-sm`}
      >
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
          Total Focus
        </p>
        <p className="text-xl font-bold font-mono">
          {(stats.totalSpent / 3600000).toFixed(1)}h
        </p>
      </div>

      {/* Tasks Done Card */}
      <div
        className={`${
          darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
        } p-4 py-2 rounded-xl border shadow-sm`}
      >
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
          Tasks Done
        </p>
        <p className="text-xl font-bold">{stats.completedCount}</p>
      </div>

      {/* To Do Card */}
      <div
        className={`${
          darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
        } p-4 py-2 rounded-xl border shadow-sm`}
      >
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
          To Do
        </p>
        <p className="text-xl font-bold">{stats.activeCount}</p>
      </div>

      {/* Efficiency Card (Highlighted) */}
      <div
        className={`${
          darkMode ? "bg-blue-700" : "bg-blue-600"
        } p-4 py-2 rounded-xl text-white shadow-lg shadow-blue-500/20`}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">
            Efficiency
          </p>
          <Target className="w-3 h-3 text-blue-200" />
        </div>
        <p className="text-xl font-bold">{efficiency}%</p>
      </div>
    </section>
  );
};

export default StatsSection;
