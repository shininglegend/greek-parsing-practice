import { useState } from "react";
import { GrammarGuide, Help, Modal, MorphologyCharts } from "./";

interface HeaderProps {
  currentMode: "drill" | "reverse";
}

export function Header({ currentMode }: HeaderProps) {
  const [showGrammarGuide, setShowGrammarGuide] = useState(false);
  const [showMorphologyCharts, setShowMorphologyCharts] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const navigateToMode = (mode: "drill" | "reverse") => {
    const hash = mode === "drill" ? "#/" : "#/reverse";
    window.history.pushState({}, "", hash);
    window.dispatchEvent(new Event("locationchange"));
  };

  return (
    <>
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="mx-auto max-w-5xl p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">Koine Parser Drill</h1>
            <button onClick={() => setShowHelp(true)} className="btn text-sm">
              Help
            </button>
            <button
              onClick={() => setShowMorphologyCharts(true)}
              className="btn text-sm"
            >
              Morphology Charts
            </button>
            <button
              onClick={() => setShowGrammarGuide(true)}
              className="btn text-sm"
            >
              Grammar Guide
            </button>
            {currentMode === "drill" ? (
              <button
                onClick={() => navigateToMode("reverse")}
                className="text-sm text-blue-600 hover:underline"
              >
                Try Reverse Parser →
              </button>
            ) : (
              <button
                onClick={() => navigateToMode("drill")}
                className="text-sm text-blue-600 hover:underline"
              >
                ← Back to Parser Drill
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={showHelp} onClose={() => setShowHelp(false)} title="Help">
        <Help />
      </Modal>

      <Modal
        isOpen={showMorphologyCharts}
        onClose={() => setShowMorphologyCharts(false)}
        title="Morphology Charts"
      >
        <MorphologyCharts />
      </Modal>

      <Modal
        isOpen={showGrammarGuide}
        onClose={() => setShowGrammarGuide(false)}
        title="Grammar Guide"
      >
        <GrammarGuide />
      </Modal>
    </>
  );
}
