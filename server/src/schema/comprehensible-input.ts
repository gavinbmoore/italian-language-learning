import { text, integer, timestamp, real, boolean, jsonb } from 'drizzle-orm/pg-core';
import { users, appSchema } from './users';

// User proficiency levels (CEFR-based)
export type ProficiencyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

// User proficiency tracking
export const userProficiency = appSchema.table('user_proficiency', {
  id: text('id').primaryKey().references(() => users.id, { onDelete: 'cascade' }), // Same as user.id
  level: text('level').notNull().default('A1'), // CEFR level: A1, A2, B1, B2, C1, C2
  vocabulary_size: integer('vocabulary_size').notNull().default(0), // Number of known words
  comprehension_score: real('comprehension_score').notNull().default(0.0), // 0.0 to 1.0
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Vocabulary tracking - words the user knows
export const vocabulary = appSchema.table('vocabulary', {
  id: text('id').primaryKey(), // UUID or hash of word+user_id
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  word: text('word').notNull(), // Italian word (normalized: lowercase, no accents for matching)
  word_original: text('word_original').notNull(), // Original word with accents
  frequency_rank: integer('frequency_rank'), // Word frequency rank (1 = most common)
  difficulty_level: text('difficulty_level'), // A1, A2, B1, B2, C1, C2
  times_encountered: integer('times_encountered').notNull().default(1),
  times_understood: integer('times_understood').notNull().default(0),
  is_known: boolean('is_known').notNull().default(false), // User marked as known
  last_encountered: timestamp('last_encountered').defaultNow().notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  // Spaced Repetition System (SRS) fields for flashcards
  next_review_date: timestamp('next_review_date'),
  ease_factor: real('ease_factor').default(2.5),
  interval_days: real('interval_days').default(0),
  repetitions: integer('repetitions').default(0),
  last_reviewed: timestamp('last_reviewed'),
  is_flashcard: boolean('is_flashcard').default(false),
  learning_step: integer('learning_step').default(0), // Anki-style learning phase: 0=new, 1+=in learning, -1=graduated
  example_sentence: text('example_sentence'),
  translation: text('translation'),
});

// Conversation history
export const conversations = appSchema.table('conversations', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  session_id: text('session_id').references(() => learningSessions.id, { onDelete: 'cascade' }), // Link to learning session
  message_type: text('message_type').notNull(), // 'user' or 'assistant'
  content: text('content').notNull(), // The message content
  comprehensibility_score: real('comprehensibility_score'), // Calculated i+1 score (0.0 to 1.0)
  target_comprehensibility: real('target_comprehensibility').notNull().default(0.825), // Target: 82.5% (between 80-85%)
  new_words_count: integer('new_words_count').default(0),
  known_words_count: integer('known_words_count').default(0),
  total_words_count: integer('total_words_count').default(0),
  new_words: jsonb('new_words'), // Array of new words encountered
  conversation_state: text('conversation_state').default('in_topic'), // 'initial_greeting', 'in_topic', 'transitioning'
  metadata: jsonb('metadata'), // Additional metadata
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Learning time tracking - track active learning sessions
export const learningSessions = appSchema.table('learning_sessions', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  start_time: timestamp('start_time').notNull(),
  end_time: timestamp('end_time'),
  duration_seconds: integer('duration_seconds').notNull().default(0), // Total time in seconds
  page_context: text('page_context'), // Which page/activity: 'comprehensible-input', 'vocabulary', etc.
  is_active: boolean('is_active').notNull().default(true), // Is this session still active?
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Conversation memory - stores summaries, facts, and context for long-term memory
export type MemoryType = 'summary' | 'fact' | 'topic' | 'preference' | 'correction' | 'explored_topic' | 'last_session_summary' | 'grammar_weakness';

export const conversationMemory = appSchema.table('conversation_memory', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  memory_type: text('memory_type').notNull(), // 'summary' | 'fact' | 'topic' | 'preference' | 'correction' | 'explored_topic' | 'last_session_summary'
  content: text('content').notNull(), // The memory content
  context: text('context'), // Optional additional context (e.g., related conversation IDs)
  importance: integer('importance').notNull().default(5), // 1-10, for prioritizing memories (higher = more important)
  created_at: timestamp('created_at').defaultNow().notNull(),
  last_used_at: timestamp('last_used_at').defaultNow().notNull(), // Track when memory was last retrieved
  metadata: jsonb('metadata'), // Additional data (conversation range, related topics, etc.) - For explored_topic: { depth: number, engagement: string }
});

// Reading comprehension - daily reading tasks
export const readingTexts = appSchema.table('reading_texts', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(), // The Italian text to read
  source_topic: text('source_topic'), // The news topic/source it's based on
  difficulty_level: text('difficulty_level').notNull(), // CEFR level
  generated_date: timestamp('generated_date', { mode: 'date' }).notNull(), // Date text was generated (for daily reset)
  vocabulary_used: jsonb('vocabulary_used'), // Array of vocabulary words used
  is_completed: boolean('is_completed').notNull().default(false),
  completed_at: timestamp('completed_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const readingQuestions = appSchema.table('reading_questions', {
  id: text('id').primaryKey(),
  reading_text_id: text('reading_text_id').notNull().references(() => readingTexts.id, { onDelete: 'cascade' }),
  question_type: text('question_type').notNull(), // 'multiple_choice' or 'free_text'
  question_text: text('question_text').notNull(),
  correct_answer: text('correct_answer').notNull(),
  options: jsonb('options'), // For multiple choice: array of answer options
  order_index: integer('order_index').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const readingAttempts = appSchema.table('reading_attempts', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reading_text_id: text('reading_text_id').notNull().references(() => readingTexts.id, { onDelete: 'cascade' }),
  question_id: text('question_id').notNull().references(() => readingQuestions.id, { onDelete: 'cascade' }),
  user_answer: text('user_answer').notNull(),
  is_correct: boolean('is_correct'),
  score: real('score'), // Partial credit score (0.0 to 1.0)
  ai_feedback: text('ai_feedback'), // For free-text answers
  session_id: text('session_id').references(() => learningSessions.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export type UserProficiency = typeof userProficiency.$inferSelect;
export type NewUserProficiency = typeof userProficiency.$inferInsert;
export type Vocabulary = typeof vocabulary.$inferSelect;
export type NewVocabulary = typeof vocabulary.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type LearningSession = typeof learningSessions.$inferSelect;
export type NewLearningSession = typeof learningSessions.$inferInsert;
export type ConversationMemory = typeof conversationMemory.$inferSelect;
export type NewConversationMemory = typeof conversationMemory.$inferInsert;
export type ReadingText = typeof readingTexts.$inferSelect;
export type NewReadingText = typeof readingTexts.$inferInsert;
export type ReadingQuestion = typeof readingQuestions.$inferSelect;
export type NewReadingQuestion = typeof readingQuestions.$inferInsert;
export type ReadingAttempt = typeof readingAttempts.$inferSelect;
export type NewReadingAttempt = typeof readingAttempts.$inferInsert;
