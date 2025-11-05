export const MORPHOLOGY_CHARTS = {
  article: {
    title: "Article (ὁ, ἡ, τό - 'the')",
    tables: [
      {
        subtitle: "Singular",
        headers: ["Case", "Masculine", "Feminine", "Neuter"],
        rows: [
          ["Nominative", "ὁ", "ἡ", "τό"],
          ["Genitive", "τοῦ", "τῆς", "τοῦ"],
          ["Dative", "τῷ", "τῇ", "τῷ"],
          ["Accusative", "τόν", "τήν", "τό"],
        ],
      },
      {
        subtitle: "Plural",
        headers: ["Case", "Masculine", "Feminine", "Neuter"],
        rows: [
          ["Nominative", "οἱ", "αἱ", "τά"],
          ["Genitive", "τῶν", "τῶν", "τῶν"],
          ["Dative", "τοῖς", "ταῖς", "τοῖς"],
          ["Accusative", "τούς", "τάς", "τά"],
        ],
      },
    ],
  },
  firstDeclension: {
    title: "First Declension Nouns (mostly feminine)",
    tables: [
      {
        subtitle: "ἡ γλῶσσα (tongue) - α-stem after ρ, ε, ι",
        headers: ["Case", "Singular", "Plural"],
        rows: [
          ["Nominative", "γλῶσσα", "γλῶσσαι"],
          ["Genitive", "γλώσσης", "γλωσσῶν"],
          ["Dative", "γλώσσῃ", "γλώσσαις"],
          ["Accusative", "γλῶσσαν", "γλώσσας"],
          ["Vocative", "γλῶσσα", "γλῶσσαι"],
        ],
      },
      {
        subtitle: "ἡ γλῶσσα (tongue) - η-stem after ρ, ε, ι",
        headers: ["Case", "Singular", "Plural"],
        rows: [
          ["Nominative", "γλῶσσα", "γλῶσσαι"],
          ["Genitive", "γλώσσης", "γλωσσῶν"],
          ["Dative", "γλώσσῃ", "γλώσσαις"],
          ["Accusative", "γλῶσσαν", "γλώσσας"],
          ["Vocative", "γλῶσσα", "γλῶσσαι"],
        ],
      },
    ],
  },
  secondDeclension: {
    title: "Second Declension Nouns",
    tables: [
      {
        subtitle: "ὁ λόγος (word) - Masculine",
        headers: ["Case", "Singular", "Plural"],
        rows: [
          ["Nominative", "λόγος", "λόγοι"],
          ["Genitive", "λόγου", "λόγων"],
          ["Dative", "λόγῳ", "λόγοις"],
          ["Accusative", "λόγον", "λόγους"],
          ["Vocative", "λόγε", "λόγοι"],
        ],
      },
      {
        subtitle: "τὸ δῶρον (gift) - Neuter",
        headers: ["Case", "Singular", "Plural"],
        rows: [
          ["Nominative", "δῶρον", "δῶρα"],
          ["Genitive", "δώρου", "δώρων"],
          ["Dative", "δώρῳ", "δώροις"],
          ["Accusative", "δῶρον", "δῶρα"],
          ["Vocative", "δῶρον", "δῶρα"],
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
          ["Nominative", "σάρξ", "σάρκες"],
          ["Genitive", "σαρκός", "σαρκῶν"],
          ["Dative", "σαρκί", "σαρξί(ν)"],
          ["Accusative", "σάρκα", "σάρκας"],
          ["Vocative", "σάρξ", "σάρκες"],
        ],
      },
      {
        subtitle: "ἡ πόλις (city) - Vowel stem",
        headers: ["Case", "Singular", "Plural"],
        rows: [
          ["Nominative", "πόλις", "πόλεις"],
          ["Genitive", "πόλεως", "πόλεων"],
          ["Dative", "πόλει", "πόλεσι(ν)"],
          ["Accusative", "πόλιν", "πόλεις"],
          ["Vocative", "πόλι", "πόλεις"],
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
