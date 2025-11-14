import { getOpenAIClient } from './openai-client';
import { getDatabase } from './db';
import { grammarConcepts, grammarPracticeSessions } from '../schema/grammar';
import type { DifficultyLevel } from '../schema/grammar';
import { eq } from 'drizzle-orm';
import { getUserProficiency, getKnownWords } from './comprehensible-input';

interface ConversationMessage {
  role: 'tutor' | 'student';
  content: string;
  timestamp: string;
  correction?: {
    original: string;
    corrected: string;
    explanation: string;
  };
  wasCorrect?: boolean;
}

interface ConversationState {
  messages: ConversationMessage[];
  topicsCovered: string[];
  correctCount: number;
  totalExchanges: number;
  currentDifficulty: DifficultyLevel;
}

/**
 * Generate the initial tutor message to start a grammar practice conversation
 */
export async function startGrammarConversation(
  userId: string,
  conceptId: string,
  sessionId: string
): Promise<{ message: string; context: ConversationState }> {
  const db = await getDatabase();
  const client = getOpenAIClient();
  const { desc } = await import('drizzle-orm');
  
  // Get concept details
  const concepts = await db
    .select()
    .from(grammarConcepts)
    .where(eq(grammarConcepts.id, conceptId))
    .limit(1);
  
  if (concepts.length === 0) {
    throw new Error('Concept not found');
  }
  
  const concept = concepts[0];
  
  // Get user context
  const proficiency = await getUserProficiency(userId);
  const knownWords = await getKnownWords(userId, 100);
  const knownWordList = knownWords.map(w => w.word_original).join(', ');
  
  // Get session to determine current difficulty
  const sessions = await db
    .select()
    .from(grammarPracticeSessions)
    .where(eq(grammarPracticeSessions.id, sessionId))
    .limit(1);
  
  const currentDifficulty = sessions[0]?.current_difficulty as DifficultyLevel || 'easy';
  
  // Get previous completed session for this concept to build context
  const { and, ne } = await import('drizzle-orm');
  const previousSessions = await db
    .select()
    .from(grammarPracticeSessions)
    .where(
      and(
        eq(grammarPracticeSessions.user_id, userId),
        eq(grammarPracticeSessions.concept_id, conceptId),
        eq(grammarPracticeSessions.is_active, false),
        ne(grammarPracticeSessions.id, sessionId)
      )
    )
    .orderBy(desc(grammarPracticeSessions.completed_at))
    .limit(1);
  
  const previousSession = previousSessions[0];
  let contextFromPrevious = '';
  let complexityAdjustment = '';
  
  if (previousSession) {
    const userRating = previousSession.user_difficulty_rating;
    const prevContext = previousSession.previous_session_context || '';
    
    if (prevContext) {
      contextFromPrevious = `\n\nPREVIOUS SESSION CONTEXT:\n${prevContext}`;
    }
    
    if (userRating === 'easy') {
      complexityAdjustment = `\n\n⚠️ IMPORTANT: The student found the last session TOO EASY. Increase the complexity:
- Use more nuanced examples
- Test edge cases and exceptions
- Combine multiple aspects of the concept
- Use less common vocabulary
- Ask them to explain WHY something is correct/incorrect`;
    } else if (userRating === 'difficult') {
      complexityAdjustment = `\n\n⚠️ IMPORTANT: The student found the last session TOO DIFFICULT. Make it easier:
- Use simpler vocabulary and sentence structures
- Focus on the most basic, common uses
- Provide more hints and scaffolding
- Break down concepts into smaller steps
- Give more examples before asking questions`;
    }
  }
  
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a friendly, encouraging Italian grammar tutor having a conversation to practice: ${concept.name} (${concept.name_italian}).

Student level: ${proficiency.level}
Known vocabulary: ${knownWordList || 'basic words'}
Current difficulty: ${currentDifficulty}

Grammar concept details:
${concept.description}

Rules: ${concept.rules}${contextFromPrevious}${complexityAdjustment}

YOUR ROLE:
- Have a natural, conversational tutoring session
- **PRIORITIZE giving the student English phrases/sentences to translate into Italian** (this is the easiest format for them to respond to)
- Occasionally mix in other exercise types:
  * Complete Italian sentences with the correct form
  * Explain when/how to use the grammar concept
  * Respond to Italian scenarios
- Adapt your questions based on their responses
- Give IMMEDIATE feedback - if they make a mistake, gently correct it right away
- Be encouraging and supportive
- Keep the conversation flowing naturally
- Use examples from their known vocabulary when possible

**TRANSLATION EXERCISES (USE THESE MOST):**
Format: "How would you say in Italian: '[English phrase]'?"
Examples:
- "How would you say in Italian: 'I speak Italian'?"
- "Translate to Italian: 'You (informal) are studying'"
- "In Italian, how do you say: 'We eat pizza'?"

DIFFICULTY LEVEL (${currentDifficulty}):
- easy: Simple, basic usage with clear prompts and common vocabulary
- medium: More varied contexts, some complexity, less common words
- hard: Nuanced usage, edge cases, multiple concepts combined, explain rules

Start the conversation with a warm greeting and give them an English phrase to translate into Italian. Be conversational and friendly, not formal.`,
      },
      {
        role: 'user',
        content: 'Start the grammar tutoring conversation.',
      },
    ],
    temperature: 0.8,
    max_tokens: 300,
  });
  
  const tutorMessage = completion.choices[0]?.message?.content || 'Ciao! Let\'s practice some Italian grammar together!';
  
  const initialState: ConversationState = {
    messages: [{
      role: 'tutor',
      content: tutorMessage,
      timestamp: new Date().toISOString(),
    }],
    topicsCovered: [],
    correctCount: 0,
    totalExchanges: 0,
    currentDifficulty,
  };
  
  return {
    message: tutorMessage,
    context: initialState,
  };
}

/**
 * Continue the grammar conversation with the student's response
 */
export async function continueGrammarConversation(
  userId: string,
  conceptId: string,
  sessionId: string,
  studentMessage: string,
  conversationState: ConversationState
): Promise<{
  tutorMessage: string;
  correction: { original: string; corrected: string; explanation: string } | null;
  wasCorrect: boolean;
  context: ConversationState;
  difficultyAdjusted?: { from: DifficultyLevel; to: DifficultyLevel; reason: string };
}> {
  const db = await getDatabase();
  const client = getOpenAIClient();
  
  // Get concept details
  const concepts = await db
    .select()
    .from(grammarConcepts)
    .where(eq(grammarConcepts.id, conceptId))
    .limit(1);
  
  if (concepts.length === 0) {
    throw new Error('Concept not found');
  }
  
  const concept = concepts[0];
  
  // Get user context
  const proficiency = await getUserProficiency(userId);
  const knownWords = await getKnownWords(userId, 100);
  const knownWordList = knownWords.map(w => w.word_original).join(', ');
  
  // Build conversation history for context
  const conversationHistory = conversationState.messages.map(msg => ({
    role: msg.role === 'tutor' ? 'assistant' : 'user',
    content: msg.content,
  }));
  
  // Extract recent errors to reinforce
  const recentErrors = conversationState.messages
    .filter(msg => msg.role === 'student' && msg.wasCorrect === false && msg.correction)
    .slice(-3) // Last 3 errors
    .map(msg => msg.correction);
  
  let errorReinforcement = '';
  if (recentErrors.length > 0) {
    errorReinforcement = `\n\n**RECENT ERRORS TO REINFORCE:**
The student made these mistakes recently - incorporate these grammar points into your next questions naturally:
${recentErrors.map((err, idx) => `${idx + 1}. Error: "${err?.original}" → Correct: "${err?.corrected}" (${err?.explanation})`).join('\n')}

Make sure to create questions that test these same grammar points in different contexts within the next 2-3 exchanges.`;
  }
  
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a friendly Italian grammar tutor. You're practicing: ${concept.name} (${concept.name_italian}).

Student level: ${proficiency.level}
Known vocabulary: ${knownWordList || 'basic words'}
Current difficulty: ${conversationState.currentDifficulty}

Grammar concept: ${concept.description}
Rules: ${concept.rules}

Common mistakes to watch for: ${JSON.stringify(concept.common_mistakes)}${errorReinforcement}

YOUR INSTRUCTIONS:
1. Evaluate the student's response
2. If there's a grammar error related to this concept, provide a gentle correction
3. **PRIORITIZE asking them to translate English phrases into Italian** (format: "How would you say in Italian: '[phrase]'?")
4. Occasionally vary: sentence completion, explanations, scenarios
5. Keep it conversational and encouraging
6. Track what you've covered so you don't repeat
7. Use vocabulary they know when possible

**EVALUATION CRITERIA - VERY IMPORTANT:**
- **Mark as CORRECT (wasCorrect: true)** if the student got the GRAMMAR PATTERN right, even with minor spelling typos
- **Only mark as INCORRECT (wasCorrect: false)** if there's an actual GRAMMAR ERROR related to the concept being practiced
- Examples for verb conjugation:
  * "construiscono" instead of "costruiscono" = CORRECT (right -isc- pattern, right ending, just a typo in stem)
  * "costruano" instead of "costruiscono" = INCORRECT (wrong pattern, missing -isc-)
  * "costruisce" for "loro" = INCORRECT (wrong ending for plural)
- You can still gently mention spelling corrections in your tutorResponse without marking it wrong
- Focus on whether they UNDERSTOOD and APPLIED the grammar concept correctly

**CRITICAL - ERROR REINFORCEMENT:**
- If the student made a mistake in their previous response, you MUST incorporate that same grammar point into one of the next 2-3 questions
- This ensures they truly understand and learn from their error through spaced repetition
- Example: If they incorrectly used "io parlo" when emphasis wasn't needed, later ask them to translate something that requires deciding whether to include the pronoun or not
- Don't make it obvious you're testing the same concept - weave it naturally into a different context

**MOST IMPORTANT:** Your next question should usually be a translation exercise. Give them an English phrase and ask them to translate it to Italian.

Return ONLY valid JSON:
{
  "wasCorrect": boolean (true if the grammar concept was applied correctly, even with minor spelling typos),
  "correction": {
    "original": "the FULL SENTENCE the student wrote with the error" (ONLY if there was a GRAMMAR error related to the concept),
    "corrected": "the FULL SENTENCE with the correction applied",
    "explanation": "brief, friendly explanation focusing on the GRAMMAR mistake"
  } OR null if grammar is correct (even if there are minor spelling issues),
  "tutorResponse": "your conversational response with the next question/prompt (you can gently mention spelling here if needed, but don't make it a big deal)",
  "topicCovered": "brief label for what aspect was just practiced (e.g., 'pronoun omission', 'formal Lei')",
  "errorToReinforce": "if wasCorrect is false, note the specific grammar point to reinforce in upcoming questions" OR null if correct
}

**IMPORTANT FOR CORRECTIONS:** Always provide the complete sentence in both "original" and "corrected" fields, not just the word or phrase with the error. This helps the student see the full context.
Example:
- Student writes: "loro partono a domani"
- Good correction: {"original": "loro partono a domani", "corrected": "loro partono domani", "explanation": "..."}
- Bad correction: {"original": "a domani", "corrected": "domani", "explanation": "..."}`,
      },
      ...conversationHistory,
      {
        role: 'user',
        content: studentMessage,
      },
    ],
    temperature: 0.7,
    max_tokens: 400,
    response_format: { type: 'json_object' },
  });
  
  const responseContent = completion.choices[0]?.message?.content || '{}';
  const response = JSON.parse(responseContent);
  
  // Update conversation state
  const updatedState: ConversationState = {
    ...conversationState,
    messages: [
      ...conversationState.messages,
      {
        role: 'student',
        content: studentMessage,
        timestamp: new Date().toISOString(),
        correction: response.correction || undefined,
        wasCorrect: response.wasCorrect,
      },
      {
        role: 'tutor',
        content: response.tutorResponse || 'Great! Let\'s continue...',
        timestamp: new Date().toISOString(),
      },
    ],
    topicsCovered: response.topicCovered 
      ? [...conversationState.topicsCovered, response.topicCovered]
      : conversationState.topicsCovered,
    correctCount: conversationState.correctCount + (response.wasCorrect ? 1 : 0),
    totalExchanges: conversationState.totalExchanges + 1,
    currentDifficulty: conversationState.currentDifficulty,
  };
  
  // Check if difficulty should be adjusted (every 10 exchanges)
  let difficultyAdjustment: { from: DifficultyLevel; to: DifficultyLevel; reason: string } | undefined;
  
  if (updatedState.totalExchanges % 10 === 0 && updatedState.totalExchanges > 0) {
    const recentCorrectRate = updatedState.correctCount / updatedState.totalExchanges;
    const currentDiff = updatedState.currentDifficulty;
    let newDiff: DifficultyLevel | null = null;
    
    if (recentCorrectRate >= 0.8 && currentDiff !== 'hard') {
      newDiff = currentDiff === 'easy' ? 'medium' : 'hard';
      difficultyAdjustment = {
        from: currentDiff,
        to: newDiff,
        reason: `Excellent work! You're getting ${(recentCorrectRate * 100).toFixed(0)}% correct. Moving to ${newDiff} level.`,
      };
    } else if (recentCorrectRate < 0.6 && currentDiff !== 'easy') {
      newDiff = currentDiff === 'hard' ? 'medium' : 'easy';
      difficultyAdjustment = {
        from: currentDiff,
        to: newDiff,
        reason: `Let's practice the fundamentals more. Adjusting to ${newDiff} level.`,
      };
    }
    
    if (newDiff) {
      updatedState.currentDifficulty = newDiff;
      
      // Update session in database
      await db
        .update(grammarPracticeSessions)
        .set({ current_difficulty: newDiff })
        .where(eq(grammarPracticeSessions.id, sessionId));
    }
  }
  
  // Update session metrics
  await db
    .update(grammarPracticeSessions)
    .set({
      total_exercises_attempted: updatedState.totalExchanges,
      total_correct: updatedState.correctCount,
      total_incorrect: updatedState.totalExchanges - updatedState.correctCount,
      updated_at: new Date(),
    })
    .where(eq(grammarPracticeSessions.id, sessionId));
  
  return {
    tutorMessage: response.tutorResponse,
    correction: response.correction || null,
    wasCorrect: response.wasCorrect,
    context: updatedState,
    difficultyAdjusted: difficultyAdjustment,
  };
}

/**
 * Deeply analyze the grammar conversation session for patterns and insights
 */
export async function analyzeGrammarSession(
  conceptId: string,
  conversationState: ConversationState
): Promise<{
  summary: string;
  areasOfStrength: string[];
  areasForImprovement: string[];
  specificRecommendations: string[];
  errorPatterns: string[];
}> {
  const client = getOpenAIClient();
  const db = await getDatabase();
  
  const concepts = await db
    .select()
    .from(grammarConcepts)
    .where(eq(grammarConcepts.id, conceptId))
    .limit(1);
  
  const concept = concepts[0] || { name: 'Grammar Concept' };
  
  const accuracy = conversationState.totalExchanges > 0
    ? (conversationState.correctCount / conversationState.totalExchanges) * 100
    : 0;
  
  // Extract all corrections for pattern analysis
  const corrections = conversationState.messages
    .filter(msg => msg.role === 'student' && msg.correction)
    .map(msg => msg.correction);
  
  // Extract all student responses for analysis
  const studentResponses = conversationState.messages
    .filter(msg => msg.role === 'student')
    .map(msg => ({
      content: msg.content,
      wasCorrect: msg.wasCorrect,
      correction: msg.correction,
    }));
  
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert Italian grammar educator analyzing a tutoring session about: ${concept.name} (${concept.name_italian}).

GRAMMAR CONCEPT DETAILS:
${concept.description}

Rules: ${concept.rules}

Common mistakes: ${JSON.stringify(concept.common_mistakes)}

SESSION PERFORMANCE:
- Total exchanges: ${conversationState.totalExchanges}
- Correct: ${conversationState.correctCount}
- Incorrect: ${conversationState.totalExchanges - conversationState.correctCount}
- Accuracy: ${accuracy.toFixed(0)}%
- Topics covered: ${conversationState.topicsCovered.join(', ')}
- Difficulty progression: ${conversationState.currentDifficulty}

STUDENT RESPONSES & CORRECTIONS:
${JSON.stringify(studentResponses, null, 2)}

YOUR TASK:
Analyze this student's performance deeply and identify:
1. What they're doing well (specific strengths related to this grammar concept)
2. What they need to work on (specific weaknesses and patterns)
3. Recurring error patterns (if any mistakes repeated or consistent issues)
4. Specific, actionable recommendations for improvement

Be constructive, encouraging, and specific. Focus on the grammar concept being practiced.

Return ONLY valid JSON:
{
  "summary": "2-3 sentence personalized summary of their session performance",
  "areasOfStrength": ["specific strength 1", "specific strength 2", ...],
  "areasForImprovement": ["specific area 1 with explanation", "specific area 2", ...],
  "specificRecommendations": ["actionable tip 1", "actionable tip 2", ...],
  "errorPatterns": ["pattern 1 if found", "pattern 2 if found", ...] (empty array if no patterns)
}`,
      },
      {
        role: 'user',
        content: 'Analyze this grammar practice session and provide detailed feedback.',
      },
    ],
    temperature: 0.7,
    max_tokens: 600,
    response_format: { type: 'json_object' },
  });
  
  const responseContent = completion.choices[0]?.message?.content || '{}';
  const analysis = JSON.parse(responseContent);
  
  return {
    summary: analysis.summary || 'You completed the practice session!',
    areasOfStrength: analysis.areasOfStrength || [],
    areasForImprovement: analysis.areasForImprovement || [],
    specificRecommendations: analysis.specificRecommendations || [],
    errorPatterns: analysis.errorPatterns || [],
  };
}

/**
 * Generate a summary of the conversation session (legacy function, kept for compatibility)
 */
export async function summarizeGrammarConversation(
  conceptId: string,
  conversationState: ConversationState
): Promise<{
  summary: string;
  areasOfStrength: string[];
  areasForImprovement: string[];
}> {
  // Use the more detailed analysis function
  const analysis = await analyzeGrammarSession(conceptId, conversationState);
  
  return {
    summary: analysis.summary,
    areasOfStrength: analysis.areasOfStrength,
    areasForImprovement: analysis.areasForImprovement,
  };
}

