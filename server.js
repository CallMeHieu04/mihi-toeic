const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// TOEIC Score Conversion Table (standard ETS mapping)
function calculateToeicScore(listeningCorrect, readingCorrect) {
  // Approximate standard conversion curve for 100 questions each
  const lMap = [
    5, 5, 5, 5, 5, 5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, // 0-19
    75, 80, 85, 90, 95, 100, 110, 115, 120, 125, 130, 135, 140, 145, 150, 160, 165, 170, 175, 180, // 20-39
    185, 190, 195, 200, 210, 215, 220, 230, 240, 245, 250, 255, 260, 270, 275, 280, 290, 295, 300, 310, // 40-59
    315, 320, 325, 330, 335, 340, 350, 355, 360, 365, 370, 380, 385, 390, 395, 400, 405, 410, 420, 425, // 60-79
    430, 440, 445, 450, 460, 465, 470, 475, 480, 485, 490, 495, 495, 495, 495, 495, 495, 495, 495, 495, 495 // 80-100
  ];

  const rMap = [
    5, 5, 5, 5, 5, 5, 5, 5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, // 0-19
    65, 70, 75, 80, 85, 90, 95, 100, 110, 115, 120, 125, 130, 135, 140, 145, 150, 160, 165, 170, // 20-39
    175, 180, 185, 190, 195, 200, 210, 215, 220, 225, 230, 235, 240, 250, 255, 260, 265, 270, 280, 285, // 40-59
    290, 295, 300, 305, 310, 320, 325, 330, 335, 340, 350, 355, 360, 365, 370, 375, 380, 385, 390, 395, // 60-79
    400, 405, 410, 415, 420, 425, 430, 435, 445, 450, 455, 465, 470, 480, 485, 490, 495, 495, 495, 495, 495 // 80-100
  ];

  const lIdx = Math.max(0, Math.min(100, Math.round(listeningCorrect)));
  const rIdx = Math.max(0, Math.min(100, Math.round(readingCorrect)));
  const lScore = lMap[lIdx];
  const rScore = rMap[rIdx];
  return {
    listeningScore: lScore,
    readingScore: rScore,
    totalScore: lScore + rScore
  };
}

function cleanChoiceContent(rawContent) {
  if (!rawContent) return { letter: '', text: '' };
  const s = String(rawContent).trim();
  const m = s.match(/^\(?([A-Da-d])\)?[\.\:\s\-]*(.*)$/);
  if (m) {
    return {
      letter: m[1].toUpperCase(),
      text: m[2].trim()
    };
  }
  return { letter: '', text: s };
}

// Transform raw card to clean question (V2: 100% Accurate choices & answers)
function parseCard(card, questionNum) {
  const qData = card.question || {};
  const ansData = card.answer || {};
  const rawChoices = card.choices || [];

  const parsedChoices = [];
  let correctLetter = 'A';

  if (Array.isArray(rawChoices) && rawChoices.length > 0) {
    for (let i = 0; i < rawChoices.length; i++) {
      const rc = rawChoices[i];
      const defaultLetter = String.fromCharCode(65 + i);
      const content = rc.content || '';
      const { letter, text } = cleanChoiceContent(content);
      const finalLetter = letter || defaultLetter;
      const isCorrect = !!rc.isCorrect;

      if (isCorrect) {
        correctLetter = finalLetter;
      }

      parsedChoices.push({
        letter: finalLetter,
        text: text,
        raw: content,
        isCorrect: isCorrect
      });
    }
  } else {
    const correctAnswers = ansData.texts || [];
    const otherChoices = ansData.choices || [];
    const all = [...correctAnswers, ...otherChoices];
    for (let i = 0; i < all.length; i++) {
      const letter = String.fromCharCode(65 + i);
      parsedChoices.push({
        letter,
        text: all[i],
        raw: all[i],
        isCorrect: i === 0
      });
    }
  }

  let soundUrl = qData.sound || '';
  let imageUrl = qData.image || '';
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = `https://storage.googleapis.com/${imageUrl}`;
  }

  const hintEn = ansData.hint || '';
  const hintVi = (ansData.mapLangHint && ansData.mapLangHint.vi) || '';

  return {
    id: card._id,
    questionNumber: questionNum,
    questionText: (qData.text || '').trim(),
    imageUrl,
    audioUrl: soundUrl,
    choices: parsedChoices,
    correctAnswer: correctLetter,
    explanationHtml: hintEn,
    explanationViHtml: hintVi,
    transcriptHtml: hintEn
  };
}

// Convert cards into clean test structure
function transformCards(cards, topicId, testTitle = '') {
  const parsedQuestions = [];
  let qCounter = 1;

  for (const c of cards) {
    const children = c.childCards || [];
    if (children.length > 0) {
      let groupSound = (c.question && c.question.sound) || '';
      let groupImage = (c.question && c.question.image) || '';
      if (groupImage && !groupImage.startsWith('http')) {
        groupImage = `https://storage.googleapis.com/${groupImage}`;
      }
      const groupPassage = (c.question && (c.question.text || c.question.article)) || '';
      const groupExplanation = (c.answer && c.answer.hint) || '';
      const groupExplanationVi = (c.answer && c.answer.mapLangHint && c.answer.mapLangHint.vi) || '';

      const subQuestions = [];
      for (const child of children) {
        const subQ = parseCard(child, qCounter);
        if (!subQ.audioUrl && groupSound) subQ.audioUrl = groupSound;
        if (!subQ.imageUrl && groupImage) subQ.imageUrl = groupImage;
        if (!subQ.explanationViHtml && groupExplanationVi) subQ.explanationViHtml = groupExplanationVi;
        subQuestions.push(subQ);
        qCounter++;
      }

      parsedQuestions.append ? null : parsedQuestions.push({
        type: 'group',
        groupId: c._id,
        audioUrl: groupSound,
        imageUrl: groupImage,
        passageHtml: groupPassage,
        transcriptHtml: groupExplanation,
        transcriptViHtml: groupExplanationVi,
        questions: subQuestions
      });
    } else {
      const q = parseCard(c, qCounter);
      parsedQuestions.push({
        type: 'single',
        question: q
      });
      qCounter++;
    }
  }

  return {
    topicId,
    title: testTitle,
    totalCards: cards.length,
    totalQuestions: qCounter - 1,
    data: parsedQuestions
  };
}

// API: Get Tests Summary
app.get('/api/tests', (req, res) => {
  const filePath = path.join(DATA_DIR, 'tests_summary.json');
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return res.json(data);
  }
  res.status(404).json({ error: 'tests_summary.json not found' });
});

// API: Get Practice Summary
app.get('/api/practice', (req, res) => {
  const filePath = path.join(DATA_DIR, 'practice_summary.json');
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return res.json(data);
  }
  res.status(404).json({ error: 'practice_summary.json not found' });
});

// API: Get specific test detail (with on-demand crawl + caching)
app.get('/api/test/:id', async (req, res) => {
  let { id } = req.params;
  let filePath = path.join(DATA_DIR, `${id}.json`);

  // If file doesn't exist directly, resolve slug/name to actual ID from summaries
  if (!fs.existsSync(filePath)) {
    try {
      const cleanId = decodeURIComponent(String(id || ''))
        .replace(/^Từ vựng:\s*/i, '')
        .replace(/^Ngữ pháp:\s*/i, '')
        .replace(/\s*\(.*?\)/g, '')
        .trim().toLowerCase();

      const practiceSummaryPath = path.join(DATA_DIR, 'practice_summary.json');
      if (fs.existsSync(practiceSummaryPath)) {
        const pSummary = JSON.parse(fs.readFileSync(practiceSummaryPath, 'utf-8'));
        for (const p of pSummary) {
          const allItems = [...(p.byTopic || []), ...(p.byPart || []), ...(p.topics || []), ...(p.subTopics || []), ...(p.tests || [])];
          const found = allItems.find(t => 
            t.id === id || 
            t.slug === id || 
            (t.name && t.name.toLowerCase() === id.toLowerCase()) ||
            (t.slug && t.slug.toLowerCase() === id.toLowerCase()) ||
            (cleanId && t.slug && t.slug.toLowerCase() === cleanId) ||
            (cleanId && t.name && t.name.toLowerCase() === cleanId) ||
            (cleanId && t.name && t.name.toLowerCase().includes(cleanId))
          );
          if (found && found.id) {
            id = found.id;
            filePath = path.join(DATA_DIR, `${id}.json`);
            break;
          }
        }
      }
    } catch (e) {
      console.error('Error resolving test/topic slug:', e);
    }
  }

  // Check local cache first
  if (fs.existsSync(filePath)) {
    try {
      let raw = fs.readFileSync(filePath, 'utf-8');
      let changed = false;
      if (raw.includes('storage.googleapis.com//')) {
        raw = raw.replaceAll('storage.googleapis.com//', 'storage.googleapis.com/');
        changed = true;
      }
      if (raw.includes('": "estudyme/')) {
        raw = raw.replaceAll('": "estudyme/', '": "https://storage.googleapis.com/estudyme/');
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(filePath, raw, 'utf-8');
      }
      const data = JSON.parse(raw);
      return res.json({ source: 'cache', ...data });
    } catch (err) {
      console.error('Error reading cached file:', err);
    }
  }

  // Not cached yet: fetch live from EstudyMe backend and cache
  try {
    console.log(`On-demand crawling test: ${id}...`);
    const resp = await fetch('https://v2.estudyme.com/api/get-card-by-topic-id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ topicId: id })
    });

    if (!resp.ok) {
      return res.status(resp.status).json({ error: `EstudyMe API returned ${resp.status}` });
    }

    const cards = await resp.json();
    if (!Array.isArray(cards)) {
      return res.status(500).json({ error: 'Invalid response from upstream API' });
    }

    const testData = transformCards(cards, id, `TOEIC Practice Test ${id.substring(0, 6)}`);

    // Cache locally
    fs.writeFileSync(filePath, JSON.stringify(testData, null, 2), 'utf-8');
    console.log(`Successfully cached ${testData.totalQuestions} questions for ${id}`);

    res.json({ source: 'live', ...testData });
  } catch (error) {
    console.error(`Error fetching test ${id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// API: Get Theory / Topic Details
app.get('/api/topic/:id', async (req, res) => {
  const { id } = req.params;

  // Check local practice_full_summary.json first
  try {
    const fullSummaryPath = path.join(DATA_DIR, 'practice_full_summary.json');
    if (fs.existsSync(fullSummaryPath)) {
      const full = JSON.parse(fs.readFileSync(fullSummaryPath, 'utf-8'));
      // Search in grammar
      const gItem = (full.grammar?.topics || []).find(t => t.id === id);
      if (gItem && gItem.description) {
        return res.json(gItem);
      }
      // Search in parts lessons
      for (const p of (full.parts || [])) {
        const lItem = (p.lessons || []).find(l => l.id === id);
        if (lItem && lItem.description) {
          return res.json(lItem);
        }
      }
    }
  } catch (localErr) {
    console.warn('Error reading local topic summary:', localErr.message);
  }

  // Fallback to upstream API
  try {
    const resp = await fetch('https://v2.estudyme.com/api/get-topic-by-id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({ topicId: id })
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Submit test results and compute standard TOEIC score
app.post('/api/submit', (req, res) => {
  const { testId, testTitle, userAnswers, totalQuestions, timeSpentSeconds, testType } = req.body;
  const filePath = path.join(DATA_DIR, `${testId}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Test data not found' });
  }

  const testData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  let listeningCorrect = 0;
  let readingCorrect = 0;

  const detailedResults = [];

  const sanitizeUrl = (u) => {
    if (!u) return '';
    let clean = String(u).trim();
    if (clean.startsWith('//')) clean = 'https:' + clean;
    if (clean.startsWith('estudyme/')) clean = 'https://storage.googleapis.com/' + clean;
    clean = clean.replace(/storage\.googleapis\.com\/+/g, 'storage.googleapis.com/');
    if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('data:')) {
      if (clean.startsWith('/')) clean = clean.substring(1);
      clean = 'https://storage.googleapis.com/' + clean;
    }
    return clean;
  };

  const checkAnswer = (q, group) => {
    const rawUserAns = (userAnswers[q.questionNumber] || '').trim().toUpperCase();
    const userMatch = rawUserAns.match(/[A-Da-d]/);
    const userAns = userMatch ? userMatch[0].toUpperCase() : '';

    let correctLetter = 'A';
    if (q.correctAnswer) {
      const match = String(q.correctAnswer).match(/[A-Da-d]/);
      if (match) correctLetter = match[0].toUpperCase();
    }
    const isCorrect = userAns && userAns === correctLetter;
    
    if (!userAns) {
      skippedCount++;
    } else if (isCorrect) {
      correctCount++;
      if (q.questionNumber <= 100) listeningCorrect++;
      else readingCorrect++;
    } else {
      wrongCount++;
    }

    detailedResults.push({
      questionNumber: q.questionNumber,
      userAnswer: userAns,
      correctAnswer: correctLetter,
      isCorrect: !!isCorrect,
      explanationHtml: q.explanationHtml || (group && group.transcriptHtml) || '',
      explanationViHtml: q.explanationViHtml || (group && group.transcriptViHtml) || '',
      transcriptHtml: q.transcriptHtml || (group && group.transcriptHtml) || '',
      transcriptViHtml: q.transcriptViHtml || (group && group.transcriptViHtml) || '',
      audioUrl: sanitizeUrl(q.audioUrl || (group && group.audioUrl) || ''),
      imageUrl: sanitizeUrl(q.imageUrl || (group && group.imageUrl) || ''),
      passageHtml: (group && group.passageHtml) || '',
      questionText: q.questionText || '',
      choices: q.choices
    });
  };

  for (const item of testData.data) {
    if (item.type === 'single') {
      checkAnswer(item.question, null);
    } else if (item.type === 'group') {
      for (const sub of item.questions) {
        checkAnswer(sub, item);
      }
    }
  }

  // Calculate official scaled score
  let scoreData;
  if (testData.totalQuestions >= 180) {
    // 200 câu chuẩn
    scoreData = calculateToeicScore(listeningCorrect, readingCorrect);
  } else if (testData.totalQuestions >= 90) {
    // Mini Test 100 câu: x2 scale
    scoreData = calculateToeicScore(listeningCorrect * 2, readingCorrect * 2);
  } else {
    // Luyện tập theo Part
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    scoreData = {
      listeningScore: listeningCorrect * 5,
      readingScore: readingCorrect * 5,
      totalScore: `${accuracy}% (${correctCount}/${totalQuestions})`
    };
  }

  let testTitleResolved = testTitle || testData.title;
  if (!testTitleResolved) {
    try {
      const summary = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'tests_summary.json'), 'utf-8'));
      const found = [...(summary.full_tests || []), ...(summary.mini_tests || [])].find(t => t.id === testId);
      if (found) testTitleResolved = found.name;
    } catch (e) {}
  }
  if (!testTitleResolved) testTitleResolved = `TOEIC Test ${testId.substring(0, 6)}`;

  const resultRecord = {
    id: Date.now().toString(),
    testId,
    testTitle: testTitleResolved,
    date: new Date().toISOString(),
    totalQuestions: testData.totalQuestions,
    correctCount,
    wrongCount,
    skippedCount,
    listeningCorrect,
    readingCorrect,
    timeSpentSeconds: timeSpentSeconds || 0,
    score: scoreData,
    detailedResults
  };

  // Save to history
  const historyPath = path.join(DATA_DIR, 'history.json');
  let history = [];
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    } catch (e) {}
  }
  history.unshift({
    id: resultRecord.id,
    type: 'test',
    testId: resultRecord.testId,
    testTitle: resultRecord.testTitle,
    title: resultRecord.testTitle,
    subtitle: `Hoàn thành ${resultRecord.correctCount}/${resultRecord.totalQuestions} câu`,
    badge: 'Bài thi',
    date: resultRecord.date,
    score: resultRecord.score.totalScore,
    accuracy: Math.round((correctCount / testData.totalQuestions) * 100),
    timeSpentSeconds: resultRecord.timeSpentSeconds
  });
  if (history.length > 300) history = history.slice(0, 300);
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');

  res.json(resultRecord);
});

// API: Save custom study activity (vocabulary, grammar, lessons)
app.post('/api/history/activity', (req, res) => {
  const { type, title, subtitle, badge, score, accuracy, details } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const activityRecord = {
    id: Date.now().toString(),
    type: type || 'activity', // 'vocabulary' | 'grammar' | 'practice' | 'test'
    title,
    subtitle: subtitle || '',
    badge: badge || (type === 'vocabulary' ? 'Từ vựng' : type === 'grammar' ? 'Ngữ pháp' : 'Hoạt động'),
    score: score !== undefined ? score : null,
    accuracy: typeof accuracy === 'number' ? accuracy : null,
    date: new Date().toISOString(),
    details: details || {}
  };

  const historyPath = path.join(DATA_DIR, 'history.json');
  let history = [];
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    } catch (e) {}
  }

  // Prevent duplicate logs if identical activity logged within last 3 minutes
  const recentDuplicate = history.find(h => 
    h.title === activityRecord.title && 
    h.type === activityRecord.type &&
    (Date.now() - new Date(h.date).getTime()) < 180000
  );

  if (!recentDuplicate) {
    history.unshift(activityRecord);
    if (history.length > 300) history = history.slice(0, 300);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
  }

  res.json({ success: true, record: activityRecord });
});

// API: Get study history
app.get('/api/history', (req, res) => {
  const historyPath = path.join(DATA_DIR, 'history.json');
  if (fs.existsSync(historyPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      return res.json(data);
    } catch (e) {}
  }
  res.json([]);
});

// API: Sync study time from client
app.post('/api/study-time/sync', (req, res) => {
  try {
    const { date, seconds, categories } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });
    const studyTimePath = path.join(DATA_DIR, 'study_time.json');
    let studyData = {};
    if (fs.existsSync(studyTimePath)) {
      try {
        studyData = JSON.parse(fs.readFileSync(studyTimePath, 'utf-8'));
      } catch (e) {}
    }
    const currentForDate = studyData[date] || {};
    studyData[date] = {
      totalSeconds: Math.max(seconds || 0, currentForDate.totalSeconds || 0),
      categories: categories || currentForDate.categories || {},
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(studyTimePath, JSON.stringify(studyData, null, 2), 'utf-8');
    res.json({ success: true, date, totalSeconds: studyData[date].totalSeconds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get streak data
app.get('/api/streak', (req, res) => {
  const streakPath = path.join(DATA_DIR, 'streak.json');
  if (fs.existsSync(streakPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(streakPath, 'utf-8'));
      return res.json(data);
    } catch (e) {}
  }
  res.json({ currentStreak: 2, bestStreak: 2, lastActiveDate: '2026-11-23', history: ['2026-11-23'] });
});

// API: Sync streak from client
app.post('/api/streak/sync', (req, res) => {
  try {
    const { currentStreak, bestStreak, totalDays, lastActiveDate, startDate, history } = req.body || {};
    const streakPath = path.join(DATA_DIR, 'streak.json');
    let data = {
      currentStreak: typeof currentStreak === 'number' ? currentStreak : 2,
      bestStreak: typeof bestStreak === 'number' ? bestStreak : 2,
      totalDays: typeof totalDays === 'number' ? totalDays : 2,
      startDate: startDate || '2026-11-22',
      lastActiveDate: lastActiveDate || new Date().toISOString().split('T')[0],
      history: Array.isArray(history) ? history : ['2026-11-23'],
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(streakPath, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, streak: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= WRONG VOCABULARY SPACED REPETITION (3 DAYS) =================
function getVnDateOffsetStr(daysOffset = 0) {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const vn = new Date(utc + (3600000 * 7) + (daysOffset * 86400000));
  const y = vn.getFullYear();
  const m = String(vn.getMonth() + 1).padStart(2, '0');
  const d = String(vn.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readWrongVocabList() {
  const filePath = path.join(DATA_DIR, 'wrong_vocab.json');
  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return [];
}

function writeWrongVocabList(list) {
  const filePath = path.join(DATA_DIR, 'wrong_vocab.json');
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
}

app.get('/api/wrong-vocab', (req, res) => {
  const list = readWrongVocabList();
  list.sort((a, b) => (a.reviewDueDate || '').localeCompare(b.reviewDueDate || ''));
  res.json({ items: list, today: getVnDateOffsetStr(0) });
});

app.post('/api/wrong-vocab/add', (req, res) => {
  try {
    const body = req.body || {};
    const incoming = Array.isArray(body.cards) ? body.cards : (body.card ? [body.card] : []);
    if (incoming.length === 0) return res.status(400).json({ error: 'No card provided' });

    const today = getVnDateOffsetStr(0);
    const dueDate = getVnDateOffsetStr(3);
    const list = readWrongVocabList();

    incoming.forEach(c => {
      if (!c || !c.word) return;
      const wordKey = String(c.word).trim().toLowerCase();
      const idx = list.findIndex(x => (x.id && c.id && x.id === c.id) || (x.word && x.word.toLowerCase() === wordKey));
      const entry = {
        id: c.id || wordKey,
        word: c.word,
        phonetic: c.phonetic || '',
        meaningVi: c.meaningVi || '',
        audioUrl: c.audioUrl || '',
        imageUrl: c.imageUrl || '',
        exampleEn: c.exampleEn || '',
        exampleVi: c.exampleVi || '',
        topicId: c.topicId || '',
        topicName: c.topicName || '',
        wrongDate: today,
        reviewDueDate: dueDate,
        notified: false,
        wrongCount: idx >= 0 ? (list[idx].wrongCount || 1) + 1 : 1
      };
      if (idx >= 0) {
        list[idx] = entry;
      } else {
        list.unshift(entry);
      }
    });

    writeWrongVocabList(list);
    res.json({ success: true, items: list, today });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/wrong-vocab/mastered', (req, res) => {
  try {
    const { id, word } = req.body || {};
    const wordKey = word ? String(word).trim().toLowerCase() : '';
    let list = readWrongVocabList();
    list = list.filter(x => {
      if (id && x.id === id) return false;
      if (wordKey && x.word && x.word.toLowerCase() === wordKey) return false;
      return true;
    });
    writeWrongVocabList(list);
    res.json({ success: true, items: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= TELEGRAM BOT NOTIFICATION APIS =================
const telegram = require('./telegram');

// Health check endpoint for external ping / keep-alive
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'MiHi TOEIC',
    time: new Date().toISOString(),
    vietnamTime: telegram.getVietnamDate().toISOString()
  });
});

// Get Telegram configuration status
app.get('/api/telegram/status', async (req, res) => {
  try {
    const config = telegram.getTelegramConfig();
    let botInfo = null;
    let botValid = false;

    if (config.botToken) {
      const v = await telegram.verifyBot(config.botToken);
      botValid = v.ok;
      botInfo = v.bot || null;
    }

    res.json({
      configured: Boolean(config.botToken && config.chatId),
      botValid,
      botInfo,
      enabled: config.enabled,
      morningEnabled: config.morningEnabled,
      morningTime: config.morningTime,
      eveningEnabled: config.eveningEnabled,
      eveningTime: config.eveningTime,
      chatIdMasked: config.chatId ? `${config.chatId.substring(0, 3)}****${config.chatId.slice(-2)}` : '',
      chatId: config.chatId,
      botTokenMasked: config.botToken ? `${config.botToken.substring(0, 6)}...${config.botToken.slice(-4)}` : ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Telegram configuration
app.post('/api/telegram/config', async (req, res) => {
  try {
    const { botToken, chatId, enabled, morningEnabled, morningTime, eveningEnabled, eveningTime } = req.body;
    
    // If new token provided, verify it
    if (botToken) {
      const v = await telegram.verifyBot(botToken);
      if (!v.ok) {
        return res.status(400).json({ error: 'Bot Token không hợp lệ: ' + (v.error || '') });
      }
    }

    const updated = telegram.saveTelegramConfig({
      ...(botToken !== undefined && { botToken: botToken.trim() }),
      ...(chatId !== undefined && { chatId: String(chatId).trim() }),
      ...(enabled !== undefined && { enabled: Boolean(enabled) }),
      ...(morningEnabled !== undefined && { morningEnabled: Boolean(morningEnabled) }),
      ...(morningTime !== undefined && { morningTime }),
      ...(eveningEnabled !== undefined && { eveningEnabled: Boolean(eveningEnabled) }),
      ...(eveningTime !== undefined && { eveningTime })
    });

    res.json({ success: true, config: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test sending a Telegram message
app.post('/api/telegram/test', async (req, res) => {
  try {
    const { botToken, chatId } = req.body || {};
    if (botToken || chatId) {
      telegram.saveTelegramConfig({
        ...(botToken && { botToken: botToken.trim() }),
        ...(chatId && { chatId: String(chatId).trim() })
      });
    }

    const testText = `🤖 <b>KẾT NỐI MIHI TOEIC THÀNH CÔNG!</b>

Xin chào Minh Hiếu! 👋
Bot thông báo MiHi TOEIC đã được liên kết thành công với tài khoản Telegram của bạn.

⏰ <b>Lịch nhắc nhở mỗi ngày:</b>
• 🌅 <b>08:00 Sáng:</b> Nhắc học 1 chủ đề từ vựng Flashcard (20-30 phút).
• 🔥 <b>20:00 Tối:</b> Cảnh báo khẩn cấp cứu chuỗi Streak (nếu hôm đó bạn chưa học).

Chúc bạn ôn luyện chăm chỉ và sớm đạt mục tiêu TOEIC 600+ nhé! 🎉`;

    let baseUrl = `${req.protocol}://${req.get('host')}`;
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = 'https://mihi-toeic.onrender.com';
    }
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '📖 Mở Web MiHi TOEIC', url: baseUrl }
        ]
      ]
    };

    const sent = await telegram.sendTelegramMessage(testText, replyMarkup, chatId);
    res.json({ success: true, message: 'Đã gửi tin nhắn thử nghiệm thành công!', result: sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Telegram Webhook receiver for interactive dictionary & bot commands
app.post('/api/telegram/webhook', async (req, res) => {
  // Always acknowledge immediately with 200 OK so Telegram doesn't retry
  res.sendStatus(200);

  try {
    const update = req.body;
    if (update && update.message) {
      await telegram.handleIncomingTelegramMessage(update.message);
    }
  } catch (err) {
    console.error('[Telegram Webhook Error]:', err.message);
  }
});

// Trigger Telegram Cron (Can be called by cron-job.org / UptimeRobot / Webhook)
app.all('/api/telegram/cron', async (req, res) => {
  try {
    const forceType = req.query.force || req.query.type || null;
    let baseUrl = `${req.protocol}://${req.get('host')}`;
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = 'https://mihi-toeic.onrender.com';
    }
    const result = await telegram.checkTelegramScheduler(baseUrl, forceType);
    res.json({ success: true, cron: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Internal Background Scheduler (runs every 60 seconds)
setInterval(() => {
  telegram.checkTelegramScheduler().catch(err => {
    console.error('[Telegram Scheduler Error]:', err.message);
  });
}, 60000);

// ================= WEB PUSH NOTIFICATION ENGINE (VAPID) =================
const pushService = require('./push');

// Get VAPID public key for browser subscription
app.get('/api/push/public-key', (req, res) => {
  res.json({ publicKey: pushService.vapidPublicKey });
});

// Register / Save browser PushSubscription
app.post('/api/push/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Subscription data required' });
  }
  pushService.saveSubscription(subscription);
  res.json({ success: true, count: pushService.getSubscriptions().length });
});

// Test Web Push notification to current browser
app.post('/api/push/test', async (req, res) => {
  try {
    const { subscription } = req.body || {};
    if (subscription && subscription.endpoint) {
      pushService.saveSubscription(subscription);
    }

    const testPayload = {
      title: '🔥 MiHi TOEIC: Thông báo trang web hoạt động!',
      body: 'Tuyệt vời! Trang web MiHi TOEIC đã được cấp quyền gửi thông báo trực tiếp đến điện thoại/máy tính của bạn ngay cả khi đóng web!',
      icon: 'https://estudyme.com/images/icon/estudyme/favicon.png',
      badge: 'https://estudyme.com/images/icon/estudyme/favicon.png',
      tag: 'mihi-test-webpush',
      data: { url: '/' }
    };

    const result = await pushService.sendPushToAll(testPayload);
    res.json({ success: true, message: 'Đã gửi thông báo Web Push thành công!', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger Web Push Cron (Called by cron-job.org / Webhook at 8am & 8pm)
app.all('/api/push/cron', async (req, res) => {
  try {
    const forceType = req.query.force || req.query.type || null;
    const result = await pushService.triggerPushScheduler(forceType);
    res.json({ success: true, pushResult: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Internal Background Scheduler for Web Push (runs every 60s if server is awake)
setInterval(() => {
  pushService.triggerPushScheduler().catch(err => {
    console.error('[WebPush Scheduler Error]:', err.message);
  });
}, 60000);

// Simple lightweight ping endpoint for keep-alive cronjobs (only 2 bytes)
app.get(['/ping', '/api/ping'], (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('OK');
});

// Catch-all for undefined /api routes (prevent returning 98KB index.html)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 TOEIC Test Pro Platform is running at: http://localhost:${PORT}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  console.log(`=======================================================`);
});
