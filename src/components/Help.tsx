export function Help() {
  return (
    <div className="prose prose-slate max-w-none">
      <h3 className="text-2xl font-bold mb-4 text-slate-800">
        How to Use This Site
      </h3>

      <div className="space-y-4 text-slate-700">
        <section>
          <h4 className="font-semibold text-lg text-slate-800">
            Getting Started
          </h4>
          <p>
            Select a Bible verse using the book, chapter, and verse dropdowns,
            then click <strong>Load Verse</strong>. The verse will appear in
            Greek with each word ready for parsing practice.
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-lg text-slate-800">
            Parser Drill Mode
          </h4>
          <p>
            Tap a word in the verse, then choose its grammatical features.
            A miss opens a signal card: the contrast, the cue in the verse when
            there is one, and what that parse does in English. When every
            selected word has an answer, write an English rendering and compare
            it with a gloss line, a parse checklist, and WEB, KJV, and ASV.
            The app does not grade your English. A longer tutor note is
            available only on an approved account.
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-lg text-slate-800">
            Reverse Parser Mode
          </h4>
          <p>
            Given the grammatical information and lemma, type the correct Greek
            surface form into the input box. You can toggle options to ignore
            accents, breathing marks, or case sensitivity. Correct answers show
            with green borders. Click <strong>Reveal Answers</strong> to see all
            correct forms.
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-lg text-slate-800">
            Additional Resources
          </h4>
          <p>
            Use the <strong>Morphology Charts</strong> button to view noun
            declension and verb conjugation paradigms. The{" "}
            <strong>Grammar Guide</strong> button provides definitions and
            examples for all grammatical terms used in parsing.
          </p>
        </section>
      </div>
    </div>
  );
}
