import type {
  CurriculumSection,
  CurriculumWeek,
  DailyLesson,
  LessonBlock,
  WeeklyAssessment,
  WeeklyReviewDay
} from "@/types";

const LESSON_BLOCKS: LessonBlock[] = [
  {
    kind: "vocabulary",
    label: "Vocabulary",
    minutes: 5,
    placeholder:
      "Five source-backed vocabulary items will appear here after uploaded PDFs provide file/page support."
  },
  {
    kind: "grammar",
    label: "Grammar",
    minutes: 5,
    placeholder:
      "A short grammar explanation will appear here only when it can cite uploaded PDF pages."
  },
  {
    kind: "sentence-practice",
    label: "Sentence practice",
    minutes: 7,
    placeholder:
      "Seven minutes of source-backed sentence practice will be generated from retrieved PDF context."
  },
  {
    kind: "challenge",
    label: "Challenge",
    minutes: 3,
    placeholder:
      "A three-minute speaking or writing challenge will be added only from supported PDF material."
  }
];

type WeekSeed = {
  title: string;
  grammarTheme: string;
  communicationGoal: string;
  lessonTitles: string[];
};

const WEEK_SEEDS: WeekSeed[] = [
  {
    title: "Week 1: Sound, greeting, and sentence awareness",
    grammarTheme: "Pronunciation awareness, greetings, and basic sentence shape",
    communicationGoal: "Open simple family interactions politely once PDFs provide supported phrasing.",
    lessonTitles: [
      "Orientation to PDF-grounded Spanish study",
      "Pronunciation notes from the source library",
      "Greeting structure from supported pages",
      "Polite family introductions from supported pages",
      "Combining first-week building blocks"
    ]
  },
  {
    title: "Week 2: Nouns, articles, gender, and number",
    grammarTheme: "Nouns, articles, gender, and singular/plural awareness",
    communicationGoal: "Recognize family and household nouns only when sourced from PDFs.",
    lessonTitles: [
      "Noun patterns from the PDF library",
      "Article patterns from cited pages",
      "Gender clues from source examples",
      "Number patterns from source examples",
      "Noun phrase review with citations"
    ]
  },
  {
    title: "Week 3: Adjectives and agreement",
    grammarTheme: "Adjective position and noun/adjective agreement",
    communicationGoal: "Describe people, meals, places, and everyday situations when PDFs support the wording.",
    lessonTitles: [
      "Adjective roles from source examples",
      "Agreement patterns from cited pages",
      "Describing family members with source support",
      "Describing everyday objects with source support",
      "Agreement repair and review"
    ]
  },
  {
    title: "Week 4: Subject pronouns and basic ser",
    grammarTheme: "Subject pronouns and introductory ser patterns",
    communicationGoal: "Identify people and relationships with PDF-backed examples.",
    lessonTitles: [
      "Subject pronouns from the PDFs",
      "Introducing ser from cited grammar pages",
      "Identity statements from supported pages",
      "Family relationship statements from supported pages",
      "Ser pattern consolidation"
    ]
  },
  {
    title: "Week 5: Estar for location and condition",
    grammarTheme: "Introductory estar for location and condition",
    communicationGoal: "Talk about where people are and how they are doing when PDFs support it.",
    lessonTitles: [
      "Introducing estar from source pages",
      "Location patterns from cited examples",
      "Condition patterns from cited examples",
      "Family visit context from supported pages",
      "Estar review and repair"
    ]
  },
  {
    title: "Week 6: Ser and estar contrast",
    grammarTheme: "Choosing between ser and estar with source-backed reasons",
    communicationGoal: "Avoid common identity/location/condition mix-ups in family conversation.",
    lessonTitles: [
      "Ser and estar comparison from PDFs",
      "Identity versus condition from cited pages",
      "Location versus description from cited pages",
      "Conversation choices from supported examples",
      "Contrast review and correction"
    ]
  },
  {
    title: "Week 7: Hay and questions",
    grammarTheme: "Hay, question formation, and question words",
    communicationGoal: "Ask simple family-context questions when the source library supports the wording.",
    lessonTitles: [
      "Introducing hay from source pages",
      "Question shape from cited examples",
      "Question words from supported pages",
      "Everyday family questions from PDFs",
      "Question review and response practice"
    ]
  },
  {
    title: "Week 8: Regular present-tense verbs",
    grammarTheme: "Regular present-tense verb awareness and simple sentence building",
    communicationGoal: "Build simple family conversation sentences only from PDF-supported verbs and patterns.",
    lessonTitles: [
      "Regular verb patterns from PDFs",
      "Subject and verb matching from source examples",
      "Everyday action sentences from cited pages",
      "Family conversation sentence chains",
      "Eight-week grammar foundation review"
    ]
  }
];

const section: CurriculumSection = {
  id: "grammar-foundation-1",
  title: "Grammar Foundation I",
  description:
    "Eight weeks of grammar-first daily study. All Spanish content is placeholder-gated until uploaded PDFs provide source-backed material.",
  weeks: WEEK_SEEDS.map((seed, index) => buildWeek(seed, index + 1))
};

export const curriculumSections: CurriculumSection[] = [section];

export function getCurriculumSections() {
  return curriculumSections;
}

export function getAllDailyLessons() {
  return curriculumSections.flatMap((curriculumSection) =>
    curriculumSection.weeks.flatMap((week) => week.lessons)
  );
}

export function getDailyLessonByDayNumber(dayNumber: number) {
  return getAllDailyLessons().find((lesson) => lesson.dayNumber === dayNumber) ?? null;
}

export function getWeekByNumber(weekNumber: number) {
  return section.weeks.find((week) => week.weekNumber === weekNumber) ?? null;
}

export function getWeeklyAssessment(weekNumber: number) {
  return getWeekByNumber(weekNumber)?.assessment ?? null;
}

export function getCurriculumSummary() {
  const weeks = curriculumSections.flatMap((curriculumSection) => curriculumSection.weeks);
  const lessons = weeks.flatMap((week) => week.lessons);

  return {
    sectionCount: curriculumSections.length,
    weekCount: weeks.length,
    lessonCount: lessons.length,
    assessmentCount: weeks.length,
    estimatedLessonMinutes: lessons.reduce((total, lesson) => total + lesson.estimatedMinutes, 0)
  };
}

function buildWeek(seed: WeekSeed, weekNumber: number): CurriculumWeek {
  const sectionId = sectionIdForWeek(weekNumber);
  const lessons = seed.lessonTitles.map((title, dayIndex) =>
    buildLesson({
      sectionId,
      weekNumber,
      dayInWeek: dayIndex + 1,
      title,
      grammarTheme: seed.grammarTheme,
      communicationGoal: seed.communicationGoal
    })
  );
  const reviewDay = buildReviewDay(sectionId, weekNumber, seed);
  const assessment = buildAssessment(sectionId, weekNumber, seed);

  return {
    id: `week-${weekNumber}`,
    sectionId,
    weekNumber,
    title: seed.title,
    grammarTheme: seed.grammarTheme,
    communicationGoal: seed.communicationGoal,
    lessons,
    reviewDay,
    assessment
  };
}

function buildLesson({
  sectionId,
  weekNumber,
  dayInWeek,
  title,
  grammarTheme,
  communicationGoal
}: {
  sectionId: string;
  weekNumber: number;
  dayInWeek: number;
  title: string;
  grammarTheme: string;
  communicationGoal: string;
}): DailyLesson {
  const dayNumber = (weekNumber - 1) * 5 + dayInWeek;

  return {
    id: `day-${dayNumber}`,
    sectionId,
    weekNumber,
    dayNumber,
    dayInWeek,
    title,
    grammarFocus: grammarTheme,
    vocabularyFocus: "Five everyday vocabulary items sourced from uploaded PDFs",
    familyCommunicationGoal: communicationGoal,
    buildsOn: buildDependencies(dayNumber),
    masteryGoals: [
      "Use only PDF-supported Spanish content once sources are attached.",
      "Connect the grammar focus to practical family communication.",
      "Cite the source file and page for every future lesson example."
    ],
    estimatedMinutes: 20,
    blocks: LESSON_BLOCKS,
    sourceReferences: []
  };
}

function buildReviewDay(sectionId: string, weekNumber: number, seed: WeekSeed): WeeklyReviewDay {
  return {
    id: `week-${weekNumber}-review`,
    sectionId,
    weekNumber,
    title: `Week ${weekNumber} review`,
    goals: [
      `Review the week theme: ${seed.grammarTheme}.`,
      "Identify any PDF source gaps before assessment.",
      "Practice only with cited material that has already been unlocked."
    ],
    placeholder:
      "Review prompts will be generated after the app confirms which uploaded PDF pages support this week's focus."
  };
}

function buildAssessment(sectionId: string, weekNumber: number, seed: WeekSeed): WeeklyAssessment {
  return {
    id: `week-${weekNumber}-assessment`,
    sectionId,
    weekNumber,
    title: `Week ${weekNumber} mastery assessment`,
    masteryRequirements: [
      `Explain the week theme from cited PDF support: ${seed.grammarTheme}.`,
      "Use source-backed vocabulary and sentence patterns only.",
      "Show readiness to continue without relying on unsupported outside Spanish knowledge."
    ],
    passingThreshold: 80,
    sourceReferences: []
  };
}

function buildDependencies(dayNumber: number) {
  if (dayNumber === 1) {
    return [];
  }

  return [`day-${dayNumber - 1}`];
}

function sectionIdForWeek(weekNumber: number) {
  return weekNumber <= 8 ? "grammar-foundation-1" : "future-section";
}
