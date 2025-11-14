import { text, integer, timestamp, real, boolean, jsonb } from 'drizzle-orm/pg-core';
import { users, appSchema } from './users';
import { conversations } from './comprehensible-input';
import { learningSessions } from './comprehensible-input';

// CEFR levels for grammar concepts
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

// Grammar concept categories
export type GrammarCategory = 
  | 'verbs' 
  | 'articles' 
  | 'prepositions' 
  | 'pronouns' 
  | 'adjectives' 
  | 'nouns' 
  | 'syntax' 
  | 'other';

// Mastery levels for user progress
export type MasteryLevel = 'new' | 'learning' | 'practicing' | 'mastered';

// Exercise types
export type ExerciseType = 
  | 'fill_blank' 
  | 'multiple_choice' 
  | 'translation' 
  | 'conjugation' 
  | 'correction'
  | 'sentence_building'
  | 'error_spotting'
  | 'contextual_usage'
  | 'dialogue_completion';

// Error severity levels
export type ErrorSeverity = 'minor' | 'medium' | 'major';

// Difficulty levels
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

// Grammar Concepts - Core grammar topics
export const grammarConcepts = appSchema.table('grammar_concepts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  name_italian: text('name_italian').notNull(),
  category: text('category').notNull(), // GrammarCategory
  cefr_level: text('cefr_level').notNull(), // CEFRLevel
  description: text('description').notNull(),
  rules: jsonb('rules'), // Structured array of RuleBlock objects for comprehensive explanation
  explanation_italian: text('explanation_italian'),
  examples: jsonb('examples'), // Array of {italian, english, highlight}
  common_mistakes: jsonb('common_mistakes'), // Array of {wrong, correct, explanation}
  practice_focus: text('practice_focus').array(), // Array of practice focus areas
  related_concepts: text('related_concepts').array(),
  exercise_generation_prompt: text('exercise_generation_prompt'), // Custom AI prompt for generating exercises
  importance: integer('importance').notNull().default(5),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// User Grammar Progress - Track mastery with SRS
export const userGrammarProgress = appSchema.table('user_grammar_progress', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  concept_id: text('concept_id').notNull().references(() => grammarConcepts.id, { onDelete: 'cascade' }),
  
  // Spaced Repetition System fields
  ease_factor: real('ease_factor').default(2.5),
  interval_days: real('interval_days').default(0),
  repetitions: integer('repetitions').default(0),
  next_review_date: timestamp('next_review_date'),
  last_reviewed: timestamp('last_reviewed'),
  learning_step: integer('learning_step').default(0),
  
  // Mastery tracking
  mastery_level: text('mastery_level').default('new'), // MasteryLevel
  total_exercises_completed: integer('total_exercises_completed').default(0),
  correct_exercises: integer('correct_exercises').default(0),
  error_count: integer('error_count').default(0),
  last_error_date: timestamp('last_error_date'),
  
  // Completion tracking
  has_watched_video: boolean('has_watched_video').default(false),
  completed_at: timestamp('completed_at'),
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Grammar Errors - Log detected errors from conversations
export const grammarErrors = appSchema.table('grammar_errors', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  concept_id: text('concept_id').references(() => grammarConcepts.id, { onDelete: 'set null' }),
  conversation_id: text('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  session_id: text('session_id').references(() => learningSessions.id, { onDelete: 'cascade' }),
  
  // Error details
  original_text: text('original_text').notNull(),
  corrected_text: text('corrected_text').notNull(),
  error_type: text('error_type').notNull(),
  explanation: text('explanation').notNull(),
  severity: text('severity').default('medium'), // ErrorSeverity
  
  // Context
  full_sentence: text('full_sentence'),
  position_start: integer('position_start'),
  position_end: integer('position_end'),
  
  // User interaction
  was_corrected_in_conversation: boolean('was_corrected_in_conversation').default(false),
  user_acknowledged: boolean('user_acknowledged').default(false),
  
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Grammar Practice Sessions - Track long-form adaptive practice sessions
export const grammarPracticeSessions = appSchema.table('grammar_practice_sessions', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  concept_id: text('concept_id').notNull().references(() => grammarConcepts.id, { onDelete: 'cascade' }),
  
  // Session metadata
  started_at: timestamp('started_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'),
  is_active: boolean('is_active').default(true).notNull(),
  
  // Performance tracking
  total_exercises_attempted: integer('total_exercises_attempted').default(0).notNull(),
  total_correct: integer('total_correct').default(0).notNull(),
  total_incorrect: integer('total_incorrect').default(0).notNull(),
  current_difficulty: text('current_difficulty').default('easy').notNull(), // DifficultyLevel
  
  // Difficulty adjustment tracking
  difficulty_adjustments: jsonb('difficulty_adjustments'), // Array of {timestamp, from, to, reason}
  
  // Session summary
  session_summary: text('session_summary'),
  areas_of_strength: text('areas_of_strength').array(),
  areas_for_improvement: text('areas_for_improvement').array(),
  
  // User feedback
  user_difficulty_rating: text('user_difficulty_rating'), // 'easy' | 'medium' | 'difficult'
  previous_session_context: text('previous_session_context'), // Summary of what was covered before
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Grammar Exercises - Store generated and completed exercises
export const grammarExercises = appSchema.table('grammar_exercises', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  concept_id: text('concept_id').notNull().references(() => grammarConcepts.id, { onDelete: 'cascade' }),
  session_id: text('session_id').references(() => grammarPracticeSessions.id, { onDelete: 'set null' }),
  
  // Exercise content
  exercise_type: text('exercise_type').notNull(), // ExerciseType
  question: text('question').notNull(),
  correct_answer: text('correct_answer').notNull(),
  options: jsonb('options'), // For multiple choice
  explanation: text('explanation'),
  difficulty: text('difficulty').default('medium'), // DifficultyLevel
  
  // User's attempt
  user_answer: text('user_answer'),
  is_correct: boolean('is_correct'),
  attempted_at: timestamp('attempted_at'),
  time_spent_seconds: integer('time_spent_seconds'),
  
  // Context
  hints: jsonb('hints'), // Array of progressive hints
  related_vocabulary: text('related_vocabulary').array(),
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'),
});

// Watched Grammar Videos - Track which videos users have watched
export const watchedGrammarVideos = appSchema.table('watched_grammar_videos', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  video_id: text('video_id').notNull(),
  concept_id: text('concept_id').notNull().references(() => grammarConcepts.id, { onDelete: 'cascade' }),
  watched_at: timestamp('watched_at').defaultNow().notNull(),
  watch_status: text('watch_status').default('watched').notNull(), // 'watched' | 'in_progress'
  
  // Cached transcript and analysis
  transcript: text('transcript'),
  transcript_language: text('transcript_language'),
  analysis: jsonb('analysis'), // VideoAnalysis type
  
  // Metadata
  video_title: text('video_title'),
  video_duration: text('video_duration'),
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Type exports for use in application
export type GrammarConcept = typeof grammarConcepts.$inferSelect;
export type NewGrammarConcept = typeof grammarConcepts.$inferInsert;
export type UserGrammarProgress = typeof userGrammarProgress.$inferSelect;
export type NewUserGrammarProgress = typeof userGrammarProgress.$inferInsert;
export type GrammarError = typeof grammarErrors.$inferSelect;
export type NewGrammarError = typeof grammarErrors.$inferInsert;
export type GrammarPracticeSession = typeof grammarPracticeSessions.$inferSelect;
export type NewGrammarPracticeSession = typeof grammarPracticeSessions.$inferInsert;
export type GrammarExercise = typeof grammarExercises.$inferSelect;
export type NewGrammarExercise = typeof grammarExercises.$inferInsert;
export type WatchedGrammarVideo = typeof watchedGrammarVideos.$inferSelect;
export type NewWatchedGrammarVideo = typeof watchedGrammarVideos.$inferInsert;

// Example structure for JSONB fields
export interface GrammarExample {
  italian: string;
  english: string;
  highlight?: string; // Word/phrase to highlight in the example
}

export interface CommonMistake {
  wrong: string;
  correct: string;
  explanation: string;
}

export interface ExerciseOption {
  text: string;
  isCorrect: boolean;
}

// Video analysis structure (stored in JSONB)
export interface VideoAnalysis {
  coreLessons: string[]; // Main grammar points covered
  examples: VideoExample[]; // Examples from the video
  keyTakeaways: string[]; // Summary bullets
  practiceRecommendations: string[]; // What to practice next
}

export interface VideoExample {
  italian: string;
  english: string;
  explanation: string;
}

// Difficulty adjustment tracking
export interface DifficultyAdjustment {
  timestamp: string;
  from: DifficultyLevel;
  to: DifficultyLevel;
  reason: string;
  performanceScore: number; // % correct in the batch that triggered adjustment
}

// Structured grammar rules
export type RuleBlockType = 'heading' | 'paragraph' | 'list' | 'note' | 'table';
export type NoteVariant = 'info' | 'warning' | 'tip';

export interface TableContent {
  headers: string[];
  rows: string[][];
}

export interface RuleBlock {
  type: RuleBlockType;
  content: string | string[] | TableContent;
  level?: number; // For headings (2 = h2, 3 = h3, 4 = h4)
  variant?: NoteVariant; // For notes
  ordered?: boolean; // For lists (true = numbered, false = bullets)
}

