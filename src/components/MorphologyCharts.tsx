import { useState } from "react";
import { MORPHOLOGY_CHARTS } from "../data/morphologyCharts";

export function MorphologyCharts() {
  const [activeChart, setActiveChart] = useState<string>("article");

  const charts = [
    { key: "article", label: "Article" },
    { key: "firstDeclension", label: "1st Declension" },
    { key: "secondDeclension", label: "2nd Declension" },
    { key: "thirdDeclension", label: "3rd Declension" },
    { key: "presentActive", label: "Present Active" },
    { key: "imperfectActive", label: "Imperfect Active" },
    { key: "futureActive", label: "Future Active" },
    { key: "aoristActive", label: "Aorist Active" },
    { key: "perfectActive", label: "Perfect Active" },
    { key: "middlePassive", label: "Middle/Passive" }
  ];

  const currentChart = MORPHOLOGY_CHARTS[activeChart as keyof typeof MORPHOLOGY_CHARTS];

  return (
    <div className="flex gap-3">
      {/* Sidebar navigation */}
      <nav className="w-32 flex-shrink-0">
        <ul className="space-y-1">
          {charts.map(chart => (
            <li key={chart.key}>
              <button
                onClick={() => setActiveChart(chart.key)}
                className={`w-full text-left px-2 py-2 rounded text-sm transition-colors ${
                  activeChart === chart.key
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                {chart.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        <h3 className="text-2xl font-bold mb-6 text-slate-800">{currentChart.title}</h3>
        <div className="space-y-8">
          {currentChart.tables.map((table, idx) => (
            <div key={idx}>
              {table.subtitle && (
                <h4 className="text-lg font-semibold text-slate-700 mb-3">{table.subtitle}</h4>
              )}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      {table.headers.map((header, hIdx) => (
                        <th
                          key={hIdx}
                          className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-700"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`border border-slate-300 px-2 py-2 ${
                              cIdx === 0 ? "font-medium text-slate-700" : "text-slate-800 font-greek"
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
