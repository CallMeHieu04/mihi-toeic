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

function pickBestUSPhonetic(phoneticsList) {
  if (!phoneticsList || phoneticsList.length === 0) return '';
  // 1. If any entry is directly associated with US audio (-us, /us/, en-us)
  for (const p of phoneticsList) {
    const audio = (p.audio || '').toLowerCase();
    const text = (p.text || '').trim();
    if (text && (audio.includes('-us') || audio.includes('/us/') || audio.includes('en-us') || audio.includes('us.'))) {
      return text;
    }
  }
  // 2. Check for American IPA markers: ɝ, ɚ, ɹ, ɾ, oʊ, æ
  for (const p of phoneticsList) {
    const text = (p.text || '').trim();
    if (text && (text.includes('ɝ') || text.includes('ɚ') || text.includes('ɹ') || text.includes('ɾ') || text.includes('oʊ'))) {
      return text;
    }
  }
  // 3. Prefer one that does not have British non-rhotic long vowels without r (like ɜː or ɒ)
  for (const p of phoneticsList) {
    const text = (p.text || '').trim();
    if (text && !text.includes('ɜː') && !text.includes('ɒ')) {
      return text;
    }
  }
  return (phoneticsList.find(p => (p.text || '').trim()) || {}).text || '';
}

// Universal English - Vietnamese Dictionary Lookup (Strictly American / US Pronunciation)
async function searchUniversalDictionary(queryWord) {
  let phonetic = '';
  let audioUrl = '';
  let example = '';

  // 1. Fetch phonetic, audio & example from DictionaryAPI (Prioritizing US English)
  try {
    const dRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(queryWord)}`);
    if (dRes.ok) {
      const dJson = await dRes.json();
      if (Array.isArray(dJson)) {
        const allPhonetics = [];
        for (const item of dJson) {
          if (Array.isArray(item.phonetics)) {
            for (const p of item.phonetics) {
              allPhonetics.push(p);
              const audio = (p.audio || '').trim();
              const isUS = audio && (audio.includes('-us') || audio.includes('/us/') || audio.includes('en-us') || audio.includes('US.'));
              if (isUS && !audioUrl) {
                audioUrl = audio;
              }
            }
          }
          if (Array.isArray(item.meanings)) {
            for (const m of item.meanings) {
              if (Array.isArray(m.definitions)) {
                for (const def of m.definitions) {
                  if (!example && def.example) example = def.example;
                }
              }
            }
          }
        }

        // Extract US phonetic IPA
        phonetic = pickBestUSPhonetic(allPhonetics);
        if (!phonetic && dJson[0] && dJson[0].phonetic) {
          phonetic = dJson[0].phonetic;
        }
      }
    }
  } catch (e) {
    console.error('[DictionaryAPI Error]:', e.message);
  }

  // 2. Fetch accurate Vietnamese translation & part of speech from Google Translate
  let meaningVi = '';
  let partsOfSpeech = [];
  try {
    const tRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=bd&q=${encodeURIComponent(queryWord)}`);
    if (tRes.ok) {
      const tJson = await tRes.json();
      if (tJson && tJson[0] && tJson[0][0]) {
        meaningVi = tJson[0][0][0];
      }
      if (tJson && tJson[1] && Array.isArray(tJson[1])) {
        tJson[1].slice(0, 3).forEach(item => {
          const pos = item[0] || 'từ';
          const synonyms = Array.isArray(item[1]) ? item[1].slice(0, 5).join(', ') : '';
          partsOfSpeech.push({ pos, meanings: synonyms });
        });
      }
    }
  } catch (e) {
    console.error('[GoogleTranslate Error]:', e.message);
  }

  // If Google Translate didn't find anything and dictionaryapi didn't find anything, return null
  if (!meaningVi && !phonetic && partsOfSpeech.length === 0) {
    return null;
  }

  // Strictly American English (US) Audio Pronunciation
  // If no native American audio was found (e.g. DictionaryAPI only had British -uk.mp3), fallback to Google US TTS
  if (!audioUrl) {
    audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-US&q=${encodeURIComponent(queryWord)}`;
  }

  return {
    word: queryWord,
    phonetic,
    meaningVi: meaningVi || queryWord,
    partsOfSpeech,
    example,
    audioUrl,
    isToeic: false
  };
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

  // 2. Exact match on singular/plural in TOEIC vocabulary
  const singular = clean.endsWith('s') ? clean.slice(0, -1) : clean;
  if (toeicWordMap.has(singular)) {
    return toeicWordMap.get(singular);
  }

  // 3. Universal Dictionary search (Vietnamese translation + IPA + audio for ANY word like "school", "friend"...)
  const universal = await searchUniversalDictionary(clean);
  if (universal) {
    return universal;
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
