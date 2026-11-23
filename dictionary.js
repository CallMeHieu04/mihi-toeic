const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
let toeicWordMap = null;
let toeicWordList = [];

function cleanHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&hellip;/g, '...')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function initToeicDictionary() {
  if (toeicWordMap && toeicWordList.length > 0) return toeicWordMap;

  toeicWordMap = new Map();
  toeicWordList = [];

  const summaryPath = path.join(DATA_DIR, 'practice_summary.json');
  if (!fs.existsSync(summaryPath)) return toeicWordMap;

  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    const vocab = summary.find(x => x.slug === 'vocabulary');
    if (!vocab) return toeicWordMap;

    const topics = [...(vocab.byTopic || []), ...(vocab.byPart || [])];

    topics.forEach(t => {
      const topicFile = path.join(DATA_DIR, `${t.id}.json`);
      if (fs.existsSync(topicFile)) {
        try {
          const fileData = JSON.parse(fs.readFileSync(topicFile, 'utf-8'));
          const cards = fileData.flashcards || [];

          // Also check data array if flashcards is empty
          const items = cards.length > 0 ? cards : (fileData.data || []).map(d => {
            const q = d.question || {};
            return {
              id: q.id,
              word: q.questionText,
              phonetic: q.phonetic || '',
              imageUrl: q.imageUrl || '',
              audioUrl: q.audioUrl || '',
              meaningVi: (q.choices && q.choices[0]) || '',
              meaningEn: '',
              exampleEn: q.explanationHtml || q.transcriptHtml || '',
              exampleVi: q.explanationViHtml || ''
            };
          });

          items.forEach(c => {
            const rawWord = c.word || '';
            const cleanKey = rawWord.trim().toLowerCase();
            if (cleanKey && !toeicWordMap.has(cleanKey)) {
              const entry = {
                id: c.id,
                word: rawWord.trim(),
                phonetic: cleanHtml(c.phonetic || ''),
                imageUrl: c.imageUrl || '',
                audioUrl: c.audioUrl || '',
                meaningVi: cleanHtml(c.meaningVi || ''),
                meaningEn: cleanHtml(c.meaningEn || ''),
                exampleEn: cleanHtml(c.exampleEn || c.exampleEnHtml || ''),
                exampleVi: cleanHtml(c.exampleVi || c.exampleViHtml || ''),
                topicName: t.name,
                topicId: t.id,
                isToeic: true
              };
              toeicWordMap.set(cleanKey, entry);
              toeicWordList.push(entry);
            }
          });
        } catch (e) {
          console.error(`Error loading topic ${t.id}:`, e.message);
        }
      }
    });

    console.log(`[Dictionary] Successfully indexed ${toeicWordList.length} TOEIC words.`);
  } catch (err) {
    console.error('[Dictionary] Error indexing TOEIC dictionary:', err.message);
  }

  return toeicWordMap;
}

// Fallback search using Free English Dictionary API
async function searchExternalDictionary(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const first = data[0];
    let phonetic = first.phonetic || '';
    let audioUrl = '';

    if (Array.isArray(first.phonetics)) {
      for (const p of first.phonetics) {
        if (!phonetic && p.text) phonetic = p.text;
        if (!audioUrl && p.audio) audioUrl = p.audio;
        if (phonetic && audioUrl) break;
      }
    }

    const meanings = [];
    if (Array.isArray(first.meanings)) {
      first.meanings.slice(0, 3).forEach(m => {
        const partOfSpeech = m.partOfSpeech || '';
        const def = (m.definitions && m.definitions[0]) ? m.definitions[0].definition : '';
        const ex = (m.definitions && m.definitions[0]) ? m.definitions[0].example : '';
        meanings.push({ partOfSpeech, definition: def, example: ex });
      });
    }

    return {
      word: first.word || word,
      phonetic,
      audioUrl,
      meanings,
      isToeic: false
    };
  } catch (err) {
    console.error('[Dictionary] External API error:', err.message);
    return null;
  }
}

// Master lookup function
async function lookupWord(query) {
  if (!query) return null;
  initToeicDictionary();

  // Clean query string
  let clean = String(query).trim().toLowerCase()
    .replace(/^\/(dict|tra|vocab|tudien)\s*/i, '')
    .trim();

  if (!clean) return null;

  // 1. Exact match in 600 TOEIC vocabulary
  if (toeicWordMap.has(clean)) {
    return toeicWordMap.get(clean);
  }

  // 2. Fuzzy match in TOEIC vocabulary (singular/plural or prefix)
  const singular = clean.endsWith('s') ? clean.slice(0, -1) : clean;
  if (toeicWordMap.has(singular)) {
    return toeicWordMap.get(singular);
  }

  for (const [key, entry] of toeicWordMap.entries()) {
    if (key.startsWith(clean) || clean.startsWith(key)) {
      return entry;
    }
  }

  // 3. Query external English dictionary API as fallback
  const ext = await searchExternalDictionary(clean);
  if (ext) {
    return ext;
  }

  return null;
}

function getRandomToeicWord() {
  initToeicDictionary();
  if (toeicWordList.length === 0) return null;
  const idx = Math.floor(Math.random() * toeicWordList.length);
  return toeicWordList[idx];
}

module.exports = {
  initToeicDictionary,
  lookupWord,
  getRandomToeicWord
};
