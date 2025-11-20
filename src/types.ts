export type ParseFields = {
  pos?: string;
  case?: string;
  number?: string;
  gender?: string;
  tense?: string;
  voice?: string;
  mood?: string;
  person?: string;
};

export type Word = {
  surface: string;     // e.g., "Ἐν"
  lemma?: string;      // e.g., "ἐν"
  parse?: ParseFields; // normalized fields
  id: string;          // stable key
  definition?: {       // optional lexicon data
    brief?: string;
    full?: string;
  };
};

export type Verse = {
  ref: string;         // "Jn 1:1"
  words: Word[];
};

export type DrillAnswer = {
  [k: string]: string | undefined;
};

export type FieldSpec = {
  key: keyof ParseFields;
  label: string;
  options: string[];
};
