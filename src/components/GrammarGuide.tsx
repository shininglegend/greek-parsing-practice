import { useState } from "react";
import { GRAMMAR_DEFINITIONS } from "../data/grammarDefinitions";

export function GrammarGuide() {
  const [activeSection, setActiveSection] = useState<string>("partOfSpeech");

  const sections = [
    { key: "partOfSpeech", label: "Parts of Speech" },
    { key: "case", label: "Cases" },
    { key: "number", label: "Number" },
    { key: "gender", label: "Gender" },
    { key: "tense", label: "Tenses" },
    { key: "voice", label: "Voices" },
    { key: "mood", label: "Moods" },
    { key: "person", label: "Person" }
  ];

  const currentSection = GRAMMAR_DEFINITIONS[activeSection as keyof typeof GRAMMAR_DEFINITIONS];

  return (
    <div className="flex gap-6">
      {/* Sidebar navigation */}
      <nav className="w-48 flex-shrink-0">
        <ul className="space-y-1">
          {sections.map(section => (
            <li key={section.key}>
              <button
                onClick={() => setActiveSection(section.key)}
                className={`w-full text-left px-3 py-2 rounded transition-colors ${
                  activeSection === section.key
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        <h3 className="text-2xl font-bold mb-6 text-slate-800">{currentSection.title}</h3>
        <div className="space-y-6">
          {currentSection.items.map((item, idx) => (
            <div key={idx} className="border-l-4 border-blue-500 pl-4">
              <h4 className="text-lg font-semibold text-slate-800 mb-2">{item.term}</h4>
              <p className="text-slate-700 mb-2">{item.definition}</p>
              <p className="text-sm text-slate-600 italic">
                <strong>Example:</strong> {item.example}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
