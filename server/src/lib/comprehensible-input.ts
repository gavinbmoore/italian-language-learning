/**
 * Comprehensible Input (i+1) Core Logic
 * 
 * Implements Krashen's Input Hypothesis:
 * - Maintains 80-85% comprehensibility (15-20% new content)
 * - Adjusts content complexity in real-time
 * - Tracks vocabulary and user proficiency
 */

import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { vocabulary, userProficiency, conversations, ProficiencyLevel } from '../schema/comprehensible-input';
import { getDatabase } from './db';

// Italian word frequency data with CEFR levels
// Based on common Italian word frequencies and CEFR vocabulary guidelines
const ITALIAN_WORD_FREQUENCY: Record<string, { level: ProficiencyLevel; rank: number }> = {
  // A1 level - Top 500 most common words (ranks 1-500)
  'il': { level: 'A1', rank: 1 }, 'la': { level: 'A1', rank: 2 }, 'di': { level: 'A1', rank: 3 },
  'che': { level: 'A1', rank: 4 }, 'e': { level: 'A1', rank: 5 }, 'a': { level: 'A1', rank: 6 },
  'un': { level: 'A1', rank: 7 }, 'una': { level: 'A1', rank: 8 }, 'è': { level: 'A1', rank: 9 },
  'sono': { level: 'A1', rank: 10 }, 'in': { level: 'A1', rank: 11 }, 'per': { level: 'A1', rank: 12 },
  'con': { level: 'A1', rank: 13 }, 'su': { level: 'A1', rank: 14 }, 'da': { level: 'A1', rank: 15 },
  'come': { level: 'A1', rank: 16 }, 'ma': { level: 'A1', rank: 17 }, 'questo': { level: 'A1', rank: 18 },
  'quello': { level: 'A1', rank: 19 }, 'non': { level: 'A1', rank: 20 }, 'lo': { level: 'A1', rank: 21 },
  'si': { level: 'A1', rank: 22 }, 'le': { level: 'A1', rank: 23 }, 'del': { level: 'A1', rank: 24 },
  'alla': { level: 'A1', rank: 25 }, 'nel': { level: 'A1', rank: 26 }, 'dei': { level: 'A1', rank: 27 },
  'gli': { level: 'A1', rank: 28 }, 'al': { level: 'A1', rank: 29 }, 'delle': { level: 'A1', rank: 30 },
  'i': { level: 'A1', rank: 31 }, 'della': { level: 'A1', rank: 32 }, 'dall': { level: 'A1', rank: 33 },
  'anche': { level: 'A1', rank: 34 }, 'dal': { level: 'A1', rank: 35 }, 'più': { level: 'A1', rank: 36 },
  'ha': { level: 'A1', rank: 37 }, 'essere': { level: 'A1', rank: 38 }, 'avere': { level: 'A1', rank: 39 },
  'fare': { level: 'A1', rank: 40 }, 'andare': { level: 'A1', rank: 41 }, 'ho': { level: 'A1', rank: 42 },
  'hai': { level: 'A1', rank: 43 }, 'quando': { level: 'A1', rank: 44 }, 'dove': { level: 'A1', rank: 45 },
  'chi': { level: 'A1', rank: 46 }, 'cosa': { level: 'A1', rank: 47 }, 'perché': { level: 'A1', rank: 48 },
  'molto': { level: 'A1', rank: 49 }, 'ciao': { level: 'A1', rank: 50 }, 'sì': { level: 'A1', rank: 51 },
  'no': { level: 'A1', rank: 52 }, 'bene': { level: 'A1', rank: 53 }, 'male': { level: 'A1', rank: 54 },
  'io': { level: 'A1', rank: 55 }, 'tu': { level: 'A1', rank: 56 }, 'lui': { level: 'A1', rank: 57 },
  'lei': { level: 'A1', rank: 58 }, 'noi': { level: 'A1', rank: 59 }, 'voi': { level: 'A1', rank: 60 },
  'loro': { level: 'A1', rank: 61 }, 'mi': { level: 'A1', rank: 62 }, 'ti': { level: 'A1', rank: 63 },
  'ci': { level: 'A1', rank: 64 }, 'vi': { level: 'A1', rank: 65 }, 'mio': { level: 'A1', rank: 66 },
  'tuo': { level: 'A1', rank: 67 }, 'suo': { level: 'A1', rank: 68 }, 'nostro': { level: 'A1', rank: 69 },
  'vostro': { level: 'A1', rank: 70 },   'adesso': { level: 'A1', rank: 71 }, 'oggi': { level: 'A1', rank: 72 },
  'ieri': { level: 'A1', rank: 73 }, 'domani': { level: 'A1', rank: 74 }, 'sempre': { level: 'A1', rank: 75 },
  'mai': { level: 'A1', rank: 76 }, 'qui': { level: 'A1', rank: 77 }, 'lì': { level: 'A1', rank: 78 },
  'là': { level: 'A1', rank: 79 }, 'bello': { level: 'A1', rank: 80 }, 'buono': { level: 'A1', rank: 81 },
  'grande': { level: 'A1', rank: 82 }, 'piccolo': { level: 'A1', rank: 83 }, 'nuovo': { level: 'A1', rank: 84 },
  'vecchio': { level: 'A1', rank: 85 }, 'giovane': { level: 'A1', rank: 86 }, 'giorno': { level: 'A1', rank: 87 },
  'anno': { level: 'A1', rank: 88 }, 'tempo': { level: 'A1', rank: 89 }, 'volta': { level: 'A1', rank: 90 },
  'vita': { level: 'A1', rank: 91 }, 'uomo': { level: 'A1', rank: 92 }, 'donna': { level: 'A1', rank: 93 },
  'bambino': { level: 'A1', rank: 94 }, 'persona': { level: 'A1', rank: 95 }, 'gente': { level: 'A1', rank: 96 },
  'casa': { level: 'A1', rank: 97 }, 'città': { level: 'A1', rank: 98 }, 'paese': { level: 'A1', rank: 99 },
  'mondo': { level: 'A1', rank: 100 }, 'grazie': { level: 'A1', rank: 101 }, 'prego': { level: 'A1', rank: 102 },
  'scusa': { level: 'A1', rank: 103 }, 'buongiorno': { level: 'A1', rank: 104 }, 'buonasera': { level: 'A1', rank: 105 },
  'buonanotte': { level: 'A1', rank: 106 }, 'arrivederci': { level: 'A1', rank: 107 }, 'padre': { level: 'A1', rank: 108 },
  'madre': { level: 'A1', rank: 109 }, 'figlio': { level: 'A1', rank: 110 }, 'figlia': { level: 'A1', rank: 111 },
  'fratello': { level: 'A1', rank: 112 }, 'sorella': { level: 'A1', rank: 113 }, 'famiglia': { level: 'A1', rank: 114 },
  'amico': { level: 'A1', rank: 115 }, 'amore': { level: 'A1', rank: 116 }, 'mangiare': { level: 'A1', rank: 117 },
  'bere': { level: 'A1', rank: 118 }, 'dormire': { level: 'A1', rank: 119 }, 'vedere': { level: 'A1', rank: 120 },
  'sentire': { level: 'A1', rank: 121 }, 'dire': { level: 'A1', rank: 122 }, 'sapere': { level: 'A1', rank: 123 },
  'potere': { level: 'A1', rank: 124 }, 'volere': { level: 'A1', rank: 125 }, 'dovere': { level: 'A1', rank: 126 },
  'piacere': { level: 'A1', rank: 127 }, 'venire': { level: 'A1', rank: 128 }, 'stare': { level: 'A1', rank: 129 },
  'dare': { level: 'A1', rank: 130 }, 'prendere': { level: 'A1', rank: 131 }, 'mettere': { level: 'A1', rank: 132 },
  'lasciare': { level: 'A1', rank: 133 }, 'trovare': { level: 'A1', rank: 134 }, 'chiamare': { level: 'A1', rank: 135 },
  'chiedere': { level: 'A1', rank: 136 }, 'rispondere': { level: 'A1', rank: 137 }, 'capire': { level: 'A1', rank: 138 },
  'pensare': { level: 'A1', rank: 139 }, 'credere': { level: 'A1', rank: 140 }, 'uno': { level: 'A1', rank: 141 },
  'due': { level: 'A1', rank: 142 }, 'tre': { level: 'A1', rank: 143 }, 'quattro': { level: 'A1', rank: 144 },
  'cinque': { level: 'A1', rank: 145 }, 'sei': { level: 'A1', rank: 146 }, 'sette': { level: 'A1', rank: 147 },
  'otto': { level: 'A1', rank: 148 }, 'nove': { level: 'A1', rank: 149 }, 'dieci': { level: 'A1', rank: 150 },
  'cento': { level: 'A1', rank: 151 }, 'mille': { level: 'A1', rank: 152 }, 'rosso': { level: 'A1', rank: 153 },
  'blu': { level: 'A1', rank: 154 }, 'verde': { level: 'A1', rank: 155 }, 'giallo': { level: 'A1', rank: 156 },
  'bianco': { level: 'A1', rank: 157 }, 'nero': { level: 'A1', rank: 158 }, 'acqua': { level: 'A1', rank: 159 },
  'pane': { level: 'A1', rank: 160 }, 'vino': { level: 'A1', rank: 161 }, 'caffè': { level: 'A1', rank: 162 },
  'latte': { level: 'A1', rank: 163 }, 'carne': { level: 'A1', rank: 164 }, 'pesce': { level: 'A1', rank: 165 },
  'frutta': { level: 'A1', rank: 166 }, 'verdura': { level: 'A1', rank: 167 }, 'pasta': { level: 'A1', rank: 168 },
  'pizza': { level: 'A1', rank: 169 }, 'tavola': { level: 'A1', rank: 170 }, 'sedia': { level: 'A1', rank: 171 },
  'letto': { level: 'A1', rank: 172 }, 'porta': { level: 'A1', rank: 173 }, 'finestra': { level: 'A1', rank: 174 },
  'strada': { level: 'A1', rank: 175 }, 'auto': { level: 'A1', rank: 176 }, 'treno': { level: 'A1', rank: 177 },
  'aereo': { level: 'A1', rank: 178 }, 'mare': { level: 'A1', rank: 179 }, 'montagna': { level: 'A1', rank: 180 },
  'sole': { level: 'A1', rank: 181 }, 'luna': { level: 'A1', rank: 182 }, 'cielo': { level: 'A1', rank: 183 },
  'terra': { level: 'A1', rank: 184 }, 'libro': { level: 'A1', rank: 185 }, 'scuola': { level: 'A1', rank: 186 },
  'lavoro': { level: 'A1', rank: 187 }, 'ufficio': { level: 'A1', rank: 188 }, 'negozio': { level: 'A1', rank: 189 },
  'ristorante': { level: 'A1', rank: 190 }, 'albergo': { level: 'A1', rank: 191 }, 'camera': { level: 'A1', rank: 192 },
  'bagno': { level: 'A1', rank: 193 }, 'cucina': { level: 'A1', rank: 194 }, 'salotto': { level: 'A1', rank: 195 },
  'mattina': { level: 'A1', rank: 196 }, 'tardo': { level: 'A1', rank: 197 }, 'notte': { level: 'A1', rank: 198 },
  'settimana': { level: 'A1', rank: 199 }, 'mese': { level: 'A1', rank: 200 },
  
  // A1 continued (201-500)
  'primo': { level: 'A1', rank: 201 }, 'ultimo': { level: 'A1', rank: 202 }, 'altro': { level: 'A1', rank: 203 },
  'stesso': { level: 'A1', rank: 204 }, 'ancora': { level: 'A1', rank: 205 }, 'poi': { level: 'A1', rank: 206 },
  'già': { level: 'A1', rank: 207 }, 'così': { level: 'A1', rank: 208 }, 'poco': { level: 'A1', rank: 209 },
  'tanto': { level: 'A1', rank: 210 }, 'troppo': { level: 'A1', rank: 211 }, 'tutto': { level: 'A1', rank: 212 },
  'niente': { level: 'A1', rank: 213 }, 'qualcosa': { level: 'A1', rank: 214 }, 'qualcuno': { level: 'A1', rank: 215 },
  'tutti': { level: 'A1', rank: 216 }, 'ogni': { level: 'A1', rank: 217 }, 'alcuni': { level: 'A1', rank: 218 },
  'molti': { level: 'A1', rank: 219 }, 'pochi': { level: 'A1', rank: 220 }, 'solo': { level: 'A1', rank: 221 },
  'proprio': { level: 'A1', rank: 222 }, 'insieme': { level: 'A1', rank: 223 }, 'contro': { level: 'A1', rank: 224 },
  'senza': { level: 'A1', rank: 225 }, 'dentro': { level: 'A1', rank: 226 }, 'fuori': { level: 'A1', rank: 227 },
  'sopra': { level: 'A1', rank: 228 }, 'sotto': { level: 'A1', rank: 229 }, 'avanti': { level: 'A1', rank: 230 },
  'dietro': { level: 'A1', rank: 231 }, 'vicino': { level: 'A1', rank: 232 }, 'lontano': { level: 'A1', rank: 233 },
  'centro': { level: 'A1', rank: 234 }, 'parte': { level: 'A1', rank: 235 }, 'momento': { level: 'A1', rank: 236 },
  'istante': { level: 'A1', rank: 237 }, 'minuto': { level: 'A1', rank: 238 }, 'secondo': { level: 'A1', rank: 239 },
  'mattino': { level: 'A1', rank: 240 }, 'pomeriggio': { level: 'A1', rank: 241 }, 'sera': { level: 'A1', rank: 242 },
  'lunedì': { level: 'A1', rank: 243 }, 'martedì': { level: 'A1', rank: 244 }, 'mercoledì': { level: 'A1', rank: 245 },
  'giovedì': { level: 'A1', rank: 246 }, 'venerdì': { level: 'A1', rank: 247 }, 'sabato': { level: 'A1', rank: 248 },
  'domenica': { level: 'A1', rank: 249 }, 'gennaio': { level: 'A1', rank: 250 }, 'febbraio': { level: 'A1', rank: 251 },
  'marzo': { level: 'A1', rank: 252 }, 'aprile': { level: 'A1', rank: 253 }, 'maggio': { level: 'A1', rank: 254 },
  'giugno': { level: 'A1', rank: 255 }, 'luglio': { level: 'A1', rank: 256 }, 'agosto': { level: 'A1', rank: 257 },
  'settembre': { level: 'A1', rank: 258 }, 'ottobre': { level: 'A1', rank: 259 }, 'novembre': { level: 'A1', rank: 260 },
  'dicembre': { level: 'A1', rank: 261 }, 'occhio': { level: 'A1', rank: 262 }, 'mano': { level: 'A1', rank: 263 },
  'piede': { level: 'A1', rank: 264 }, 'testa': { level: 'A1', rank: 265 }, 'corpo': { level: 'A1', rank: 266 },
  'cuore': { level: 'A1', rank: 267 }, 'bocca': { level: 'A1', rank: 268 }, 'naso': { level: 'A1', rank: 269 },
  'orecchio': { level: 'A1', rank: 270 }, 'capello': { level: 'A1', rank: 271 }, 'braccio': { level: 'A1', rank: 272 },
  'gamba': { level: 'A1', rank: 273 }, 'dito': { level: 'A1', rank: 274 }, 'numero': { level: 'A1', rank: 275 },
  'nome': { level: 'A1', rank: 276 }, 'cognome': { level: 'A1', rank: 277 }, 'età': { level: 'A1', rank: 278 },
  'indirizzo': { level: 'A1', rank: 279 }, 'telefono': { level: 'A1', rank: 280 }, 'email': { level: 'A1', rank: 281 },
  'lingua': { level: 'A1', rank: 282 }, 'parola': { level: 'A1', rank: 283 }, 'frase': { level: 'A1', rank: 284 },
  'domanda': { level: 'A1', rank: 285 }, 'risposta': { level: 'A1', rank: 286 }, 'problema': { level: 'A1', rank: 287 },
  'soluzione': { level: 'A1', rank: 288 }, 'idea': { level: 'A1', rank: 289 }, 'aiuto': { level: 'A1', rank: 290 },
  'bisogno': { level: 'A1', rank: 291 }, 'voglia': { level: 'A1', rank: 292 }, 'fame': { level: 'A1', rank: 293 },
  'sete': { level: 'A1', rank: 294 }, 'sonno': { level: 'A1', rank: 295 }, 'freddo': { level: 'A1', rank: 296 },
  'caldo': { level: 'A1', rank: 297 }, 'felice': { level: 'A1', rank: 298 }, 'triste': { level: 'A1', rank: 299 },
  'contento': { level: 'A1', rank: 300 }, 'stanco': { level: 'A1', rank: 301 }, 'malato': { level: 'A1', rank: 302 },
  'sano': { level: 'A1', rank: 303 }, 'forte': { level: 'A1', rank: 304 }, 'debole': { level: 'A1', rank: 305 },
  'alto': { level: 'A1', rank: 306 }, 'basso': { level: 'A1', rank: 307 }, 'lungo': { level: 'A1', rank: 308 },
  'corto': { level: 'A1', rank: 309 }, 'largo': { level: 'A1', rank: 310 }, 'stretto': { level: 'A1', rank: 311 },
  'aperto': { level: 'A1', rank: 312 }, 'chiuso': { level: 'A1', rank: 313 }, 'pieno': { level: 'A1', rank: 314 },
  'vuoto': { level: 'A1', rank: 315 }, 'pulito': { level: 'A1', rank: 316 }, 'sporco': { level: 'A1', rank: 317 },
  'facile': { level: 'A1', rank: 318 }, 'difficile': { level: 'A1', rank: 319 }, 'possibile': { level: 'A1', rank: 320 },
  'impossibile': { level: 'A1', rank: 321 }, 'vero': { level: 'A1', rank: 322 }, 'falso': { level: 'A1', rank: 323 },
  'giusto': { level: 'A1', rank: 324 }, 'sbagliato': { level: 'A1', rank: 325 }, 'importante': { level: 'A1', rank: 326 },
  'interessante': { level: 'A1', rank: 327 }, 'noioso': { level: 'A1', rank: 328 }, 'attraente': { level: 'A1', rank: 329 },
  'brutto': { level: 'A1', rank: 330 }, 'caro': { level: 'A1', rank: 331 }, 'economico': { level: 'A1', rank: 332 },
  'gratis': { level: 'A1', rank: 333 }, 'prezzo': { level: 'A1', rank: 334 }, 'soldi': { level: 'A1', rank: 335 },
  'euro': { level: 'A1', rank: 336 }, 'pagare': { level: 'A1', rank: 337 }, 'comprare': { level: 'A1', rank: 338 },
  'vendere': { level: 'A1', rank: 339 }, 'mercato': { level: 'A1', rank: 340 }, 'banco': { level: 'A1', rank: 341 },
  'posta': { level: 'A1', rank: 342 }, 'lettera': { level: 'A1', rank: 343 }, 'pacchetto': { level: 'A1', rank: 344 },
  'francobollo': { level: 'A1', rank: 345 }, 'stazione': { level: 'A1', rank: 346 }, 'biglietto': { level: 'A1', rank: 347 },
  'viaggio': { level: 'A1', rank: 348 }, 'turista': { level: 'A1', rank: 349 }, 'vacanza': { level: 'A1', rank: 350 },
  'festa': { level: 'A1', rank: 351 }, 'compleanno': { level: 'A1', rank: 352 }, 'regalo': { level: 'A1', rank: 353 },
  'natale': { level: 'A1', rank: 354 }, 'pasqua': { level: 'A1', rank: 355 },   'studente': { level: 'A1', rank: 356 },
  'professore': { level: 'A1', rank: 357 }, 'lezione': { level: 'A1', rank: 358 }, 'esame': { level: 'A1', rank: 359 },
  'corso': { level: 'A1', rank: 360 }, 'aula': { level: 'A1', rank: 361 }, 'compito': { level: 'A1', rank: 362 },
  'quaderno': { level: 'A1', rank: 363 }, 'penna': { level: 'A1', rank: 364 }, 'matita': { level: 'A1', rank: 365 },
  'carta': { level: 'A1', rank: 366 }, 'pagina': { level: 'A1', rank: 367 }, 'giornale': { level: 'A1', rank: 368 },
  'rivista': { level: 'A1', rank: 369 }, 'film': { level: 'A1', rank: 370 }, 'cinema': { level: 'A1', rank: 371 },
  'teatro': { level: 'A1', rank: 372 }, 'musica': { level: 'A1', rank: 373 }, 'canzone': { level: 'A1', rank: 374 },
  'sport': { level: 'A1', rank: 375 }, 'calcio': { level: 'A1', rank: 376 }, 'tennis': { level: 'A1', rank: 377 },
  'nuotare': { level: 'A1', rank: 378 }, 'correre': { level: 'A1', rank: 379 }, 'camminare': { level: 'A1', rank: 380 },
  'giocare': { level: 'A1', rank: 381 }, 'ballare': { level: 'A1', rank: 382 }, 'cantare': { level: 'A1', rank: 383 },
  'ascoltare': { level: 'A1', rank: 384 }, 'leggere': { level: 'A1', rank: 385 }, 'scrivere': { level: 'A1', rank: 386 },
  'studiare': { level: 'A1', rank: 387 }, 'lavorare': { level: 'A1', rank: 388 }, 'riposare': { level: 'A1', rank: 389 },
  'aspettare': { level: 'A1', rank: 390 }, 'arrivare': { level: 'A1', rank: 391 }, 'partire': { level: 'A1', rank: 392 },
  'entrare': { level: 'A1', rank: 393 }, 'uscire': { level: 'A1', rank: 394 }, 'salire': { level: 'A1', rank: 395 },
  'scendere': { level: 'A1', rank: 396 }, 'alzare': { level: 'A1', rank: 397 }, 'abbassare': { level: 'A1', rank: 398 },
  'aprire': { level: 'A1', rank: 399 }, 'chiudere': { level: 'A1', rank: 400 }, 'cominciare': { level: 'A1', rank: 401 },
  'finire': { level: 'A1', rank: 402 }, 'continuare': { level: 'A1', rank: 403 }, 'smettere': { level: 'A1', rank: 404 },
  'iniziare': { level: 'A1', rank: 405 }, 'terminare': { level: 'A1', rank: 406 }, 'portare': { level: 'A1', rank: 407 },
  'tirare': { level: 'A1', rank: 408 }, 'spingere': { level: 'A1', rank: 409 }, 'tenere': { level: 'A1', rank: 410 },
  'scegliere': { level: 'A1', rank: 411 }, 'decidere': { level: 'A1', rank: 412 }, 'preferire': { level: 'A1', rank: 413 },
  'amare': { level: 'A1', rank: 414 }, 'odiare': { level: 'A1', rank: 415 }, 'ricordare': { level: 'A1', rank: 416 },
  'dimenticare': { level: 'A1', rank: 417 }, 'imparare': { level: 'A1', rank: 418 }, 'insegnare': { level: 'A1', rank: 419 },
  'conoscere': { level: 'A1', rank: 420 }, 'incontrare': { level: 'A1', rank: 421 }, 'presentare': { level: 'A1', rank: 422 },
  'salutare': { level: 'A1', rank: 423 }, 'baciare': { level: 'A1', rank: 424 }, 'abbracciare': { level: 'A1', rank: 425 },
  'sorridere': { level: 'A1', rank: 426 }, 'ridere': { level: 'A1', rank: 427 }, 'piangere': { level: 'A1', rank: 428 },
  'parlare': { level: 'A1', rank: 429 }, 'raccontare': { level: 'A1', rank: 430 }, 'spiegare': { level: 'A1', rank: 431 },
  'mostrare': { level: 'A1', rank: 432 }, 'guardare': { level: 'A1', rank: 433 }, 'osservare': { level: 'A1', rank: 434 },
  'cercare': { level: 'A1', rank: 435 }, 'perdere': { level: 'A1', rank: 436 }, 'vincere': { level: 'A1', rank: 437 },
  'guadagnare': { level: 'A1', rank: 438 }, 'spendere': { level: 'A1', rank: 439 }, 'risparmiare': { level: 'A1', rank: 440 },
  'usare': { level: 'A1', rank: 441 }, 'utilizzare': { level: 'A1', rank: 442 }, 'servire': { level: 'A1', rank: 443 },
  'bastare': { level: 'A1', rank: 444 }, 'mancare': { level: 'A1', rank: 445 }, 'succedere': { level: 'A1', rank: 446 },
  'accadere': { level: 'A1', rank: 447 }, 'capitare': { level: 'A1', rank: 448 }, 'diventare': { level: 'A1', rank: 449 },
  'restare': { level: 'A1', rank: 450 }, 'rimanere': { level: 'A1', rank: 451 }, 'vivere': { level: 'A1', rank: 452 },
  'morire': { level: 'A1', rank: 453 }, 'nascere': { level: 'A1', rank: 454 }, 'crescere': { level: 'A1', rank: 455 },
  'cambiare': { level: 'A1', rank: 456 }, 'modificare': { level: 'A1', rank: 457 }, 'migliorare': { level: 'A1', rank: 458 },
  'peggiorare': { level: 'A1', rank: 459 }, 'aumentare': { level: 'A1', rank: 460 }, 'diminuire': { level: 'A1', rank: 461 },
  'tagliare': { level: 'A1', rank: 462 }, 'rompere': { level: 'A1', rank: 463 }, 'costruire': { level: 'A1', rank: 464 },
  'riparare': { level: 'A1', rank: 465 }, 'pulire': { level: 'A1', rank: 466 }, 'lavare': { level: 'A1', rank: 467 },
  'cucinare': { level: 'A1', rank: 468 }, 'preparare': { level: 'A1', rank: 469 }, 'ordinare': { level: 'A1', rank: 470 },
  'fornire': { level: 'A1', rank: 471 }, 'offrire': { level: 'A1', rank: 472 }, 'accettare': { level: 'A1', rank: 473 },
  'rifiutare': { level: 'A1', rank: 474 }, 'permettere': { level: 'A1', rank: 475 }, 'proibire': { level: 'A1', rank: 476 },
  'obbligare': { level: 'A1', rank: 477 }, 'consigliare': { level: 'A1', rank: 478 }, 'suggerire': { level: 'A1', rank: 479 },
  'promettere': { level: 'A1', rank: 480 }, 'sperare': { level: 'A1', rank: 481 }, 'desiderare': { level: 'A1', rank: 482 },
  'temere': { level: 'A1', rank: 483 }, 'aver paura': { level: 'A1', rank: 484 }, 'preoccupare': { level: 'A1', rank: 485 },
  'calmare': { level: 'A1', rank: 486 }, 'tranquillo': { level: 'A1', rank: 487 }, 'nervoso': { level: 'A1', rank: 488 },
  'arrabbiato': { level: 'A1', rank: 489 }, 'deluso': { level: 'A1', rank: 490 }, 'soddisfatto': { level: 'A1', rank: 491 },
  'orgoglioso': { level: 'A1', rank: 492 }, 'imbarazzato': { level: 'A1', rank: 493 }, 'sorpreso': { level: 'A1', rank: 494 },
  'stupito': { level: 'A1', rank: 495 }, 'annoiato': { level: 'A1', rank: 496 }, 'divertito': { level: 'A1', rank: 497 },
  'eccitato': { level: 'A1', rank: 498 }, 'rilassato': { level: 'A1', rank: 499 }, 'preoccupato': { level: 'A1', rank: 500 },
  
  // A2 level - ranks 501-1500
  'dunque': { level: 'A2', rank: 501 }, 'quindi': { level: 'A2', rank: 502 }, 'tuttavia': { level: 'A2', rank: 503 },
  'comunque': { level: 'A2', rank: 504 }, 'invece': { level: 'A2', rank: 505 }, 'inoltre': { level: 'A2', rank: 506 },
  'infatti': { level: 'A2', rank: 507 }, 'cioè': { level: 'A2', rank: 508 }, 'oppure': { level: 'A2', rank: 509 },
  'altrimenti': { level: 'A2', rank: 510 }, 'sebbene': { level: 'A2', rank: 511 }, 'benché': { level: 'A2', rank: 512 },
  'nonostante': { level: 'A2', rank: 513 }, 'malgrado': { level: 'A2', rank: 514 }, 'affinché': { level: 'A2', rank: 515 },
  'purché': { level: 'A2', rank: 516 }, 'qualora': { level: 'A2', rank: 517 }, 'comunità': { level: 'A2', rank: 518 },
  'società': { level: 'A2', rank: 519 }, 'popolazione': { level: 'A2', rank: 520 }, 'cittadino': { level: 'A2', rank: 521 },
  'governo': { level: 'A2', rank: 522 }, 'politica': { level: 'A2', rank: 523 }, 'economia': { level: 'A2', rank: 524 },
  'cultura': { level: 'A2', rank: 525 }, 'tradizione': { level: 'A2', rank: 526 }, 'storia': { level: 'A2', rank: 527 },
  'futuro': { level: 'A2', rank: 528 }, 'passato': { level: 'A2', rank: 529 }, 'presente': { level: 'A2', rank: 530 },
  'sviluppo': { level: 'A2', rank: 531 }, 'progresso': { level: 'A2', rank: 532 }, 'tecnologia': { level: 'A2', rank: 533 },
  'scienza': { level: 'A2', rank: 534 }, 'ricerca': { level: 'A2', rank: 535 }, 'scoperta': { level: 'A2', rank: 536 },
  'invenzione': { level: 'A2', rank: 537 }, 'metodo': { level: 'A2', rank: 538 }, 'sistema': { level: 'A2', rank: 539 },
  'processo': { level: 'A2', rank: 540 }, 'risultato': { level: 'A2', rank: 541 }, 'conseguenza': { level: 'A2', rank: 542 },
  'effetto': { level: 'A2', rank: 543 }, 'causa': { level: 'A2', rank: 544 }, 'ragione': { level: 'A2', rank: 545 },
  'motivo': { level: 'A2', rank: 546 }, 'scopo': { level: 'A2', rank: 547 }, 'obiettivo': { level: 'A2', rank: 548 },
  'meta': { level: 'A2', rank: 549 }, 'fine': { level: 'A2', rank: 550 }, 'mezzo': { level: 'A2', rank: 551 },
  'modo': { level: 'A2', rank: 552 }, 'maniera': { level: 'A2', rank: 553 }, 'tipo': { level: 'A2', rank: 554 },
  'genere': { level: 'A2', rank: 555 }, 'specie': { level: 'A2', rank: 556 }, 'sorta': { level: 'A2', rank: 557 },
  'categoria': { level: 'A2', rank: 558 }, 'gruppo': { level: 'A2', rank: 559 }, 'classe': { level: 'A2', rank: 560 },
  'esempio': { level: 'A2', rank: 561 }, 'caso': { level: 'A2', rank: 562 }, 'situazione': { level: 'A2', rank: 563 },
  'condizione': { level: 'A2', rank: 564 }, 'stato': { level: 'A2', rank: 565 }, 'posizione': { level: 'A2', rank: 566 },
  'luogo': { level: 'A2', rank: 567 }, 'posto': { level: 'A2', rank: 568 }, 'spazio': { level: 'A2', rank: 569 },
  'area': { level: 'A2', rank: 570 }, 'zona': { level: 'A2', rank: 571 }, 'regione': { level: 'A2', rank: 572 },
  'territorio': { level: 'A2', rank: 573 }, 'confine': { level: 'A2', rank: 574 }, 'limite': { level: 'A2', rank: 575 },
  'bordo': { level: 'A2', rank: 576 }, 'margine': { level: 'A2', rank: 577 }, 'angolo': { level: 'A2', rank: 578 },
  'lato': { level: 'A2', rank: 579 }, 'fianco': { level: 'A2', rank: 580 }, 'fronte': { level: 'A2', rank: 581 },
  'retro': { level: 'A2', rank: 582 }, 'fondo': { level: 'A2', rank: 583 }, 'superficie': { level: 'A2', rank: 584 },
  'profondità': { level: 'A2', rank: 585 }, 'altezza': { level: 'A2', rank: 586 }, 'larghezza': { level: 'A2', rank: 587 },
  'lunghezza': { level: 'A2', rank: 588 }, 'distanza': { level: 'A2', rank: 589 }, 'misura': { level: 'A2', rank: 590 },
  'dimensione': { level: 'A2', rank: 591 }, 'grandezza': { level: 'A2', rank: 592 }, 'peso': { level: 'A2', rank: 593 },
  'volume': { level: 'A2', rank: 594 }, 'quantità': { level: 'A2', rank: 595 }, 'ammontare': { level: 'A2', rank: 596 },
  'cifra': { level: 'A2', rank: 597 }, 'somma': { level: 'A2', rank: 598 }, 'totale': { level: 'A2', rank: 599 },
  'media': { level: 'A2', rank: 600 }, 'maggioranza': { level: 'A2', rank: 601 }, 'minoranza': { level: 'A2', rank: 602 },
  'metà': { level: 'A2', rank: 603 }, 'quarto': { level: 'A2', rank: 604 }, 'terzo': { level: 'A2', rank: 605 },
  'doppio': { level: 'A2', rank: 606 }, 'triplo': { level: 'A2', rank: 607 }, 'paio': { level: 'A2', rank: 608 },
  'dozzina': { level: 'A2', rank: 609 }, 'centinaio': { level: 'A2', rank: 610 }, 'migliaio': { level: 'A2', rank: 611 },
  'milione': { level: 'A2', rank: 612 }, 'miliardo': { level: 'A2', rank: 613 }, 'infinito': { level: 'A2', rank: 614 },
  'zero': { level: 'A2', rank: 615 }, 'nulla': { level: 'A2', rank: 616 }, 'deserto': { level: 'A2', rank: 617 },
  'colmo': { level: 'A2', rank: 618 }, 'completo': { level: 'A2', rank: 619 }, 'intero': { level: 'A2', rank: 620 },
  'globale': { level: 'A2', rank: 621 }, 'parziale': { level: 'A2', rank: 622 }, 'generale': { level: 'A2', rank: 623 },
  'particolare': { level: 'A2', rank: 624 }, 'specifico': { level: 'A2', rank: 625 }, 'preciso': { level: 'A2', rank: 626 },
  'esatto': { level: 'A2', rank: 627 }, 'corretto': { level: 'A2', rank: 628 }, 'accurato': { level: 'A2', rank: 629 },
  'dettagliato': { level: 'A2', rank: 630 }, 'comprendere': { level: 'A2', rank: 631 }, 'compreso': { level: 'A2', rank: 632 },
  'incluso': { level: 'A2', rank: 633 }, 'escluso': { level: 'A2', rank: 634 }, 'eccetto': { level: 'A2', rank: 635 },
  'tranne': { level: 'A2', rank: 636 }, 'salvo': { level: 'A2', rank: 637 }, 'oltre': { level: 'A2', rank: 638 },
  'circa': { level: 'A2', rank: 639 }, 'quasi': { level: 'A2', rank: 640 }, 'appena': { level: 'A2', rank: 641 },
  'approssimativamente': { level: 'A2', rank: 642 }, 'pressappoco': { level: 'A2', rank: 643 }, 'all\'incirca': { level: 'A2', rank: 644 },
  'completamente': { level: 'A2', rank: 645 }, 'totalmente': { level: 'A2', rank: 646 }, 'interamente': { level: 'A2', rank: 647 },
  'pienamente': { level: 'A2', rank: 648 }, 'assolutamente': { level: 'A2', rank: 649 }, 'certamente': { level: 'A2', rank: 650 },
  'sicuramente': { level: 'A2', rank: 651 }, 'probabilmente': { level: 'A2', rank: 652 }, 'forse': { level: 'A2', rank: 653 },
  'magari': { level: 'A2', rank: 654 }, 'eventualmente': { level: 'A2', rank: 655 }, 'possibilmente': { level: 'A2', rank: 656 },
  'necessariamente': { level: 'A2', rank: 657 }, 'obbligatoriamente': { level: 'A2', rank: 658 }, 'volentieri': { level: 'A2', rank: 659 },
  'purtroppo': { level: 'A2', rank: 660 }, 'fortunatamente': { level: 'A2', rank: 661 }, 'sfortunatamente': { level: 'A2', rank: 662 },
  'ovviamente': { level: 'A2', rank: 663 }, 'evidentemente': { level: 'A2', rank: 664 }, 'chiaramente': { level: 'A2', rank: 665 },
  'decisamente': { level: 'A2', rank: 666 }, 'indubbiamente': { level: 'A2', rank: 667 }, 'naturalmente': { level: 'A2', rank: 668 },
  'logicamente': { level: 'A2', rank: 669 }, 'ragionevolmente': { level: 'A2', rank: 670 }, 'praticamente': { level: 'A2', rank: 671 },
  'teoricamente': { level: 'A2', rank: 672 }, 'realmente': { level: 'A2', rank: 673 }, 'effettivamente': { level: 'A2', rank: 674 },
  'veramente': { level: 'A2', rank: 675 }, 'davvero': { level: 'A2', rank: 676 }, 'appunto': { level: 'A2', rank: 677 },
  'esattamente': { level: 'A2', rank: 678 }, 'precisamente': { level: 'A2', rank: 679 }, 'specialmente': { level: 'A2', rank: 680 },
  'particolarmente': { level: 'A2', rank: 681 }, 'soprattutto': { level: 'A2', rank: 682 }, 'principalmente': { level: 'A2', rank: 683 },
  'essenzialmente': { level: 'A2', rank: 684 }, 'fondamentalmente': { level: 'A2', rank: 685 }, 'sostanzialmente': { level: 'A2', rank: 686 },
  'generalmente': { level: 'A2', rank: 687 }, 'normalmente': { level: 'A2', rank: 688 }, 'abitualmente': { level: 'A2', rank: 689 },
  'solitamente': { level: 'A2', rank: 690 }, 'usualmente': { level: 'A2', rank: 691 }, 'regolarmente': { level: 'A2', rank: 692 },
  'frequentemente': { level: 'A2', rank: 693 }, 'spesso': { level: 'A2', rank: 694 }, 'raramente': { level: 'A2', rank: 695 },
  'occasionalmente': { level: 'A2', rank: 696 }, 'talvolta': { level: 'A2', rank: 697 }, 'qualche volta': { level: 'A2', rank: 698 },
  'a volte': { level: 'A2', rank: 699 }, 'ogni tanto': { level: 'A2', rank: 700 },
  
  // Continue A2 (701-1500) - adding more common words
  'recentemente': { level: 'A2', rank: 701 }, 'ultimamente': { level: 'A2', rank: 702 }, 'attualmente': { level: 'A2', rank: 703 },
  'precedentemente': { level: 'A2', rank: 704 }, 'successivamente': { level: 'A2', rank: 705 }, 'contemporaneamente': { level: 'A2', rank: 706 },
  'simultaneamente': { level: 'A2', rank: 707 }, 'immediatamente': { level: 'A2', rank: 708 }, 'subito': { level: 'A2', rank: 709 },
  'presto': { level: 'A2', rank: 710 }, 'tardi': { level: 'A2', rank: 711 }, 'prima': { level: 'A2', rank: 712 },
  'dopo': { level: 'A2', rank: 713 }, 'durante': { level: 'A2', rank: 714 }, 'mentre': { level: 'A2', rank: 715 },
  'intanto': { level: 'A2', rank: 716 }, 'frattempo': { level: 'A2', rank: 717 }, 'infine': { level: 'A2', rank: 718 },
  'finalmente': { level: 'A2', rank: 719 }, 'alla fine': { level: 'A2', rank: 720 }, 'all\'inizio': { level: 'A2', rank: 721 },
  'inizialmente': { level: 'A2', rank: 722 }, 'originariamente': { level: 'A2', rank: 723 }, 'originale': { level: 'A2', rank: 724 },
  'originario': { level: 'A2', rank: 725 }, 'nativo': { level: 'A2', rank: 726 }, 'straniero': { level: 'A2', rank: 727 },
  'estero': { level: 'A2', rank: 728 }, 'internazionale': { level: 'A2', rank: 729 }, 'nazionale': { level: 'A2', rank: 730 },
  'locale': { level: 'A2', rank: 731 }, 'regionale': { level: 'A2', rank: 732 }, 'provinciale': { level: 'A2', rank: 733 },
  'comunale': { level: 'A2', rank: 734 }, 'statale': { level: 'A2', rank: 735 }, 'federale': { level: 'A2', rank: 736 },
  'pubblico': { level: 'A2', rank: 737 }, 'privato': { level: 'A2', rank: 738 }, 'personale': { level: 'A2', rank: 739 },
  'individuale': { level: 'A2', rank: 740 }, 'collettivo': { level: 'A2', rank: 741 }, 'comune': { level: 'A2', rank: 742 },
  'condiviso': { level: 'A2', rank: 743 }, 'separato': { level: 'A2', rank: 744 }, 'diviso': { level: 'A2', rank: 745 },
  'unito': { level: 'A2', rank: 746 }, 'assieme': { level: 'A2', rank: 747 }, 'soltanto': { level: 'A2', rank: 748 },
  'solamente': { level: 'A2', rank: 749 }, 'esclusivamente': { level: 'A2', rank: 750 },
  
  // B1 level - ranks 1501-3500
  'nondimeno': { level: 'B1', rank: 1501 }, 'peraltro': { level: 'B1', rank: 1502 }, 'conseguentemente': { level: 'B1', rank: 1503 },
  'pertanto': { level: 'B1', rank: 1504 }, 'ciononostante': { level: 'B1', rank: 1505 }, 'allorché': { level: 'B1', rank: 1506 },
  'ove': { level: 'B1', rank: 1507 }, 'laddove': { level: 'B1', rank: 1508 }, 'giacché': { level: 'B1', rank: 1509 },
  'poiché': { level: 'B1', rank: 1510 }, 'siccome': { level: 'B1', rank: 1511 }, 'dato che': { level: 'B1', rank: 1512 },
  'visto che': { level: 'B1', rank: 1513 }, 'considerato che': { level: 'B1', rank: 1514 }, 'ammesso che': { level: 'B1', rank: 1515 },
  'supposto che': { level: 'B1', rank: 1516 }, 'a condizione che': { level: 'B1', rank: 1517 }, 'a patto che': { level: 'B1', rank: 1518 },
  'a patto': { level: 'B1', rank: 1519 }, 'qualunque': { level: 'B1', rank: 1520 }, 'chiunque': { level: 'B1', rank: 1521 },
  'dovunque': { level: 'B1', rank: 1522 }, 'ovunque': { level: 'B1', rank: 1523 }, 'comechessia': { level: 'B1', rank: 1524 },
  'amministrazione': { level: 'B1', rank: 1525 }, 'organizzazione': { level: 'B1', rank: 1526 }, 'istituzione': { level: 'B1', rank: 1527 },
  'azienda': { level: 'B1', rank: 1528 }, 'impresa': { level: 'B1', rank: 1529 }, 'compagnia': { level: 'B1', rank: 1530 },
  'ditta': { level: 'B1', rank: 1531 }, 'ente': { level: 'B1', rank: 1532 }, 'associazione': { level: 'B1', rank: 1533 },
  'fondazione': { level: 'B1', rank: 1534 }, 'cooperativa': { level: 'B1', rank: 1535 }, 'sindacato': { level: 'B1', rank: 1536 },
  'partito': { level: 'B1', rank: 1537 }, 'movimento': { level: 'B1', rank: 1538 }, 'corrente': { level: 'B1', rank: 1539 },
  'tendenza': { level: 'B1', rank: 1540 }, 'orientamento': { level: 'B1', rank: 1541 }, 'approccio': { level: 'B1', rank: 1542 },
  'direzione': { level: 'B1', rank: 1543 }, 'gestione': { level: 'B1', rank: 1544 }, 'conduzione': { level: 'B1', rank: 1545 },
  'coordinamento': { level: 'B1', rank: 1546 }, 'supervisione': { level: 'B1', rank: 1547 }, 'sorveglianza': { level: 'B1', rank: 1548 },
  'verifica': { level: 'B1', rank: 1549 }, 'ispezione': { level: 'B1', rank: 1550 }, 'revisione': { level: 'B1', rank: 1551 },
  'valutazione': { level: 'B1', rank: 1552 }, 'giudizio': { level: 'B1', rank: 1553 }, 'opinione': { level: 'B1', rank: 1554 },
  'parere': { level: 'B1', rank: 1555 }, 'punto di vista': { level: 'B1', rank: 1556 }, 'prospettiva': { level: 'B1', rank: 1557 },
  'visione': { level: 'B1', rank: 1558 }, 'concezione': { level: 'B1', rank: 1559 }, 'interpretazione': { level: 'B1', rank: 1560 },
  'spiegazione': { level: 'B1', rank: 1561 }, 'chiarimento': { level: 'B1', rank: 1562 }, 'delucidazione': { level: 'B1', rank: 1563 },
  'illustrazione': { level: 'B1', rank: 1564 }, 'dimostrazione': { level: 'B1', rank: 1565 }, 'prova': { level: 'B1', rank: 1566 },
  'evidenza': { level: 'B1', rank: 1567 }, 'testimonianza': { level: 'B1', rank: 1568 }, 'conferma': { level: 'B1', rank: 1569 },
  'certificazione': { level: 'B1', rank: 1570 }, 'convalida': { level: 'B1', rank: 1571 }, 'ratifica': { level: 'B1', rank: 1572 },
  'approvazione': { level: 'B1', rank: 1573 }, 'consenso': { level: 'B1', rank: 1574 }, 'accordo': { level: 'B1', rank: 1575 },
  'intesa': { level: 'B1', rank: 1576 }, 'patto': { level: 'B1', rank: 1577 }, 'trattato': { level: 'B1', rank: 1578 },
  'convenzione': { level: 'B1', rank: 1579 }, 'contratto': { level: 'B1', rank: 1580 }, 'comprensione': { level: 'B1', rank: 1581 },
  'incomprensione': { level: 'B1', rank: 1582 }, 'malinteso': { level: 'B1', rank: 1583 }, 'equivoco': { level: 'B1', rank: 1584 },
  'fraintendimento': { level: 'B1', rank: 1585 }, 'confusione': { level: 'B1', rank: 1586 }, 'disordine': { level: 'B1', rank: 1587 },
  'caos': { level: 'B1', rank: 1588 }, 'complessità': { level: 'B1', rank: 1589 }, 'complicazione': { level: 'B1', rank: 1590 },
  'difficoltà': { level: 'B1', rank: 1591 }, 'ostacolo': { level: 'B1', rank: 1592 }, 'impedimento': { level: 'B1', rank: 1593 },
  'barriera': { level: 'B1', rank: 1594 }, 'soglia': { level: 'B1', rank: 1595 }, 'restrizione': { level: 'B1', rank: 1596 },
  'vincolo': { level: 'B1', rank: 1597 }, 'costrizione': { level: 'B1', rank: 1598 }, 'obbligo': { level: 'B1', rank: 1599 },
  'onere': { level: 'B1', rank: 1600 }, 'responsabilità': { level: 'B1', rank: 1601 }, 'impegno': { level: 'B1', rank: 1602 },
  'incarico': { level: 'B1', rank: 1603 }, 'mansione': { level: 'B1', rank: 1604 }, 'funzione': { level: 'B1', rank: 1605 },
  'ruolo': { level: 'B1', rank: 1606 }, 'carica': { level: 'B1', rank: 1607 }, 'collocazione': { level: 'B1', rank: 1608 },
  'grado': { level: 'B1', rank: 1609 }, 'livello': { level: 'B1', rank: 1610 }, 'piano': { level: 'B1', rank: 1611 },
  'strato': { level: 'B1', rank: 1612 }, 'fase': { level: 'B1', rank: 1613 }, 'stadio': { level: 'B1', rank: 1614 },
  'tappa': { level: 'B1', rank: 1615 }, 'periodo': { level: 'B1', rank: 1616 }, 'epoca': { level: 'B1', rank: 1617 },
  'era': { level: 'B1', rank: 1618 }, 'ciclo': { level: 'B1', rank: 1619 }, 'generazione': { level: 'B1', rank: 1620 },
  
  // B2 level - ranks 3501-5000
  'acquisizione': { level: 'B2', rank: 3501 }, 'elaborazione': { level: 'B2', rank: 3502 }, 'implementazione': { level: 'B2', rank: 3503 },
  'configurazione': { level: 'B2', rank: 3504 }, 'ottimizzazione': { level: 'B2', rank: 3505 }, 'razionalizzazione': { level: 'B2', rank: 3506 },
  'semplificazione': { level: 'B2', rank: 3507 }, 'articolazione': { level: 'B2', rank: 3508 }, 'sofisticazione': { level: 'B2', rank: 3509 },
  'raffinatezza': { level: 'B2', rank: 3510 }, 'eleganza': { level: 'B2', rank: 3511 }, 'precisione': { level: 'B2', rank: 3512 },
  'accuratezza': { level: 'B2', rank: 3513 }, 'meticolosità': { level: 'B2', rank: 3514 }, 'scrupolosità': { level: 'B2', rank: 3515 },
  'diligenza': { level: 'B2', rank: 3516 }, 'dedizione': { level: 'B2', rank: 3517 }, 'applicazione': { level: 'B2', rank: 3518 },
  'coinvolgimento': { level: 'B2', rank: 3519 }, 'partecipazione': { level: 'B2', rank: 3520 }, 'contributo': { level: 'B2', rank: 3521 },
  'apporto': { level: 'B2', rank: 3522 }, 'collaborazione': { level: 'B2', rank: 3523 }, 'cooperazione': { level: 'B2', rank: 3524 },
  'sinergia': { level: 'B2', rank: 3525 }, 'integrazione': { level: 'B2', rank: 3526 }, 'fusione': { level: 'B2', rank: 3527 },
  'unificazione': { level: 'B2', rank: 3528 }, 'consolidamento': { level: 'B2', rank: 3529 }, 'rafforzamento': { level: 'B2', rank: 3530 },
  'potenziamento': { level: 'B2', rank: 3531 }, 'intensificazione': { level: 'B2', rank: 3532 }, 'amplificazione': { level: 'B2', rank: 3533 },
  'espansione': { level: 'B2', rank: 3534 }, 'estensione': { level: 'B2', rank: 3535 }, 'allargamento': { level: 'B2', rank: 3536 },
  'dilatazione': { level: 'B2', rank: 3537 }, 'ingrandimento': { level: 'B2', rank: 3538 }, 'riduzione': { level: 'B2', rank: 3539 },
  'contrazione': { level: 'B2', rank: 3540 }, 'restringimento': { level: 'B2', rank: 3541 }, 'diminuzione': { level: 'B2', rank: 3542 },
  'decremento': { level: 'B2', rank: 3543 }, 'decrescita': { level: 'B2', rank: 3544 }, 'declino': { level: 'B2', rank: 3545 },
  'deterioramento': { level: 'B2', rank: 3546 }, 'degrado': { level: 'B2', rank: 3547 }, 'peggioramento': { level: 'B2', rank: 3548 },
  'miglioramento': { level: 'B2', rank: 3549 }, 'perfezionamento': { level: 'B2', rank: 3550 },
  
  // C1 level - ranks 5001-7000
  'indiscutibilmente': { level: 'C1', rank: 5001 }, 'inequivocabilmente': { level: 'C1', rank: 5002 }, 'incontrovertibilmente': { level: 'C1', rank: 5003 },
  'inoppugnabilmente': { level: 'C1', rank: 5004 }, 'irrefutabilmente': { level: 'C1', rank: 5005 }, 'inconfutabilmente': { level: 'C1', rank: 5006 },
  'categoricamente': { level: 'C1', rank: 5007 }, 'perentoriamente': { level: 'C1', rank: 5008 }, 'tassativamente': { level: 'C1', rank: 5009 },
  'rigorosamente': { level: 'C1', rank: 5010 }, 'scrupolosamente': { level: 'C1', rank: 5011 }, 'meticolosamente': { level: 'C1', rank: 5012 },
  'minuziosamente': { level: 'C1', rank: 5013 }, 'dettagliatamente': { level: 'C1', rank: 5014 }, 'circostanziatamente': { level: 'C1', rank: 5015 },
  'approfonditamente': { level: 'C1', rank: 5016 }, 'esaustivamente': { level: 'C1', rank: 5017 }, 'esauriente': { level: 'C1', rank: 5018 },
  'onnicomprensivo': { level: 'C1', rank: 5019 }, 'enciclopedico': { level: 'C1', rank: 5020 },
  
  // C2 level - ranks 7001+
  'perspicace': { level: 'C2', rank: 7001 }, 'sagace': { level: 'C2', rank: 7002 }, 'arguto': { level: 'C2', rank: 7003 },
  'acuto': { level: 'C2', rank: 7004 }, 'penetrante': { level: 'C2', rank: 7005 }, 'incisivo': { level: 'C2', rank: 7006 },
  'tagliente': { level: 'C2', rank: 7007 }, 'caustico': { level: 'C2', rank: 7008 }, 'mordace': { level: 'C2', rank: 7009 },
  'sarcastico': { level: 'C2', rank: 7010 }, 'ironico': { level: 'C2', rank: 7011 }, 'satirico': { level: 'C2', rank: 7012 },
  'parodistico': { level: 'C2', rank: 7013 }, 'caricaturale': { level: 'C2', rank: 7014 }, 'grottesco': { level: 'C2', rank: 7015 },
  'surreale': { level: 'C2', rank: 7016 }, 'onirico': { level: 'C2', rank: 7017 }, 'fantasmagorico': { level: 'C2', rank: 7018 },
  'caleidoscopico': { level: 'C2', rank: 7019 }, 'poliedrico': { level: 'C2', rank: 7020 },
};

/**
 * Normalize Italian word for matching (lowercase, remove accents)
 */
function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .trim();
}

/**
 * Extract words from Italian text
 */
function extractWords(text: string): string[] {
  // Remove punctuation but keep apostrophes (e.g., "l'italiano")
  const cleaned = text.replace(/[^\p{L}\s']/gu, ' ');
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  return words.map(normalizeWord);
}

/**
 * Get word difficulty level
 */
function getWordDifficulty(word: string): { level: ProficiencyLevel; rank: number } | null {
  const normalized = normalizeWord(word);
  return ITALIAN_WORD_FREQUENCY[normalized] || null;
}

/**
 * Analyze text for comprehensibility with hybrid frequency-based scoring
 */
export async function analyzeComprehensibility(
  userId: string,
  text: string
): Promise<{
  comprehensibilityScore: number; // 0.0 to 1.0 (target: 0.80-0.85)
  knownWords: number;
  newWords: number;
  totalWords: number;
  newWordList: string[];
  knownWordList: string[];
}> {
  const db = await getDatabase();
  const words = extractWords(text);
  const totalWords = words.length;

  if (totalWords === 0) {
    return {
      comprehensibilityScore: 1.0,
      knownWords: 0,
      newWords: 0,
      totalWords: 0,
      newWordList: [],
      knownWordList: [],
    };
  }

  // Get user's known vocabulary and vocabulary size
  const knownVocab = await db
    .select()
    .from(vocabulary)
    .where(and(eq(vocabulary.user_id, userId), eq(vocabulary.is_known, true)));

  const knownWordSet = new Set(knownVocab.map(v => v.word));
  const vocabularySize = knownWordSet.size;
  
  const newWordList: string[] = [];
  const knownWordList: string[] = [];
  let frequentWordsScore = 0; // For frequency-based scoring

  // Categorize words and calculate frequency-based scores
  for (const word of words) {
    if (knownWordSet.has(word)) {
      knownWordList.push(word);
    } else {
      newWordList.push(word);
    }
    
    // Calculate frequency-based comprehensibility (for cold start)
    const wordInfo = getWordDifficulty(word);
    if (wordInfo) {
      if (wordInfo.rank <= 1000) {
        // Top 1000 words - very common, treat as fully comprehensible
        frequentWordsScore += 1.0;
      } else if (wordInfo.rank <= 3000) {
        // 1000-3000 - somewhat common, partially comprehensible
        frequentWordsScore += 0.5;
      } else if (wordInfo.rank <= 5000) {
        // 3000-5000 - less common, slightly comprehensible
        frequentWordsScore += 0.25;
      }
      // Words beyond 5000 rank or not in dictionary = 0 score
    }
  }

  const knownWords = knownWordList.length;
  const newWords = newWordList.length;
  
  // Calculate scores
  const knownWordScore = knownWords / totalWords;
  const frequencyScore = frequentWordsScore / totalWords;
  
  // Hybrid scoring: use frequency-based for new users, transition to known-word tracking
  let comprehensibilityScore: number;
  
  if (vocabularySize < 100) {
    // New user: heavily rely on frequency-based scoring
    // Use the maximum of known-word score and 85% of frequency score
    // This ensures new users don't see 0% comprehensibility
    comprehensibilityScore = Math.max(knownWordScore, frequencyScore * 0.85);
  } else if (vocabularySize < 500) {
    // Transition phase: blend both approaches
    // Gradually shift weight from frequency to known words
    const transitionWeight = vocabularySize / 500; // 0.2 to 1.0
    comprehensibilityScore = (knownWordScore * transitionWeight) + (frequencyScore * 0.85 * (1 - transitionWeight));
  } else {
    // Established user: use known-word tracking primarily
    // But still use frequency as a floor to handle edge cases
    comprehensibilityScore = Math.max(knownWordScore, frequencyScore * 0.5);
  }

  return {
    comprehensibilityScore,
    knownWords,
    newWords,
    totalWords,
    newWordList: [...new Set(newWordList)], // Remove duplicates
    knownWordList: [...new Set(knownWordList)],
  };
}

/**
 * Track vocabulary from conversation
 * Optimized to reduce N+1 queries by batching database operations
 */
export async function trackVocabulary(
  userId: string,
  words: string[],
  understood: boolean = true
): Promise<void> {
  if (words.length === 0) {
    return;
  }

  const db = await getDatabase();
  const uniqueWords = [...new Set(words)]; // Remove duplicates

  // Fetch all existing words in one query
  const existingWords = await db
    .select()
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.user_id, userId),
        inArray(vocabulary.word, uniqueWords)
      )
    );

  // Create a map for quick lookup
  const existingWordMap = new Map(existingWords.map(w => [w.word, w]));

  // Prepare batch operations
  const wordsToUpdate: typeof existingWords = [];
  const wordsToInsert: Array<{
    id: string;
    user_id: string;
    word: string;
    word_original: string;
    frequency_rank: number;
    difficulty_level: string;
    times_encountered: number;
    times_understood: number;
    is_known: boolean;
    last_encountered: Date;
  }> = [];

  const now = new Date();

  for (const word of uniqueWords) {
    const normalized = word;
    const wordInfo = getWordDifficulty(word);
    const existing = existingWordMap.get(normalized);

    if (existing) {
      wordsToUpdate.push(existing);
    } else {
      // Create new entry
      wordsToInsert.push({
        id: `${userId}-${normalized}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        user_id: userId,
        word: normalized,
        word_original: word,
        frequency_rank: wordInfo?.rank || 99999,
        difficulty_level: wordInfo?.level || 'C2',
        times_encountered: 1,
        times_understood: understood ? 1 : 0,
        is_known: false,
        last_encountered: now,
      });
    }
  }

  // Batch update existing words using a single transaction
  if (wordsToUpdate.length > 0) {
    // Use Promise.all to update all words in parallel (still better than sequential)
    await Promise.all(
      wordsToUpdate.map(existingWord => {
        const updateData: any = {
          times_encountered: sql`${vocabulary.times_encountered} + 1`,
          last_encountered: now,
        };

        if (understood) {
          updateData.times_understood = sql`${vocabulary.times_understood} + 1`;
        }

        return db
          .update(vocabulary)
          .set(updateData)
          .where(eq(vocabulary.id, existingWord.id));
      })
    );
  }

  // Batch insert new words
  if (wordsToInsert.length > 0) {
    await db.insert(vocabulary).values(wordsToInsert);
  }
}

/**
 * Auto-learn vocabulary based on repeated successful encounters
 * Automatically marks words as known when:
 * - Encountered 3+ times with 70%+ understanding rate
 * - Word is in top 100 most common Italian words (bootstrap)
 */
export async function autoLearnVocabulary(userId: string): Promise<number> {
  const db = await getDatabase();
  
  // Find candidate words for auto-learning
  const candidates = await db
    .select()
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_known, false),
        sql`${vocabulary.times_encountered} >= 3`
      )
    );
  
  let learnedCount = 0;
  
  for (const word of candidates) {
    const understandingRate = word.times_understood / word.times_encountered;
    const wordInfo = getWordDifficulty(word.word);
    
    let shouldLearn = false;
    
    // Criterion 1: Good understanding rate (70%+)
    if (understandingRate >= 0.7) {
      shouldLearn = true;
    }
    
    // Criterion 2: Top 100 most common words (bootstrap knowledge)
    if (wordInfo && wordInfo.rank <= 100) {
      shouldLearn = true;
    }
    
    // Criterion 3: Encountered many times with decent understanding
    if (word.times_encountered >= 5 && understandingRate >= 0.6) {
      shouldLearn = true;
    }
    
    if (shouldLearn) {
      await db
        .update(vocabulary)
        .set({ is_known: true })
        .where(eq(vocabulary.id, word.id));
      
      learnedCount++;
    }
  }
  
  // If any words were learned, update user proficiency
  if (learnedCount > 0) {
    await updateUserProficiency(userId);
  }
  
  return learnedCount;
}

/**
 * Get or create user proficiency
 */
export async function getUserProficiency(userId: string) {
  const db = await getDatabase();

  const existing = await db
    .select()
    .from(userProficiency)
    .where(eq(userProficiency.id, userId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create default proficiency
  const newProficiency = {
    id: userId,
    level: 'A1' as ProficiencyLevel,
    vocabulary_size: 0,
    comprehension_score: 0.0,
  };

  try {
    await db.insert(userProficiency).values(newProficiency);
  } catch (error) {
    // Ignore foreign key errors for demo user
    console.log('Note: User proficiency created for demo user');
  }
  return { ...newProficiency, created_at: new Date(), updated_at: new Date() };
}

/**
 * Update user proficiency based on vocabulary
 */
export async function updateUserProficiency(userId: string): Promise<void> {
  const db = await getDatabase();

  // Count known vocabulary
  const vocabCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(and(eq(vocabulary.user_id, userId), eq(vocabulary.is_known, true)));

  const vocabularySize = Number(vocabCount[0]?.count || 0);

  // Determine level based on vocabulary size (simplified)
  let level: ProficiencyLevel = 'A1';
  if (vocabularySize >= 5000) level = 'C2';
  else if (vocabularySize >= 4000) level = 'C1';
  else if (vocabularySize >= 3000) level = 'B2';
  else if (vocabularySize >= 2000) level = 'B1';
  else if (vocabularySize >= 1000) level = 'A2';

  // Calculate average comprehension from recent conversations
  const recentConversations = await db
    .select()
    .from(conversations)
    .where(eq(conversations.user_id, userId))
    .orderBy(sql`${conversations.created_at} DESC`)
    .limit(10);

  const avgComprehension =
    recentConversations.length > 0
      ? recentConversations.reduce((sum, c) => sum + (c.comprehensibility_score || 0), 0) /
        recentConversations.length
      : 0.0;

  await db
    .update(userProficiency)
    .set({
      level,
      vocabulary_size: vocabularySize,
      comprehension_score: avgComprehension,
      updated_at: new Date(),
    })
    .where(eq(userProficiency.id, userId));
}

/**
 * Infer user's proficiency level from their Italian message
 * Analyzes vocabulary sophistication, message length, and complexity
 */
export function inferUserLevelFromMessage(text: string): { 
  level: ProficiencyLevel; 
  confidence: number;
  vocabularyScore: number;
} {
  const words = extractWords(text);
  const totalWords = words.length;
  
  // Default to A1 for very short messages or empty text
  if (totalWords < 5) {
    return { level: 'A1', confidence: 0.3, vocabularyScore: 0 };
  }
  
  let vocabularyScore = 0;
  let totalRankScore = 0;
  let wordsWithKnownRank = 0;
  
  // Analyze vocabulary sophistication
  for (const word of words) {
    const wordInfo = getWordDifficulty(word);
    if (wordInfo) {
      wordsWithKnownRank++;
      
      // Score based on word frequency rank
      if (wordInfo.rank <= 500) {
        vocabularyScore += 1; // A1 level words
      } else if (wordInfo.rank <= 1500) {
        vocabularyScore += 2; // A2 level words
      } else if (wordInfo.rank <= 3500) {
        vocabularyScore += 3; // B1 level words
      } else if (wordInfo.rank <= 5000) {
        vocabularyScore += 4; // B2 level words
      } else if (wordInfo.rank <= 7000) {
        vocabularyScore += 5; // C1 level words
      } else {
        vocabularyScore += 6; // C2 level words
      }
      
      totalRankScore += wordInfo.rank;
    }
  }
  
  // Calculate average vocabulary sophistication
  const avgVocabScore = wordsWithKnownRank > 0 ? vocabularyScore / wordsWithKnownRank : 1;
  const avgWordRank = wordsWithKnownRank > 0 ? totalRankScore / wordsWithKnownRank : 1000;
  
  // Determine level based on vocabulary sophistication
  let level: ProficiencyLevel = 'A1';
  let confidence = 0.5;
  
  if (avgVocabScore >= 5 || avgWordRank > 6000) {
    level = 'C2';
    confidence = 0.7;
  } else if (avgVocabScore >= 4 || avgWordRank > 4500) {
    level = 'C1';
    confidence = 0.75;
  } else if (avgVocabScore >= 3.5 || avgWordRank > 3000) {
    level = 'B2';
    confidence = 0.8;
  } else if (avgVocabScore >= 2.5 || avgWordRank > 1500) {
    level = 'B1';
    confidence = 0.8;
  } else if (avgVocabScore >= 1.8 || avgWordRank > 700) {
    level = 'A2';
    confidence = 0.75;
  } else {
    level = 'A1';
    confidence = 0.7;
  }
  
  // Adjust confidence based on message length
  if (totalWords >= 20) {
    confidence += 0.2;
  } else if (totalWords >= 10) {
    confidence += 0.1;
  }
  
  // Adjust confidence based on coverage (how many words we recognized)
  const coverage = wordsWithKnownRank / totalWords;
  confidence *= (0.5 + coverage * 0.5); // Reduce confidence if many unknown words
  
  // Cap confidence at 0.95
  confidence = Math.min(confidence, 0.95);
  
  return { level, confidence, vocabularyScore: avgVocabScore };
}

/**
 * Bootstrap user's known vocabulary based on inferred proficiency level
 * Seeds common words appropriate for their level as "known"
 */
export async function bootstrapVocabularyForLevel(
  userId: string, 
  level: ProficiencyLevel
): Promise<number> {
  const db = await getDatabase();
  
  // Determine which words to bootstrap based on level
  let maxRank = 0;
  switch (level) {
    case 'A1':
      maxRank = 200; // Bootstrap top 200 most common words
      break;
    case 'A2':
      maxRank = 500; // Bootstrap top 500 words
      break;
    case 'B1':
      maxRank = 1000; // Bootstrap top 1000 words
      break;
    case 'B2':
      maxRank = 1500; // Bootstrap top 1500 words
      break;
    case 'C1':
      maxRank = 3000; // Bootstrap top 3000 words
      break;
    case 'C2':
      maxRank = 5000; // Bootstrap top 5000 words
      break;
  }
  
  // Get words to bootstrap from our frequency dictionary
  const wordsToBootstrap: string[] = [];
  for (const [word, info] of Object.entries(ITALIAN_WORD_FREQUENCY)) {
    if (info.rank <= maxRank) {
      wordsToBootstrap.push(word);
    }
  }
  let bootstrappedCount = 0;
  
  // Fetch all existing words in one query (FIX: eliminate N+1 pattern)
  const existingWords = await db
    .select()
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.user_id, userId),
        inArray(vocabulary.word, wordsToBootstrap)
      )
    );
  
  const existingWordMap = new Map(existingWords.map(w => [w.word, w]));
  
  const wordsToUpdate: string[] = [];
  const wordsToInsert: Array<{
    id: string;
    user_id: string;
    word: string;
    word_original: string;
    frequency_rank: number;
    difficulty_level: string;
    times_encountered: number;
    times_understood: number;
    is_known: boolean;
    last_encountered: Date;
  }> = [];
  
  const now = new Date();
  
  // Prepare batch operations
  for (const word of wordsToBootstrap) {
    const wordInfo = getWordDifficulty(word);
    const existing = existingWordMap.get(word);
    
    if (existing && !existing.is_known) {
      wordsToUpdate.push(existing.id);
      bootstrappedCount++;
    } else if (!existing) {
      wordsToInsert.push({
        id: `${userId}-${word}-bootstrap-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        user_id: userId,
        word: word,
        word_original: word,
        frequency_rank: wordInfo?.rank || 99999,
        difficulty_level: wordInfo?.level || level,
        times_encountered: 1,
        times_understood: 1,
        is_known: true,
        last_encountered: now,
      });
      bootstrappedCount++;
    }
  }
  
  // Batch update existing words
  if (wordsToUpdate.length > 0) {
    await db
      .update(vocabulary)
      .set({ is_known: true })
      .where(inArray(vocabulary.id, wordsToUpdate));
  }
  
  // Batch insert new words
  if (wordsToInsert.length > 0) {
    await db.insert(vocabulary).values(wordsToInsert);
  }
  
  // Update user proficiency after bootstrapping
  if (bootstrappedCount > 0) {
    await updateUserProficiency(userId);
  }
  
  console.log(`Bootstrapped ${bootstrappedCount} words for user ${userId} at level ${level}`);
  return bootstrappedCount;
}

/**
 * Adjust text complexity to maintain i+1 ratio
 * This is a simplified version - in production, use AI/LLM to rewrite content
 */
export function shouldAdjustComplexity(
  currentComprehensibility: number,
  targetComprehensibility: number = 0.825
): 'simplify' | 'maintain' | 'increase' {
  const tolerance = 0.05; // 5% tolerance

  if (currentComprehensibility < targetComprehensibility - tolerance) {
    return 'simplify'; // Too difficult, simplify
  } else if (currentComprehensibility > targetComprehensibility + tolerance) {
    return 'increase'; // Too easy, make more complex
  } else {
    return 'maintain'; // Within target range
  }
}

/**
 * Save conversation message
 */
export async function saveConversation(
  userId: string,
  messageType: 'user' | 'assistant',
  content: string,
  analysis?: {
    comprehensibilityScore: number;
    newWords: string[];
    knownWords: string[];
    totalWords: number;
  },
  sessionId?: string
): Promise<string> {
  const db = await getDatabase();
  const conversationId = `${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  await db.insert(conversations).values({
    id: conversationId,
    user_id: userId,
    session_id: sessionId,
    message_type: messageType,
    content,
    comprehensibility_score: analysis?.comprehensibilityScore,
    target_comprehensibility: 0.825, // 82.5% target
    new_words_count: analysis?.newWords.length || 0,
    known_words_count: analysis?.knownWords.length || 0,
    total_words_count: analysis?.totalWords || 0,
    new_words: analysis?.newWords || [],
    metadata: {},
  });

  return conversationId;
}

/**
 * Mastery level labels for vocabulary reinforcement
 */
export type MasteryLevel = 'learning' | 'practicing' | 'reinforcing' | 'mastered';

/**
 * Word with mastery information for reinforcement
 */
export interface WordForReinforcement {
  word: string;
  wordOriginal: string;
  translation: string | null;
  exampleSentence: string | null;
  masteryLevel: MasteryLevel;
  timePeriod: '0-7days' | '7-30days' | '30+days';
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  lastEncountered: Date;
}

/**
 * Track word reinforcement in AI responses
 * Detects when recently learned words appear in the AI's response and updates tracking
 */
export async function trackWordReinforcement(
  userId: string,
  responseText: string,
  recentWords: WordForReinforcement[]
): Promise<string[]> {
  if (recentWords.length === 0) {
    return [];
  }

  const db = await getDatabase();
  const responseWords = extractWords(responseText);
  const reinforcedWords: string[] = [];
  const wordsToReinforce: string[] = [];
  const originalWords: string[] = [];

  // Check which recent words appear in the response
  for (const recentWord of recentWords) {
    const normalizedWord = recentWord.word;
    
    if (responseWords.includes(normalizedWord)) {
      wordsToReinforce.push(normalizedWord);
      originalWords.push(recentWord.wordOriginal);
    }
  }

  // Batch update all reinforced words in parallel (FIX: eliminate N+1 pattern)
  if (wordsToReinforce.length > 0) {
    try {
      const now = new Date();
      await Promise.all(
        wordsToReinforce.map(normalizedWord =>
          db
            .update(vocabulary)
            .set({
              times_encountered: sql`${vocabulary.times_encountered} + 1`,
              last_encountered: now,
            })
            .where(
              and(
                eq(vocabulary.user_id, userId),
                eq(vocabulary.word, normalizedWord)
              )
            )
        )
      );
      
      reinforcedWords.push(...originalWords);
      console.log(`Reinforced ${reinforcedWords.length} words: ${originalWords.join(', ')}`);
    } catch (error) {
      console.error(`Error tracking reinforcement:`, error);
    }
  }

  return reinforcedWords;
}

/**
 * Get recently learned words grouped by time period for organic reinforcement
 * Only includes flashcard words that are not yet fully mastered
 */
export async function getRecentlyLearnedWords(
  userId: string,
  limit: number = 20
): Promise<{
  last7Days: WordForReinforcement[];
  last30Days: WordForReinforcement[];
  older: WordForReinforcement[];
}> {
  const db = await getDatabase();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    // Query flashcard words that are not fully mastered
    // Mastered criteria: ease_factor >= 2.5 AND repetitions >= 5 AND interval_days >= 21
    const words = await db
      .select()
      .from(vocabulary)
      .where(
        and(
          eq(vocabulary.user_id, userId),
          eq(vocabulary.is_flashcard, true),
          eq(vocabulary.is_known, false), // Not marked as fully known
          sql`NOT (${vocabulary.ease_factor} >= 2.5 AND ${vocabulary.repetitions} >= 5 AND ${vocabulary.interval_days} >= 21)`
        )
      )
      .orderBy(desc(vocabulary.last_encountered))
      .limit(limit * 3); // Get more than we need, then filter by time periods

    // Categorize words by time period and mastery level
    const last7Days: WordForReinforcement[] = [];
    const last30Days: WordForReinforcement[] = [];
    const older: WordForReinforcement[] = [];

    for (const word of words) {
      // Determine mastery level
      const reps = word.repetitions || 0;
      let masteryLevel: MasteryLevel;
      
      if (reps <= 2) {
        masteryLevel = 'learning';
      } else if (reps <= 4) {
        masteryLevel = 'practicing';
      } else {
        masteryLevel = 'reinforcing';
      }

      // Determine time period
      const lastEncountered = new Date(word.last_encountered);
      let timePeriod: '0-7days' | '7-30days' | '30+days';
      let targetArray: WordForReinforcement[];

      if (lastEncountered >= sevenDaysAgo) {
        timePeriod = '0-7days';
        targetArray = last7Days;
      } else if (lastEncountered >= thirtyDaysAgo) {
        timePeriod = '7-30days';
        targetArray = last30Days;
      } else {
        timePeriod = '30+days';
        targetArray = older;
      }

      // Only include if we have translation or example
      if (word.translation || word.example_sentence) {
        targetArray.push({
          word: word.word,
          wordOriginal: word.word_original,
          translation: word.translation,
          exampleSentence: word.example_sentence,
          masteryLevel,
          timePeriod,
          repetitions: reps,
          easeFactor: word.ease_factor || 2.5,
          intervalDays: word.interval_days || 0,
          lastEncountered,
        });
      }
    }

    // Limit each group
    const maxPerGroup = Math.ceil(limit / 2); // More flexible distribution
    return {
      last7Days: last7Days.slice(0, maxPerGroup),
      last30Days: last30Days.slice(0, maxPerGroup),
      older: older.slice(0, Math.floor(limit / 3)),
    };
  } catch (error) {
    console.error('Error fetching recently learned words:', error);
    return {
      last7Days: [],
      last30Days: [],
      older: [],
    };
  }
}

/**
 * Get known words for a user (words marked as is_known = true)
 * Used for generating personalized exercises with familiar vocabulary
 */
export async function getKnownWords(
  userId: string,
  limit: number = 100
): Promise<Array<{
  word: string;
  word_original: string;
  difficulty_level: string | null;
  frequency_rank: number | null;
}>> {
  const db = await getDatabase();
  
  try {
    const knownWords = await db
      .select({
        word: vocabulary.word,
        word_original: vocabulary.word_original,
        difficulty_level: vocabulary.difficulty_level,
        frequency_rank: vocabulary.frequency_rank,
      })
      .from(vocabulary)
      .where(
        and(
          eq(vocabulary.user_id, userId),
          eq(vocabulary.is_known, true)
        )
      )
      .orderBy(vocabulary.last_encountered)
      .limit(limit);
    
    return knownWords;
  } catch (error) {
    console.error('Error fetching known words:', error);
    return [];
  }
}

/**
 * Get all messages for a specific session
 */
export async function getConversationsBySession(
  sessionId: string
): Promise<Array<{
  id: string;
  message_type: 'user' | 'assistant';
  content: string;
  comprehensibility_score?: number;
  new_words_count?: number;
  known_words_count?: number;
  total_words_count?: number;
  new_words?: string[];
  created_at: Date;
}>> {
  try {
    const db = await getDatabase();
    
    const messages = await db
      .select()
      .from(conversations)
      .where(eq(conversations.session_id, sessionId))
      .orderBy(conversations.created_at);
    
    return messages.map(msg => ({
      id: msg.id,
      message_type: msg.message_type as 'user' | 'assistant',
      content: msg.content,
      comprehensibility_score: msg.comprehensibility_score || undefined,
      new_words_count: msg.new_words_count || undefined,
      known_words_count: msg.known_words_count || undefined,
      total_words_count: msg.total_words_count || undefined,
      new_words: (msg.new_words as string[]) || undefined,
      created_at: msg.created_at,
    }));
  } catch (error) {
    console.error('Error fetching conversations by session:', error);
    return [];
  }
}

/**
 * Get recent sessions with metadata
 * Returns last 5 sessions with preview information
 */
export async function getRecentSessions(
  userId: string,
  limit: number = 5
): Promise<Array<{
  sessionId: string;
  messageCount: number;
  firstMessage: string;
  lastMessageTime: Date;
  startTime: Date;
  endTime?: Date;
}>> {
  try {
    const db = await getDatabase();
    const { learningSessions } = await import('../schema/comprehensible-input');
    
    // Get recent sessions with their conversation counts
    const sessions = await db
      .select({
        id: learningSessions.id,
        start_time: learningSessions.start_time,
        end_time: learningSessions.end_time,
        is_active: learningSessions.is_active,
      })
      .from(learningSessions)
      .where(
        and(
          eq(learningSessions.user_id, userId),
          eq(learningSessions.page_context, 'comprehensible-input')
        )
      )
      .orderBy(desc(learningSessions.start_time))
      .limit(limit);
    
    // Get message info for each session
    const sessionsWithData = await Promise.all(
      sessions.map(async (session) => {
        const messages = await db
          .select({
            content: conversations.content,
            message_type: conversations.message_type,
            created_at: conversations.created_at,
          })
          .from(conversations)
          .where(eq(conversations.session_id, session.id))
          .orderBy(conversations.created_at);
        
        // Find first user message for preview
        const firstUserMessage = messages.find(m => m.message_type === 'user');
        const lastMessage = messages[messages.length - 1];
        
        return {
          sessionId: session.id,
          messageCount: messages.length,
          firstMessage: firstUserMessage?.content || messages[0]?.content || 'Empty session',
          lastMessageTime: lastMessage?.created_at || session.start_time,
          startTime: session.start_time,
          endTime: session.end_time || undefined,
        };
      })
    );
    
    // Filter out sessions with no messages
    return sessionsWithData.filter(s => s.messageCount > 0);
  } catch (error) {
    console.error('Error fetching recent sessions:', error);
    return [];
  }
}

/**
 * Delete old sessions beyond the most recent N
 * This permanently removes sessions and their messages
 */
export async function deleteOldSessions(
  userId: string,
  keepRecentCount: number = 5
): Promise<number> {
  try {
    const db = await getDatabase();
    const { learningSessions } = await import('../schema/comprehensible-input');
    
    // Get all sessions for this user, ordered by start time
    const allSessions = await db
      .select({ id: learningSessions.id })
      .from(learningSessions)
      .where(
        and(
          eq(learningSessions.user_id, userId),
          eq(learningSessions.page_context, 'comprehensible-input')
        )
      )
      .orderBy(desc(learningSessions.start_time));
    
    // If we have more than the limit, delete the old ones
    if (allSessions.length <= keepRecentCount) {
      return 0; // Nothing to delete
    }
    
    const sessionsToKeep = allSessions.slice(0, keepRecentCount);
    const sessionsToDelete = allSessions.slice(keepRecentCount);
    
    if (sessionsToDelete.length === 0) {
      return 0;
    }
    
    const sessionIdsToDelete = sessionsToDelete.map(s => s.id);
    
    // Delete the old sessions (CASCADE will handle conversations)
    await db
      .delete(learningSessions)
      .where(
        and(
          eq(learningSessions.user_id, userId),
          inArray(learningSessions.id, sessionIdsToDelete)
        )
      );
    
    console.log(`Deleted ${sessionsToDelete.length} old sessions for user ${userId}`);
    return sessionsToDelete.length;
  } catch (error) {
    console.error('Error deleting old sessions:', error);
    return 0;
  }
}

