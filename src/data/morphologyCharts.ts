export const MORPHOLOGY_CHARTS = {
  article: {
    title: "Article (ὁ, ἡ, τό - 'the')",
    tables: [
      {
        subtitle: "Singular",
        headers: ["Case", "Masc.", "Fem.", "Neut."],
        rows: [
          ["Nom.", "ὁ", "ἡ", "τό"],
          ["Gen.", "τοῦ", "τῆς", "τοῦ"],
          ["Dat.", "τῷ", "τῇ", "τῷ"],
          ["Acc.", "τόν", "τήν", "τό"],
        ],
      },
      {
        subtitle: "Plural",
        headers: ["Case", "Masc.", "Fem.", "Neut."],
        rows: [
          ["Nom.", "οἱ", "αἱ", "τά"],
          ["Gen.", "τῶν", "τῶν", "τῶν"],
          ["Dat.", "τοῖς", "ταῖς", "τοῖς"],
          ["Acc.", "τούς", "τάς", "τά"],
        ],
      },
    ],
  },
  firstDeclension: {
    title: "First Declension Nouns (mostly Fem.)",
    tables: [
      {
        subtitle: "ἡ γλῶσσα (tongue) - α-stem after ρ, ε, ι",
        headers: ["Case", "Singular", "Plural"],
        rows: [
          ["Nom.", "γλῶσσα", "γλῶσσαι"],
          ["Gen.", "γλώσσης", "γλωσσῶν"],
          ["Dat.", "γλώσσῃ", "γλώσσαις"],
          ["Acc.", "γλῶσσαν", "γλώσσας"],
          ["Voc.", "γλῶσσα", "γλῶσσαι"],
        ],
      },
      {
        subtitle: "ἡ γλῶσσα (tongue) - η-stem after ρ, ε, ι",
        headers: ["Case", "Singular", "Plural"],
        rows: [
          ["Nom.", "γλῶσσα", "γλῶσσαι"],
          ["Gen.", "γλώσσης", "γλωσσῶν"],
          ["Dat.", "γλώσσῃ", "γλώσσαις"],
          ["Acc.", "γλῶσσαν", "γλώσσας"],
          ["Voc.", "γλῶσσα", "γλῶσσαι"],
        ],
      },
    ],
  },
  secondDeclension: {
    title: "Second Declension Nouns",
    tables: [
      {
        subtitle: "ὁ λόγος (word) - Masc.",
        headers: ["Case", "Singular", "Plural"],
        rows: [
          ["Nom.", "λόγος", "λόγοι"],
          ["Gen.", "λόγου", "λόγων"],
          ["Dat.", "λόγῳ", "λόγοις"],
          ["Acc.", "λόγον", "λόγους"],
          ["Voc.", "λόγε", "λόγοι"],
        ],
      },
      {
        subtitle: "τὸ δῶρον (gift) - Neut.",
        headers: ["Case", "Singular", "Plural"],
        rows: [
          ["Nom.", "δῶρον", "δῶρα"],
          ["Gen.", "δώρου", "δώρων"],
          ["Dat.", "δώρῳ", "δώροις"],
          ["Acc.", "δῶρον", "δῶρα"],
          ["Voc.", "δῶρον", "δῶρα"],
        ],
      },
    ],
  },
  thirdDeclension: {
    title: "Third Declension Nouns",
    tables: [
      {
        subtitle: "ἡ σάρξ (flesh) - Consonant stem",
        headers: ["Case", "Singular", "Plural"],
        rows: [
          ["Nom.", "σάρξ", "σάρκες"],
          ["Gen.", "σαρκός", "σαρκῶν"],
          ["Dat.", "σαρκί", "σαρξί(ν)"],
          ["Acc.", "σάρκα", "σάρκας"],
          ["Voc.", "σάρξ", "σάρκες"],
        ],
      },
      {
        subtitle: "ἡ πόλις (city) - Vowel stem",
        headers: ["Case", "Singular", "Plural"],
        rows: [
          ["Nom.", "πόλις", "πόλεις"],
          ["Gen.", "πόλεως", "πόλεων"],
          ["Dat.", "πόλει", "πόλεσι(ν)"],
          ["Acc.", "πόλιν", "πόλεις"],
          ["Voc.", "πόλι", "πόλεις"],
        ],
      },
    ],
  },
  presentActive: {
    title: "Present Active Indicative (λύω - I loose)",
    tables: [
      {
        subtitle: "Singular & Plural",
        headers: ["Person", "Singular", "Plural"],
        rows: [
          ["1st", "λύομαι", "λυόμεθα"],
          ["2nd", "λύῃ", "λύεσθε"],
          ["3rd", "λύεται", "λύονται"],
        ],
      },
    ],
  },
  imperfectActive: {
    title: "Imperfect Active Indicative (ἔλυον - I was loosing)",
    tables: [
      {
        subtitle: "Singular & Plural",
        headers: ["Person", "Singular", "Plural"],
        rows: [
          ["1st", "ἔλυον", "ἐλύομεν"],
          ["2nd", "ἔλυες", "ἐλύετε"],
          ["3rd", "ἔλυε(ν)", "ἔλυον"],
        ],
      },
    ],
  },
  futureActive: {
    title: "Future Active Indicative (λύσω - I will loose)",
    tables: [
      {
        subtitle: "Singular & Plural",
        headers: ["Person", "Singular", "Plural"],
        rows: [
          ["1st", "λύσω", "λύσομεν"],
          ["2nd", "λύσεις", "λύσετε"],
          ["3rd", "λύσει", "λύσουσι(ν)"],
        ],
      },
    ],
  },
  aoristActive: {
    title: "Aorist Active Indicative (ἔλυσα - I loosed)",
    tables: [
      {
        subtitle: "Singular & Plural",
        headers: ["Person", "Singular", "Plural"],
        rows: [
          ["1st", "ἔλυσα", "ἐλύσαμεν"],
          ["2nd", "ἔλυσας", "ἐλύσατε"],
          ["3rd", "ἔλυσε(ν)", "ἔλυσαν"],
        ],
      },
    ],
  },
  perfectActive: {
    title: "Perfect Active Indicative (λέλυκα - I have loosed)",
    tables: [
      {
        subtitle: "Singular & Plural",
        headers: ["Person", "Singular", "Plural"],
        rows: [
          ["1st", "λέλυκα", "λελύκαμεν"],
          ["2nd", "λέλυκας", "λελύκατε"],
          ["3rd", "λέλυκε(ν)", "λελύκασι(ν)"],
        ],
      },
    ],
  },
  middlePassive: {
    title: "Present Middle/Passive Indicative (λύομαι)",
    tables: [
      {
        subtitle: "Singular & Plural",
        headers: ["Person", "Singular", "Plural"],
        rows: [
          ["1st", "λύομαι", "λυόμεθα"],
          ["2nd", "λύῃ/λύει", "λύεσθε"],
          ["3rd", "λύεται", "λύονται"],
        ],
      },
    ],
  },
};
