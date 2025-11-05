export const GRAMMAR_DEFINITIONS = {
  partOfSpeech: {
    title: "Parts of Speech",
    items: [
      {
        term: "Noun",
        definition:
          "A word that names a person, place, thing, or idea. In Koine Greek, nouns are inflected for case, number, and gender.",
        example: "ἄνθρωπος (anthrōpos) - man, human",
      },
      {
        term: "Verb",
        definition:
          "A word that expresses action or state of being. Greek verbs are inflected for tense, voice, mood, person, and number.",
        example: "λέγω (legō) - I say, I speak",
      },
      {
        term: "Adjective",
        definition:
          "A word that modifies or describes a noun. Adjectives agree with the nouns they modify in case, number, and gender.",
        example: "ἀγαθός (agathos) - good",
      },
      {
        term: "Adverb",
        definition:
          "A word that modifies a verb, adjective, or another adverb. Adverbs are typically invariable.",
        example: "καλῶς (kalōs) - well, rightly",
      },
      {
        term: "Preposition",
        definition:
          "A word that shows the relationship between a noun (or pronoun) and other words in a sentence. Greek prepositions govern specific cases.",
        example: "ἐν (en) - in, by (+ dative)",
      },
      {
        term: "Pronoun",
        definition:
          "A word that takes the place of a noun. Pronouns are inflected for case, number, gender, and sometimes person.",
        example: "αὐτός (autos) - he, she, it",
      },
      {
        term: "Conjunction",
        definition:
          "A word that connects words, phrases, or clauses. Conjunctions are invariable.",
        example: "καί (kai) - and, also, even",
      },
      {
        term: "Particle",
        definition:
          "A small, indeclinable word that adds nuance or emphasis to a sentence.",
        example: "ἄν (an) - a particle indicating contingency",
      },
      {
        term: "Article",
        definition:
          "The definite article 'the' in Greek. It is inflected for case, number, and gender.",
        example: "ὁ, ἡ, τό (ho, hē, to) - the",
      },
    ],
  },
  case: {
    title: "Cases",
    items: [
      {
        term: "Nominative",
        definition:
          "The case of the subject of a sentence or the predicate nominative. Answers 'who?' or 'what?' is doing the action.",
        example: "ὁ ἄνθρωπος λέγει - The man speaks (ἄνθρωπος is nominative)",
      },
      {
        term: "Genitive",
        definition:
          "The case of possession, origin, or description. Often translated with 'of' or with a possessive ('s).",
        example: "ὁ λόγος τοῦ θεοῦ - The word of God (θεοῦ is genitive)",
      },
      {
        term: "Dative",
        definition:
          "The case of the indirect object, means, location, or personal interest. Often translated with 'to,' 'for,' 'by,' or 'with.'",
        example: "λέγει τῷ ἀνθρώπῳ - He speaks to the man (ἀνθρώπῳ is dative)",
      },
      {
        term: "Accusative",
        definition:
          "The case of the direct object or extent. Answers 'whom?' or 'what?' receives the action.",
        example: "βλέπω τὸν ἄνθρωπον - I see the man (ἄνθρωπον is accusative)",
      },
      {
        term: "Vocative",
        definition:
          "The case of direct address. Used when speaking directly to someone or something.",
        example: "κύριε, σῶσον ἡμᾶς - Lord, save us! (κύριε is vocative)",
      },
    ],
  },
  number: {
    title: "Number",
    items: [
      {
        term: "Singular",
        definition: "Refers to one person or thing.",
        example: "ὁ μαθητής - the disciple (one)",
      },
      {
        term: "Plural",
        definition: "Refers to more than one person or thing.",
        example: "οἱ μαθηταί - the disciples (more than one)",
      },
    ],
  },
  gender: {
    title: "Gender",
    items: [
      {
        term: "Masculine",
        definition:
          "Grammatical gender typically (but not always) used for male persons and certain nouns.",
        example: "ὁ ἄνθρωπος - the man (masculine)",
      },
      {
        term: "Feminine",
        definition:
          "Grammatical gender typically (but not always) used for female persons and certain nouns.",
        example: "ἡ γυνή - the woman (feminine)",
      },
      {
        term: "Neuter",
        definition:
          "Grammatical gender for things and certain abstract concepts. Neither masculine nor feminine.",
        example: "τὸ τέκνον - the child (neuter)",
      },
    ],
  },
  tense: {
    title: "Tenses",
    items: [
      {
        term: "Present",
        definition:
          "Describes ongoing or continuous action in present time. Emphasizes the process or ongoing nature of the action.",
        example: "λέγω - I am saying, I say",
      },
      {
        term: "Imperfect",
        definition:
          "Describes ongoing or repeated action in past time. Often translated 'was doing' or 'used to do.'",
        example: "ἔλεγον - I was saying, I kept saying",
      },
      {
        term: "Future",
        definition: "Describes action that will occur in future time.",
        example: "ἐρῶ - I will say (irregular form)",
      },
      {
        term: "Aorist",
        definition:
          "Describes a simple, undefined action, often in past time. Does not emphasize the process but simply that the action occurred.",
        example: "εἶπον - I said",
      },
      {
        term: "Perfect",
        definition:
          "Describes a completed action with continuing results in the present. The action is finished, but its effects remain.",
        example: "εἴρηκα - I have said (and it still stands)",
      },
      {
        term: "Pluperfect",
        definition:
          "Describes a completed action with continuing results in the past. The action was finished, and its effects remained at a past point in time.",
        example: "εἰρήκειν - I had said",
      },
    ],
  },
  voice: {
    title: "Voices",
    items: [
      {
        term: "Active",
        definition: "The subject performs the action of the verb.",
        example: "λύω - I loose (I am performing the action)",
      },
      {
        term: "Middle",
        definition:
          "The subject acts upon itself or for its own benefit. Emphasizes the subject's involvement or interest in the action.",
        example: "λύομαι - I loose for myself, I ransom",
      },
      {
        term: "Passive",
        definition: "The subject receives the action of the verb.",
        example: "λύομαι - I am loosed (by someone else)",
      },
      {
        term: "Middle/Passive",
        definition:
          "Some forms in Greek are ambiguous between middle and passive meanings. Context determines which is intended.",
        example: "λύεται - he/she/it looses (for self) OR is being loosed",
      },
    ],
  },
  mood: {
    title: "Moods",
    items: [
      {
        term: "Indicative",
        definition:
          "The mood of assertion or statement of fact. Used for statements and questions about reality.",
        example: "λέγω - I say (stating a fact)",
      },
      {
        term: "Imperative",
        definition:
          "The mood of command or entreaty. Used for direct commands, requests, or prohibitions.",
        example: "λέγε - Say! Speak! (command)",
      },
      {
        term: "Subjunctive",
        definition:
          "The mood of possibility, expectation, or exhortation. Often used in conditional clauses and purpose clauses.",
        example: "λέγωμεν - let us say, we might say",
      },
      {
        term: "Optative",
        definition:
          "The mood of wish or remote possibility. Less common in Koine Greek than in Classical Greek.",
        example: "λέγοιμι - May I say, I would say",
      },
      {
        term: "Infinitive",
        definition:
          "A verbal noun ('to do'). Not technically a mood, but functions as one in Greek grammar.",
        example: "λέγειν - to say, to speak",
      },
      {
        term: "Participle",
        definition:
          "A verbal adjective. Not technically a mood, but functions as one in Greek grammar. Participles can express time, cause, manner, condition, and more.",
        example: "λέγων - saying, while saying",
      },
    ],
  },
  person: {
    title: "Person",
    items: [
      {
        term: "First Person",
        definition: "The speaker or writer. 'I' (singular) or 'we' (plural).",
        example: "λέγω - I say; λέγομεν - we say",
      },
      {
        term: "Second Person",
        definition:
          "The person(s) being addressed. 'You' (singular or plural).",
        example: "λέγεις - you say; λέγετε - you (all) say",
      },
      {
        term: "Third Person",
        definition:
          "The person(s) or thing(s) being spoken about. 'He/she/it' (singular) or 'they' (plural).",
        example: "λέγει - he/she/it says; λέγουσι - they say",
      },
    ],
  },
};
