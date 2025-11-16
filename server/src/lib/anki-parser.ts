/**
 * Anki .apkg file parser
 * 
 * Parses .apkg files (Anki deck packages) which are zip files containing:
 * - collection.anki2 or collection.anki21 (SQLite database)
 * - media files (images, audio) with a media map (JSON)
 */

import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import crypto from 'crypto';

// Anki database structures
interface AnkiNote {
  id: number;
  guid: string;
  mid: number; // model id (note type)
  mod: number; // modification timestamp
  usn: number;
  tags: string;
  flds: string; // Fields separated by \x1f
  sfld: string; // Sort field
  csum: number;
  flags: number;
  data: string;
}

interface AnkiCard {
  id: number;
  nid: number; // note id
  did: number; // deck id
  ord: number; // ordinal (which card template)
  mod: number;
  usn: number;
  type: number; // 0=new, 1=learning, 2=review
  queue: number;
  due: number;
  ivl: number; // interval
  factor: number; // ease factor
  reps: number; // repetitions
  lapses: number;
  left: number;
  odue: number;
  odid: number;
  flags: number;
  data: string;
}

interface AnkiCol {
  id: number;
  crt: number; // creation time
  mod: number;
  scm: number;
  ver: number;
  dty: number;
  usn: number;
  ls: number;
  conf: string; // JSON config
  models: string; // JSON models (note types)
  decks: string; // JSON decks
  dconf: string; // JSON deck config
  tags: string; // JSON tags
}

interface AnkiModel {
  id: number;
  name: string;
  type: number; // 0=standard, 1=cloze
  mod: number;
  flds: Array<{
    name: string;
    ord: number;
    sticky: boolean;
    rtl: boolean;
    font: string;
    size: number;
  }>;
  tmpls: Array<{
    name: string;
    ord: number;
    qfmt: string; // question format (front)
    afmt: string; // answer format (back)
    bqfmt: string;
    bafmt: string;
    did: number | null;
  }>;
  css: string;
  latexPre: string;
  latexPost: string;
  sortf: number; // sort field index
  req: any;
}

interface AnkiDeck {
  id: number;
  name: string;
  desc: string;
  mod: number;
  collapsed: boolean;
}

export interface ParsedAnkiDeck {
  name: string;
  description: string;
  originalDeckId: number;
  notes: ParsedAnkiNote[];
  media: ParsedMedia[];
}

export interface ParsedAnkiNote {
  originalNoteId: number;
  modelName: string;
  fields: string[]; // Array of field values
  tags: string[];
  sortField: string;
  cards: ParsedAnkiCard[];
}

export interface ParsedAnkiCard {
  originalCardId: number;
  ordinal: number;
  cardType: 'basic' | 'basic_reverse' | 'cloze';
  templateName: string;
  frontContent: string;
  backContent: string;
  frontAudio: string[];
  backAudio: string[];
  // Scheduling data
  state: 'new' | 'learning' | 'review';
  interval: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
}

export interface ParsedMedia {
  filename: string;
  data: Buffer;
  mimeType: string;
  mediaType: 'image' | 'audio' | 'other';
}

/**
 * Parse an Anki .apkg file
 */
export function parseApkgFile(buffer: Buffer): ParsedAnkiDeck {
  console.log('📦 Parsing .apkg file...');
  
  // Extract zip file
  const zip = new AdmZip(buffer);
  const zipEntries = zip.getEntries();
  
  // Find the database file
  let dbEntry = zipEntries.find(e => e.entryName === 'collection.anki21');
  if (!dbEntry) {
    dbEntry = zipEntries.find(e => e.entryName === 'collection.anki2');
  }
  if (!dbEntry) {
    throw new Error('No Anki database found in .apkg file');
  }
  
  console.log(`📊 Found database: ${dbEntry.entryName}`);
  
  // Extract database to buffer
  const dbBuffer = dbEntry.getData();
  
  // Parse media map
  const mediaMapEntry = zipEntries.find(e => e.entryName === 'media');
  let mediaMap: Record<string, string> = {};
  if (mediaMapEntry) {
    const mediaMapData = mediaMapEntry.getData().toString('utf8');
    mediaMap = JSON.parse(mediaMapData);
  }
  
  // Parse the database
  const deckData = readAnkiDatabase(dbBuffer, mediaMap);
  
  // Extract media files
  const media = extractMediaFiles(zip, mediaMap);
  deckData.media = media;
  
  console.log(`✅ Parsed deck: ${deckData.name} (${deckData.notes.length} notes, ${media.length} media files)`);
  
  return deckData;
}

/**
 * Read and parse Anki SQLite database
 */
function readAnkiDatabase(dbBuffer: Buffer, mediaMap: Record<string, string>): ParsedAnkiDeck {
  // Write buffer to temp file for SQLite
  const tmpPath = `/tmp/anki-${crypto.randomBytes(8).toString('hex')}.db`;
  require('fs').writeFileSync(tmpPath, dbBuffer);
  
  try {
    const db = new Database(tmpPath, { readonly: true });
    
    // Read collection metadata
    const colRow = db.prepare('SELECT * FROM col LIMIT 1').get() as AnkiCol;
    const models: Record<string, AnkiModel> = JSON.parse(colRow.models);
    const decks: Record<string, AnkiDeck> = JSON.parse(colRow.decks);
    
    // Get the first deck (usually only one in .apkg exports)
    const deckList = Object.values(decks).filter(d => d.id !== 1); // Skip default deck
    const mainDeck = deckList.length > 0 ? deckList[0] : Object.values(decks)[0];
    
    console.log(`📚 Deck: ${mainDeck.name}`);
    console.log(`📝 Models: ${Object.keys(models).length}`);
    
    // Read all notes
    const notes = db.prepare('SELECT * FROM notes').all() as AnkiNote[];
    console.log(`🗒️  Notes: ${notes.length}`);
    
    // Read all cards
    const cards = db.prepare('SELECT * FROM cards').all() as AnkiCard[];
    console.log(`🃏 Cards: ${cards.length}`);
    
    // Build card lookup by note
    const cardsByNote = new Map<number, AnkiCard[]>();
    for (const card of cards) {
      if (!cardsByNote.has(card.nid)) {
        cardsByNote.set(card.nid, []);
      }
      cardsByNote.get(card.nid)!.push(card);
    }
    
    // Parse notes and generate cards
    const parsedNotes: ParsedAnkiNote[] = [];
    
    for (const note of notes) {
      const model = models[note.mid];
      if (!model) {
        console.warn(`⚠️  Model ${note.mid} not found for note ${note.id}`);
        continue;
      }
      
      // Parse fields
      const fields = note.flds.split('\x1f');
      const tags = note.tags ? note.tags.trim().split(/\s+/).filter(t => t) : [];
      
      // Get cards for this note
      const noteCards = cardsByNote.get(note.id) || [];
      const parsedCards: ParsedAnkiCard[] = [];
      
      for (const card of noteCards) {
        const template = model.tmpls[card.ord];
        if (!template) {
          console.warn(`⚠️  Template ${card.ord} not found for card ${card.id}`);
          continue;
        }
        
        // Render card content
        const { front, back, frontAudio, backAudio } = renderCard(fields, model, template, mediaMap);
        
        // Determine card type
        const cardType = detectCardType(model, template);
        
        // Convert scheduling data
        const state = card.queue === 0 ? 'new' : (card.queue === 1 || card.queue === 3) ? 'learning' : 'review';
        const interval = card.ivl > 0 ? card.ivl : 0;
        const easeFactor = card.factor > 0 ? card.factor / 1000 : 2.5; // Anki stores as 2500 for 2.5
        
        parsedCards.push({
          originalCardId: card.id,
          ordinal: card.ord,
          cardType,
          templateName: template.name,
          frontContent: front,
          backContent: back,
          frontAudio,
          backAudio,
          state,
          interval,
          easeFactor,
          repetitions: card.reps,
          lapses: card.lapses,
        });
      }
      
      parsedNotes.push({
        originalNoteId: note.id,
        modelName: model.name,
        fields,
        tags,
        sortField: note.sfld,
        cards: parsedCards,
      });
    }
    
    db.close();
    
    return {
      name: mainDeck.name,
      description: mainDeck.desc || '',
      originalDeckId: mainDeck.id,
      notes: parsedNotes,
      media: [], // Will be filled by extractMediaFiles
    };
    
  } finally {
    // Clean up temp file
    try {
      require('fs').unlinkSync(tmpPath);
    } catch (err) {
      console.warn('Failed to delete temp file:', err);
    }
  }
}

/**
 * Render card front and back from template
 */
function renderCard(
  fields: string[],
  model: AnkiModel,
  template: AnkiModel['tmpls'][0],
  mediaMap: Record<string, string>
): { front: string; back: string; frontAudio: string[]; backAudio: string[] } {
  // Build field map
  const fieldMap: Record<string, string> = {};
  for (let i = 0; i < model.flds.length; i++) {
    fieldMap[model.flds[i].name] = fields[i] || '';
  }
  
  // Render front
  let front = template.qfmt;
  for (const [name, value] of Object.entries(fieldMap)) {
    // Handle basic field replacement
    front = front.replace(new RegExp(`{{${name}}}`, 'g'), value);
    // Handle cloze fields
    front = front.replace(new RegExp(`{{cloze:${name}}}`, 'g'), 
      processClozeForQuestion(value));
  }
  
  // Render back
  let back = template.afmt;
  for (const [name, value] of Object.entries(fieldMap)) {
    back = back.replace(new RegExp(`{{${name}}}`, 'g'), value);
    back = back.replace(new RegExp(`{{cloze:${name}}}`, 'g'), 
      processClozeForAnswer(value));
  }
  
  // Remove {{FrontSide}} placeholder by including front in back
  back = back.replace(/{{FrontSide}}/g, front);
  
  // Extract audio references
  const frontAudio = extractAudioReferences(front);
  const backAudio = extractAudioReferences(back);
  
  // Clean up conditional fields and Anki syntax
  front = cleanupAnkiSyntax(front);
  back = cleanupAnkiSyntax(back);
  
  return { front, back, frontAudio, backAudio };
}

/**
 * Process cloze deletion for question (hide answers)
 */
function processClozeForQuestion(content: string): string {
  // Replace {{c1::answer}} with [...]
  return content.replace(/{{c\d+::([^}:]+)(?:::[^}]*)?}}/g, '[...]');
}

/**
 * Process cloze deletion for answer (show answers)
 */
function processClozeForAnswer(content: string): string {
  // Replace {{c1::answer}} with answer
  return content.replace(/{{c\d+::([^}:]+)(?:::[^}]*)?}}/g, '$1');
}

/**
 * Extract audio file references from content
 */
function extractAudioReferences(content: string): string[] {
  const audioRegex = /\[sound:([^\]]+)\]/g;
  const matches = [...content.matchAll(audioRegex)];
  return matches.map(m => m[1]);
}

/**
 * Clean up Anki-specific syntax
 */
function cleanupAnkiSyntax(content: string): string {
  // Remove {{#Field}} and {{/Field}} conditional markers
  content = content.replace(/{{[#/][^}]+}}/g, '');
  // Remove {{type:Field}} input fields
  content = content.replace(/{{type:[^}]+}}/g, '');
  return content.trim();
}

/**
 * Detect card type from model and template
 */
function detectCardType(model: AnkiModel, template: AnkiModel['tmpls'][0]): 'basic' | 'basic_reverse' | 'cloze' {
  // Check if cloze model
  if (model.type === 1) {
    return 'cloze';
  }
  
  // Check if reverse card (ordinal > 0 usually means reverse)
  if (template.ord > 0 && model.tmpls.length > 1) {
    return 'basic_reverse';
  }
  
  return 'basic';
}

/**
 * Extract media files from zip
 */
function extractMediaFiles(zip: AdmZip, mediaMap: Record<string, string>): ParsedMedia[] {
  const media: ParsedMedia[] = [];
  const entries = zip.getEntries();
  
  // Media files are named as numbers (0, 1, 2, ...) and mapped in media JSON
  for (const [numStr, filename] of Object.entries(mediaMap)) {
    const entry = entries.find(e => e.entryName === numStr);
    if (!entry) continue;
    
    const data = entry.getData();
    const mimeType = getMimeType(filename);
    const mediaType = getMediaType(mimeType);
    
    media.push({
      filename,
      data,
      mimeType,
      mediaType,
    });
  }
  
  console.log(`🎵 Extracted ${media.length} media files`);
  return media;
}

/**
 * Get MIME type from filename
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
    // Video
    'mp4': 'video/mp4',
    'webm': 'video/webm',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Get media type category
 */
function getMediaType(mimeType: string): 'image' | 'audio' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'other';
}

