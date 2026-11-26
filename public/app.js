/**
 * TOEIC Test Pro 2026 - Modern Application Logic (V2 Accurate Engine)
 */

// Global State
let testsSummary = { full_tests: [], mini_tests: [] };
let practiceSummary = [];
let currentTest = null;
let flatQuestions = []; // Array of { question, group }
let testClusters = []; // Array of clusters (single or group)
let activeClusterIndex = 0;
let activeQuestionIndex = 0;
let userAnswers = {}; // { [questionNumber]: 'A' | 'B' | 'C' | 'D' }
let flaggedQuestions = new Set();
let isPracticeMode = false;
let isSimulationMode = false;
let activeSimulationPart = 1;
let isSimulationPaused = false;
let examTimer = null;
let timeRemaining = 7200;
let totalDurationSeconds = 7200;
let timeSpentSeconds = 0;
let lastResult = null;
let currentReviewFilter = 'all';
let passageFontSize = 14;

const TOEIC_PARTS_INFO = [
  { 
    part: 1, 
    name: 'Part 1: Photographs', 
    shortName: 'Part 1', 
    startQ: 1, 
    endQ: 6, 
    totalQ: 6, 
    directions: 'Directions: For each question in this part, you will hear four statements about a picture on your screen. When you hear the statements, you must select the one statement that best describes what you see in the picture. Then, click on the letter of the answer you want to choose. The statements will not be shown on your screen and will be spoken only once.' 
  },
  { 
    part: 2, 
    name: 'Part 2: Question - Response', 
    shortName: 'Part 2', 
    startQ: 7, 
    endQ: 31, 
    totalQ: 25, 
    directions: 'Directions: You will hear a question or statement and three responses spoken in English. They will not be spoken again and will not appear on your test screen. You must listen carefully and select the best response to the question or statement by choosing (A), (B), or (C).' 
  },
  { 
    part: 3, 
    name: 'Part 3: Conversations', 
    shortName: 'Part 3', 
    startQ: 32, 
    endQ: 70, 
    totalQ: 39, 
    directions: 'Directions: You will hear some conversations between two or more people. You will be asked to answer three questions about what the speakers say in each conversation. Select the best response to each question and mark the letter (A), (B), (C), or (D). The conversations will not be printed on your screen and will be spoken only once.' 
  },
  { 
    part: 4, 
    name: 'Part 4: Short Talks', 
    shortName: 'Part 4', 
    startQ: 71, 
    endQ: 100, 
    totalQ: 30, 
    directions: 'Directions: You will hear some talks given by a single speaker. You will be asked to answer three questions about what the speaker says in each talk. Select the best response to each question and mark the letter (A), (B), (C), or (D). The talks will not be printed on your screen and will be spoken only once.' 
  },
  { 
    part: 5, 
    name: 'Part 5: Incomplete Sentences', 
    shortName: 'Part 5', 
    startQ: 101, 
    endQ: 130, 
    totalQ: 30, 
    directions: 'Directions: A word or phrase is missing in each of the following sentences. Four answer choices are given below each sentence. Select the best answer to complete the sentence by choosing (A), (B), (C), or (D).' 
  },
  { 
    part: 6, 
    name: 'Part 6: Text Completion', 
    shortName: 'Part 6', 
    startQ: 131, 
    endQ: 146, 
    totalQ: 16, 
    directions: 'Directions: Read the texts that follow. A word, phrase, or sentence is missing in parts of each text. Four answer choices for each question are given below the text. Select the best answer to complete the text by choosing (A), (B), (C), or (D).' 
  },
  { 
    part: 7, 
    name: 'Part 7: Reading Comprehension', 
    shortName: 'Part 7', 
    startQ: 147, 
    endQ: 200, 
    totalQ: 54, 
    directions: 'Directions: In this part you will read a selection of texts, such as notices, letters, forms, and newspaper and magazine articles. Each text or set of texts is followed by several questions. Select the best answer for each question and mark the letter (A), (B), (C), or (D).' 
  }
];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  initThemeMode();
  initAuth();
  initStreak();
  initDailyReminders();
  initStudyTimeTracker();
  loadWrongVocab();
  await loadInitialData();
  setupKeyboardShortcuts();
});

// Load summary metadata from API
async function loadInitialData() {
  try {
    const [testsResp, practiceResp] = await Promise.all([
      fetch('/api/tests'),
      fetch('/api/practice')
    ]);

    if (testsResp.ok) {
      testsSummary = await testsResp.json();
      renderFullTestsGrid();
      renderSimulationGrid();
      renderMiniTestsGrid();
    }

    if (practiceResp.ok) {
      practiceSummary = await practiceResp.json();
      renderPracticeGrid();
      renderGrammarGrid();
      renderVocabularyGrid();
    }
  } catch (err) {
    console.error('Failed to load initial data:', err);
  }
}

// ================= VIEW SWITCHER =================
function showView(viewName) {
  document.querySelectorAll('.view-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.remove('hidden');

  // Hide Main Site Header & Footer in Focus Modes (Flashcard & Exam)
  const mainHeader = document.querySelector('header');
  const mainFooter = document.querySelector('footer');
  if (viewName === 'flashcard' || viewName === 'exam') {
    if (mainHeader) mainHeader.classList.add('hidden');
    if (mainFooter) mainFooter.classList.add('hidden');
  } else {
    if (mainHeader) mainHeader.classList.remove('hidden');
    if (mainFooter) mainFooter.classList.remove('hidden');
  }

  if (viewName !== 'exam' && examTimer) {
    clearInterval(examTimer);
    examTimer = null;
  }

  if (viewName === 'home' && typeof loadWrongVocab === 'function') {
    loadWrongVocab();
  }

  const matchingNav = Array.from(document.querySelectorAll('.nav-btn')).find(b => 
    b.getAttribute('onclick')?.includes(viewName)
  );
  if (matchingNav) matchingNav.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();

  if (viewName === 'history') {
    loadStudyHistory();
  }
  if (viewName === 'dashboard') {
    renderDashboardView();
  }
  updateStreakUI();
}

// Switch Category Tabs in Home View
function switchTab(tabId, scrollToSection = false) {
  showView('home');

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

  const btn = document.getElementById(`tab-btn-${tabId}`);
  const content = document.getElementById(`tab-${tabId}`);
  if (btn) btn.classList.add('active');
  if (content) content.classList.remove('hidden');

  if (window.lucide) lucide.createIcons();

  if ((scrollToSection || tabId === 'vocabulary') && content) {
    setTimeout(() => {
      const rect = content.getBoundingClientRect();
      const targetTop = window.pageYOffset + rect.top - 85;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    }, 50);
  }
}

// ================= RENDER HOMEPAGE GRIDS =================

function renderSimulationGrid() {
  const container = document.getElementById('simulation-grid');
  const countBadge = document.getElementById('simulation-count');
  if (!container) return;

  const tests = testsSummary.full_tests || [];
  if (countBadge) countBadge.textContent = `${tests.length} đề thi mô phỏng`;

  container.innerHTML = tests.map((t, idx) => `
    <div class="bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl border border-slate-200 transition-all flex flex-col justify-between group">
      <div>
        <div class="flex items-center justify-between mb-3">
          <span class="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-50 text-[#5648ee]">
            Mô phỏng máy tính
          </span>
          <span class="text-xs font-bold text-slate-400">#${String(idx + 1).padStart(2, '0')}</span>
        </div>
        <h3 class="text-xl font-extrabold text-slate-900 group-hover:text-[#5648ee] transition mb-3">
          ${t.name}
        </h3>
        <p class="text-xs text-slate-500 mb-4 leading-relaxed">
          Đầy đủ 7 Part (200 câu hỏi), thời gian 120 phút. Trải nghiệm giao diện thi thật trên máy tính chuẩn ETS TOEIC.
        </p>
        <div class="flex items-center gap-4 text-xs font-bold text-slate-500 mb-6">
          <span class="flex items-center gap-1.5"><i data-lucide="help-circle" class="w-4 h-4 text-slate-400"></i> ${t.questionsNum || 200} câu</span>
          <span class="flex items-center gap-1.5"><i data-lucide="clock" class="w-4 h-4 text-slate-400"></i> ${t.duration || 120} phút</span>
          <span class="flex items-center gap-1.5"><i data-lucide="monitor" class="w-4 h-4 text-[#5648ee]"></i> Thi máy</span>
        </div>
      </div>
      <div class="pt-4 border-t border-slate-100">
        <button onclick="startSimulationTest('${t.id}', '${t.name.trim()}')" class="w-full py-3 px-4 rounded-xl bg-[#5648ee] hover:bg-[#4335df] text-white font-extrabold text-xs shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-2 cursor-pointer">
          <i data-lucide="play" class="w-4 h-4 fill-current"></i> Bắt đầu thi mô phỏng
        </button>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

async function startSimulationTest(testId, testTitle) {
  isSimulationMode = true;
  activeSimulationPart = 1;
  isSimulationPaused = false;
  await startTest(testId, testTitle, false, true);
}

function renderFullTestsGrid() {
  const container = document.getElementById('fulltest-grid');
  const countBadge = document.getElementById('fulltest-count');
  if (!container) return;

  const tests = testsSummary.full_tests || [];
  if (countBadge) countBadge.textContent = `${tests.length} đề thi`;

  container.innerHTML = tests.map((t, idx) => `
    <div class="bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl border border-slate-200 transition-all flex flex-col justify-between group">
      <div>
        <div class="flex items-center justify-between mb-3">
          <span class="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-[#5648ee]">
            Full Test
          </span>
          <span class="text-xs font-bold text-slate-400">#${String(idx + 1).padStart(2, '0')}</span>
        </div>
        <h3 class="text-xl font-extrabold text-slate-900 group-hover:text-[#5648ee] transition mb-3">
          ${t.name}
        </h3>
        <div class="flex items-center gap-4 text-xs font-bold text-slate-500 mb-6">
          <span class="flex items-center gap-1.5"><i data-lucide="help-circle" class="w-4 h-4 text-slate-400"></i> ${t.questionsNum || 200} câu</span>
          <span class="flex items-center gap-1.5"><i data-lucide="clock" class="w-4 h-4 text-slate-400"></i> ${t.duration || 120} phút</span>
          <span class="flex items-center gap-1.5"><i data-lucide="headphones" class="w-4 h-4 text-slate-400"></i> LC & RC</span>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
        <button onclick="startTest('${t.id}', '${t.name}', false)" class="py-2.5 px-4 rounded-xl bg-[#5648ee] hover:bg-[#4335df] text-white font-extrabold text-xs shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-1.5">
          <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i> Thi thử
        </button>
        <button onclick="startTest('${t.id}', '${t.name}', true)" class="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition flex items-center justify-center gap-1.5">
          <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Luyện tập
        </button>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function renderMiniTestsGrid() {
  const container = document.getElementById('minitest-grid');
  const countBadge = document.getElementById('minitest-count');
  if (!container) return;

  const tests = testsSummary.mini_tests || [];
  if (countBadge) countBadge.textContent = `${tests.length} đề thi`;

  container.innerHTML = tests.map((t, idx) => `
    <div class="bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl border border-slate-200 transition-all flex flex-col justify-between group">
      <div>
        <div class="flex items-center justify-between mb-3">
          <span class="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-orange-50 text-orange-700">
            Mini Test
          </span>
          <span class="text-xs font-bold text-slate-400">#${String(idx + 1).padStart(2, '0')}</span>
        </div>
        <h3 class="text-xl font-extrabold text-slate-900 group-hover:text-orange-600 transition mb-3">
          ${t.name}
        </h3>
        <div class="flex items-center gap-4 text-xs font-bold text-slate-500 mb-6">
          <span class="flex items-center gap-1.5"><i data-lucide="help-circle" class="w-4 h-4 text-slate-400"></i> ${t.questionsNum || 100} câu</span>
          <span class="flex items-center gap-1.5"><i data-lucide="clock" class="w-4 h-4 text-slate-400"></i> ${t.duration || 60} phút</span>
          <span class="flex items-center gap-1.5"><i data-lucide="zap" class="w-4 h-4 text-orange-500"></i> Nhanh</span>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
        <button onclick="startTest('${t.id}', '${t.name}', false)" class="py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 transition flex items-center justify-center gap-1.5">
          <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i> Thi thử
        </button>
        <button onclick="startTest('${t.id}', '${t.name}', true)" class="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition flex items-center justify-center gap-1.5">
          <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Luyện tập
        </button>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function renderPracticeGrid() {
  const container = document.getElementById('practice-grid');
  if (!container) return;

  const parts = (practiceSummary || []).filter(p => p.slug && p.slug.startsWith('part-'));

  container.innerHTML = parts.map(p => {
    const testsCount = p.testsCount || (p.tests && p.tests.length) || (p.subTopics && p.subTopics.length) || 25;
    const lessonsCount = p.lessonsCount || (p.lessons && p.lessons.length) || 4;

    return `
      <div class="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-xl transition-all flex flex-col justify-between group">
        <div>
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-[#5648ee] flex items-center justify-center font-black text-base shadow-xs group-hover:bg-[#5648ee] group-hover:text-white transition">
              ${p.partNumber ? `P${p.partNumber}` : (p.slug.split('-')[1]?.toUpperCase() || 'P')}
            </div>
            <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
              ${p.badge || 'TOEIC'}
            </span>
          </div>
          <h3 class="text-xl font-black text-slate-900 mb-2 group-hover:text-[#5648ee] transition">${p.name}</h3>
          <p class="text-xs text-slate-500 leading-relaxed mb-5 line-clamp-2">${p.description}</p>
          <div class="flex items-center gap-2 text-xs font-bold text-slate-600 mb-5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span class="flex items-center gap-1 text-[#5648ee]"><i data-lucide="award" class="w-3.5 h-3.5"></i> ${testsCount} đề</span> • 
            <span class="flex items-center gap-1 text-emerald-600"><i data-lucide="book-open" class="w-3.5 h-3.5"></i> ${lessonsCount} bài lý thuyết</span>
          </div>
        </div>
        <button onclick="openPracticeSubtopicsModal('${p.slug}')" class="w-full py-3 rounded-2xl bg-indigo-50 hover:bg-[#5648ee] hover:text-white text-[#5648ee] font-extrabold text-xs transition flex items-center justify-center gap-2 shadow-xs">
          Vào luyện tập phần này <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function renderGrammarGrid() {
  const container = document.getElementById('grammar-grid');
  if (!container) return;

  const grammar = (practiceSummary || []).find(p => p.slug === 'grammar');
  const topics = grammar ? (grammar.topics || grammar.subTopics || []) : [];

  container.innerHTML = topics.map((g, idx) => {
    const testCount = (g.tests && g.tests.length) || g.practiceCount || 4;
    const qCount = g.totalQuestions || (testCount * 20);

    return `
      <div class="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-xl hover:border-emerald-300 transition-all flex flex-col justify-between group">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">Chuyên đề ${idx + 1}</span>
            <span class="text-xs font-bold text-slate-400">Ngữ pháp TOEIC</span>
          </div>
          <h4 class="font-extrabold text-lg text-slate-900 group-hover:text-emerald-700 transition mb-2">${g.name}</h4>
          <p class="text-xs text-slate-500 line-clamp-2">Lý thuyết, quy tắc trọng tâm, cấu trúc câu và các bẫy thường gặp.</p>
          
          <div class="flex items-center gap-2 text-xs font-bold text-slate-600 my-4 bg-emerald-50/70 p-2.5 rounded-2xl border border-emerald-100">
            <span class="flex items-center gap-1 text-emerald-700"><i data-lucide="award" class="w-3.5 h-3.5"></i> ${testCount} bài tập</span> • 
            <span class="flex items-center gap-1 text-slate-600"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> ${qCount} câu hỏi</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2 pt-4 border-t border-slate-100">
          <button onclick="openLessonReader('${g.id}', '${g.name.replace(/'/g, "\\'")}')" class="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs transition flex items-center justify-center gap-1">
            <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Lý thuyết
          </button>
          <button onclick="openGrammarTopicModal('${g.id}')" class="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition flex items-center justify-center gap-1 shadow-xs">
            <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Luyện tập
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function renderVocabularyGrid() {
  const container = document.getElementById('vocabulary-grid');
  if (!container) return;

  const vocabData = (practiceSummary || []).find(p => p.slug === 'vocabulary');
  const byTopic = (vocabData && vocabData.byTopic) || [];
  const byPart = (vocabData && vocabData.byPart) || [];

  container.innerHTML = `
    <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 col-span-full">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
        <div>
          <h3 class="text-2xl font-black text-slate-900">Kho Từ Vựng TOEIC Ăn Điểm 2026</h3>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">Đầy đủ 48 chủ đề kinh doanh/đời sống cốt lõi và 6 bộ từ vựng phân loại theo từng Part.</p>
        </div>
        <div class="inline-flex rounded-xl bg-slate-100 p-1 self-start sm:self-auto">
          <button id="vocab-tab-topics-btn" onclick="switchVocabSubTab('topics')" class="px-4 py-2 rounded-lg text-xs font-extrabold bg-white text-[#5648ee] shadow-xs transition">
            48 Chủ đề (${byTopic.length})
          </button>
          <button id="vocab-tab-parts-btn" onclick="switchVocabSubTab('parts')" class="px-4 py-2 rounded-lg text-xs font-extrabold text-slate-600 hover:text-slate-900 transition">
            Theo Part (${byPart.length})
          </button>
        </div>
      </div>

      <!-- 48 Topics Grid -->
      <div id="vocab-topics-content" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${byTopic.map((t, idx) => `
          <div class="p-4 rounded-2xl bg-slate-50/80 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 transition flex flex-col justify-between group">
            <div>
              <div class="flex items-center justify-between text-[11px] font-black text-slate-400 mb-2">
                <span>#${String(idx + 1).padStart(2, '0')}</span>
                <span class="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">${t.questionsNum || 12} từ</span>
              </div>
              <div class="font-extrabold text-base text-slate-900 group-hover:text-[#5648ee] transition mb-1">${t.name}</div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
              <button onclick="startFlashcardSession('${t.id}', '${t.name.replace(/'/g, "\\'")}')" class="py-2.5 px-2 rounded-xl bg-[#5648ee] hover:bg-[#4335df] text-white font-extrabold text-xs transition flex items-center justify-center gap-1.5 shadow-xs shadow-indigo-500/20" title="Lật thẻ xem nghĩa, phát âm & ví dụ">
                <i data-lucide="layers" class="w-3.5 h-3.5"></i> Flashcard
              </button>
              <button onclick="startVocabQuizDirectly('${t.id}', '${t.name.replace(/'/g, "\\'")}')" class="py-2.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition flex items-center justify-center gap-1" title="Làm bài kiểm tra từ vựng">
                <i data-lucide="check-square" class="w-3.5 h-3.5 text-[#5648ee]"></i> Kiểm tra
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- By Part Grid -->
      <div id="vocab-parts-content" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 hidden">
        ${byPart.map((p, idx) => `
          <div class="p-6 rounded-2xl bg-slate-50/80 hover:bg-orange-50/70 border border-slate-200 hover:border-orange-300 transition flex flex-col justify-between group">
            <div>
              <span class="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-orange-100 text-orange-800 mb-3">Từ vựng TOEIC</span>
              <div class="font-black text-xl text-slate-900 group-hover:text-orange-600 transition mb-2">${p.name}</div>
              <div class="text-xs font-bold text-slate-500 mb-4">${p.questionsNum || 200} câu hỏi trắc nghiệm từ vựng chuyên sâu</div>
            </div>
            <div class="grid grid-cols-2 gap-3 mt-2">
              <button onclick="startFlashcardSession('${p.id}', 'Từ vựng ${p.name.replace(/'/g, "\\'")}')" class="py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-105 text-white font-extrabold text-xs transition flex items-center justify-center gap-1.5 shadow-xs">
                <i data-lucide="layers" class="w-3.5 h-3.5"></i> Flashcard
              </button>
              <button onclick="startVocabQuizDirectly('${p.id}', 'Từ vựng ${p.name.replace(/'/g, "\\'")}')" class="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition flex items-center justify-center gap-1">
                <i data-lucide="check-square" class="w-3.5 h-3.5 text-orange-600"></i> Kiểm tra
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function switchVocabSubTab(tab) {
  const topicsBtn = document.getElementById('vocab-tab-topics-btn');
  const partsBtn = document.getElementById('vocab-tab-parts-btn');
  const topicsContent = document.getElementById('vocab-topics-content');
  const partsContent = document.getElementById('vocab-parts-content');

  if (tab === 'topics') {
    if (topicsBtn) topicsBtn.className = 'px-4 py-2 rounded-lg text-xs font-extrabold bg-white text-[#5648ee] shadow-xs transition';
    if (partsBtn) partsBtn.className = 'px-4 py-2 rounded-lg text-xs font-extrabold text-slate-600 hover:text-slate-900 transition';
    if (topicsContent) topicsContent.classList.remove('hidden');
    if (partsContent) partsContent.classList.add('hidden');
  } else {
    if (partsBtn) partsBtn.className = 'px-4 py-2 rounded-lg text-xs font-extrabold bg-white text-[#ff7733] shadow-xs transition';
    if (topicsBtn) topicsBtn.className = 'px-4 py-2 rounded-lg text-xs font-extrabold text-slate-600 hover:text-slate-900 transition';
    if (partsContent) partsContent.classList.remove('hidden');
    if (topicsContent) topicsContent.classList.add('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

// Modal for Part Subtopics (Lessons & Practice tests)
function openPracticeSubtopicsModal(partSlug) {
  const part = (practiceSummary || []).find(p => p.slug === partSlug);
  if (!part) return;

  const tests = part.tests || part.subTopics || [];
  const lessons = part.lessons || [];

  const modalHtml = `
    <div id="practice-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div class="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-150">
        
        <!-- Header -->
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-[#5648ee]">${part.badge || 'TOEIC'}</span>
              <h3 class="text-xl font-black text-slate-900">${part.name}</h3>
            </div>
            <p class="text-xs text-slate-500">${part.description}</p>
          </div>
          <button onclick="closeModal('practice-modal')" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition">
            ✕
          </button>
        </div>

        <!-- Sub Tabs: Đề Luyện Tập & Bài Học -->
        <div class="flex items-center gap-2 pt-4 pb-3">
          <button id="modal-tab-tests-btn" onclick="switchModalSubTab('tests')" class="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#5648ee] text-white shadow-xs transition flex items-center gap-1.5">
            <i data-lucide="award" class="w-3.5 h-3.5"></i> Đề luyện tập (${tests.length})
          </button>
          ${lessons.length > 0 ? `
          <button id="modal-tab-lessons-btn" onclick="switchModalSubTab('lessons')" class="px-4 py-2 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5">
            <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Lý thuyết & Mẹo (${lessons.length})
          </button>
          ` : ''}
        </div>

        <!-- Content: Tests List -->
        <div id="modal-content-tests" class="overflow-y-auto py-2 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${tests.map((t, idx) => `
            <div class="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition flex flex-col justify-between group">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-black text-[#5648ee]">${t.name}</span>
                  <span class="text-[11px] font-bold text-slate-400">#${String(idx + 1).padStart(2, '0')}</span>
                </div>
                <div class="flex items-center gap-3 text-xs font-semibold text-slate-500 mb-4">
                  <span>${t.questionsNum || 6} câu hỏi</span> • <span>${t.duration || 10} phút</span>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button onclick="closeModal('practice-modal'); startTest('${t.id}', '${part.name} - ${t.name}', false)" class="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition flex items-center justify-center gap-1">
                  <i data-lucide="play" class="w-3 h-3"></i> Thi thử
                </button>
                <button onclick="closeModal('practice-modal'); startTest('${t.id}', '${part.name} - ${t.name}', true)" class="py-2 px-3 rounded-xl bg-[#5648ee] hover:bg-[#4335df] text-white font-extrabold text-xs transition flex items-center justify-center gap-1 shadow-xs">
                  <i data-lucide="check-circle" class="w-3 h-3"></i> Luyện tập
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Content: Lessons List -->
        <div id="modal-content-lessons" class="overflow-y-auto py-2 flex-1 flex flex-col gap-3 hidden">
          ${lessons.map((l, idx) => `
            <div class="p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 transition flex items-center justify-between">
              <div>
                <div class="text-[11px] font-black uppercase text-indigo-600 mb-0.5">Bài ${idx + 1}</div>
                <div class="font-extrabold text-sm text-slate-900">${l.name}</div>
              </div>
              <button onclick="openLessonReader('${l.id}', '${l.name.replace(/'/g, "\\'")}')" class="px-4 py-2 rounded-xl bg-[#5648ee] hover:bg-[#4335df] text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-xs">
                <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Đọc bài học
              </button>
            </div>
          `).join('')}
        </div>

      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (window.lucide) lucide.createIcons();
}

function switchModalSubTab(tab) {
  const testsBtn = document.getElementById('modal-tab-tests-btn');
  const lessonsBtn = document.getElementById('modal-tab-lessons-btn');
  const testsContent = document.getElementById('modal-content-tests');
  const lessonsContent = document.getElementById('modal-content-lessons');

  if (tab === 'tests') {
    if (testsBtn) testsBtn.className = 'px-4 py-2 rounded-xl text-xs font-extrabold bg-[#5648ee] text-white shadow-xs transition flex items-center gap-1.5';
    if (lessonsBtn) lessonsBtn.className = 'px-4 py-2 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5';
    if (testsContent) testsContent.classList.remove('hidden');
    if (lessonsContent) lessonsContent.classList.add('hidden');
  } else {
    if (lessonsBtn) lessonsBtn.className = 'px-4 py-2 rounded-xl text-xs font-extrabold bg-[#5648ee] text-white shadow-xs transition flex items-center gap-1.5';
    if (testsBtn) testsBtn.className = 'px-4 py-2 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5';
    if (lessonsContent) lessonsContent.classList.remove('hidden');
    if (testsContent) testsContent.classList.add('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

// Modal for Grammar Topic (Practice tests & Theory)
function openGrammarTopicModal(topicId) {
  const grammar = (practiceSummary || []).find(p => p.slug === 'grammar');
  if (!grammar) return;
  const topics = grammar.topics || grammar.subTopics || [];
  const topic = topics.find(t => t.id === topicId);
  if (!topic) return;

  const tests = topic.tests || [];
  const hasTheory = !!topic.description;

  const modalHtml = `
    <div id="grammar-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div class="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-150">
        
        <!-- Header -->
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700">Ngữ pháp TOEIC</span>
              <h3 class="text-xl font-black text-slate-900">${topic.name}</h3>
            </div>
            <p class="text-xs text-slate-500">${tests.length} bài luyện tập trắc nghiệm • ${topic.totalQuestions || (tests.length * 20)} câu hỏi có giải thích chi tiết</p>
          </div>
          <button onclick="closeModal('grammar-modal')" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition">
            ✕
          </button>
        </div>

        <!-- Sub Tabs: Đề Luyện Tập & Bài Học -->
        <div class="flex items-center gap-2 pt-4 pb-3">
          <button id="grammar-tab-tests-btn" onclick="switchGrammarModalTab('tests')" class="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 text-white shadow-xs transition flex items-center gap-1.5">
            <i data-lucide="award" class="w-3.5 h-3.5"></i> Đề luyện tập (${tests.length})
          </button>
          ${hasTheory ? `
          <button id="grammar-tab-theory-btn" onclick="switchGrammarModalTab('theory')" class="px-4 py-2 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5">
            <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Lý thuyết trọng tâm
          </button>
          ` : ''}
        </div>

        <!-- Content: Tests List -->
        <div id="grammar-content-tests" class="overflow-y-auto py-2 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${tests.map((t, idx) => `
            <div class="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition flex flex-col justify-between group">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-black text-emerald-700">${t.name}</span>
                  <span class="text-[11px] font-bold text-slate-400">#${String(idx + 1).padStart(2, '0')}</span>
                </div>
                <div class="flex items-center gap-3 text-xs font-semibold text-slate-500 mb-4">
                  <span>${t.questionsNum || 20} câu hỏi</span> • <span>${t.duration || 15} phút</span>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button onclick="closeModal('grammar-modal'); startTest('${t.id}', '${topic.name} - ${t.name}', false)" class="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition flex items-center justify-center gap-1">
                  <i data-lucide="play" class="w-3 h-3"></i> Thi thử
                </button>
                <button onclick="closeModal('grammar-modal'); startTest('${t.id}', '${topic.name} - ${t.name}', true)" class="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition flex items-center justify-center gap-1 shadow-xs">
                  <i data-lucide="check-circle" class="w-3 h-3"></i> Luyện tập
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Content: Theory -->
        <div id="grammar-content-theory" class="overflow-y-auto py-4 px-2 flex-1 hidden">
          <div class="prose max-w-none text-slate-800 text-sm leading-relaxed lesson-content">${topic.description || 'Chưa có nội dung lý thuyết.'}</div>
        </div>

      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (window.lucide) lucide.createIcons();
}

function switchGrammarModalTab(tab) {
  const testsBtn = document.getElementById('grammar-tab-tests-btn');
  const theoryBtn = document.getElementById('grammar-tab-theory-btn');
  const testsContent = document.getElementById('grammar-content-tests');
  const theoryContent = document.getElementById('grammar-content-theory');

  if (tab === 'tests') {
    if (testsBtn) testsBtn.className = 'px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 text-white shadow-xs transition flex items-center gap-1.5';
    if (theoryBtn) theoryBtn.className = 'px-4 py-2 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5';
    if (testsContent) testsContent.classList.remove('hidden');
    if (theoryContent) theoryContent.classList.add('hidden');
  } else {
    if (theoryBtn) theoryBtn.className = 'px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 text-white shadow-xs transition flex items-center gap-1.5';
    if (testsBtn) testsBtn.className = 'px-4 py-2 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5';
    if (theoryContent) theoryContent.classList.remove('hidden');
    if (testsContent) testsContent.classList.add('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

// Modal for Reading Lessons & Grammar
async function openLessonReader(lessonId, lessonTitle) {
  let contentVi = '';
  let contentEn = '';
  let activeTopic = null;

  // Check in practiceSummary first
  for (const p of (practiceSummary || [])) {
    const l = (p.lessons || []).find(x => x.id === lessonId);
    if (l) {
      activeTopic = l;
      contentVi = l.descriptionVi || l.description || '';
      contentEn = l.descriptionEn || '';
      break;
    }
    const g = (p.topics || p.subTopics || []).find(x => x.id === lessonId);
    if (g) {
      activeTopic = g;
      contentVi = g.descriptionVi || g.description || '';
      contentEn = g.descriptionEn || '';
      break;
    }
  }

  // If not found in memory, fetch from /api/topic/:id
  if (!contentVi && !contentEn) {
    try {
      const resp = await fetch(`/api/topic/${lessonId}`);
      if (resp.ok) {
        const data = await resp.json();
        activeTopic = data;
        contentVi = data.descriptionVi || data.description || '';
        contentEn = data.descriptionEn || '';
      }
    } catch (e) {
      console.error(e);
    }
  }

  window._currentLessonVi = contentVi || '<p class="text-slate-500">Chưa có bài viết lý thuyết chi tiết cho phần này.</p>';
  window._currentLessonEn = contentEn || contentVi;

  const displayTitle = (activeTopic && activeTopic.titleVi) ? activeTopic.titleVi : lessonTitle;
  const initialContent = contentVi || contentEn || '<p class="text-slate-500">Chưa có bài viết lý thuyết chi tiết cho phần này.</p>';

  // Log grammar study activity
  recordStudyHistoryActivity({
    type: 'grammar',
    title: `Ngữ pháp: ${displayTitle || lessonTitle}`,
    subtitle: 'Đã hoàn thành xem lý thuyết & phương pháp làm bài',
    badge: 'Lý thuyết',
    score: 'Đã xem',
    accuracy: 100,
    details: {
      lessonId,
      lessonTitle: displayTitle || lessonTitle
    }
  });

  const modalHtml = `
    <div id="lesson-reader-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs">
      <div class="bg-white rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-150">
        
        <div class="flex items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div class="min-w-0 flex-1">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700">Lý Thuyết & Phương Pháp Làm Bài</span>
            <h3 class="text-lg sm:text-xl font-black text-slate-900 mt-1 truncate" title="${displayTitle}">${displayTitle}</h3>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            ${(contentVi && contentEn) ? `
              <div class="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/60 shadow-2xs">
                <button id="btn-lesson-lang-vi" onclick="switchLessonLanguage('vi')" class="px-3 py-1 rounded-lg text-xs font-black transition bg-white text-[#5648ee] shadow-xs">
                  🇻🇳 Tiếng Việt
                </button>
                <button id="btn-lesson-lang-en" onclick="switchLessonLanguage('en')" class="px-3 py-1 rounded-lg text-xs font-bold transition text-slate-500 hover:text-slate-800">
                  🇺🇸 English
                </button>
              </div>
            ` : ''}
            <button onclick="closeModal('lesson-reader-modal')" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition">
              ✕
            </button>
          </div>
        </div>

        <div id="lesson-reader-content" class="overflow-y-auto py-6 flex-1 prose max-w-none text-slate-700 text-sm sm:text-base leading-relaxed lesson-content">
          ${initialContent}
        </div>

        <div class="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button onclick="closeModal('lesson-reader-modal')" class="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition">
            Đóng
          </button>
          <button onclick="closeModal('lesson-reader-modal'); if (window.openGrammarTopicModal && (practiceSummary || []).some(p => p.slug === 'grammar' && (p.topics||p.subTopics||[]).some(t => t.id === '${lessonId}'))) { openGrammarTopicModal('${lessonId}'); } else { startTest('${lessonId}', '${lessonTitle.replace(/'/g, "\\'")}', true); }" class="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20">
            <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Luyện tập chuyên đề này
          </button>
        </div>

      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (window.lucide) lucide.createIcons();
}

function switchLessonLanguage(lang) {
  const container = document.getElementById('lesson-reader-content');
  const btnVi = document.getElementById('btn-lesson-lang-vi');
  const btnEn = document.getElementById('btn-lesson-lang-en');
  if (!container) return;

  if (lang === 'vi') {
    container.innerHTML = window._currentLessonVi || '<p class="text-slate-500">Chưa có bài viết tiếng Việt.</p>';
    if (btnVi) {
      btnVi.className = "px-3 py-1 rounded-lg text-xs font-black transition bg-white text-[#5648ee] shadow-xs";
    }
    if (btnEn) {
      btnEn.className = "px-3 py-1 rounded-lg text-xs font-bold transition text-slate-500 hover:text-slate-800";
    }
  } else {
    container.innerHTML = window._currentLessonEn || '<p class="text-slate-500">No English description available.</p>';
    if (btnEn) {
      btnEn.className = "px-3 py-1 rounded-lg text-xs font-black transition bg-white text-[#5648ee] shadow-xs";
    }
    if (btnVi) {
      btnVi.className = "px-3 py-1 rounded-lg text-xs font-bold transition text-slate-500 hover:text-slate-800";
    }
  }
  if (window.lucide) lucide.createIcons();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.remove();
}

// ================= EXAM ENGINE (V2) =================

async function startTest(testId, testTitle, practiceMode = false, simulationMode = false) {
  isPracticeMode = practiceMode;
  isSimulationMode = simulationMode;
  if (!isSimulationMode) {
    activeSimulationPart = 1;
    isSimulationPaused = false;
  }
  userAnswers = {};
  flaggedQuestions = new Set();
  testClusters = [];
  flatQuestions = [];
  activeClusterIndex = 0;
  activeQuestionIndex = 0;
  timeSpentSeconds = 0;

  // Show loading indicator
  const loadToast = document.createElement('div');
  loadToast.id = 'load-toast';
  loadToast.className = 'fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-bounce';
  loadToast.innerHTML = '<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Đang tải đề thi...';
  document.body.appendChild(loadToast);

  try {
    const resp = await fetch(`/api/test/${testId}`);
    if (!resp.ok) throw new Error('Không thể tải dữ liệu đề thi');
    currentTest = await resp.json();
    currentTest.title = testTitle || currentTest.title || 'TOEIC Practice Test';

    // Populate testClusters & flatQuestions
    let qCounter = 1;
    for (const item of (currentTest.data || [])) {
      if (item.type === 'single') {
        const q = item.question;
        const qNum = q.questionNumber || qCounter;
        q.questionNumber = qNum;
        const clusterIdx = testClusters.length;

        flatQuestions.push({
          question: q,
          clusterIndex: clusterIdx,
          indexInCluster: 0
        });

        testClusters.push({
          type: 'single',
          id: q.id || `single_${qNum}`,
          audioUrl: q.audioUrl || '',
          imageUrl: q.imageUrl || '',
          passageHtml: '',
          transcriptHtml: q.transcriptHtml || '',
          transcriptViHtml: q.explanationViHtml || q.transcriptViHtml || '',
          startQNum: qNum,
          endQNum: qNum,
          questions: [q]
        });
        qCounter++;
      } else if (item.type === 'group') {
        const subList = item.questions || [];
        if (subList.length === 0) continue;

        const clusterIdx = testClusters.length;
        const startNum = subList[0].questionNumber || qCounter;
        const endNum = subList[subList.length - 1].questionNumber || (startNum + subList.length - 1);

        subList.forEach((sub, subIdx) => {
          if (!sub.questionNumber) sub.questionNumber = qCounter + subIdx;
          flatQuestions.push({
            question: sub,
            clusterIndex: clusterIdx,
            indexInCluster: subIdx
          });
        });

        testClusters.push({
          type: 'group',
          id: item.groupId || `group_${startNum}`,
          audioUrl: item.audioUrl || '',
          imageUrl: item.imageUrl || '',
          passageHtml: item.passageHtml || '',
          transcriptHtml: item.transcriptHtml || '',
          transcriptViHtml: item.transcriptViHtml || '',
          startQNum: startNum,
          endQNum: endNum,
          questions: subList
        });
        qCounter += subList.length;
      }
    }

    if (flatQuestions.length === 0) {
      alert('Đề thi này hiện chưa có câu hỏi.');
      return;
    }

    // Set duration
    if (isSimulationMode) {
      totalDurationSeconds = 120 * 60; // 120 mins
    } else if (flatQuestions.length >= 180) {
      totalDurationSeconds = 120 * 60; // 120 mins
    } else if (flatQuestions.length >= 90) {
      totalDurationSeconds = 60 * 60;  // 60 mins
    } else {
      totalDurationSeconds = Math.max(10 * 60, flatQuestions.length * 60); // 1 min/q
    }
    timeRemaining = totalDurationSeconds;

    // Switch view to exam
    showView('exam');
    toggleBottomDock(false);

    // Setup Header info
    const titleEl = document.getElementById('exam-title');
    if (titleEl) titleEl.textContent = isSimulationMode ? 'Simulation Test' : currentTest.title;

    // Start timer (counts up in practice mode matching EstudyMe)
    startExamTimer();

    const welcomeCard = document.getElementById('simulation-welcome-card');
    const dirCard = document.getElementById('simulation-directions-card');
    const questionCard = document.getElementById('exam-question-card');

    if (isSimulationMode) {
      const welcomeTitle = document.getElementById('sim-welcome-title');
      if (welcomeTitle) welcomeTitle.textContent = currentTest.title || 'TEST 1';
      if (welcomeCard) welcomeCard.classList.remove('hidden');
      if (dirCard) dirCard.classList.add('hidden');
      if (questionCard) questionCard.classList.add('hidden');
      renderSimulationSidebar();
      renderSimulationDock();
    } else {
      if (welcomeCard) welcomeCard.classList.add('hidden');
      if (dirCard) dirCard.classList.add('hidden');
      if (questionCard) questionCard.classList.remove('hidden');
      const sidebar = document.getElementById('simulation-sidebar');
      if (sidebar) {
        sidebar.classList.add('hidden');
        sidebar.style.display = 'none';
      }
      const expandBtn = document.getElementById('btn-expand-sim-sidebar');
      if (expandBtn) {
        expandBtn.classList.add('hidden');
        expandBtn.style.display = 'none';
      }
      const dockSimulation = document.getElementById('exam-dock-simulation');
      if (dockSimulation && flatQuestions.length < 180) dockSimulation.classList.add('hidden');
      renderActiveCluster();
      updateExamDock();
    }

  } catch (err) {
    alert('Lỗi tải bài thi: ' + err.message);
  } finally {
    const toast = document.getElementById('load-toast');
    if (toast) toast.remove();
  }
}

// ================= SIMULATION SIDEBAR & CONTROLLERS =================

function renderSimulationSidebar() {
  const sidebar = document.getElementById('simulation-sidebar');
  const expandBtn = document.getElementById('btn-expand-sim-sidebar');
  const testsContainer = document.getElementById('simulation-sidebar-tests');
  const progressBadge = document.getElementById('sim-sidebar-progress');
  if (!sidebar || !testsContainer) return;

  if (!isSimulationMode) {
    sidebar.classList.add('hidden');
    sidebar.style.display = 'none';
    if (expandBtn) {
      expandBtn.classList.add('hidden');
      expandBtn.style.display = 'none';
    }
    return;
  }

  sidebar.classList.remove('hidden');
  sidebar.style.display = 'flex';
  if (expandBtn) {
    expandBtn.classList.add('hidden');
    expandBtn.style.display = 'none';
  }

  const tests = testsSummary.full_tests || [];
  if (progressBadge) {
    progressBadge.textContent = `0/${tests.length}`;
  }

  testsContainer.innerHTML = tests.map(t => {
    const isCurrent = currentTest && (currentTest.topicId === t.id || currentTest.id === t.id);
    return `
      <div onclick="startSimulationTest('${t.id}', '${t.name.trim()}')" class="px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${isCurrent ? 'bg-indigo-50 text-[#5648ee] border border-indigo-200' : 'text-slate-700 hover:bg-slate-50 border border-transparent'}">
        <span class="truncate">${t.name.trim()}</span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${isCurrent ? 'bg-[#5648ee] text-white' : 'bg-slate-100 text-slate-500'}">0%</span>
      </div>
    `;
  }).join('');
}

function toggleSimulationSidebar(forceOpen) {
  const sidebar = document.getElementById('simulation-sidebar');
  const expandBtn = document.getElementById('btn-expand-sim-sidebar');
  if (!sidebar) return;

  const isCollapsed = sidebar.classList.contains('hidden') || sidebar.style.display === 'none';
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isCollapsed;

  if (shouldOpen) {
    sidebar.classList.remove('hidden');
    sidebar.style.display = 'flex';
    if (expandBtn) {
      expandBtn.classList.add('hidden');
      expandBtn.style.display = 'none';
    }
  } else {
    sidebar.classList.add('hidden');
    sidebar.style.display = 'none';
    if (expandBtn) {
      expandBtn.classList.remove('hidden');
      expandBtn.style.display = 'inline-flex';
    }
  }
  if (window.lucide) lucide.createIcons();
}

function dismissSimulationWelcome() {
  const welcomeCard = document.getElementById('simulation-welcome-card');
  if (welcomeCard) welcomeCard.classList.add('hidden');
  switchSimulationPart(1);
}

function dismissSimulationDirections() {
  const dirCard = document.getElementById('simulation-directions-card');
  const questionCard = document.getElementById('exam-question-card');
  if (dirCard) dirCard.classList.add('hidden');
  if (questionCard) questionCard.classList.remove('hidden');

  const pInfo = TOEIC_PARTS_INFO.find(p => p.part === activeSimulationPart) || TOEIC_PARTS_INFO[0];
  jumpToSimulationQuestion(pInfo.startQ);
}

function switchSimulationPart(partNum) {
  activeSimulationPart = partNum;
  const pInfo = TOEIC_PARTS_INFO.find(p => p.part === partNum) || TOEIC_PARTS_INFO[0];

  const welcomeCard = document.getElementById('simulation-welcome-card');
  const dirCard = document.getElementById('simulation-directions-card');
  const questionCard = document.getElementById('exam-question-card');

  if (welcomeCard) welcomeCard.classList.add('hidden');
  if (questionCard) questionCard.classList.add('hidden');

  if (dirCard) {
    const titleEl = document.getElementById('sim-directions-part-title');
    const textEl = document.getElementById('sim-directions-text');
    if (titleEl) titleEl.textContent = pInfo.shortName;
    if (textEl) textEl.textContent = pInfo.directions;
    dirCard.classList.remove('hidden');
  }

  renderSimulationDock();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
}

function jumpToSimulationQuestion(qNum) {
  const welcomeCard = document.getElementById('simulation-welcome-card');
  const dirCard = document.getElementById('simulation-directions-card');
  const questionCard = document.getElementById('exam-question-card');

  if (welcomeCard) welcomeCard.classList.add('hidden');
  if (dirCard) dirCard.classList.add('hidden');
  if (questionCard) questionCard.classList.remove('hidden');

  const pInfo = TOEIC_PARTS_INFO.find(p => qNum >= p.startQ && qNum <= p.endQ);
  if (pInfo) activeSimulationPart = pInfo.part;

  const clusterIdx = testClusters.findIndex(c => qNum >= c.startQNum && qNum <= c.endQNum);
  if (clusterIdx !== -1) {
    activeClusterIndex = clusterIdx;
    renderActiveCluster();
    const fIdx = flatQuestions.findIndex(f => f.question.questionNumber === qNum);
    if (fIdx !== -1) activeQuestionIndex = fIdx;

    setTimeout(() => {
      scrollToQuestion(qNum);
    }, 100);
  }

  renderSimulationDock();
}

let isDockCollapsed = false;

function toggleBottomDock(forceState) {
  const dock = document.getElementById('exam-bottom-dock');
  const icon = document.getElementById('dock-collapse-icon');
  if (!dock) return;

  isDockCollapsed = typeof forceState === 'boolean' ? forceState : !isDockCollapsed;

  if (isDockCollapsed) {
    dock.classList.add('dock-collapsed');
    if (icon) icon.setAttribute('data-lucide', 'chevron-up');
  } else {
    dock.classList.remove('dock-collapsed');
    if (icon) icon.setAttribute('data-lucide', 'chevron-down');
  }
  if (window.lucide) lucide.createIcons();
}

function renderSimulationDock() {
  const dockSimulation = document.getElementById('exam-dock-simulation');
  const singleDock = document.getElementById('exam-dock-single');
  const clusteredDock = document.getElementById('exam-dock-clustered');
  if (singleDock) singleDock.classList.add('hidden');
  if (clusteredDock) clusteredDock.classList.add('hidden');
  if (!dockSimulation) return;
  dockSimulation.classList.remove('hidden');

  // 1. Render Row 1: The 7 Part tabs
  const tabsContainer = document.getElementById('simulation-parts-tabs');
  if (tabsContainer) {
    tabsContainer.innerHTML = TOEIC_PARTS_INFO.map(p => {
      const isActive = p.part === activeSimulationPart;
      let partAnswered = 0;
      for (let q = p.startQ; q <= p.endQ; q++) {
        if (userAnswers[q]) partAnswered++;
      }
      const isAllDone = partAnswered === p.totalQ;

      return `
        <div onclick="switchSimulationPart(${p.part})" class="flex-shrink-0 px-4 py-2 cursor-pointer flex flex-col justify-center transition border-b-2 select-none ${isActive ? 'bg-indigo-50/90 border-[#5648ee]' : 'border-transparent hover:bg-slate-50'}">
          <div class="flex items-center gap-1.5 text-xs font-black ${isActive ? 'text-[#5648ee]' : 'text-slate-800'}">
            <span>${p.shortName}</span>
            ${isAllDone ? '<span class="text-emerald-500 font-black">✓</span>' : ''}
          </div>
          <div class="text-[11px] font-bold ${isActive ? 'text-[#5648ee]' : 'text-slate-400'} mt-0.5">
            ${partAnswered}/${p.totalQ} questions
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Render Row 2: Questions strip for activeSimulationPart
  const qBarContainer = document.getElementById('simulation-questions-bar');
  if (qBarContainer) {
    const activePartInfo = TOEIC_PARTS_INFO.find(p => p.part === activeSimulationPart) || TOEIC_PARTS_INFO[0];
    const currentQuestionObj = flatQuestions[activeQuestionIndex];
    const currentQNum = currentQuestionObj ? currentQuestionObj.question.questionNumber : -1;

    let pillsHtml = '';
    for (let qNum = activePartInfo.startQ; qNum <= activePartInfo.endQ; qNum++) {
      const isAnswered = !!userAnswers[qNum];
      const isCurrent = currentQNum === qNum;
      const isFlagged = flaggedQuestions.has(qNum);

      let pillClasses = 'min-w-[36px] h-8 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center relative cursor-pointer select-none border ';
      if (isCurrent) {
        pillClasses += 'ring-2 ring-[#5648ee] border-[#5648ee] text-[#5648ee] bg-indigo-50 font-black shadow-xs ';
      } else if (isAnswered) {
        pillClasses += 'bg-indigo-100 text-[#5648ee] border-indigo-200 font-bold ';
      } else {
        pillClasses += 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 ';
      }

      pillsHtml += `
        <button onclick="jumpToSimulationQuestion(${qNum})" class="${pillClasses}" title="Câu hỏi ${qNum}">
          ${qNum}
          ${isFlagged ? '<span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border border-white"></span>' : ''}
        </button>
      `;
    }
    qBarContainer.innerHTML = pillsHtml;
  }
}

function pauseSimulationExam() {
  isSimulationPaused = true;
  if (examTimer) {
    clearInterval(examTimer);
    examTimer = null;
  }
  const audio = document.getElementById('exam-audio-player');
  if (audio && !audio.paused) {
    audio.pause();
    const playIcon = document.getElementById('exam-audio-play-icon');
    if (playIcon) playIcon.setAttribute('data-lucide', 'play');
    if (window.lucide) lucide.createIcons();
  }

  // Show pause modal
  let pauseModal = document.getElementById('simulation-pause-modal');
  if (!pauseModal) {
    pauseModal = document.createElement('div');
    pauseModal.id = 'simulation-pause-modal';
    pauseModal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs';
    document.body.appendChild(pauseModal);
  }

  const answered = Object.keys(userAnswers).length;
  const total = flatQuestions.length || 200;

  pauseModal.innerHTML = `
    <div class="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl animate-in fade-in zoom-in duration-150">
      <div class="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4 border border-amber-200">
        <i data-lucide="pause" class="w-8 h-8 fill-current"></i>
      </div>
      <h3 class="text-xl font-black text-slate-900 mb-2">Đang tạm dừng bài thi</h3>
      <p class="text-xs text-slate-500 mb-6 leading-relaxed">
        Thời gian làm bài đã được tạm dừng. Bạn đã trả lời <strong class="text-slate-800">${answered}/${total}</strong> câu hỏi. Bạn có thể tiếp tục làm bài bất cứ khi nào sẵn sàng.
      </p>
      <div class="flex flex-col gap-3">
        <button onclick="resumeSimulationExam()" class="w-full py-3 rounded-2xl bg-[#5648ee] hover:bg-[#4335df] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer">
          <i data-lucide="play" class="w-4 h-4 fill-current"></i> Tiếp tục làm bài
        </button>
        <button onclick="confirmSubmitExam()" class="w-full py-2.5 rounded-2xl border-2 border-[#5648ee] text-[#5648ee] hover:bg-indigo-50 font-bold text-xs transition cursor-pointer">
          Nộp bài ngay
        </button>
        <button onclick="closeModal('simulation-pause-modal'); confirmExitExam()" class="w-full py-2 rounded-xl text-slate-400 hover:text-slate-700 font-semibold text-xs transition cursor-pointer">
          Thoát và hủy kết quả
        </button>
      </div>
    </div>
  `;
  pauseModal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function resumeSimulationExam() {
  const pauseModal = document.getElementById('simulation-pause-modal');
  if (pauseModal) pauseModal.classList.add('hidden');
  isSimulationPaused = false;
  startExamTimer();
}

function confirmSubmitExam() {
  const pauseModal = document.getElementById('simulation-pause-modal');
  if (pauseModal) pauseModal.classList.add('hidden');

  let submitModal = document.getElementById('simulation-submit-modal');
  if (!submitModal) {
    submitModal = document.createElement('div');
    submitModal.id = 'simulation-submit-modal';
    submitModal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs';
    document.body.appendChild(submitModal);
  }

  const answered = Object.keys(userAnswers).length;
  const total = flatQuestions.length || 200;
  const unanswered = total - answered;

  submitModal.innerHTML = `
    <div class="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl animate-in fade-in zoom-in duration-150">
      <div class="w-16 h-16 rounded-full bg-indigo-50 text-[#5648ee] flex items-center justify-center mx-auto mb-4 border border-indigo-200">
        <i data-lucide="send" class="w-8 h-8"></i>
      </div>
      <h3 class="text-xl font-black text-slate-900 mb-2">Xác nhận nộp bài thi</h3>
      <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 mb-6 text-left">
        <div class="flex justify-between items-center text-xs font-bold text-slate-700 py-1 border-b border-slate-200/60">
          <span>Tổng số câu hỏi:</span>
          <span class="font-extrabold text-slate-900">${total} câu</span>
        </div>
        <div class="flex justify-between items-center text-xs font-bold text-slate-700 py-1 border-b border-slate-200/60">
          <span>Đã hoàn thành:</span>
          <span class="font-extrabold text-emerald-600">${answered} câu</span>
        </div>
        <div class="flex justify-between items-center text-xs font-bold text-slate-700 py-1">
          <span>Chưa trả lời:</span>
          <span class="font-extrabold ${unanswered > 0 ? 'text-rose-500' : 'text-slate-400'}">${unanswered} câu</span>
        </div>
      </div>
      ${unanswered > 0 ? `
        <p class="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200 mb-6 font-semibold">
          ⚠️ Bạn vẫn còn <strong>${unanswered}</strong> câu chưa chọn đáp án. Bạn có chắc chắn muốn kết thúc bài thi?
        </p>
      ` : `
        <p class="text-xs text-slate-500 mb-6">
          Tuyệt vời! Bạn đã hoàn thành tất cả các câu hỏi trong đề thi. Nhấn xác nhận để tính điểm TOEIC ngay.
        </p>
      `}
      <div class="flex flex-col sm:flex-row gap-3">
        <button onclick="closeModal('simulation-submit-modal')" class="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition cursor-pointer">
          Tiếp tục làm bài
        </button>
        <button onclick="closeModal('simulation-submit-modal'); submitExam(true)" class="flex-1 py-3 rounded-2xl bg-[#5648ee] hover:bg-[#4335df] text-white font-extrabold text-xs shadow-md transition cursor-pointer">
          Xác nhận nộp bài
        </button>
      </div>
    </div>
  `;
  submitModal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function formatTimerHHMMSS(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startExamTimer() {
  if (examTimer) clearInterval(examTimer);

  const timerEl = document.getElementById('exam-timer');
  const updateDisplay = () => {
    if (!timerEl) return;
    if (isPracticeMode) {
      // Practice mode counts up like EstudyMe: 00:00:29
      timerEl.textContent = formatTimerHHMMSS(timeSpentSeconds);
    } else {
      // Mock test mode counts down
      const h = Math.floor(timeRemaining / 3600);
      const m = Math.floor((timeRemaining % 3600) / 60);
      const s = timeRemaining % 60;
      timerEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  };

  updateDisplay();

  examTimer = setInterval(() => {
    timeSpentSeconds++;
    if (!isPracticeMode) {
      timeRemaining--;
      if (timeRemaining <= 0) {
        clearInterval(examTimer);
        alert('Đã hết thời gian làm bài! Hệ thống đang tự động nộp bài.');
        submitExam(true);
        return;
      }
    }
    updateDisplay();
  }, 1000);
}

function sanitizeMediaUrl(url) {
  if (!url) return '';
  let clean = String(url).trim();
  if (clean.startsWith('//')) clean = 'https:' + clean;
  if (clean.startsWith('estudyme/')) clean = 'https://storage.googleapis.com/' + clean;
  clean = clean.replace(/storage\.googleapis\.com\/+/g, 'storage.googleapis.com/');
  if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('data:')) {
    if (clean.startsWith('/')) clean = clean.substring(1);
    clean = 'https://storage.googleapis.com/' + clean;
  }
  return clean;
}

function getCorrectLetter(ans) {
  if (!ans) return 'A';
  const match = String(ans).trim().match(/[A-Da-d]/);
  return match ? match[0].toUpperCase() : 'A';
}

function normalizeChoices(rawChoices) {
  if (!Array.isArray(rawChoices) || rawChoices.length === 0) {
    return [
      { letter: 'A', text: '' },
      { letter: 'B', text: '' },
      { letter: 'C', text: '' },
      { letter: 'D', text: '' }
    ];
  }

  return rawChoices.map((c, idx) => {
    const defaultLetter = String.fromCharCode(65 + idx);
    if (typeof c === 'string') {
      const trimmed = c.trim();
      const match = trimmed.match(/^\(?([A-Da-d])\)?[\.\:\s\-]*(.*)$/);
      if (match) {
        return { letter: match[1].toUpperCase(), text: match[2].trim() };
      }
      return { letter: defaultLetter, text: trimmed };
    }
    if (typeof c === 'object' && c !== null) {
      let letter = c.letter;
      let text = (c.text || c.content || '').trim();
      if (!letter) {
        const match = text.match(/^\(?([A-Da-d])\)?[\.\:\s\-]*(.*)$/);
        if (match) {
          letter = match[1].toUpperCase();
          text = match[2].trim();
        } else {
          letter = defaultLetter;
        }
      }
      return { letter: String(letter).toUpperCase(), text };
    }
    return { letter: defaultLetter, text: '' };
  });
}

let examAudioListenersAttached = false;

function setupExamCardAudio(audioUrl) {
  const bar = document.getElementById('exam-card-audio-bar');
  const player = document.getElementById('exam-audio-player');
  const playIcon = document.getElementById('exam-audio-play-icon');
  const timeDisplay = document.getElementById('exam-audio-time-display');
  const scrubber = document.getElementById('exam-audio-scrubber');

  if (!audioUrl) {
    if (bar) bar.classList.add('hidden');
    if (player) player.pause();
    return;
  }

  if (bar) bar.classList.remove('hidden');
  const cleanUrl = sanitizeMediaUrl(audioUrl);
  if (player && player.src !== cleanUrl) {
    player.src = cleanUrl;
  }
  if (timeDisplay) timeDisplay.textContent = '00:00 / 00:00';
  if (scrubber) scrubber.value = 0;
  if (playIcon) playIcon.setAttribute('data-lucide', 'play');

  if (!examAudioListenersAttached && player) {
    examAudioListenersAttached = true;

    player.addEventListener('loadedmetadata', updateExamAudioTime);
    player.addEventListener('timeupdate', updateExamAudioTime);
    player.addEventListener('ended', () => {
      const pIcon = document.getElementById('exam-audio-play-icon');
      if (pIcon) pIcon.setAttribute('data-lucide', 'play');
      const sc = document.getElementById('exam-audio-scrubber');
      if (sc) sc.value = 0;
      if (window.lucide) lucide.createIcons();
    });
  }

  if (window.lucide) lucide.createIcons();

  // Auto-play audio when entering question/cluster if enabled
  const examView = document.getElementById('view-exam');
  if (examView && !examView.classList.contains('hidden') && getExamSettings().autoAudio && player && player.src) {
    setTimeout(() => {
      const ev = document.getElementById('view-exam');
      if (ev && !ev.classList.contains('hidden') && player.src) {
        player.currentTime = 0;
        player.play().then(() => {
          const pIcon = document.getElementById('exam-audio-play-icon');
          if (pIcon) pIcon.setAttribute('data-lucide', 'pause');
          if (window.lucide) lucide.createIcons();
        }).catch(err => console.log('Exam audio autoplay prevented:', err));
      }
    }, 150);
  }
}

function updateExamAudioTime() {
  const player = document.getElementById('exam-audio-player');
  const timeDisplay = document.getElementById('exam-audio-time-display');
  const scrubber = document.getElementById('exam-audio-scrubber');
  if (!player) return;

  const cur = formatAudioTime(player.currentTime || 0);
  const dur = formatAudioTime(player.duration || 0);
  if (timeDisplay) timeDisplay.textContent = `${cur} / ${dur}`;

  if (scrubber && player.duration) {
    scrubber.value = Math.floor((player.currentTime / player.duration) * 100);
  }
}

function toggleExamAudio() {
  const player = document.getElementById('exam-audio-player');
  const playIcon = document.getElementById('exam-audio-play-icon');
  if (!player || !player.src) return;

  if (player.paused) {
    player.play().catch(e => console.log('Audio play error:', e));
    if (playIcon) playIcon.setAttribute('data-lucide', 'pause');
  } else {
    player.pause();
    if (playIcon) playIcon.setAttribute('data-lucide', 'play');
  }
  if (window.lucide) lucide.createIcons();
}

function seekExamAudio(val) {
  const player = document.getElementById('exam-audio-player');
  if (player && player.duration) {
    player.currentTime = (val / 100) * player.duration;
  }
}

function toggleExamMute() {
  const player = document.getElementById('exam-audio-player');
  const volIcon = document.getElementById('exam-audio-vol-icon');
  if (!player) return;

  player.muted = !player.muted;
  if (volIcon) {
    volIcon.setAttribute('data-lucide', player.muted ? 'volume-x' : 'volume-2');
    if (window.lucide) lucide.createIcons();
  }
}

// Render active cluster (Exact EstudyMe Layout for both Single and Grouped parts)
function renderActiveCluster() {
  if (!testClusters[activeClusterIndex]) return;

  const cluster = testClusters[activeClusterIndex];

  // 1. Audio player setup (at cluster level)
  const audioSrc = cluster.audioUrl || (cluster.questions[0] && cluster.questions[0].audioUrl);
  setupExamCardAudio(audioSrc);
  applyShortcutHintsVisibility();

  // 2. Reading Passage (Part 6 & 7)
  const passageWrap = document.getElementById('exam-passage-wrap');
  const passageText = document.getElementById('exam-passage-text');
  if (cluster.passageHtml && passageWrap && passageText) {
    passageWrap.classList.remove('hidden');
    passageText.innerHTML = cluster.passageHtml;
  } else if (passageWrap) {
    passageWrap.classList.add('hidden');
  }

  // 3. Shared Image (e.g. photo for Part 1 or diagram for cluster)
  const imgWrap = document.getElementById('exam-img-wrap');
  const imgEl = document.getElementById('exam-img');
  const cleanClusterImg = sanitizeMediaUrl(cluster.imageUrl || (cluster.type === 'single' ? cluster.questions[0].imageUrl : ''));
  if (cleanClusterImg && imgWrap && imgEl) {
    imgWrap.classList.remove('hidden');
    imgEl.src = cleanClusterImg;
  } else if (imgWrap) {
    imgWrap.classList.add('hidden');
  }

  // 4. Sub-questions Container
  const container = document.getElementById('exam-cluster-questions-container');
  if (!container) return;

  container.innerHTML = cluster.questions.map((subQ, subIdx) => {
    const qNum = subQ.questionNumber;
    const isFlagged = flaggedQuestions.has(qNum);
    const userAns = userAnswers[qNum];
    const correctLetter = getCorrectLetter(subQ.correctAnswer);
    const choicesList = normalizeChoices(subQ.choices);
    const promptText = (subQ.questionText || '').trim();

    // Specific sub-question image if any and different from cluster image
    const cleanSubImg = sanitizeMediaUrl(subQ.imageUrl);
    const showSubImg = cleanSubImg && cleanSubImg !== cleanClusterImg;
    const subImgHtml = showSubImg ? `
      <div class="w-full flex items-center justify-center my-3">
        <div class="inline-flex p-1 rounded-2xl bg-white border border-slate-200/90 shadow-2xs max-w-[420px] max-h-[300px]">
          <img src="${cleanSubImg}" alt="Question Image" class="max-h-64 object-contain rounded-xl">
        </div>
      </div>
    ` : '';

    // Find correct choice text
    let correctText = '';
    const correctChoiceObj = choicesList.find(c => (c.letter || 'A') === correctLetter);
    if (correctChoiceObj && correctChoiceObj.text) {
      correctText = correctChoiceObj.text;
    }

    // Choices HTML
    const choicesHtml = choicesList.map(c => {
      const letter = c.letter || 'A';
      const text = (c.text || '').trim();
      const isSelected = userAns === letter;
      const isAudioOnly = !text;

      let extraClass = '';
      let circleContent = '';

      if (userAns) {
        if (isPracticeMode) {
          extraClass += ' graded';
          if (letter === correctLetter) {
            extraClass += ' correct';
            circleContent = '✓';
          } else if (isSelected && letter !== correctLetter) {
            extraClass += ' wrong';
            circleContent = '✕';
          }
        } else if (isSelected) {
          extraClass += ' selected';
          circleContent = '●';
        }
      }

      const displayLabel = isAudioOnly ? `(${letter})` : `<strong class="font-bold mr-1.5">(${letter})</strong> ${text}`;

      return `
        <div onclick="selectExamChoice(${qNum}, '${letter}')" class="exam-choice-item flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 hover:border-indigo-400 hover:bg-slate-50/80 transition cursor-pointer select-none ${extraClass}">
          <div class="exam-radio-circle w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0 text-xs font-black transition">
            ${circleContent}
          </div>
          <span class="text-sm sm:text-base font-semibold text-slate-800">${displayLabel}</span>
        </div>
      `;
    }).join('');

    // Explanations (Practice Mode)
    let explanationHtml = '';
    if (isPracticeMode && userAns) {
      const sections = parseExplanationSections(subQ, cluster);
      let accordionsHtml = '';
      if (sections.length === 0) {
        accordionsHtml = '<p class="text-slate-500 italic text-sm">Không có giải thích chi tiết cho câu hỏi này.</p>';
      } else {
        accordionsHtml = sections.map((sec, idx) => `
          <div class="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
            <button type="button" onclick="toggleAccordion('acc-q-${qNum}-${idx}')" class="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/70 transition cursor-pointer">
              <div class="flex items-center gap-3">
                <span class="w-6 h-6 rounded-full bg-[#5648ee] text-white flex items-center justify-center text-xs font-black flex-shrink-0">
                  ${sec.num}
                </span>
                <span class="text-sm font-black text-slate-900">${sec.title}</span>
              </div>
              <i id="acc-icon-acc-q-${qNum}-${idx}" data-lucide="chevron-up" class="w-4 h-4 text-slate-400 transition-transform"></i>
            </button>
            <div id="acc-body-acc-q-${qNum}-${idx}" class="acc-content px-5 pb-5 pt-1 text-sm text-slate-700 leading-relaxed border-t border-slate-100/60 overflow-x-auto">
              ${sec.content}
            </div>
          </div>
        `).join('');
      }

      explanationHtml = `
        <div id="exam-explanation-${qNum}" class="mt-5 pt-5 border-t border-slate-100">
          <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
            <i data-lucide="users" class="w-4 h-4 text-slate-400"></i>
            <span>86% of others answered correctly</span>
          </div>
          <div class="text-sm font-extrabold text-slate-900 mb-1">
            Đáp án đúng: <span class="text-emerald-600 font-black">(${correctLetter})</span> <span class="font-medium text-slate-700">${correctText}</span>
          </div>
          <button type="button" onclick="toggleSubQuestionExplanation(${qNum})" class="text-xs font-bold text-[#5648ee] hover:underline flex items-center gap-1 mb-4 cursor-pointer">
            <span id="exam-toggle-explain-text-${qNum}">Ẩn Giải thích</span>
            <i id="exam-toggle-explain-icon-${qNum}" data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
          </button>
          <div id="exam-accordions-${qNum}" class="flex flex-col gap-3.5 w-full">
            ${accordionsHtml}
          </div>
        </div>
      `;
    }

    return `
      <div id="q-block-${qNum}" class="subquestion-block ${subIdx > 0 ? 'pt-8 border-t border-slate-100/90' : ''}">
        <div class="flex items-center justify-between mb-3">
          <div class="text-base font-extrabold text-slate-900">Câu hỏi ${qNum}.</div>
          <button onclick="toggleFlagQuestion(${qNum})" class="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer" title="Đánh dấu câu hỏi này">
            <i id="exam-flag-icon-${qNum}" data-lucide="flag" class="w-5 h-5 ${isFlagged ? 'text-rose-500 fill-rose-500' : 'text-slate-400'}"></i>
          </button>
        </div>

        ${promptText ? `<div class="text-base font-bold text-slate-900 mb-4 leading-relaxed">${promptText}</div>` : ''}
        ${subImgHtml}

        <div id="exam-choices-${qNum}" class="flex flex-col gap-3 w-full">
          ${choicesHtml}
        </div>

        ${explanationHtml}
      </div>
    `;
  }).join('');

  // Floating Next Question Button
  updateFloatingNextButton();

  updateExamDock();
  renderExamPalette();
  if (window.lucide) lucide.createIcons();
}

// Backward compatibility alias
function renderActiveQuestion() {
  renderActiveCluster();
}

function selectExamChoice(qNumOrLetter, maybeLetter) {
  let qNum, letter;
  if (typeof qNumOrLetter === 'string' && maybeLetter === undefined) {
    const cluster = testClusters[activeClusterIndex];
    if (cluster && cluster.questions[0]) {
      qNum = cluster.questions[0].questionNumber;
      letter = qNumOrLetter;
    } else {
      return;
    }
  } else {
    qNum = qNumOrLetter;
    letter = maybeLetter;
  }

  if (isPracticeMode && userAnswers[qNum]) {
    return; // Already answered in practice mode
  }

  userAnswers[qNum] = letter;
  recordStreakActivity('làm bài thi');
  const fIdx = flatQuestions.findIndex(f => f.question.questionNumber === qNum);
  if (fIdx !== -1) activeQuestionIndex = fIdx;

  renderActiveCluster();
  updateExamDock();
}

function toggleFlagQuestion(qNum) {
  if (flaggedQuestions.has(qNum)) {
    flaggedQuestions.delete(qNum);
  } else {
    flaggedQuestions.add(qNum);
  }
  renderActiveCluster();
  if (isSimulationMode) {
    renderSimulationDock();
  }
}

function toggleSubQuestionExplanation(qNum) {
  const container = document.getElementById(`exam-accordions-${qNum}`);
  const textEl = document.getElementById(`exam-toggle-explain-text-${qNum}`);
  const iconEl = document.getElementById(`exam-toggle-explain-icon-${qNum}`);
  if (!container) return;

  const isHidden = container.classList.contains('hidden');
  if (isHidden) {
    container.classList.remove('hidden');
    if (textEl) textEl.textContent = 'Ẩn Giải thích';
    if (iconEl) iconEl.setAttribute('data-lucide', 'chevron-down');
  } else {
    container.classList.add('hidden');
    if (textEl) textEl.textContent = 'Xem Giải thích';
    if (iconEl) iconEl.setAttribute('data-lucide', 'chevron-right');
  }
  if (window.lucide) lucide.createIcons();
}

function scrollToQuestion(qNum) {
  const el = document.getElementById(`q-block-${qNum}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function switchCluster(cIdx) {
  if (cIdx < 0 || cIdx >= testClusters.length) return;
  activeClusterIndex = cIdx;
  if (isSimulationMode) {
    const cluster = testClusters[cIdx];
    if (cluster) {
      const qNum = cluster.startQNum;
      const pInfo = TOEIC_PARTS_INFO.find(p => qNum >= p.startQ && qNum <= p.endQ);
      if (pInfo && pInfo.part !== activeSimulationPart) {
        activeSimulationPart = pInfo.part;
      }
    }
  }
  renderActiveCluster();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextExamQuestion() {
  const cluster = testClusters[activeClusterIndex];
  if (!cluster) return;

  // Find first unanswered question in current cluster
  const firstUnanswered = cluster.questions.find(q => !userAnswers[q.questionNumber]);
  if (firstUnanswered) {
    scrollToQuestion(firstUnanswered.questionNumber);
    return;
  }

  // All in current cluster answered, advance to next cluster
  if (activeClusterIndex < testClusters.length - 1) {
    activeClusterIndex++;
    if (isSimulationMode) {
      const nextCluster = testClusters[activeClusterIndex];
      if (nextCluster) {
        const qNum = nextCluster.startQNum;
        const pInfo = TOEIC_PARTS_INFO.find(p => qNum >= p.startQ && qNum <= p.endQ);
        if (pInfo && pInfo.part !== activeSimulationPart) {
          activeSimulationPart = pInfo.part;
        }
      }
    }
    renderActiveCluster();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    if (isSimulationMode) {
      confirmSubmitExam();
    } else {
      submitExam();
    }
  }
}

function updateFloatingNextButton() {
  const floatingBtn = document.getElementById('exam-floating-next-btn');
  if (!floatingBtn) return;

  const cluster = testClusters[activeClusterIndex];
  if (!cluster) return;

  const isLastCluster = activeClusterIndex === testClusters.length - 1;
  const allAnsweredInCluster = cluster.questions.every(q => !!userAnswers[q.questionNumber]);

  floatingBtn.classList.remove('hidden');
  if (isLastCluster && allAnsweredInCluster) {
    floatingBtn.innerHTML = '<span>Nộp bài & Xem kết quả</span> <i data-lucide="check-circle" class="w-4 h-4"></i>';
  } else {
    floatingBtn.innerHTML = '<span>Next question</span> <i data-lucide="chevron-right" class="w-4 h-4"></i>';
  }
  if (window.lucide) lucide.createIcons();
}

function parseExplanationSections(q, group) {
  const rawVi = typeof (q.explanationViHtml || q.transcriptViHtml || (group && group.transcriptViHtml) || '') === 'string'
    ? (q.explanationViHtml || q.transcriptViHtml || (group && group.transcriptViHtml) || '').trim() : '';
  const rawEn = typeof (q.explanationHtml || q.transcriptHtml || (group && group.transcriptHtml) || '') === 'string'
    ? (q.explanationHtml || q.transcriptHtml || (group && group.transcriptHtml) || '').trim() : '';

  let viData = null;
  let enData = null;

  if (rawVi.startsWith('#json-mode')) {
    try {
      viData = JSON.parse(rawVi.substring(10));
    } catch(e) {}
  }
  if (rawEn.startsWith('#json-mode')) {
    try {
      enData = JSON.parse(rawEn.substring(10));
    } catch(e) {}
  }

  // Canonical 5 sections of EstudyMe (Matches media_1794824421115_8b36f99e.jpg etc.)
  const canonicalOrder = [
    { key: 'Chiến Thuật Làm Bài', altKey: 'Strategy', defaultTitle: 'Chiến Thuật Làm Bài' },
    { key: 'Bản Dịch', altKey: 'Transcript', defaultTitle: 'Bản Dịch & Transcript Song Ngữ' },
    { key: 'Đáp Án & Phân Tích', altKey: 'Answers & Analysis', defaultTitle: 'Đáp Án & Phân Tích' },
    { key: 'Từ Vựng Cần Nhớ', altKey: 'Vocabulary Builder', defaultTitle: 'Từ Vựng Cần Nhớ' },
    { key: 'Ngữ Pháp', altKey: 'Grammar Focus', defaultTitle: 'Ngữ Pháp' }
  ];

  const sections = [];

  if (viData || enData) {
    const dataSource = viData || {};
    const fallbackSource = enData || {};

    let index = 1;
    for (const c of canonicalOrder) {
      if (c.key === 'Bản Dịch') {
        const viTrans = dataSource['Bản Dịch'] || fallbackSource['Bản Dịch'] || '';
        const enTrans = fallbackSource['Transcript'] || dataSource['Transcript'] || '';

        if (viTrans && enTrans) {
          sections.push({
            num: index++,
            title: 'Bản Dịch & Transcript Song Ngữ',
            content: `
              <div class="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80">
                <div class="prose max-w-none text-xs sm:text-sm text-slate-800 border-b md:border-b-0 md:border-r border-slate-200/90 pb-3 md:pb-0 md:pr-4">
                  <div class="font-extrabold text-xs uppercase tracking-wider text-[#5648ee] mb-2 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-[#5648ee]"></span> Transcript:
                  </div>
                  <div class="leading-relaxed text-slate-800">${enTrans}</div>
                </div>
                <div class="prose max-w-none text-xs sm:text-sm text-slate-700">
                  <div class="font-extrabold text-xs uppercase tracking-wider text-emerald-600 mb-2 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Bản dịch:
                  </div>
                  <div class="leading-relaxed text-slate-700">${viTrans}</div>
                </div>
              </div>
            `
          });
          continue;
        } else if (viTrans || enTrans) {
          sections.push({
            num: index++,
            title: viTrans ? 'Bản Dịch' : 'Transcript',
            content: viTrans || enTrans
          });
          continue;
        }
      }

      const content = dataSource[c.key] || dataSource[c.altKey] || fallbackSource[c.key] || fallbackSource[c.altKey];
      if (content) {
        sections.push({
          num: index++,
          title: c.defaultTitle,
          content: content
        });
      }
    }

    // Check for any extra custom keys
    for (const [k, v] of Object.entries(dataSource)) {
      if (!canonicalOrder.some(c => c.key === k || c.altKey === k) && v) {
        sections.push({
          num: index++,
          title: k,
          content: v
        });
      }
    }
  }

  // If no json-mode was found, fallback to raw HTML
  if (sections.length === 0) {
    if (rawVi && rawEn) {
      // Both English Transcript and Vietnamese Translation are present
      const cleanEn = rawEn.replace(/^(<p[^>]*>)?\s*(<br\s*\/?>)?\s*(<b>|<strong>)?\s*(Transcript|Detailed Explanation)\s*:?\s*(<\/b>|<\/strong>)?\s*(<br\s*\/?>)?\s*/i, '$1').trim();
      const cleanVi = rawVi.replace(/^(<p[^>]*>)?\s*(<br\s*\/?>)?\s*(<b>|<strong>)?\s*(Bản dịch|Giải thích chi tiết)\s*:?\s*(<\/b>|<\/strong>)?\s*(<br\s*\/?>)?\s*/i, '$1').trim();

      const isListening = rawEn.toLowerCase().includes('transcript') || rawVi.toLowerCase().includes('bản dịch') || rawEn.includes('(A)') || !!(q.audioUrl || (group && group.audioUrl));
      const leftHeading = isListening ? 'Transcript:' : 'Giải thích (Tiếng Anh):';
      const rightHeading = isListening ? 'Bản dịch:' : 'Giải thích (Tiếng Việt):';

      sections.push({
        num: 1,
        title: isListening ? 'Transcript & Bản dịch Song Ngữ' : 'Giải thích chi tiết & Bản dịch Song Ngữ',
        content: `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80">
            <div class="prose max-w-none text-xs sm:text-sm text-slate-800 border-b md:border-b-0 md:border-r border-slate-200/90 pb-3 md:pb-0 md:pr-4">
              <div class="font-extrabold text-xs uppercase tracking-wider text-[#5648ee] mb-2 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-[#5648ee]"></span> ${leftHeading}
              </div>
              <div class="leading-relaxed text-slate-800">${cleanEn}</div>
            </div>
            <div class="prose max-w-none text-xs sm:text-sm text-slate-700">
              <div class="font-extrabold text-xs uppercase tracking-wider text-emerald-600 mb-2 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span> ${rightHeading}
              </div>
              <div class="leading-relaxed text-slate-700">${cleanVi}</div>
            </div>
          </div>
        `
      });
    } else if (rawVi) {
      sections.push({
        num: 1,
        title: 'Giải thích chi tiết & Bản dịch',
        content: rawVi
      });
    } else if (rawEn) {
      sections.push({
        num: 1,
        title: 'Transcript & Giải thích',
        content: rawEn
      });
    }
  }

  return sections;
}

function toggleAccordion(id) {
  const body = document.getElementById(`acc-body-${id}`);
  const icon = document.getElementById(`acc-icon-${id}`);
  if (!body) return;

  const isHidden = body.classList.contains('hidden');
  if (isHidden) {
    body.classList.remove('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-up');
  } else {
    body.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-down');
  }
  if (window.lucide) lucide.createIcons();
}

function toggleExamDrawer(forceState) {
  const drawer = document.getElementById('exam-palette-drawer');
  const icon = document.getElementById('exam-drawer-icon');
  if (!drawer) return;

  const isHidden = drawer.classList.contains('hidden');
  const shouldOpen = typeof forceState === 'boolean' ? forceState : isHidden;

  if (shouldOpen) {
    drawer.classList.remove('hidden');
    renderExamPalette();
    if (icon) icon.setAttribute('data-lucide', 'chevron-down');
  } else {
    drawer.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-up');
  }
  if (window.lucide) lucide.createIcons();
}

let currentPaletteFilter = 'all';

function renderExamPalette(filterPart) {
  if (filterPart !== undefined) currentPaletteFilter = filterPart;
  const grid = document.getElementById('exam-palette-grid');
  if (!grid) return;

  const isFullOrMini = flatQuestions.length >= 90;
  if (!isFullOrMini) {
    grid.className = 'grid grid-cols-6 sm:grid-cols-10 gap-2 max-h-64 overflow-y-auto p-1';
    grid.innerHTML = flatQuestions.map((item, idx) => {
      const qNum = item.question.questionNumber;
      const userAns = userAnswers[qNum];
      const correctLetter = getCorrectLetter(item.question.correctAnswer);
      const isCurrent = idx === activeQuestionIndex;
      const isFlagged = flaggedQuestions.has(qNum);

      let bg = 'bg-slate-100 text-slate-700 border-slate-200';
      if (userAns) {
        if (isPracticeMode) {
          if (userAns === correctLetter) bg = 'bg-emerald-500 text-white border-emerald-600';
          else bg = 'bg-rose-500 text-white border-rose-600';
        } else {
          bg = 'bg-[#5648ee] text-white border-[#5648ee]';
        }
      }
      const ring = isCurrent ? 'ring-2 ring-[#5648ee] ring-offset-2' : '';
      const flagDot = isFlagged ? '<span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-white"></span>' : '';

      return `
        <button onclick="jumpToExamQuestion(${idx})" class="relative h-9 rounded-xl border font-black text-xs transition flex items-center justify-center ${bg} ${ring}">
          ${idx + 1}
          ${flagDot}
        </button>
      `;
    }).join('');
    return;
  }

  // Multi-part TOEIC Exam: Grouped cleanly by Part!
  grid.className = 'flex flex-col gap-4 max-h-[60vh] overflow-y-auto p-1';

  const parts = TOEIC_PARTS_INFO.map(p => {
    const questions = flatQuestions.map((fq, idx) => ({ ...fq, flatIdx: idx }))
      .filter(fq => fq.question.questionNumber >= p.startQ && fq.question.questionNumber <= p.endQ);
    const answeredCount = questions.filter(fq => !!userAnswers[fq.question.questionNumber]).length;
    return { ...p, questions, answeredCount };
  });

  // Top Filter Tabs (Jump or isolate a Part)
  const tabsHtml = `
    <div class="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-100 flex-shrink-0">
      <button onclick="renderExamPalette('all')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${currentPaletteFilter === 'all' ? 'bg-[#5648ee] text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
        Tất cả (${flatQuestions.length})
      </button>
      ${parts.map(p => `
        <button onclick="renderExamPalette(${p.part})" class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${currentPaletteFilter === p.part ? 'bg-[#5648ee] text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
          <span>${p.shortName}</span>
          <span class="text-[10px] font-black ${p.answeredCount === p.totalQ ? 'text-emerald-500' : 'opacity-70'}">(${p.answeredCount}/${p.totalQ})</span>
        </button>
      `).join('')}
    </div>
  `;

  const partsToRender = currentPaletteFilter === 'all' ? parts : parts.filter(p => p.part === currentPaletteFilter);

  const sectionsHtml = partsToRender.map(p => {
    const btns = p.questions.map(item => {
      const qNum = item.question.questionNumber;
      const userAns = userAnswers[qNum];
      const correctLetter = getCorrectLetter(item.question.correctAnswer);
      const isCurrent = item.flatIdx === activeQuestionIndex;
      const isFlagged = flaggedQuestions.has(qNum);

      let bg = 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300';
      if (userAns) {
        if (isPracticeMode) {
          if (userAns === correctLetter) bg = 'bg-emerald-500 text-white border-emerald-600';
          else bg = 'bg-rose-500 text-white border-rose-600';
        } else {
          bg = 'bg-[#5648ee] text-white border-[#5648ee]';
        }
      }
      const ring = isCurrent ? 'ring-2 ring-[#5648ee] ring-offset-2' : '';
      const flagDot = isFlagged ? '<span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border border-white"></span>' : '';

      return `
        <button onclick="jumpToExamQuestion(${item.flatIdx})" class="relative h-9 rounded-xl border font-black text-xs transition flex items-center justify-center cursor-pointer ${bg} ${ring}" title="Câu hỏi ${qNum}">
          ${qNum}
          ${flagDot}
        </button>
      `;
    }).join('');

    return `
      <div class="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3">
        <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-100 text-[#5648ee]">${p.shortName}</span>
            <span class="text-xs font-black text-slate-800">${p.name} (Câu ${p.startQ} - ${p.endQ})</span>
          </div>
          <span class="text-[11px] font-bold text-slate-500">Đã làm: <strong class="text-[#5648ee] font-black">${p.answeredCount}/${p.totalQ}</strong></span>
        </div>
        <div class="grid grid-cols-6 sm:grid-cols-10 gap-2">
          ${btns}
        </div>
      </div>
    `;
  }).join('');

  grid.innerHTML = tabsHtml + sectionsHtml;
}

function jumpToExamQuestion(idx) {
  if (idx < 0 || idx >= flatQuestions.length) return;
  const item = flatQuestions[idx];
  if (item && item.clusterIndex !== undefined) {
    if (isSimulationMode || flatQuestions.length >= 180) {
      const qNum = item.question.questionNumber;
      jumpToSimulationQuestion(qNum);
      toggleExamDrawer(false);
      return;
    }
    activeClusterIndex = item.clusterIndex;
    renderActiveCluster();
    setTimeout(() => {
      scrollToQuestion(item.question.questionNumber);
    }, 150);
  }
  toggleExamDrawer(false);
}

function updateExamDock() {
  if (isSimulationMode || flatQuestions.length >= 180) {
    renderSimulationDock();
    return;
  }
  const dockSimulation = document.getElementById('exam-dock-simulation');
  if (dockSimulation) dockSimulation.classList.add('hidden');

  if (testClusters.length === 0) return;

  const isMultiQuestionClustered = testClusters.some(c => c.questions.length > 1);
  const clusteredDock = document.getElementById('exam-dock-clustered');
  const singleDock = document.getElementById('exam-dock-single');

  // Compute total counts
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalAnswered = 0;
  const totalQuestions = flatQuestions.length;

  flatQuestions.forEach(item => {
    const q = item.question;
    const u = userAnswers[q.questionNumber];
    const correctLetter = getCorrectLetter(q.correctAnswer);
    if (u) {
      totalAnswered++;
      if (u === correctLetter) totalCorrect++;
      else totalWrong++;
    }
  });
  const totalUnanswered = totalQuestions - totalAnswered;

  if (isMultiQuestionClustered && clusteredDock && singleDock) {
    singleDock.classList.add('hidden');
    clusteredDock.classList.remove('hidden');

    clusteredDock.innerHTML = `
      <div class="flex items-stretch overflow-x-auto divide-x divide-slate-200/80 flex-1 py-1">
        ${testClusters.map((cluster, cIdx) => {
          const isActive = cIdx === activeClusterIndex;
          let cCorrect = 0;
          let cWrong = 0;
          let cAnswered = 0;
          const cTotal = cluster.questions.length;

          cluster.questions.forEach(q => {
            const u = userAnswers[q.questionNumber];
            const correctLetter = getCorrectLetter(q.correctAnswer);
            if (u) {
              cAnswered++;
              if (u === correctLetter) cCorrect++;
              else cWrong++;
            }
          });
          const cUnanswered = cTotal - cAnswered;
          const allDone = cAnswered === cTotal;

          if (isActive) {
            return `
              <div class="flex-shrink-0 px-4 py-1.5 bg-indigo-50/70 border-b-2 border-[#5648ee] min-w-[210px]">
                <div class="flex items-center justify-between text-xs font-black text-slate-900 mb-1">
                  <span>Câu hỏi ${cluster.startQNum}-${cluster.endQNum}</span>
                  ${allDone ? '<span class="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">✓</span>' : ''}
                </div>
                <div class="flex items-center gap-2.5 text-[11px] font-bold mb-1.5">
                  <span class="text-emerald-700 flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> ${cCorrect}/${cTotal} Đúng</span>
                  <span class="text-rose-700 flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-rose-500"></span> ${cWrong}/${cTotal} Sai</span>
                  <span class="text-slate-500 flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-slate-300"></span> ${cUnanswered}/${cTotal} Chưa</span>
                </div>
                <div class="flex items-center gap-1.5">
                  ${cluster.questions.map(q => {
                    const u = userAnswers[q.questionNumber];
                    const correctLetter = getCorrectLetter(q.correctAnswer);
                    let circleStyle = 'bg-slate-100 text-slate-700 border-slate-300';
                    if (u) {
                      if (u === correctLetter) circleStyle = 'bg-emerald-500 text-white border-emerald-500';
                      else circleStyle = 'bg-rose-500 text-white border-rose-500';
                    }
                    return `<button onclick="scrollToQuestion(${q.questionNumber})" class="w-6 h-6 rounded-full border text-xs font-black flex items-center justify-center transition cursor-pointer ${circleStyle}">${q.questionNumber}</button>`;
                  }).join('')}
                </div>
              </div>
            `;
          } else {
            return `
              <div onclick="switchCluster(${cIdx})" class="flex-shrink-0 px-4 py-1.5 hover:bg-slate-50 cursor-pointer min-w-[130px] flex flex-col justify-center transition">
                <div class="text-xs font-bold text-slate-700">Câu hỏi ${cluster.startQNum}-${cluster.endQNum}</div>
                <div class="text-[11px] font-medium text-slate-400 mt-1">${cAnswered}/${cTotal} Câu hỏi</div>
              </div>
            `;
          }
        }).join('')}
      </div>

      <!-- Right controls: Drawer toggle + Submit -->
      <div class="flex-shrink-0 flex items-center gap-2 px-3 bg-white ml-auto border-l border-slate-200">
        <button onclick="toggleExamDrawer()" class="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition shadow-2xs" title="Xem bảng câu hỏi">
          <i id="exam-drawer-icon-clustered" data-lucide="chevron-up" class="w-4 h-4"></i>
        </button>
        <button onclick="submitExam()" class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition">
          Nộp bài
        </button>
      </div>
    `;
  } else if (singleDock && clusteredDock) {
    clusteredDock.classList.add('hidden');
    singleDock.classList.remove('hidden');

    const rangeEl = document.getElementById('exam-dock-range');
    const correctEl = document.getElementById('exam-dock-correct');
    const wrongEl = document.getElementById('exam-dock-wrong');
    const unansEl = document.getElementById('exam-dock-unanswered');

    if (rangeEl) rangeEl.textContent = `1-${totalQuestions}`;
    if (correctEl) correctEl.textContent = `${totalCorrect}/${totalQuestions}`;
    if (wrongEl) wrongEl.textContent = `${totalWrong}/${totalQuestions}`;
    if (unansEl) unansEl.textContent = `${totalUnanswered}/${totalQuestions}`;
  }

  if (window.lucide) lucide.createIcons();
}

function prevQuestion() {
  if (activeQuestionIndex > 0) {
    activeQuestionIndex--;
    renderActiveQuestion();
  }
}

function nextQuestion() {
  if (activeQuestionIndex < flatQuestions.length - 1) {
    activeQuestionIndex++;
    renderActiveQuestion();
  }
}

function jumpToQuestion(index) {
  if (index >= 0 && index < flatQuestions.length) {
    activeQuestionIndex = index;
    renderActiveQuestion();
  }
}

function rewindAudio(seconds) {
  const a = document.getElementById('exam-audio');
  if (a) a.currentTime = Math.max(0, a.currentTime - seconds);
}

function setAudioSpeed(val) {
  const a = document.getElementById('exam-audio');
  if (a) a.playbackRate = parseFloat(val);
}

function changePassageFontSize(delta) {
  passageFontSize = Math.max(12, Math.min(22, passageFontSize + delta));
  const el = document.getElementById('exam-passage-text');
  if (el) el.style.fontSize = `${passageFontSize}px`;
}

function togglePracticeExplanation() {
  const explainBox = document.getElementById('practice-explanation');
  if (explainBox.classList.contains('hidden')) {
    showPracticeExplanationBox();
  } else {
    explainBox.classList.add('hidden');
  }
}

// Quick jump buttons for Parts
function renderPalettePartsJump() {
  const container = document.getElementById('palette-parts-jump');
  if (!container) return;

  const parts = [
    { label: 'P1', q: 1 },
    { label: 'P2', q: 7 },
    { label: 'P3', q: 32 },
    { label: 'P4', q: 71 },
    { label: 'P5', q: 101 },
    { label: 'P6', q: 131 },
    { label: 'P7', q: 147 },
  ];

  container.innerHTML = parts.map(p => {
    // Check if question exists in this test
    const foundIdx = flatQuestions.findIndex(item => item.question.questionNumber >= p.q);
    if (foundIdx === -1) return '';

    return `
      <button onclick="jumpToQuestion(${foundIdx})" class="px-2 py-1 rounded bg-slate-100 hover:bg-indigo-50 hover:text-[#5648ee] transition">
        ${p.label}
      </button>
    `;
  }).join('');
}

// ================= QUESTION PALETTE =================

function renderQuestionPalette() {
  const grid = document.getElementById('palette-grid');
  if (!grid) return;

  grid.innerHTML = flatQuestions.map((item, idx) => {
    const qNum = item.question.questionNumber;
    return `
      <button onclick="jumpToQuestion(${idx})" id="palette-btn-${qNum}" class="palette-btn">
        ${qNum}
      </button>
    `;
  }).join('');

  updateQuestionPalette();
}

function updateQuestionPalette() {
  const answeredCount = Object.keys(userAnswers).length;
  document.getElementById('palette-answered-count').textContent = answeredCount;
  document.getElementById('palette-total-count').textContent = flatQuestions.length;

  flatQuestions.forEach((item, idx) => {
    const qNum = item.question.questionNumber;
    const btn = document.getElementById(`palette-btn-${qNum}`);
    if (!btn) return;

    btn.className = 'palette-btn';

    if (userAnswers[qNum]) {
      btn.classList.add('answered');
    }
    if (flaggedQuestions.has(qNum)) {
      btn.classList.add('flagged');
    }
    if (idx === activeQuestionIndex) {
      btn.classList.add('active-q');
    }
  });
}

// ================= SUBMIT & RESULT ENGINE =================

async function submitExam(force = false) {
  const answeredCount = Object.keys(userAnswers).length;
  const totalCount = flatQuestions.length;
  const unansweredCount = totalCount - answeredCount;

  if (!force && unansweredCount > 0) {
    const ok = confirm(`Bạn còn ${unansweredCount} câu chưa làm. Bạn có chắc chắn muốn nộp bài ngay bây giờ?`);
    if (!ok) return;
  }

  if (examTimer) clearInterval(examTimer);

  try {
    const resp = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testId: currentTest.topicId,
        testTitle: currentTest.title,
        userAnswers,
        totalQuestions: totalCount,
        timeSpentSeconds,
        testType: totalCount >= 180 ? 'full' : (totalCount >= 90 ? 'mini' : 'practice')
      })
    });

    if (!resp.ok) throw new Error('Không thể nộp bài');
    lastResult = await resp.json();

    displayResultView(lastResult);
  } catch (err) {
    alert('Lỗi nộp bài: ' + err.message);
  }
}

function displayResultView(result) {
  showView('result');

  document.getElementById('result-test-title').textContent = result.testTitle;
  const mins = Math.floor(result.timeSpentSeconds / 60);
  document.getElementById('result-date').textContent = `${new Date(result.date).toLocaleDateString('vi-VN')} • Thời gian làm bài: ${mins} phút`;

  const totalScoreVal = typeof result.score.totalScore === 'number' 
    ? result.score.totalScore 
    : result.score.totalScore;
  document.getElementById('result-total-score').textContent = totalScoreVal;

  document.getElementById('result-l-score').textContent = typeof result.score.listeningScore === 'number' ? `${result.score.listeningScore} pts` : '--';
  document.getElementById('result-r-score').textContent = typeof result.score.readingScore === 'number' ? `${result.score.readingScore} pts` : '--';

  document.getElementById('result-l-correct').textContent = `${result.listeningCorrect}/100 câu`;
  document.getElementById('result-r-correct').textContent = `${result.readingCorrect}/100 câu`;

  document.getElementById('result-correct-count').textContent = result.correctCount;
  document.getElementById('result-wrong-count').textContent = result.wrongCount;
  document.getElementById('result-skipped-count').textContent = result.skippedCount;

  const pct = Math.round((result.correctCount / result.totalQuestions) * 100);
  document.getElementById('result-accuracy-pct').textContent = `${pct}%`;

  // === PRO FEATURES (Exact Match Image 2) ===
  const proBannerScore = document.getElementById('pro-banner-score');
  if (proBannerScore) proBannerScore.textContent = totalScoreVal;

  const proWrongBadge = document.getElementById('pro-wrong-badge-count');
  const totalWrongAndSkipped = (result.wrongCount || 0) + (result.skippedCount || 0);
  if (proWrongBadge) proWrongBadge.textContent = totalWrongAndSkipped;

  // Render 7-Part Detailed Analytics
  renderProPartsBreakdown(result);

  if (window.lucide) lucide.createIcons();
}

// ================= PRO ANALYSIS FEATURES =================

function renderProPartsBreakdown(result) {
  const container = document.getElementById('pro-parts-breakdown-grid');
  if (!container) return;

  const detailed = result.detailedResults || [];
  const partAdviceMap = {
    1: 'Mẹo: Quan sát kỹ chủ thể, hành động và vị trí đồ vật trung tâm trong ảnh. Cẩn thận bẫy từ đồng âm & thì tiếp diễn bị động.',
    2: 'Mẹo: Nghe kỹ từ để hỏi (Who, Where, When, Why, How). Chú ý các câu trả lời gián tiếp hoặc hỏi ngược lại thường xuất hiện.',
    3: 'Mẹo: Đọc lướt 3 câu hỏi trước khi audio phát. Chú ý các lượt đổi giọng giữa người nói nam và nữ để bắt đúng keyword.',
    4: 'Mẹo: Tập trung vào mục đích bài nói ở câu đầu tiên, chi tiết số liệu, bảng biểu và yêu cầu hành động ở câu cuối.',
    5: 'Mẹo: Xác định từ loại cần điền (danh từ, động từ, tính từ, trạng từ) trước khi dịch nghĩa từ vựng để tiết kiệm thời gian.',
    6: 'Mẹo: Đọc cả câu trước và câu sau chỗ trống để nắm ngữ cảnh liên kết đoạn văn, đặc biệt với dạng câu điền cả câu văn.',
    7: 'Mẹo: Với bài đọc kép và đọc ba, chú ý các thông tin chéo liên kết giữa email, thông báo và hóa đơn hoặc lịch trình.'
  };

  const partSlugMap = {
    1: 'part-1-photos',
    2: 'part-2-question-response',
    3: 'part-3-conversations',
    4: 'part-4-short-talks',
    5: 'part-5-incomplete-sentences',
    6: 'part-6-text-completion',
    7: 'part-7-single-passages'
  };

  container.innerHTML = TOEIC_PARTS_INFO.map(p => {
    const qList = detailed.filter(d => d.questionNumber >= p.startQ && d.questionNumber <= p.endQ);
    const total = p.totalQ;
    const correct = qList.filter(d => d.isCorrect).length;
    const wrong = qList.filter(d => !d.isCorrect && d.userAnswer).length;
    const skipped = total - correct - wrong;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    let statusText = 'Cần ôn tập';
    let statusColor = 'text-rose-600 bg-rose-50 border-rose-200';
    let barColor = 'bg-rose-500';
    if (pct >= 80) {
      statusText = 'Thế mạnh';
      statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      barColor = 'bg-emerald-500';
    } else if (pct >= 50) {
      statusText = 'Trung bình';
      statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
      barColor = 'bg-amber-500';
    }

    return `
      <div class="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/90 hover:border-indigo-300 transition flex flex-col justify-between shadow-2xs">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="font-extrabold text-xs sm:text-sm text-slate-800">${p.name}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black border ${statusColor}">${statusText}</span>
          </div>
          <div class="flex items-center justify-between text-xs text-slate-600 mb-1.5">
            <span>Đúng <strong>${correct}/${total}</strong> câu (${wrong} sai, ${skipped} bỏ qua)</span>
            <span class="font-black text-slate-900">${pct}%</span>
          </div>
          <div class="w-full h-2 rounded-full bg-slate-200 overflow-hidden mb-3">
            <div class="h-full rounded-full transition-all duration-500 ${barColor}" style="width: ${pct}%"></div>
          </div>
          <div class="text-[11px] text-slate-500 leading-relaxed mb-4 bg-white p-2.5 rounded-xl border border-slate-200/60">
            ${partAdviceMap[p.part] || ''}
          </div>
        </div>
        <button onclick="switchTab('practice'); openPracticeSubtopicsModal('${partSlugMap[p.part]}')" class="w-full py-2 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 text-[#5648ee] font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer">
          <i data-lucide="zap" class="w-3.5 h-3.5 text-[#5648ee]"></i>
          <span>Luyện tập riêng ${p.shortName}</span>
        </button>
      </div>
    `;
  }).join('');
}

let proAnalysisCollapsed = false;

function toggleProAnalysisSection(forceOpen) {
  const content = document.getElementById('pro-analysis-content');
  const chevron = document.getElementById('pro-analysis-chevron');
  if (!content) return;

  if (forceOpen === true) {
    proAnalysisCollapsed = false;
    content.classList.remove('hidden');
    if (chevron) chevron.setAttribute('data-lucide', 'chevron-up');
    content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    proAnalysisCollapsed = !proAnalysisCollapsed;
    if (proAnalysisCollapsed) {
      content.classList.add('hidden');
      if (chevron) chevron.setAttribute('data-lucide', 'chevron-down');
    } else {
      content.classList.remove('hidden');
      if (chevron) chevron.setAttribute('data-lucide', 'chevron-up');
    }
  }
  if (window.lucide) lucide.createIcons();
}

function revealProPartDetails() {
  toggleProAnalysisSection(true);
  const grid = document.getElementById('pro-parts-breakdown-grid');
  if (grid) {
    grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function retakeCurrentTest() {
  if (currentTest) {
    if (isSimulationMode) {
      startSimulationTest(currentTest.topicId, currentTest.title);
    } else {
      startTest(currentTest.topicId, currentTest.title, isPracticeMode, false);
    }
  }
}

function confirmExitExam() {
  const ok = confirm('Bạn có chắc chắn muốn rời bài thi? Tiến trình hiện tại sẽ không được lưu.');
  if (ok) {
    if (examTimer) {
      clearInterval(examTimer);
      examTimer = null;
    }
    isSimulationMode = false;
    isSimulationPaused = false;
    showView('home');
  }
}

// ================= REVIEW MODE =================

function startReviewMode() {
  if (!lastResult) return;
  showView('review');
  document.getElementById('review-title').textContent = `Chi tiết lời giải: ${lastResult.testTitle}`;
  filterReview('all');
}

function filterReview(filterType) {
  currentReviewFilter = filterType;

  ['all', 'wrong', 'correct'].forEach(t => {
    const btn = document.getElementById(`btn-review-${t}`);
    if (btn) {
      if (t === filterType) {
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-[#5648ee] text-white transition';
      } else {
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
      }
    }
  });

  renderReviewList();
}

let allReviewExplanationsCollapsed = false;

function toggleAllReviewAccordions() {
  allReviewExplanationsCollapsed = !allReviewExplanationsCollapsed;
  const groups = document.querySelectorAll('#review-list-container .review-accordions-group');
  const textEl = document.getElementById('text-toggle-all-review');
  
  groups.forEach(g => {
    if (allReviewExplanationsCollapsed) g.classList.add('hidden');
    else g.classList.remove('hidden');
  });

  const questionButtons = document.querySelectorAll('#review-list-container [id^="review-toggle-text-"]');
  questionButtons.forEach(btn => {
    btn.textContent = allReviewExplanationsCollapsed ? 'Xem giải thích' : 'Ẩn giải thích';
  });

  const questionIcons = document.querySelectorAll('#review-list-container [id^="review-toggle-icon-"]');
  questionIcons.forEach(icon => {
    icon.setAttribute('data-lucide', allReviewExplanationsCollapsed ? 'chevron-right' : 'chevron-down');
  });

  if (textEl) {
    textEl.textContent = allReviewExplanationsCollapsed ? 'Mở tất cả lời giải' : 'Thu gọn tất cả';
  }
  if (window.lucide) lucide.createIcons();
}

function toggleReviewQuestionAccordions(qNum) {
  const group = document.getElementById(`review-accordions-group-${qNum}`);
  const textEl = document.getElementById(`review-toggle-text-${qNum}`);
  const iconEl = document.getElementById(`review-toggle-icon-${qNum}`);
  if (!group) return;

  const isHidden = group.classList.contains('hidden');
  if (isHidden) {
    group.classList.remove('hidden');
    if (textEl) textEl.textContent = 'Ẩn giải thích';
    if (iconEl) iconEl.setAttribute('data-lucide', 'chevron-down');
  } else {
    group.classList.add('hidden');
    if (textEl) textEl.textContent = 'Xem giải thích';
    if (iconEl) iconEl.setAttribute('data-lucide', 'chevron-right');
  }
  if (window.lucide) lucide.createIcons();
}

function renderReviewList() {
  const container = document.getElementById('review-list-container');
  if (!container || !lastResult) return;

  const list = lastResult.detailedResults.filter(r => {
    if (currentReviewFilter === 'wrong') return !r.isCorrect;
    if (currentReviewFilter === 'correct') return r.isCorrect;
    return true;
  });

  if (list.length === 0) {
    container.innerHTML = `
      <div class="bg-white p-10 rounded-3xl text-center text-slate-500 font-bold border border-slate-200 shadow-2xs">
        <i data-lucide="check-circle" class="w-12 h-12 mx-auto text-emerald-500 stroke-1 mb-2"></i>
        Không có câu hỏi nào trong danh mục này.
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = list.map(q => {
    const isCorrect = q.isCorrect;
    const correctLetter = getCorrectLetter(q.correctAnswer);
    const userAnsLetter = q.userAnswer ? getCorrectLetter(q.userAnswer) : '';
    const isSkipped = !userAnsLetter;

    // Header badge & status
    let badgeClass = 'bg-rose-100 text-rose-800';
    let statusText = '✕ Sai';
    let borderClass = 'border-rose-200/90';

    if (isCorrect) {
      badgeClass = 'bg-emerald-100 text-emerald-800';
      statusText = '✓ Đúng';
      borderClass = 'border-emerald-200/90';
    } else if (isSkipped) {
      badgeClass = 'bg-slate-100 text-slate-600';
      statusText = '○ Chưa làm';
      borderClass = 'border-slate-200/90';
    }

    const userPickDisplay = userAnsLetter ? `(${userAnsLetter})` : 'Chưa chọn';
    const userPickColor = isCorrect ? 'text-emerald-700 font-black' : (isSkipped ? 'text-slate-400 font-bold' : 'text-rose-600 font-black');

    // Media
    const cleanImg = sanitizeMediaUrl(q.imageUrl);
    const cleanAudio = sanitizeMediaUrl(q.audioUrl);

    const imageHtml = cleanImg ? `
      <div class="mb-5 text-center">
        <div class="inline-block p-1.5 bg-slate-50 border border-slate-200/90 rounded-2xl shadow-2xs">
          <img src="${cleanImg}" class="max-h-72 rounded-xl object-contain mx-auto" alt="TOEIC Question Photo">
        </div>
      </div>
    ` : '';

    const audioHtml = cleanAudio ? `
      <div class="mb-5 bg-slate-50/90 p-3 rounded-2xl border border-slate-200">
        <audio controls src="${cleanAudio}" class="w-full h-8"></audio>
      </div>
    ` : '';

    const passageHtml = q.passageHtml ? `
      <div class="mb-5 p-5 rounded-2xl bg-amber-50/40 border border-amber-200/70 text-slate-800 text-sm leading-relaxed prose max-w-none">
        ${q.passageHtml}
      </div>
    ` : '';

    const promptHtml = q.questionText ? `
      <div class="font-extrabold text-slate-900 mb-4 text-base">${q.questionText}</div>
    ` : '';

    // Choices
    const choicesList = normalizeChoices(q.choices);
    const choicesHtml = choicesList.map(c => {
      const letter = c.letter || 'A';
      const text = (c.text || '').trim();
      const isAudioOnly = !text;
      const isRealAns = letter === correctLetter;
      const isUserPick = letter === userAnsLetter;

      let cardStyle = 'border-slate-200/90 bg-white text-slate-700';
      let tagHtml = '';

      if (isRealAns && isUserPick) {
        cardStyle = 'border-emerald-500 bg-emerald-50/80 text-emerald-950 shadow-2xs';
        tagHtml = '<span class="text-xs font-black text-emerald-700 bg-emerald-100/90 px-2.5 py-1 rounded-xl flex items-center gap-1">✓ Bạn chọn đúng</span>';
      } else if (isRealAns) {
        cardStyle = 'border-emerald-500 bg-emerald-50/50 text-emerald-950 shadow-2xs';
        tagHtml = '<span class="text-xs font-black text-emerald-700 bg-emerald-100/90 px-2.5 py-1 rounded-xl flex items-center gap-1">✓ Đáp án đúng</span>';
      } else if (isUserPick) {
        cardStyle = 'border-rose-400 bg-rose-50/80 text-rose-950 shadow-2xs';
        tagHtml = '<span class="text-xs font-black text-rose-700 bg-rose-100/90 px-2.5 py-1 rounded-xl flex items-center gap-1">✕ Bạn chọn</span>';
      }

      const displayLabel = isAudioOnly ? `(${letter})` : `<strong class="font-black mr-2 text-slate-900">(${letter})</strong> ${text}`;

      return `
        <div class="p-3.5 sm:p-4 rounded-2xl border text-sm flex items-center justify-between transition ${cardStyle}">
          <span class="font-medium">${displayLabel}</span>
          ${tagHtml}
        </div>
      `;
    }).join('');

    // Explanations (5 canonical accordions)
    const sections = parseExplanationSections(q);
    let explanationBlock = '';

    if (sections.length > 0) {
      explanationBlock = `
        <div class="mt-5 pt-4 border-t border-slate-100">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#5648ee]">
              <i data-lucide="book-open" class="w-4 h-4"></i> Lời giải chi tiết & Phân tích đáp án
            </div>
            <button type="button" onclick="toggleReviewQuestionAccordions(${q.questionNumber})" class="text-xs font-bold text-[#5648ee] hover:underline flex items-center gap-1 cursor-pointer">
              <span id="review-toggle-text-${q.questionNumber}">Ẩn giải thích</span>
              <i id="review-toggle-icon-${q.questionNumber}" data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
            </button>
          </div>

          <div id="review-accordions-group-${q.questionNumber}" class="review-accordions-group flex flex-col gap-3">
            ${sections.map((sec, idx) => `
              <div class="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
                <button type="button" onclick="toggleAccordion('rev-${q.questionNumber}-${idx}')" class="w-full p-3.5 sm:p-4 flex items-center justify-between text-left hover:bg-slate-50/70 transition cursor-pointer">
                  <div class="flex items-center gap-3">
                    <span class="w-6 h-6 rounded-full bg-[#5648ee] text-white flex items-center justify-center text-xs font-black flex-shrink-0">
                      ${sec.num}
                    </span>
                    <span class="text-sm font-black text-slate-900">${sec.title}</span>
                  </div>
                  <i id="acc-icon-rev-${q.questionNumber}-${idx}" data-lucide="chevron-up" class="w-4 h-4 text-slate-400 transition-transform"></i>
                </button>
                <div id="acc-body-rev-${q.questionNumber}-${idx}" class="acc-content px-5 pb-5 pt-1 text-sm text-slate-700 leading-relaxed border-t border-slate-100/60 overflow-x-auto">
                  ${sec.content}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="bg-white p-6 sm:p-7 rounded-3xl shadow-xs border ${borderClass}">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100">
          <div class="flex items-center gap-3">
            <span class="px-3.5 py-1 rounded-xl font-bold text-xs ${badgeClass}">
              Câu ${q.questionNumber}
            </span>
            <span class="text-xs font-extrabold ${isCorrect ? 'text-emerald-700' : (isSkipped ? 'text-slate-500' : 'text-rose-700')}">
              ${statusText}
            </span>
          </div>

          <div class="flex items-center gap-3 text-xs font-bold">
            <span class="text-slate-500">Bạn chọn: <b class="${userPickColor}">${userPickDisplay}</b></span>
            <span class="text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200/90 font-black">Đáp án đúng: <b>(${correctLetter})</b></span>
          </div>
        </div>

        ${passageHtml}
        ${promptHtml}
        ${imageHtml}
        ${audioHtml}

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          ${choicesHtml}
        </div>

        ${explanationBlock}
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ================= STUDY HISTORY & COMPREHENSIVE ACTIVITY LOGGER =================
let studyHistoryList = [];
let currentHistoryFilter = 'all';

async function recordStudyHistoryActivity(activity) {
  if (!activity || !activity.title) return;

  const payload = {
    type: activity.type || 'activity',
    title: activity.title,
    subtitle: activity.subtitle || '',
    badge: activity.badge || (activity.type === 'vocabulary' ? 'Từ vựng' : activity.type === 'grammar' ? 'Ngữ pháp' : 'Bài thi'),
    score: activity.score !== undefined ? activity.score : null,
    accuracy: typeof activity.accuracy === 'number' ? activity.accuracy : null,
    details: activity.details || {}
  };

  try {
    fetch('/api/history/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.error('Error posting history activity:', err));

    // Also update client memory
    const clientRecord = {
      ...payload,
      id: Date.now().toString(),
      date: new Date().toISOString()
    };
    
    // Check local duplicate within 3 mins
    const dupIdx = studyHistoryList.findIndex(h => 
      h.title === clientRecord.title && 
      h.type === clientRecord.type &&
      (Date.now() - new Date(h.date).getTime()) < 180000
    );
    if (dupIdx !== -1) {
      studyHistoryList[dupIdx] = clientRecord;
    } else {
      studyHistoryList.unshift(clientRecord);
    }
  } catch (err) {
    console.error('Error in recordStudyHistoryActivity:', err);
  }
}

async function loadStudyHistory() {
  const container = document.getElementById('history-container');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-12 text-slate-400">
      <div class="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <p class="font-bold text-xs text-slate-500">Đang tải nhật ký hoạt động...</p>
    </div>
  `;

  try {
    const resp = await fetch('/api/history');
    if (resp.ok) {
      studyHistoryList = await resp.json();
    }
  } catch (err) {
    console.error('Error fetching history:', err);
  }

  renderHistoryView();
}

function filterHistory(filterType) {
  currentHistoryFilter = filterType;

  // Update button active states
  document.querySelectorAll('.hist-filter-btn').forEach(btn => {
    btn.classList.remove('bg-[#5648ee]', 'text-white', 'shadow-xs');
    btn.classList.add('bg-slate-100', 'text-slate-700');
  });

  const activeBtn = document.getElementById(`hist-filter-${filterType}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-slate-100', 'text-slate-700');
    activeBtn.classList.add('bg-[#5648ee]', 'text-white', 'shadow-xs');
  }

  renderHistoryView();
}

function renderHistoryView() {
  const container = document.getElementById('history-container');
  const statsContainer = document.getElementById('history-summary-stats');
  if (!container) return;

  const totalActivities = studyHistoryList.length;
  const testCount = studyHistoryList.filter(item => (item.type === 'test' || !item.type)).length;
  const vocabCount = studyHistoryList.filter(item => item.type === 'vocabulary').length;
  const grammarCount = studyHistoryList.filter(item => item.type === 'grammar').length;

  // Render Stats Cards
  if (statsContainer) {
    statsContainer.innerHTML = `
      <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
        <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Tổng hoạt động</div>
        <div class="text-2xl font-black text-slate-900 mt-1">${totalActivities}</div>
      </div>
      <div class="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-100">
        <div class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500">Đề thi & Luyện tập</div>
        <div class="text-2xl font-black text-[#5648ee] mt-1">${testCount}</div>
      </div>
      <div class="p-3.5 rounded-2xl bg-orange-50/80 border border-orange-100">
        <div class="text-[10px] font-extrabold uppercase tracking-wider text-orange-500">Chủ đề từ vựng</div>
        <div class="text-2xl font-black text-orange-600 mt-1">${vocabCount}</div>
      </div>
      <div class="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-100">
        <div class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Ngữ pháp đã học</div>
        <div class="text-2xl font-black text-emerald-700 mt-1">${grammarCount}</div>
      </div>
    `;
  }

  // Filter items
  const filtered = studyHistoryList.filter(item => {
    if (currentHistoryFilter === 'all') return true;
    if (currentHistoryFilter === 'test') return (item.type === 'test' || !item.type);
    return item.type === currentHistoryFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 text-slate-400">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <i data-lucide="inbox" class="w-7 h-7 stroke-1"></i>
        </div>
        <p class="font-extrabold text-base text-slate-700">Chưa có dữ liệu cho mục này</p>
        <p class="text-xs text-slate-400 mt-1">Hãy bắt đầu học từ vựng, ngữ pháp hoặc làm bài thi thử để ghi lại lịch sử nhé!</p>
        <div class="flex items-center justify-center gap-3 mt-5 flex-wrap">
          <button onclick="switchTab('vocabulary')" class="px-4 py-2 rounded-xl bg-orange-500 text-white font-bold text-xs shadow-xs hover:bg-orange-600 transition cursor-pointer">
            Học từ vựng
          </button>
          <button onclick="switchTab('grammar')" class="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs hover:bg-emerald-700 transition cursor-pointer">
            Học ngữ pháp
          </button>
          <button onclick="switchTab('fulltest')" class="px-4 py-2 rounded-xl bg-[#5648ee] text-white font-bold text-xs shadow-xs hover:bg-indigo-600 transition cursor-pointer">
            Làm bài test
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="divide-y divide-slate-100">
      ${filtered.map(item => {
        const itemType = item.type || 'test';
        let badgeHtml = '';
        let iconHtml = '';
        let actionBtnHtml = '';

        if (itemType === 'vocabulary') {
          badgeHtml = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-100 text-orange-700">Từ vựng</span>`;
          iconHtml = `
            <div class="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center font-black flex-shrink-0">
              <i data-lucide="sparkles" class="w-5 h-5"></i>
            </div>
          `;
          const topicId = item.details?.topicId || '';
          const topicTitle = (item.details?.topicTitle || item.title).replace(/'/g, "\\'");
          actionBtnHtml = `
            <button onclick="startFlashcardSession('${topicId}', '${topicTitle}')" class="px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Học lại
            </button>
          `;
        } else if (itemType === 'grammar') {
          badgeHtml = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">Ngữ pháp</span>`;
          iconHtml = `
            <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-black flex-shrink-0">
              <i data-lucide="book-open" class="w-5 h-5"></i>
            </div>
          `;
          const lessonId = item.details?.lessonId || '';
          const lessonTitle = (item.details?.lessonTitle || item.title).replace(/'/g, "\\'");
          actionBtnHtml = `
            <button onclick="openLessonReader('${lessonId}', '${lessonTitle}')" class="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer">
              <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Xem lý thuyết
            </button>
          `;
        } else {
          badgeHtml = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-700">${item.badge || 'Bài thi'}</span>`;
          iconHtml = `
            <div class="w-10 h-10 rounded-xl bg-indigo-50 text-[#5648ee] border border-indigo-100 flex items-center justify-center font-black flex-shrink-0">
              <i data-lucide="award" class="w-5 h-5"></i>
            </div>
          `;
          const tId = item.testId || item.details?.testId || '';
          const tTitle = (item.testTitle || item.title || 'TOEIC Test').replace(/'/g, "\\'");
          actionBtnHtml = `
            <button onclick="startTest('${tId}', '${tTitle}', false)" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-[#5648ee] hover:text-white text-slate-700 font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer">
              <i data-lucide="play" class="w-3.5 h-3.5"></i> Làm lại
            </button>
          `;
        }

        const dateStr = item.date ? new Date(item.date).toLocaleString('vi-VN', {
          hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
        }) : 'Vừa xong';

        return `
          <div class="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-slate-50/70 p-3 rounded-2xl transition">
            <div class="flex items-start gap-3.5">
              ${iconHtml}
              <div>
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  ${badgeHtml}
                  <h4 class="font-bold text-sm sm:text-base text-slate-900 group-hover:text-[#5648ee] transition">${item.title || item.testTitle || 'Hoạt động'}</h4>
                </div>
                <div class="text-xs text-slate-500 font-medium">${item.subtitle || ''}</div>
                <div class="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <i data-lucide="clock" class="w-3 h-3"></i> ${dateStr}
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-5 pl-13 sm:pl-0">
              ${item.score !== null && item.score !== undefined ? `
                <div class="text-right">
                  <div class="text-xl sm:text-2xl font-black text-[#5648ee]">${item.score}</div>
                  ${item.accuracy !== null && item.accuracy !== undefined ? `
                    <div class="text-[10px] font-bold text-slate-500">Độ chính xác: ${item.accuracy}%</div>
                  ` : ''}
                </div>
              ` : ''}
              ${actionBtnHtml}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function replayExamAudio() {
  const player = document.getElementById('exam-audio-player');
  const playIcon = document.getElementById('exam-audio-play-icon');
  if (!player || !player.src) return;
  player.currentTime = 0;
  player.play().catch(e => console.log('Audio replay error:', e));
  if (playIcon) playIcon.setAttribute('data-lucide', 'pause');
  if (window.lucide) lucide.createIcons();
}

function replayQuizAudio() {
  const audioEl = document.getElementById('quiz-audio-element');
  const playIcon = document.getElementById('quiz-play-icon');
  if (!audioEl || !audioEl.src) return;
  audioEl.currentTime = 0;
  audioEl.play().catch(e => console.log('Quiz audio replay error:', e));
  if (playIcon) playIcon.setAttribute('data-lucide', 'pause');
  if (window.lucide) lucide.createIcons();
}

function navigateExamCluster(delta) {
  if (!Array.isArray(testClusters) || testClusters.length === 0) return;
  const nextIdx = activeClusterIndex + delta;
  if (nextIdx >= 0 && nextIdx < testClusters.length) {
    activeClusterIndex = nextIdx;
    if (isSimulationMode) {
      const targetCluster = testClusters[activeClusterIndex];
      if (targetCluster) {
        const qNum = targetCluster.startQNum;
        const pInfo = TOEIC_PARTS_INFO.find(p => qNum >= p.startQ && qNum <= p.endQ);
        if (pInfo && pInfo.part !== activeSimulationPart) {
          activeSimulationPart = pInfo.part;
        }
      }
    }
    renderActiveCluster();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Keyboard shortcuts for Exam & Flashcard
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore shortcuts if user is typing in an input/textarea
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target && e.target.tagName) || '')) return;

    // 1. Flashcard & Vocab Quiz Mode Shortcuts
    const flashcardView = document.getElementById('view-flashcard');
    if (flashcardView && !flashcardView.classList.contains('hidden')) {
      if (flashcardActiveMode === 'quiz') {
        const key = e.key.toUpperCase();
        const choiceMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, '1': 0, '2': 1, '3': 2, '4': 3 };
        if (key in choiceMap) {
          e.preventDefault();
          selectQuizChoice(choiceMap[key]);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prevQuizQuestion();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          nextQuizQuestion();
        } else if (e.code === 'Space') {
          e.preventDefault();
          toggleQuizAudio();
        } else if (key === 'R' || e.key === 'ArrowUp') {
          e.preventDefault();
          replayQuizAudio();
        }
        return;
      }

      if (e.code === 'Space' || e.key.toUpperCase() === 'F') {
        e.preventDefault();
        flipFlashcard();
      } else if (e.key === 'ArrowLeft' || e.key === '<' || e.key === ',') {
        e.preventDefault();
        prevFlashcard(); // Phím mũi tên trái hoặc < để quay về từ cũ
      } else if (e.key === 'ArrowRight' || e.key === '>' || e.key === '.') {
        e.preventDefault();
        nextFlashcard(); // Phím mũi tên phải hoặc > để sang từ tiếp theo
      } else if (e.key === '1') {
        e.preventDefault();
        markFlashcard(false); // Số 1: Chưa ghi nhớ
      } else if (e.key === '2') {
        e.preventDefault();
        markFlashcard(true); // Số 2: Đã ghi nhớ
      } else if (e.key === 'ArrowUp' || e.key.toUpperCase() === 'R') {
        e.preventDefault();
        playFlashcardAudio();
      }
      return;
    }

    // 2. Exam & Audio Practice Mode Shortcuts
    const examView = document.getElementById('view-exam');
    if (!examView || examView.classList.contains('hidden')) return;

    const key = e.key.toUpperCase();
    const numToLetter = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
    const chosenLetter = ['A', 'B', 'C', 'D'].includes(key) ? key : numToLetter[key];

    if (chosenLetter) {
      e.preventDefault();
      const cluster = testClusters[activeClusterIndex];
      if (cluster && Array.isArray(cluster.questions) && cluster.questions.length > 0) {
        const targetQ = cluster.questions.find(q => !userAnswers[q.questionNumber]) || cluster.questions[0];
        if (targetQ) {
          selectExamChoice(targetQ.questionNumber, chosenLetter);
        }
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateExamCluster(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateExamCluster(-1);
    } else if (e.code === 'Space') {
      const bar = document.getElementById('exam-card-audio-bar');
      if (bar && !bar.classList.contains('hidden')) {
        e.preventDefault();
        toggleExamAudio();
      }
    } else if (key === 'R') {
      const bar = document.getElementById('exam-card-audio-bar');
      if (bar && !bar.classList.contains('hidden')) {
        e.preventDefault();
        replayExamAudio();
      }
    }
  });
}

// ================= FLASHCARD & VOCAB QUIZ ENGINE (ESTUDYME MATCH) =================
let currentFlashcardTopicId = null;
let currentFlashcardTopicTitle = '';
let currentFlashcards = [];
let flashcardIndex = 0;
let flashcardStatus = {}; // { [cardId]: boolean (true: learned, false: unlearned) }
let flashcardFlags = new Set();
let flashcardActiveMode = 'study'; // 'study' or 'quiz'

// Vocab Quiz state
let quizQuestions = [];
let quizCurrentIndex = 0;
let quizAnswers = {}; // { [index]: { selectedIdx, isCorrect, chosenText } }
let quizFlags = new Set();
let quizAudioListenersAttached = false;

const fallbackVocabMeanings = [
  "thỏa thuận", "hợp đồng", "tuân thủ", "sự đảm bảo", "hủy bỏ", "xác định",
  "cam kết", "khẳng định", "bắt buộc", "các bên tham gia", "điều khoản",
  "giải quyết", "cụ thể", "tiến hành", "cung cấp dịch vụ", "đàm phán",
  "thanh toán", "thông báo", "yêu cầu", "sửa đổi, bổ sung", "bồi thường"
];

function switchFlashcardMode(mode) {
  flashcardActiveMode = mode;

  const studyPanel = document.getElementById('fc-study-panel');
  const quizPanel = document.getElementById('fc-quiz-panel');
  const dockStudy = document.getElementById('dock-study-content');
  const dockQuiz = document.getElementById('dock-quiz-content');
  const drawerToggleBtn = document.getElementById('quiz-drawer-toggle-btn');
  const studyBtn = document.getElementById('fc-mode-study-btn');
  const quizBtn = document.getElementById('fc-mode-quiz-btn');

  // Pause audio when switching
  const fcAudio = document.getElementById('fc-audio-element');
  if (fcAudio) fcAudio.pause();
  const quizAudio = document.getElementById('quiz-audio-element');
  if (quizAudio) quizAudio.pause();

  if (mode === 'study') {
    if (studyPanel) studyPanel.classList.remove('hidden');
    if (quizPanel) quizPanel.classList.add('hidden');
    if (dockStudy) dockStudy.classList.remove('hidden');
    if (dockQuiz) dockQuiz.classList.add('hidden');
    if (drawerToggleBtn) drawerToggleBtn.classList.add('hidden');
    toggleQuizDrawer(false);

    if (studyBtn) {
      studyBtn.className = 'px-3.5 sm:px-4 py-1.5 rounded-xl bg-white text-[#5648ee] shadow-2xs font-extrabold flex items-center gap-1.5 transition';
    }
    if (quizBtn) {
      quizBtn.className = 'px-3.5 sm:px-4 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 font-extrabold flex items-center gap-1.5 transition';
    }

    updateFlashcardOverview();
    renderCurrentFlashcard();
  } else {
    // Mode is 'quiz'
    if (studyPanel) studyPanel.classList.add('hidden');
    if (quizPanel) {
      quizPanel.classList.remove('hidden');
      quizPanel.style.display = 'flex';
    }
    if (dockStudy) dockStudy.classList.add('hidden');
    if (dockQuiz) dockQuiz.classList.remove('hidden');
    if (drawerToggleBtn) drawerToggleBtn.classList.remove('hidden');

    if (studyBtn) {
      studyBtn.className = 'px-3.5 sm:px-4 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 font-extrabold flex items-center gap-1.5 transition';
    }
    if (quizBtn) {
      quizBtn.className = 'px-3.5 sm:px-4 py-1.5 rounded-xl bg-white text-[#5648ee] shadow-2xs font-extrabold flex items-center gap-1.5 transition';
    }

    if (quizQuestions.length === 0) {
      initVocabQuiz();
    } else {
      renderCurrentQuizQuestion();
      updateQuizDock();
    }
  }

  if (window.lucide) lucide.createIcons();
}

async function startVocabQuizDirectly(topicId, topicTitle) {
  await startFlashcardSession(topicId, topicTitle);
  switchFlashcardMode('quiz');
}

function initVocabQuiz(retestWrongOnly = false) {
  let cards = currentFlashcards.slice();
  if (retestWrongOnly) {
    cards = quizQuestions.filter((q, idx) => quizAnswers[idx] && !quizAnswers[idx].isCorrect).map(q => q.sourceCard);
    if (cards.length === 0) cards = currentFlashcards.slice();
  }

  // Collect all distinct Vietnamese meanings available
  const allMeanings = Array.from(new Set(
    currentFlashcards.map(c => (c.meaningVi || c.meaningEn || '').trim()).filter(Boolean)
  ));

  quizQuestions = cards.map((card, idx) => {
    const correctMeaning = (card.meaningVi || card.meaningEn || '').trim();

    // Sample 3 distractors
    const otherMeanings = allMeanings.filter(m => m !== correctMeaning);
    let chosenDistractors = [];

    // Shuffle other meanings
    const shuffledOthers = otherMeanings.sort(() => 0.5 - Math.random());
    chosenDistractors.push(...shuffledOthers.slice(0, 3));

    // Fallback if not enough distractors
    if (chosenDistractors.length < 3) {
      const shuffledFallbacks = fallbackVocabMeanings.filter(m => m !== correctMeaning && !chosenDistractors.includes(m)).sort(() => 0.5 - Math.random());
      for (const fb of shuffledFallbacks) {
        if (chosenDistractors.length >= 3) break;
        chosenDistractors.push(fb);
      }
    }

    // Build 4 choices
    const choices = [
      { text: correctMeaning, isCorrect: true },
      ...chosenDistractors.map(d => ({ text: d, isCorrect: false }))
    ].sort(() => 0.5 - Math.random());

    return {
      index: idx,
      word: card.word,
      phonetic: card.phonetic,
      imageUrl: card.imageUrl,
      audioUrl: card.audioUrl,
      correctMeaning: correctMeaning,
      choices: choices,
      sourceCard: card
    };
  });

  quizCurrentIndex = 0;
  quizAnswers = {};
  quizFlags = new Set();

  renderCurrentQuizQuestion();
  updateQuizDock();
}

function renderCurrentQuizQuestion() {
  if (!quizQuestions[quizCurrentIndex]) return;
  const q = quizQuestions[quizCurrentIndex];

  // Question label
  const qNumEl = document.getElementById('quiz-q-num');
  if (qNumEl) qNumEl.textContent = `Câu hỏi ${quizCurrentIndex + 1}.`;

  // Flag button
  const flagBtn = document.getElementById('quiz-flag-btn');
  const flagIcon = document.getElementById('quiz-flag-icon');
  if (flagIcon) {
    if (quizFlags.has(quizCurrentIndex)) {
      flagIcon.setAttribute('fill', '#ef4444');
      flagIcon.classList.add('text-rose-500', 'fill-rose-500');
    } else {
      flagIcon.removeAttribute('fill');
      flagIcon.classList.remove('text-rose-500', 'fill-rose-500');
    }
  }

  // Target word
  const wordEl = document.getElementById('quiz-word');
  if (wordEl) wordEl.textContent = q.word;

  // Illustration image (centered)
  const imgEl = document.getElementById('quiz-img');
  if (imgEl) {
    imgEl.src = q.imageUrl || '';
    imgEl.alt = q.word;
  }

  // Audio player setup
  setupQuizAudioPlayer(q.audioUrl);
  if (flashcardActiveMode === 'quiz' && getVocabSettings().autoPronounce && q.audioUrl) {
    setTimeout(() => {
      if (flashcardActiveMode === 'quiz') {
        const audioEl = document.getElementById('quiz-audio-element');
        const playIcon = document.getElementById('quiz-play-icon');
        if (audioEl && audioEl.src) {
          audioEl.currentTime = 0;
          audioEl.play().then(() => {
            if (playIcon) playIcon.setAttribute('data-lucide', 'pause');
            if (window.lucide) lucide.createIcons();
          }).catch(err => console.log('Quiz audio autoplay prevented:', err));
        }
      }
    }, 150);
  }

  // Render 4 options
  const container = document.getElementById('quiz-options-container');
  if (container) {
    const existingAnswer = quizAnswers[quizCurrentIndex];
    container.innerHTML = q.choices.map((choice, idx) => {
      let stateClass = '';
      let circleContent = '';

      if (existingAnswer) {
        stateClass += ' graded';
        if (choice.isCorrect) {
          stateClass += ' correct';
          circleContent = '✓';
        } else if (existingAnswer.selectedIdx === idx && !choice.isCorrect) {
          stateClass += ' wrong';
          circleContent = '✕';
        }
      }

      return `
        <div onclick="selectQuizChoice(${idx})" class="quiz-choice-item flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 hover:border-indigo-400 hover:bg-slate-50/80 transition cursor-pointer select-none ${stateClass}">
          <div class="quiz-radio-circle w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0 text-xs font-black transition">
            ${circleContent}
          </div>
          <span class="text-sm sm:text-base font-semibold text-slate-800">${choice.text}</span>
        </div>
      `;
    }).join('');
  }

  renderQuizPalette();
  applyShortcutHintsVisibility();
  if (window.lucide) lucide.createIcons();
}

function setupQuizAudioPlayer(audioUrl) {
  const audioEl = document.getElementById('quiz-audio-element');
  const playBtn = document.getElementById('quiz-play-btn');
  const playIcon = document.getElementById('quiz-play-icon');
  const timeDisplay = document.getElementById('quiz-time-display');
  const scrubber = document.getElementById('quiz-audio-scrubber');

  if (!audioEl) return;

  // Reset UI
  audioEl.src = audioUrl || '';
  if (timeDisplay) timeDisplay.textContent = '00:00 / 00:00';
  if (scrubber) scrubber.value = 0;
  if (playIcon) playIcon.setAttribute('data-lucide', 'play');

  if (!quizAudioListenersAttached) {
    quizAudioListenersAttached = true;

    audioEl.addEventListener('loadedmetadata', () => {
      updateQuizAudioTime();
    });

    audioEl.addEventListener('timeupdate', () => {
      updateQuizAudioTime();
    });

    audioEl.addEventListener('ended', () => {
      const pIcon = document.getElementById('quiz-play-icon');
      if (pIcon) pIcon.setAttribute('data-lucide', 'play');
      const sc = document.getElementById('quiz-audio-scrubber');
      if (sc) sc.value = 0;
      if (window.lucide) lucide.createIcons();
    });
  }

  if (window.lucide) lucide.createIcons();
}

function updateQuizAudioTime() {
  const audioEl = document.getElementById('quiz-audio-element');
  const timeDisplay = document.getElementById('quiz-time-display');
  const scrubber = document.getElementById('quiz-audio-scrubber');
  if (!audioEl) return;

  const cur = formatAudioTime(audioEl.currentTime || 0);
  const dur = formatAudioTime(audioEl.duration || 0);
  if (timeDisplay) timeDisplay.textContent = `${cur} / ${dur}`;

  if (scrubber && audioEl.duration) {
    scrubber.value = Math.floor((audioEl.currentTime / audioEl.duration) * 100);
  }
}

function formatAudioTime(sec) {
  if (isNaN(sec) || !isFinite(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function toggleQuizAudio() {
  const audioEl = document.getElementById('quiz-audio-element');
  const playIcon = document.getElementById('quiz-play-icon');
  if (!audioEl || !audioEl.src) return;

  if (audioEl.paused) {
    audioEl.play().catch(e => console.log('Audio error:', e));
    if (playIcon) playIcon.setAttribute('data-lucide', 'pause');
  } else {
    audioEl.pause();
    if (playIcon) playIcon.setAttribute('data-lucide', 'play');
  }
  if (window.lucide) lucide.createIcons();
}

function seekQuizAudio(val) {
  const audioEl = document.getElementById('quiz-audio-element');
  if (audioEl && audioEl.duration) {
    audioEl.currentTime = (val / 100) * audioEl.duration;
  }
}

function toggleQuizMute() {
  const audioEl = document.getElementById('quiz-audio-element');
  const volIcon = document.getElementById('quiz-volume-icon');
  if (!audioEl) return;

  audioEl.muted = !audioEl.muted;
  if (volIcon) {
    volIcon.setAttribute('data-lucide', audioEl.muted ? 'volume-x' : 'volume-2');
    if (window.lucide) lucide.createIcons();
  }
}

function toggleQuizFlag() {
  if (quizFlags.has(quizCurrentIndex)) {
    quizFlags.delete(quizCurrentIndex);
  } else {
    quizFlags.add(quizCurrentIndex);
  }
  renderCurrentQuizQuestion();
}

function selectQuizChoice(choiceIdx) {
  if (quizAnswers[quizCurrentIndex]) return; // Already answered

  const q = quizQuestions[quizCurrentIndex];
  const choice = q.choices[choiceIdx];
  const isCorrect = !!choice.isCorrect;

  quizAnswers[quizCurrentIndex] = {
    selectedIdx: choiceIdx,
    isCorrect: isCorrect,
    chosenText: choice.text
  };
  recordStreakActivity('luyện từ vựng');

  // Spaced Repetition (3-day review): Save wrong word or graduate mastered word
  if (!isCorrect && q.sourceCard) {
    recordWrongVocabWord(q.sourceCard);
  } else if (isCorrect && isWrongVocabReviewMode && q.sourceCard) {
    markWrongVocabMastered(q.sourceCard.id, q.word, true);
  }

  // Immediate visual feedback on items
  const container = document.getElementById('quiz-options-container');
  if (container) {
    const items = container.querySelectorAll('.quiz-choice-item');
    items.forEach((item, idx) => {
      item.classList.add('graded');
      const c = q.choices[idx];
      const circle = item.querySelector('.quiz-radio-circle');

      if (c.isCorrect) {
        item.classList.add('correct');
        if (circle) circle.textContent = '✓';
      } else if (idx === choiceIdx && !isCorrect) {
        item.classList.add('wrong');
        if (circle) circle.textContent = '✕';
      }
    });
  }

  updateQuizDock();
  renderQuizPalette();

  // Auto advance after 1.2s
  setTimeout(() => {
    if (flashcardActiveMode !== 'quiz') return;
    if (quizCurrentIndex < quizQuestions.length - 1) {
      quizCurrentIndex++;
      renderCurrentQuizQuestion();
      updateQuizDock();
    } else {
      showQuizSummaryModal();
    }
  }, 1200);
}

function updateQuizDock() {
  const total = quizQuestions.length;
  let correct = 0;
  let wrong = 0;
  let answered = 0;

  Object.values(quizAnswers).forEach(ans => {
    answered++;
    if (ans.isCorrect) correct++;
    else wrong++;
  });

  const unanswered = Math.max(0, total - answered);

  const rangeEl = document.getElementById('quiz-dock-range');
  if (rangeEl) rangeEl.textContent = `1-${total}`;

  const corEl = document.getElementById('quiz-dock-correct');
  if (corEl) corEl.textContent = correct;

  const wrgEl = document.getElementById('quiz-dock-wrong');
  if (wrgEl) wrgEl.textContent = wrong;

  const unansEl = document.getElementById('quiz-dock-unanswered');
  if (unansEl) unansEl.textContent = unanswered;
}

function toggleQuizDrawer(forceState) {
  const drawer = document.getElementById('quiz-palette-drawer');
  const icon = document.getElementById('quiz-drawer-icon');
  if (!drawer) return;

  const isHidden = drawer.classList.contains('hidden');
  const shouldOpen = typeof forceState === 'boolean' ? forceState : isHidden;

  if (shouldOpen) {
    drawer.classList.remove('hidden');
    renderQuizPalette();
    if (icon) icon.setAttribute('data-lucide', 'chevron-down');
  } else {
    drawer.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-up');
  }
  if (window.lucide) lucide.createIcons();
}

function renderQuizPalette() {
  const grid = document.getElementById('quiz-palette-grid');
  if (!grid) return;

  grid.innerHTML = quizQuestions.map((q, idx) => {
    const isCurrent = idx === quizCurrentIndex;
    const ans = quizAnswers[idx];
    const isFlagged = quizFlags.has(idx);

    let bg = 'bg-slate-100 text-slate-700 border-slate-200';
    let label = `${idx + 1}`;

    if (ans) {
      if (ans.isCorrect) {
        bg = 'bg-emerald-500 text-white border-emerald-600';
      } else {
        bg = 'bg-rose-500 text-white border-rose-600';
      }
    }

    const ring = isCurrent ? 'ring-2 ring-[#5648ee] ring-offset-2' : '';
    const flagDot = isFlagged ? '<span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-white"></span>' : '';

    return `
      <button onclick="jumpToQuizQuestion(${idx})" class="relative h-9 rounded-xl border font-black text-xs transition flex items-center justify-center ${bg} ${ring}">
        ${label}
        ${flagDot}
      </button>
    `;
  }).join('');
}

function jumpToQuizQuestion(idx) {
  if (idx < 0 || idx >= quizQuestions.length) return;
  quizCurrentIndex = idx;
  renderCurrentQuizQuestion();
  toggleQuizDrawer(false);
}

function endSessionButtonHandler() {
  if (flashcardActiveMode === 'quiz') {
    endQuizSession();
  } else {
    endFlashcardSession();
  }
}

function endQuizSession() {
  const answeredCount = Object.keys(quizAnswers).length;
  const total = quizQuestions.length;
  if (answeredCount < total) {
    if (!confirm(`Bạn mới làm được ${answeredCount}/${total} câu. Bạn có chắc muốn nộp bài kiểm tra ngay không?`)) {
      return;
    }
  }
  showQuizSummaryModal();
}

function showQuizSummaryModal() {
  const total = quizQuestions.length;
  let correct = 0;
  let wrong = 0;

  quizQuestions.forEach((q, idx) => {
    const a = quizAnswers[idx];
    if (a && a.isCorrect) correct++;
    else if (a && !a.isCorrect) wrong++;
  });

  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Record completed vocab quiz
  recordStudyHistoryActivity({
    type: 'vocabulary',
    title: `Kiểm tra từ vựng: ${currentFlashcardTopicTitle || 'Chủ đề từ vựng'}`,
    subtitle: `Quiz: ${correct}/${total} câu đúng (${pct}%)`,
    badge: 'Vocab Quiz',
    score: `${pct}%`,
    accuracy: pct,
    details: {
      topicId: currentFlashcardTopicId,
      topicTitle: currentFlashcardTopicTitle,
      mode: 'quiz',
      correct,
      wrong,
      total
    }
  });

  const modalHtml = `
    <div id="quiz-summary-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div class="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl flex flex-col items-center text-center">
        
        <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 shadow-xs">
          <i data-lucide="award" class="w-8 h-8"></i>
        </div>

        <h3 class="text-2xl font-black text-slate-900">Kết quả Kiểm tra Từ vựng</h3>
        <p class="text-xs text-slate-500 mt-1">${currentFlashcardTopicTitle}</p>

        <!-- Stats Grid -->
        <div class="my-5 p-4 rounded-2xl bg-slate-50 w-full grid grid-cols-3 gap-3 text-center border border-slate-100">
          <div>
            <div class="text-2xl font-black text-emerald-600">${correct}</div>
            <div class="text-[11px] font-bold text-slate-500 mt-0.5">✓ Đúng</div>
          </div>
          <div>
            <div class="text-2xl font-black text-rose-500">${wrong}</div>
            <div class="text-[11px] font-bold text-slate-500 mt-0.5">✕ Sai</div>
          </div>
          <div>
            <div class="text-2xl font-black text-[#5648ee]">${pct}%</div>
            <div class="text-[11px] font-bold text-slate-500 mt-0.5">Chính xác</div>
          </div>
        </div>

        <!-- Words Review List -->
        <div class="w-full max-h-52 overflow-y-auto mb-5 text-left flex flex-col gap-2 p-1">
          ${quizQuestions.map((q, idx) => {
            const a = quizAnswers[idx];
            const isOk = a && a.isCorrect;
            const isWrong = a && !a.isCorrect;
            return `
              <div class="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span class="font-extrabold text-slate-900">${q.word}</span>
                  <span class="text-slate-400 font-mono text-[11px] ml-1">${q.phonetic || ''}</span>
                  <div class="text-slate-500 text-[11px] mt-0.5">${q.correctMeaning}</div>
                </div>
                <div class="text-right">
                  <span class="font-extrabold ${isOk ? 'text-emerald-600' : (isWrong ? 'text-rose-500' : 'text-slate-400')}">
                    ${isOk ? '✓ Đúng' : (isWrong ? '✕ Sai' : '○ Bỏ qua')}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Action Buttons -->
        <div class="w-full flex flex-col gap-2.5">
          ${wrong > 0 ? `
            <button onclick="closeModal('quiz-summary-modal'); initVocabQuiz(true);" class="w-full py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5">
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Kiểm tra lại ${wrong} câu đã làm sai
            </button>
          ` : ''}
          <button onclick="closeModal('quiz-summary-modal'); initVocabQuiz(false);" class="w-full py-3 rounded-2xl bg-[#5648ee] hover:bg-[#4335df] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i> Làm lại toàn bộ bài kiểm tra
          </button>
          <button onclick="closeModal('quiz-summary-modal'); switchFlashcardMode('study');" class="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition flex items-center justify-center gap-1.5">
            <i data-lucide="layers" class="w-4 h-4"></i> Quay lại học Flashcard
          </button>
          <button onclick="closeModal('quiz-summary-modal'); showView('home'); switchTab('vocabulary');" class="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-bold transition">
            Quay về kho từ vựng
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (window.lucide) lucide.createIcons();
}


function cleanHtmlText(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&hellip;/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

async function startFlashcardSession(topicId, topicTitle, onlyUnlearned = false) {
  isWrongVocabReviewMode = false;
  // If practiceSummary is not loaded yet, fetch it
  if (!practiceSummary) {
    try {
      const psResp = await fetch('/api/practice-summary');
      if (psResp.ok) {
        practiceSummary = await psResp.json();
      }
    } catch (e) {
      console.warn('Could not preload practiceSummary:', e);
    }
  }

  // Resolve topicId if it's a slug, title, localized name or empty
  if (practiceSummary) {
    const vocabData = practiceSummary.find(p => p.slug === 'vocabulary');
    if (vocabData) {
      const allVocabTopics = [...(vocabData.byTopic || []), ...(vocabData.byPart || [])];
      const cleanTitle = (topicTitle || '').replace(/^Từ vựng:\s*/i, '').replace(/\s*\(.*?\)/g, '').trim().toLowerCase();
      const cleanId = (topicId || '').replace(/^Từ vựng:\s*/i, '').replace(/\s*\(.*?\)/g, '').trim().toLowerCase();

      const match = allVocabTopics.find(t => 
        (t.id && t.id === topicId) || 
        (t.slug && (t.slug === topicId || t.slug === cleanId)) || 
        (t.name && t.name.toLowerCase() === cleanId) ||
        (t.name && t.name.toLowerCase() === cleanTitle) ||
        (cleanTitle && t.name && cleanTitle.includes(t.name.toLowerCase())) ||
        (cleanTitle && t.name && t.name.toLowerCase().includes(cleanTitle)) ||
        (topicTitle && t.name && topicTitle.toLowerCase().includes(t.name.toLowerCase()))
      );
      if (match) {
        topicId = match.id;
        if (!topicTitle) topicTitle = match.name;
      } else if (!topicId && allVocabTopics.length > 0) {
        // Fallback to first available topic if id is completely missing
        topicId = allVocabTopics[0].id;
        if (!topicTitle) topicTitle = allVocabTopics[0].name;
      }
    }
  }

  currentFlashcardTopicId = topicId;
  currentFlashcardTopicTitle = topicTitle;

  // Show loading indicator
  const loadToast = document.createElement('div');
  loadToast.id = 'loading-toast';
  loadToast.className = 'fixed bottom-8 right-8 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-bounce text-xs font-bold';
  loadToast.innerHTML = '<span class="w-2 h-2 rounded-full bg-[#5648ee] animate-ping"></span> Đang mở bộ thẻ flashcard...';
  document.body.appendChild(loadToast);

  try {
    const resp = await fetch(`/api/test/${topicId}`);
    if (!resp.ok) throw new Error('Không thể tải dữ liệu từ vựng');
    const data = await resp.json();

    let cards = (data.flashcards || []).map((c, idx) => ({
      ...c,
      id: c.id || String(idx),
      word: cleanHtmlText(c.word || ''),
      phonetic: cleanHtmlText(c.phonetic || ''),
      meaningVi: cleanHtmlText(c.meaningVi || ''),
      meaningEn: cleanHtmlText(c.meaningEn || ''),
      exampleEn: cleanHtmlText(c.exampleEn || c.exampleEnHtml || ''),
      exampleVi: cleanHtmlText(c.exampleVi || c.exampleViHtml || '')
    }));

    if (cards.length === 0) {
      cards = (data.data || []).map((item, idx) => {
        const q = item.question || {};
        return {
          id: q.id || String(idx),
          word: cleanHtmlText(q.questionText || ''),
          phonetic: cleanHtmlText(q.phonetic || ''),
          imageUrl: q.imageUrl || '',
          audioUrl: q.audioUrl || '',
          meaningVi: cleanHtmlText(q.meaningVi || (q.choices && q.choices[0] && q.choices[0].text) || ''),
          meaningEn: cleanHtmlText(q.meaningEn || ''),
          exampleEnHtml: q.explanationHtml || '',
          exampleViHtml: q.explanationViHtml || '',
          exampleEn: cleanHtmlText(q.explanationHtml || ''),
          exampleVi: cleanHtmlText(q.explanationViHtml || '')
        };
      });
    }

    if (onlyUnlearned) {
      cards = cards.filter(c => flashcardStatus[c.id] === false);
    } else {
      flashcardStatus = {};
      flashcardFlags = new Set();
    }

    if (cards.length === 0) {
      alert('Không có thẻ nào để học!');
      loadToast.remove();
      return;
    }

    currentFlashcards = cards;
    flashcardIndex = 0;
    quizQuestions = [];
    quizAnswers = {};
    quizFlags = new Set();

    loadToast.remove();
    showView('flashcard');

    // Record vocabulary session in study history
    recordStudyHistoryActivity({
      type: 'vocabulary',
      title: `Từ vựng: ${topicTitle || 'Chủ đề từ vựng'}`,
      subtitle: `Học Flashcard: ${cards.length} từ vựng`,
      badge: 'Flashcard',
      score: 'Đang học',
      accuracy: null,
      details: { topicId, topicTitle, total: cards.length }
    });

    document.getElementById('fc-topic-title').textContent = topicTitle;
    switchFlashcardMode('study');
  } catch (err) {
    if (loadToast) loadToast.remove();
    alert('Lỗi tải từ vựng: ' + err.message);
  }
}

function renderCurrentFlashcard() {
  if (!currentFlashcards[flashcardIndex]) return;
  const card = currentFlashcards[flashcardIndex];

  // Un-flip card if flipped
  const cardEl = document.getElementById('flashcard-card-element');
  if (cardEl) cardEl.classList.remove('is-flipped');

  // Update progress text
  const progEl = document.getElementById('fc-progress-text');
  if (progEl) progEl.textContent = `${flashcardIndex + 1}/${currentFlashcards.length}`;

  // Front Content
  const imgWrap = document.getElementById('fc-front-img-wrap');
  const imgEl = document.getElementById('fc-front-img');
  if (card.imageUrl) {
    imgEl.src = card.imageUrl;
    imgWrap.classList.remove('hidden');
  } else {
    imgWrap.classList.add('hidden');
  }

  document.getElementById('fc-front-word').textContent = cleanHtmlText(card.word);
  document.getElementById('fc-front-phonetic').textContent = cleanHtmlText(card.phonetic);

  // Back Content
  document.getElementById('fc-back-word').textContent = cleanHtmlText(card.word);
  document.getElementById('fc-back-phonetic').textContent = cleanHtmlText(card.phonetic);
  document.getElementById('fc-back-meaning').textContent = cleanHtmlText(card.meaningVi || card.meaningEn || 'Chưa cập nhật nghĩa');

  const exEn = document.getElementById('fc-back-example-en');
  const exVi = document.getElementById('fc-back-example-vi');

  if (card.exampleEnHtml) {
    exEn.innerHTML = card.exampleEnHtml;
  } else if (card.exampleEn) {
    exEn.textContent = `"${card.exampleEn}"`;
  } else {
    exEn.textContent = '';
  }

  if (card.exampleViHtml) {
    exVi.innerHTML = card.exampleViHtml;
  } else if (card.exampleVi) {
    exVi.textContent = `"${card.exampleVi}"`;
  } else {
    exVi.textContent = '';
  }

  // Audio setup & auto preload
  const audioEl = document.getElementById('fc-audio-element');
  if (audioEl) {
    audioEl.src = card.audioUrl || '';
    audioEl.load();
    if (flashcardActiveMode === 'study' && getVocabSettings().autoPronounce && card.audioUrl) {
      setTimeout(() => {
        if (flashcardActiveMode === 'study') {
          playFlashcardAudio();
        }
      }, 150);
    }
  }

  // Flag state
  const flagBtn = document.getElementById('fc-flag-btn');
  if (flagBtn) {
    if (flashcardFlags.has(card.id)) {
      flagBtn.classList.add('text-amber-500');
    } else {
      flagBtn.classList.remove('text-amber-500');
    }
  }

  // Update Prev / Next button states
  const prevBtns = [document.getElementById('fc-btn-prev'), document.getElementById('fc-counter-prev')];
  const nextBtns = [document.getElementById('fc-btn-next'), document.getElementById('fc-counter-next')];
  const isFirst = (flashcardIndex <= 0);
  const isLast = (flashcardIndex >= currentFlashcards.length - 1);

  prevBtns.forEach(btn => {
    if (btn) {
      btn.disabled = isFirst;
      btn.classList.toggle('opacity-30', isFirst);
      btn.classList.toggle('cursor-not-allowed', isFirst);
    }
  });

  nextBtns.forEach(btn => {
    if (btn) {
      btn.disabled = isLast;
      btn.classList.toggle('opacity-30', isLast);
      btn.classList.toggle('cursor-not-allowed', isLast);
    }
  });

  // Update Overview Counters
  updateFlashcardOverview();
  applyShortcutHintsVisibility();

  if (window.lucide) lucide.createIcons();
}

function updateFlashcardOverview() {
  const total = currentFlashcards.length;
  let learned = 0;
  let unlearned = 0;
  currentFlashcards.forEach(c => {
    if (flashcardStatus[c.id] === true) learned++;
    else if (flashcardStatus[c.id] === false) unlearned++;
  });
  const unanswered = total - (learned + unlearned);

  const lEl = document.getElementById('fc-overview-learned');
  const uEl = document.getElementById('fc-overview-unlearned');
  const unEl = document.getElementById('fc-overview-unanswered');

  if (lEl) lEl.textContent = `${learned}/${total}`;
  if (uEl) uEl.textContent = `${unlearned}/${total}`;
  if (unEl) unEl.textContent = `${unanswered}/${total}`;
}

function flipFlashcard(e) {
  if (e) e.stopPropagation();
  const cardEl = document.getElementById('flashcard-card-element');
  if (cardEl) cardEl.classList.toggle('is-flipped');
}

const VOCAB_SETTINGS_KEY = 'mihi_vocab_settings_v1';
const EXAM_SETTINGS_KEY = 'mihi_exam_settings_v1';

function getVocabSettings() {
  try {
    const raw = localStorage.getItem(VOCAB_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          autoPronounce: parsed.autoPronounce !== false,
          showShortcuts: parsed.showShortcuts !== false
        };
      }
    }
  } catch (e) {}
  return { autoPronounce: true, showShortcuts: true };
}

function saveVocabSettings(settings) {
  try {
    localStorage.setItem(VOCAB_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

function getExamSettings() {
  try {
    const raw = localStorage.getItem(EXAM_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          autoAudio: parsed.autoAudio !== false,
          showShortcuts: parsed.showShortcuts !== false
        };
      }
    }
  } catch (e) {}
  return { autoAudio: true, showShortcuts: true };
}

function saveExamSettings(settings) {
  try {
    localStorage.setItem(EXAM_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

function applyShortcutHintsVisibility() {
  const vocabShow = getVocabSettings().showShortcuts;
  const examShow = getExamSettings().showShortcuts;

  const fcHints = document.getElementById('fc-shortcut-hints');
  const quizHints = document.getElementById('quiz-shortcut-hints');
  const examHints = document.getElementById('exam-shortcut-hints');

  if (fcHints) fcHints.classList.toggle('hidden', !vocabShow);
  if (quizHints) quizHints.classList.toggle('hidden', !vocabShow);
  if (examHints) examHints.classList.toggle('hidden', !examShow);
}

function renderBehaviorSwitch(trackId, knobId, isOn) {
  const track = document.getElementById(trackId);
  const knob = document.getElementById(knobId);
  if (!track || !knob) return;
  if (isOn) {
    track.className = 'w-12 h-7 rounded-full bg-red-600 p-1 transition-colors duration-200 flex items-center cursor-pointer flex-shrink-0';
    knob.className = 'w-5 h-5 rounded-full bg-white shadow-sm transform translate-x-5 transition-transform duration-200';
  } else {
    track.className = 'w-12 h-7 rounded-full bg-slate-300 p-1 transition-colors duration-200 flex items-center cursor-pointer flex-shrink-0';
    knob.className = 'w-5 h-5 rounded-full bg-white shadow-sm transform translate-x-0 transition-transform duration-200';
  }
}

function toggleVocabAutoPronounce() {
  const settings = getVocabSettings();
  settings.autoPronounce = !settings.autoPronounce;
  saveVocabSettings(settings);
  renderBehaviorSwitch('vocab-auto-audio-track', 'vocab-auto-audio-knob', settings.autoPronounce);
}

function toggleVocabShortcuts() {
  const settings = getVocabSettings();
  settings.showShortcuts = !settings.showShortcuts;
  saveVocabSettings(settings);
  renderBehaviorSwitch('vocab-shortcuts-track', 'vocab-shortcuts-knob', settings.showShortcuts);
  applyShortcutHintsVisibility();
}

function toggleExamAutoAudio() {
  const settings = getExamSettings();
  settings.autoAudio = !settings.autoAudio;
  saveExamSettings(settings);
  renderBehaviorSwitch('exam-auto-audio-track', 'exam-auto-audio-knob', settings.autoAudio);
}

function toggleExamShortcuts() {
  const settings = getExamSettings();
  settings.showShortcuts = !settings.showShortcuts;
  saveExamSettings(settings);
  renderBehaviorSwitch('exam-shortcuts-track', 'exam-shortcuts-knob', settings.showShortcuts);
  applyShortcutHintsVisibility();
}

function buildBehaviorSettingsModalHtml(modalId, title, autoState, shortcutState, onToggleAuto, onToggleShortcut, prefix) {
  return `
    <div id="${modalId}" onclick="if(event.target===this) closeModal('${modalId}')" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-150">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-xl font-black text-slate-900">${title}</h3>
          <button onclick="closeModal('${modalId}')" class="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer">
            ✕
          </button>
        </div>

        <div class="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3 px-1">
          HÀNH VI
        </div>

        <div class="space-y-3">
          <div onclick="${onToggleAuto}()" class="p-3 px-4 rounded-2xl bg-rose-50/70 hover:bg-rose-50 flex items-center justify-between gap-4 cursor-pointer select-none transition">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <i data-lucide="play" class="w-4 h-4"></i>
              </div>
              <span class="text-sm font-bold text-red-900">Tự phát audio khi vào câu</span>
            </div>
            <div id="${prefix}-auto-audio-track" class="w-12 h-7 rounded-full ${autoState ? 'bg-red-600' : 'bg-slate-300'} p-1 transition-colors duration-200 flex items-center cursor-pointer flex-shrink-0">
              <div id="${prefix}-auto-audio-knob" class="w-5 h-5 rounded-full bg-white shadow-sm transform ${autoState ? 'translate-x-5' : 'translate-x-0'} transition-transform duration-200"></div>
            </div>
          </div>

          <div onclick="${onToggleShortcut}()" class="p-3 px-4 rounded-2xl bg-rose-50/70 hover:bg-rose-50 flex items-center justify-between gap-4 cursor-pointer select-none transition">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <i data-lucide="file-text" class="w-4 h-4"></i>
              </div>
              <span class="text-sm font-bold text-red-900">Hiển thị phím tắt</span>
            </div>
            <div id="${prefix}-shortcuts-track" class="w-12 h-7 rounded-full ${shortcutState ? 'bg-red-600' : 'bg-slate-300'} p-1 transition-colors duration-200 flex items-center cursor-pointer flex-shrink-0">
              <div id="${prefix}-shortcuts-knob" class="w-5 h-5 rounded-full bg-white shadow-sm transform ${shortcutState ? 'translate-x-5' : 'translate-x-0'} transition-transform duration-200"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function openVocabSettingsModal() {
  const existing = document.getElementById('vocab-settings-modal');
  if (existing) existing.remove();
  const s = getVocabSettings();
  document.body.insertAdjacentHTML('beforeend', buildBehaviorSettingsModalHtml(
    'vocab-settings-modal',
    'Cài đặt học từ vựng',
    s.autoPronounce,
    s.showShortcuts,
    'toggleVocabAutoPronounce',
    'toggleVocabShortcuts',
    'vocab'
  ));
  if (window.lucide) lucide.createIcons();
}

function openExamSettingsModal() {
  const existing = document.getElementById('exam-settings-modal');
  if (existing) existing.remove();
  const s = getExamSettings();
  document.body.insertAdjacentHTML('beforeend', buildBehaviorSettingsModalHtml(
    'exam-settings-modal',
    'Cài đặt làm bài & audio',
    s.autoAudio,
    s.showShortcuts,
    'toggleExamAutoAudio',
    'toggleExamShortcuts',
    'exam'
  ));
  if (window.lucide) lucide.createIcons();
}

function playFlashcardAudio(e) {
  if (e) e.stopPropagation();
  const audioEl = document.getElementById('fc-audio-element');
  if (audioEl && audioEl.src) {
    audioEl.currentTime = 0;
    audioEl.play().catch(err => console.log('Audio autoplay prevented:', err));
  }
}

function toggleFlagFlashcard() {
  const card = currentFlashcards[flashcardIndex];
  if (!card) return;
  if (flashcardFlags.has(card.id)) {
    flashcardFlags.delete(card.id);
  } else {
    flashcardFlags.add(card.id);
  }
  const flagBtn = document.getElementById('fc-flag-btn');
  if (flagBtn) {
    if (flashcardFlags.has(card.id)) flagBtn.classList.add('text-amber-500');
    else flagBtn.classList.remove('text-amber-500');
  }
}

function prevFlashcard(e) {
  if (e) e.stopPropagation();
  if (flashcardIndex > 0) {
    flashcardIndex--;
    renderCurrentFlashcard();
  }
}

function nextFlashcard(e) {
  if (e) e.stopPropagation();
  if (flashcardIndex < currentFlashcards.length - 1) {
    flashcardIndex++;
    renderCurrentFlashcard();
  }
}

function markFlashcard(isMemorized) {
  const card = currentFlashcards[flashcardIndex];
  if (!card) return;

  flashcardStatus[card.id] = isMemorized;
  recordStreakActivity('học từ vựng');
  updateFlashcardOverview();

  if (flashcardIndex < currentFlashcards.length - 1) {
    flashcardIndex++;
    renderCurrentFlashcard();
  } else {
    showFlashcardSummaryModal();
  }
}

function endFlashcardSession() {
  if (confirm('Bạn có muốn kết thúc phiên học từ vựng này không?')) {
    showFlashcardSummaryModal();
  }
}

function showFlashcardSummaryModal() {
  const total = currentFlashcards.length;
  let learned = 0;
  let unlearned = 0;
  currentFlashcards.forEach(c => {
    if (flashcardStatus[c.id] === true) learned++;
    else if (flashcardStatus[c.id] === false) unlearned++;
  });
  const pct = total > 0 ? Math.round((learned / total) * 100) : 0;

  // Record completed flashcard session
  recordStudyHistoryActivity({
    type: 'vocabulary',
    title: `Từ vựng: ${currentFlashcardTopicTitle || 'Chủ đề từ vựng'}`,
    subtitle: `Flashcard: ${learned}/${total} từ ghi nhớ (${pct}%)`,
    badge: 'Flashcard',
    score: `${learned}/${total} từ`,
    accuracy: pct,
    details: {
      topicId: currentFlashcardTopicId,
      topicTitle: currentFlashcardTopicTitle,
      mode: 'flashcard',
      learned,
      unlearned,
      total
    }
  });

  const modalHtml = `
    <div id="fc-summary-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div class="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl flex flex-col items-center text-center">
        
        <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
          <i data-lucide="award" class="w-8 h-8"></i>
        </div>

        <h3 class="text-2xl font-black text-slate-900">Hoàn thành phiên học!</h3>
        <p class="text-xs text-slate-500 mt-1">${currentFlashcardTopicTitle}</p>

        <!-- Stats Circle / Score -->
        <div class="my-6 p-4 rounded-2xl bg-slate-50 w-full grid grid-cols-3 gap-3 text-center border border-slate-100">
          <div>
            <div class="text-2xl font-black text-emerald-600">${learned}</div>
            <div class="text-[11px] font-bold text-slate-500 mt-0.5">Đã thuộc</div>
          </div>
          <div>
            <div class="text-2xl font-black text-rose-500">${unlearned}</div>
            <div class="text-[11px] font-bold text-slate-500 mt-0.5">Chưa thuộc</div>
          </div>
          <div>
            <div class="text-2xl font-black text-[#5648ee]">${pct}%</div>
            <div class="text-[11px] font-bold text-slate-500 mt-0.5">Ghi nhớ</div>
          </div>
        </div>

        <!-- Words List preview -->
        <div class="w-full max-h-48 overflow-y-auto mb-6 text-left flex flex-col gap-2 p-1">
          ${currentFlashcards.map(c => {
            const isOk = flashcardStatus[c.id] === true;
            const isNotOk = flashcardStatus[c.id] === false;
            return `
              <div class="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 text-xs">
                <span class="font-extrabold text-slate-800">${c.word} <span class="font-normal text-slate-400 font-mono">${c.phonetic || ''}</span></span>
                <span class="font-bold ${isOk ? 'text-emerald-600' : (isNotOk ? 'text-rose-500' : 'text-slate-400')}">
                  ${isOk ? '✓ Đã thuộc' : (isNotOk ? '✗ Chưa thuộc' : '○ Bỏ qua')}
                </span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Action Buttons -->
        <div class="w-full flex flex-col gap-2.5">
          <button onclick="closeModal('fc-summary-modal'); switchFlashcardMode('quiz')" class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#5648ee] to-indigo-600 hover:brightness-105 text-white font-extrabold text-sm shadow-md shadow-indigo-600/25 transition flex items-center justify-center gap-2">
            <i data-lucide="check-square" class="w-4 h-4"></i> Bắt đầu kiểm tra từ vựng ngay (Quiz)
          </button>
          ${unlearned > 0 ? `
            <button onclick="closeModal('fc-summary-modal'); startFlashcardSession('${currentFlashcardTopicId}', '${currentFlashcardTopicTitle.replace(/'/g, "\\'")}', true)" class="w-full py-2.5 rounded-2xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-extrabold text-xs transition flex items-center justify-center gap-1.5">
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Ôn lại ${unlearned} từ chưa thuộc
            </button>
          ` : ''}
          <button onclick="closeModal('fc-summary-modal'); startFlashcardSession('${currentFlashcardTopicId}', '${currentFlashcardTopicTitle.replace(/'/g, "\\'")}', false)" class="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition flex items-center justify-center gap-1.5">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i> Học lại toàn bộ thẻ
          </button>
          <button onclick="closeModal('fc-summary-modal'); showView('home'); switchTab('vocabulary')" class="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-bold transition">
            Quay về kho từ vựng
          </button>
        </div>

      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (window.lucide) lucide.createIcons();
}

const THEME_STORAGE_KEY = 'mihi_theme_mode_v1';

function initThemeMode() {
  let isDark = false;
  try {
    isDark = localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
  } catch (e) {}
  applyThemeMode(isDark);
}

function toggleDarkMode() {
  const isDark = !document.body.classList.contains('dark-mode');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  } catch (e) {}
  applyThemeMode(isDark);
}

function applyThemeMode(isDark) {
  document.body.classList.toggle('dark-mode', isDark);
  document.documentElement.classList.toggle('dark', isDark);

  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.innerHTML = `<i data-lucide="${isDark ? 'moon' : 'sun'}" class="w-4 h-4 ${isDark ? 'text-amber-400' : ''}"></i>`;
    btn.title = isDark ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối';
  });
  if (window.lucide) lucide.createIcons();
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => console.log(err));
  } else {
    document.exitFullscreen().catch(err => console.log(err));
  }
}

// ================= DAILY STREAK ENGINE (🔥 MIHI TOEIC) =================
const STREAK_STORAGE_KEY = 'mihi_toeic_streak_v1';
const DEFAULT_STREAK_START_DATE = '2026-11-22';

function getStreakGoalInfo(startDateStr = DEFAULT_STREAK_START_DATE, todayStr = null) {
  const today = todayStr || getLocalDateString();
  const start = new Date((startDateStr || DEFAULT_STREAK_START_DATE) + 'T00:00:00');
  const cur = new Date(today + 'T00:00:00');
  const diffDays = Math.max(0, Math.floor((cur - start) / 86400000));

  if (diffDays < 14) {
    return {
      requiredMinutes: 15,
      requiredSeconds: 15 * 60,
      stage: 1,
      stageName: 'Giai đoạn 1 (2 tuần đầu)',
      daysElapsed: diffDays + 1
    };
  } else if (diffDays < 28) {
    return {
      requiredMinutes: 30,
      requiredSeconds: 30 * 60,
      stage: 2,
      stageName: 'Giai đoạn 2 (Tuần 3 - 4)',
      daysElapsed: diffDays + 1
    };
  } else {
    return {
      requiredMinutes: 60,
      requiredSeconds: 60 * 60,
      stage: 3,
      stageName: 'Giai đoạn 3 (Duy trì 1 tiếng)',
      daysElapsed: diffDays + 1
    };
  }
}

function getTodayLocalStudySeconds() {
  try {
    const studyData = getStudyTimeData();
    const today = getLocalDateString();
    return (studyData.daily && studyData.daily[today] && studyData.daily[today].total) || 0;
  } catch (e) {
    return 0;
  }
}

function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayDateString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

function getStreakData() {
  try {
    const raw = localStorage.getItem(STREAK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.currentStreak === 'number') {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading streak data:', e);
  }

  // Default initial streak for new learner
  const today = getLocalDateString();
  const initial = {
    currentStreak: 1,
    bestStreak: 1,
    totalDays: 1,
    lastActiveDate: today,
    history: [today]
  };
  saveStreakData(initial);
  return initial;
}

function syncStreakToServer(data) {
  if (!data) return;
  fetch('/api/streak/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).catch(() => {});
}

function saveStreakData(data) {
  try {
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(data));
    syncStreakToServer(data);
  } catch (e) {
    console.error('Error saving streak data:', e);
  }
}

function initStreak() {
  const data = getStreakData();
  const today = getLocalDateString();
  const yesterday = getYesterdayDateString();

  // If lastActiveDate is older than yesterday, the streak is broken
  if (data.lastActiveDate !== today && data.lastActiveDate !== yesterday) {
    data.currentStreak = 0; // Waiting for today's activity to restart streak at 1
    saveStreakData(data);
  }

  updateStreakUI(data);
  syncStreakToServer(data);
}

function recordStreakActivity(actionName = 'học bài') {
  const data = getStreakData();
  if (!data.startDate) {
    data.startDate = (Array.isArray(data.history) && data.history[0]) || DEFAULT_STREAK_START_DATE;
  }
  const today = getLocalDateString();
  const yesterday = getYesterdayDateString();

  // Require minimum daily study time (15p -> 30p -> 60p) to light streak
  const todaySeconds = getTodayLocalStudySeconds();
  const goalInfo = getStreakGoalInfo(data.startDate, today);
  if (todaySeconds < goalInfo.requiredSeconds) {
    updateStreakUI(data);
    return false;
  }

  if (data.lastActiveDate === today) {
    // Already recorded for today
    updateStreakUI(data);
    return true;
  }

  // New day activity!
  if (data.lastActiveDate === yesterday) {
    data.currentStreak = (data.currentStreak || 0) + 1;
  } else {
    data.currentStreak = 1;
  }

  data.lastActiveDate = today;
  if (!Array.isArray(data.history)) data.history = [];
  if (!data.history.includes(today)) data.history.push(today);
  data.totalDays = data.history.length;

  if (data.currentStreak > (data.bestStreak || 0)) {
    data.bestStreak = data.currentStreak;
  }

  saveStreakData(data);
  updateStreakUI(data);
  showStreakToast(data.currentStreak);
  return true;
}

function checkInStreakManually() {
  const data = getStreakData();
  const today = getLocalDateString();
  const goalInfo = getStreakGoalInfo(data.startDate || DEFAULT_STREAK_START_DATE, today);
  const todaySeconds = getTodayLocalStudySeconds();

  if (todaySeconds < goalInfo.requiredSeconds) {
    const studiedMins = Math.floor(todaySeconds / 60);
    const missingMins = Math.max(1, goalInfo.requiredMinutes - studiedMins);
    alert(`⏳ Bạn mới học được ${studiedMins}/${goalInfo.requiredMinutes} phút hôm nay (${goalInfo.stageName})!\n\nHãy học thêm ${missingMins} phút nữa (Flashcard, Ngữ pháp hoặc Luyện đề), ngọn lửa Streak sẽ TỰ ĐỘNG được thắp sáng! 🔥`);
    return;
  }

  recordStreakActivity('điểm danh');
  openStreakModal(); // Re-render modal with updated state
}

function updateStreakUI(data) {
  if (!data) data = getStreakData();
  const today = getLocalDateString();
  const isTodayActive = (data.lastActiveDate === today);

  // 1. Header Button
  const headerCount = document.getElementById('header-streak-count');
  const headerBtn = document.getElementById('streak-header-btn');
  if (headerCount) headerCount.textContent = data.currentStreak;
  if (headerBtn) {
    if (isTodayActive) {
      headerBtn.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-300 text-orange-600 hover:bg-orange-100 font-black text-xs shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer group";
    } else {
      headerBtn.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 font-bold text-xs shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer group";
    }
  }

  // 2. Home Page Banner
  const homeDays = document.getElementById('home-streak-days');
  const homeBadge = document.getElementById('home-streak-status-badge');
  const homeSubtitle = document.getElementById('home-streak-subtitle');

  if (homeDays) homeDays.textContent = data.currentStreak;
  if (homeBadge) {
    if (isTodayActive) {
      homeBadge.textContent = "✓ Đã thắp lửa hôm nay";
      homeBadge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/25 text-white backdrop-blur-xs";
    } else {
      homeBadge.textContent = "⚡ Chưa thắp lửa hôm nay";
      homeBadge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-300 text-slate-900 shadow-xs animate-pulse";
    }
  }
  if (homeSubtitle) {
    const goalInfo = getStreakGoalInfo(data.startDate || DEFAULT_STREAK_START_DATE, today);
    const studiedMins = Math.floor(getTodayLocalStudySeconds() / 60);
    if (isTodayActive) {
      homeSubtitle.textContent = `"Tuyệt vời Minh Hiếu! Bạn đã học ${studiedMins}/${goalInfo.requiredMinutes} phút & giữ được ngọn lửa hôm nay 🔥."`;
    } else {
      homeSubtitle.textContent = `"Hôm nay bạn mới học ${studiedMins}/${goalInfo.requiredMinutes} phút (${goalInfo.stageName}). Học đủ ${goalInfo.requiredMinutes} phút để thắp lửa nhé!"`;
    }
  }
}

function showStreakToast(streakCount) {
  const toast = document.getElementById('streak-toast');
  const msg = document.getElementById('streak-toast-msg');
  if (!toast || !msg) return;

  msg.textContent = `Tuyệt vời Minh Hiếu! Bạn vừa duy trì chuỗi học ${streakCount} ngày liên tiếp! 🔥`;
  toast.classList.remove('translate-y-[-150%]', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-[-150%]', 'opacity-0', 'pointer-events-none');
  }, 4000);
}

function openStreakModal() {
  const data = getStreakData();
  const today = getLocalDateString();
  const isTodayActive = (data.lastActiveDate === today);

  // Calculate current week days (Monday -> Sunday)
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon...
  const distanceToMonday = (currentDayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - distanceToMonday);

  const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  let weekDaysHtml = '';

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = getLocalDateString(d);
    const dayNum = d.getDate();
    const isToday = (dateStr === today);
    const hasLearned = Array.isArray(data.history) && data.history.includes(dateStr);
    const isFuture = (d > now && !isToday);

    let dayBadge = '';
    let dayBorder = isToday ? 'border-2 border-orange-500 bg-orange-50/50 shadow-xs' : 'border border-slate-200 bg-white';

    if (hasLearned) {
      dayBadge = `
        <div class="w-8 h-8 mx-auto rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center text-sm shadow-sm font-black">
          🔥
        </div>
      `;
    } else if (isToday) {
      dayBadge = `
        <div class="w-8 h-8 mx-auto rounded-full bg-orange-100 text-orange-600 border border-orange-300 flex items-center justify-center text-xs font-black animate-pulse">
          ⚡
        </div>
      `;
    } else if (isFuture) {
      dayBadge = `
        <div class="w-8 h-8 mx-auto rounded-full bg-slate-100 text-slate-300 flex items-center justify-center text-xs font-bold">
          •
        </div>
      `;
    } else {
      // Past day missed
      dayBadge = `
        <div class="w-8 h-8 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-bold">
          -
        </div>
      `;
    }

    weekDaysHtml += `
      <div class="p-2 rounded-2xl flex flex-col items-center gap-1.5 ${dayBorder} transition">
        <span class="text-[10px] font-black ${isToday ? 'text-orange-600' : 'text-slate-400'}">${dayNames[i]}</span>
        ${dayBadge}
        <span class="text-[10px] font-bold ${isToday ? 'text-orange-700 font-black' : 'text-slate-500'}">${dayNum}</span>
      </div>
    `;
  }

  // Remove existing modal if any
  const existing = document.getElementById('streak-modal');
  if (existing) existing.remove();

  const modalHtml = `
    <div id="streak-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div class="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-150">
        <!-- Close button -->
        <button onclick="closeModal('streak-modal')" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer">
          ✕
        </button>
        
        <!-- Header Flame -->
        <div class="text-center pt-2 pb-4">
          <div class="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center text-4xl shadow-xl shadow-orange-500/30 mb-3 animate-bounce">
            🔥
          </div>
          <h3 class="text-2xl font-black text-slate-900 tracking-tight">
            ${data.currentStreak} Ngày Liên Tiếp!
          </h3>
          <p class="text-xs text-slate-500 font-medium mt-1 px-4">
            ${isTodayActive 
              ? '🎉 Tuyệt vời Minh Hiếu! Bạn đã thắp sáng ngọn lửa học tập hôm nay.' 
              : '⚡ Hôm nay bạn chưa thắp lửa! Hãy học bài hoặc bấm điểm danh để nối dài chuỗi nhé.'}
          </p>
        </div>

        <!-- 7-Day Week Progress -->
        <div class="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/70 mb-5">
          <div class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
            Tiến độ tuần này
          </div>
          <div class="grid grid-cols-7 gap-1.5 text-center">
            ${weekDaysHtml}
          </div>
        </div>

        <!-- Stats Row -->
        <div class="grid grid-cols-2 gap-3 mb-5">
          <div class="p-3.5 rounded-2xl bg-orange-50/80 border border-orange-100 text-center">
            <div class="text-[11px] font-extrabold text-orange-600">Kỷ lục cao nhất</div>
            <div class="text-xl font-black text-orange-700 mt-0.5">${data.bestStreak || 1} ngày</div>
          </div>
          <div class="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-center">
            <div class="text-[11px] font-extrabold text-[#5648ee]">Tổng ngày đã học</div>
            <div class="text-xl font-black text-[#5648ee] mt-0.5">${data.totalDays || 1} ngày</div>
          </div>
        </div>

        <!-- Motivational Quote -->
        <div class="p-3 rounded-xl bg-amber-50 border border-amber-200/60 text-center mb-4 text-xs text-amber-800 font-medium">
          💡 <em>"Mỗi ngày một chút thói quen nhỏ sẽ tạo nên bước nhảy vọt điểm số TOEIC 600+!"</em>
        </div>

        <!-- Daily Reminder Quick Status inside Streak Modal -->
        <div class="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex items-center justify-between gap-3 mb-5">
          <div class="flex items-center gap-2.5 text-left">
            <div class="w-8 h-8 rounded-xl bg-indigo-100 text-[#5648ee] flex items-center justify-center text-sm font-black flex-shrink-0">
              🔔
            </div>
            <div>
              <div class="text-xs font-black text-slate-800">Nhắc nhở giữ lửa Streak</div>
              <div class="text-[11px] text-slate-500 font-medium">Bật thông báo lúc 20:00 mỗi tối</div>
            </div>
          </div>
          <button onclick="closeModal('streak-modal'); openReminderSettingsModal()" class="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-[#5648ee] font-black text-xs hover:bg-indigo-50 shadow-2xs transition cursor-pointer flex-shrink-0">
            Cài đặt 🔔
          </button>
        </div>

        <!-- Action Buttons -->
        <div class="space-y-2.5">
          ${(() => {
            const gInfo = getStreakGoalInfo(data.startDate || DEFAULT_STREAK_START_DATE, today);
            const studiedM = Math.floor(getTodayLocalStudySeconds() / 60);
            const pct = Math.min(100, Math.round((studiedM / gInfo.requiredMinutes) * 100));
            return `
              <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 mb-2">
                <div class="flex items-center justify-between text-[11px] font-black mb-1.5">
                  <span class="text-slate-700">${gInfo.stageName}</span>
                  <span class="${studiedM >= gInfo.requiredMinutes ? 'text-emerald-600' : 'text-orange-600'}">${studiedM} / ${gInfo.requiredMinutes} phút</span>
                </div>
                <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div class="${studiedM >= gInfo.requiredMinutes ? 'bg-emerald-500' : 'bg-orange-500'} h-full rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                </div>
              </div>
            `;
          })()}
          ${!isTodayActive ? `
            <button onclick="checkInStreakManually()" class="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-105 active:scale-98 text-white font-black text-sm shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 transition cursor-pointer">
              <span class="text-base">🔥</span> Thắp lửa & Điểm danh ngay
            </button>
          ` : `
            <div class="w-full py-3 px-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-xs flex items-center justify-center gap-2">
              <i data-lucide="check-circle" class="w-4 h-4"></i> Đã hoàn thành điểm danh hôm nay!
            </div>
          `}
          <button onclick="closeModal('streak-modal'); switchTab('vocabulary')" class="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-[#5648ee]"></i> Học từ vựng Flashcard ngay (2 phút)
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (window.lucide) lucide.createIcons();
}

// ================= DAILY REMINDER & WEB NOTIFICATION ENGINE =================
const REMINDER_STORAGE_KEY = 'mihi_reminder_settings_v2';
let swRegistration = null;

function getReminderSettings() {
  try {
    const raw = localStorage.getItem(REMINDER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.enabled === 'boolean') {
        if (!parsed.morningTime) parsed.morningTime = '08:00';
        if (!parsed.eveningTime) parsed.eveningTime = parsed.reminderTime || '20:00';
        if (!('morningEnabled' in parsed)) parsed.morningEnabled = true;
        if (!('eveningEnabled' in parsed)) parsed.eveningEnabled = true;
        return parsed;
      }
    }
    // Check legacy v1 settings
    const legacyRaw = localStorage.getItem('mihi_reminder_settings_v1');
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      return {
        enabled: legacy.enabled ?? true,
        morningEnabled: true,
        morningTime: '08:00',
        lastMorningNotifiedDate: null,
        eveningEnabled: true,
        eveningTime: legacy.reminderTime || '20:00',
        lastEveningNotifiedDate: legacy.lastNotifiedDate || null
      };
    }
  } catch (e) {
    console.error('Error reading reminder settings:', e);
  }

  // Default reminder settings: 8h sáng & 8h tối (20:00)
  const defaults = {
    enabled: true,
    morningEnabled: true,
    morningTime: '08:00',
    lastMorningNotifiedDate: null,
    eveningEnabled: true,
    eveningTime: '20:00',
    lastEveningNotifiedDate: null
  };
  saveReminderSettings(defaults);
  return defaults;
}

function saveReminderSettings(settings) {
  try {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving reminder settings:', e);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

let webPushSubscribed = false;

async function registerWebPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Web Push is not supported in this browser.');
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      const keyResp = await fetch('/api/push/public-key');
      if (!keyResp.ok) return null;
      const { publicKey } = await keyResp.json();
      const convertedKey = urlBase64ToUint8Array(publicKey);

      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      });
      webPushSubscribed = true;
      console.log('MiHi TOEIC Web Push registered with server successfully');
      return sub;
    }
  } catch (err) {
    console.warn('Web push register failed or permission not granted:', err);
  }
  return null;
}

async function testWebPushFromUI() {
  const hasPerm = ('Notification' in window) && Notification.permission === 'granted';
  if (!hasPerm) {
    const granted = await requestReminderPermission();
    if (!granted) {
      alert('Vui lòng chọn "Cho phép (Allow)" khi trình duyệt hỏi quyền thông báo nhé!');
      return;
    }
  }

  const btn = document.getElementById('webpush-test-btn');
  if (btn) btn.innerHTML = '⏳ Đang gửi thông báo trang web...';

  try {
    const sub = await registerWebPushSubscription();
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert('🎉 Đã gửi thông báo từ trang web MiHi TOEIC! Bạn hãy nhìn góc màn hình máy tính / thanh thông báo điện thoại nhé!');
    } else {
      alert('Lỗi: ' + (data.error || 'Vui lòng kiểm tra lại quyền thông báo'));
    }
  } catch (err) {
    alert('Lỗi gửi Web Push: ' + err.message);
  } finally {
    if (btn) btn.innerHTML = '🔔 Gửi thông báo thử nghiệm từ trang web ngay';
  }
}

async function initDailyReminders() {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('MiHi TOEIC Service Worker registered successfully');

      // Auto-register Web Push subscription if permission already granted
      if (('Notification' in window) && Notification.permission === 'granted') {
        registerWebPushSubscription();
      }
    } catch (err) {
      console.log('Service Worker registration skipped or failed:', err);
    }
  }

  updateReminderBellUI();

  // Check periodically (every 60 seconds)
  checkDailyReminderScheduler();
  setInterval(checkDailyReminderScheduler, 60000);
}

function updateReminderBellUI() {
  const dot = document.getElementById('reminder-bell-dot');
  const btn = document.getElementById('reminder-bell-btn');
  if (!dot || !btn) return;

  const settings = getReminderSettings();
  const hasPermission = ('Notification' in window) && Notification.permission === 'granted';

  if (settings.enabled && hasPermission) {
    dot.classList.remove('hidden');
    btn.classList.add('text-indigo-600', 'bg-indigo-50');
    btn.title = `Nhắc nhở học: 8h Sáng (${settings.morningTime}) & 8h Tối (${settings.eveningTime})`;
  } else {
    dot.classList.add('hidden');
    btn.classList.remove('text-indigo-600', 'bg-indigo-50');
    btn.title = 'Cài đặt thông báo nhắc học (8h Sáng & 8h Tối)';
  }
}

async function requestReminderPermission() {
  if (!('Notification' in window)) {
    alert('Trình duyệt của bạn hiện chưa hỗ trợ Web Notification.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    const settings = getReminderSettings();
    if (permission === 'granted') {
      settings.enabled = true;
      saveReminderSettings(settings);
      updateReminderBellUI();
      // Register with backend Web Push service
      await registerWebPushSubscription();
      return true;
    } else {
      settings.enabled = false;
      saveReminderSettings(settings);
      updateReminderBellUI();
      return false;
    }
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

async function sendBrowserNotification(title, options = {}) {
  const finalOptions = {
    icon: 'https://estudyme.com/images/icon/estudyme/favicon.png',
    badge: 'https://estudyme.com/images/icon/estudyme/favicon.png',
    vibrate: [200, 100, 200],
    data: { url: '/' },
    ...options
  };

  if (swRegistration && swRegistration.showNotification) {
    return swRegistration.showNotification(title, finalOptions);
  } else if ('Notification' in window && Notification.permission === 'granted') {
    return new Notification(title, finalOptions);
  }
}

async function testReminderNotificationNow(type = 'morning') {
  const hasPerm = ('Notification' in window) && Notification.permission === 'granted';
  if (!hasPerm) {
    const granted = await requestReminderPermission();
    if (!granted) {
      alert('Vui lòng chọn "Cho phép (Allow)" khi trình duyệt hỏi quyền thông báo để nhận lời nhắc học nhé!');
      return;
    }
  }

  const settings = getReminderSettings();
  const streak = getStreakData();
  const now = new Date();
  const dayOfWeek = now.getDay();

  if (type === 'morning') {
    await sendBrowserNotification('🌅 MiHi TOEIC: Chào buổi sáng Minh Hiếu!', {
      body: `Mục tiêu hôm nay: Dành 20-30 phút mở Flashcard học 1 chủ đề từ vựng & ôn từ cũ nhé! 🔥 Chuỗi: ${streak.currentStreak} ngày.`,
      tag: 'mihi-test-morning-notification'
    });
    alert('Đã gửi thông báo Buổi Sáng thử nghiệm (8h00)! Kiểm tra màn hình nhé 🔔');
  } else {
    let focusText = 'Đọc 1 chuyên đề Ngữ pháp + Luyện Reading Part 5 & 7';
    if (dayOfWeek === 0) {
      focusText = 'Làm 1 đề Mini Test hoặc Full Test 200 câu';
    } else if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
      focusText = 'Luyện 2-3 bài Listening Part 1/2 hoặc Part 3/4 + Xem transcript';
    }

    await sendBrowserNotification('🔥 MiHi TOEIC: Minh Hiếu ơi! Nguy cơ mất Streak!', {
      body: `Hôm nay bạn chưa học bài! Chuỗi ${streak.currentStreak} ngày sắp tắt. Tối nay theo lịch: ${focusText} (60-80 phút). Vào học ngay nào!`,
      tag: 'mihi-test-evening-notification'
    });
    alert('Đã gửi thông báo Cứu Streak Buổi Tối thử nghiệm (20h00)! Kiểm tra màn hình nhé 🔥');
  }
}

async function checkDailyReminderScheduler() {
  const settings = getReminderSettings();
  if (!settings.enabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const today = getLocalDateString();
  const streak = getStreakData();
  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMins = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMins}`;
  const dayOfWeek = now.getDay();

  let changed = false;

  // 1. Morning Reminder (08:00 AM)
  if (settings.morningEnabled && settings.lastMorningNotifiedDate !== today && currentTimeStr >= (settings.morningTime || '08:00')) {
    await sendBrowserNotification('🌅 Chào buổi sáng Minh Hiếu! Cùng học MiHi TOEIC nào!', {
      body: `Dành 20-30 phút mở Flashcard học 1 chủ đề từ vựng và ôn từ cũ nhé! 🔥 Chuỗi Streak hiện tại: ${streak.currentStreak} ngày.`,
      tag: 'mihi-morning-reminder'
    });
    settings.lastMorningNotifiedDate = today;
    changed = true;
  }

  // 2. Evening Streak Rescue Alert (20:00 PM / 8h Tối)
  if (settings.eveningEnabled && settings.lastEveningNotifiedDate !== today && currentTimeStr >= (settings.eveningTime || '20:00')) {
    // ONLY send if user has NOT studied today!
    if (streak.lastActiveDate !== today) {
      let eveningMsg = `Chuỗi Streak ${streak.currentStreak} ngày của bạn sắp tắt rồi!`;
      if (dayOfWeek === 0) {
        eveningMsg = `Chủ Nhật: Dành 90 phút làm đề Mini Test / Full Test và chữa cặn kẽ để giữ chuỗi Streak ${streak.currentStreak} ngày nhé!`;
      } else if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
        eveningMsg = `Thứ ${dayOfWeek + 1} (Listening): Luyện 2-3 bài Part 1/2 hoặc Part 3/4 (60-80 phút) để giữ chuỗi Streak ${streak.currentStreak} ngày nhé!`;
      } else {
        eveningMsg = `Thứ ${dayOfWeek + 1} (Reading): Ôn 1 bài Ngữ pháp & Luyện Reading Part 5/7 (60-80 phút) để giữ chuỗi Streak ${streak.currentStreak} ngày nhé!`;
      }

      await sendBrowserNotification('🔥 Minh Hiếu ơi! Nguy cơ mất chuỗi Streak!', {
        body: eveningMsg,
        tag: 'mihi-evening-streak-alert'
      });
    }

    // Mark as checked today so it doesn't repeatedly notify
    settings.lastEveningNotifiedDate = today;
    changed = true;
  }

  if (changed) {
    saveReminderSettings(settings);
  }
}

let telegramConfigCache = null;

async function fetchTelegramStatus() {
  try {
    const res = await fetch('/api/telegram/status');
    if (res.ok) {
      telegramConfigCache = await res.json();
      return telegramConfigCache;
    }
  } catch (e) {
    console.warn('Could not fetch Telegram status:', e);
  }
  return null;
}

async function openReminderSettingsModal() {
  const settings = getReminderSettings();
  const hasPermission = ('Notification' in window) && (Notification.permission === 'granted');
  const isDenied = ('Notification' in window) && (Notification.permission === 'denied');

  const existing = document.getElementById('reminder-modal');
  if (existing) existing.remove();

  // Pre-fetch telegram config
  const tele = await fetchTelegramStatus() || { configured: false };

  const modalHtml = `
    <div id="reminder-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div class="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        <!-- Close button -->
        <button onclick="closeModal('reminder-modal')" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer">
          ✕
        </button>

        <div class="text-center pt-2 pb-4">
          <div class="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 text-[#5648ee] flex items-center justify-center text-3xl mb-3 shadow-sm shadow-indigo-100">
            🔔
          </div>
          <h3 class="text-2xl font-black text-slate-900 tracking-tight">
            Lịch Nhắc Nhở Học Tập & Cứu Streak
          </h3>
          <p class="text-xs text-slate-500 font-medium mt-1">
            Gửi thông báo đúng 8h sáng & 8h tối bất kể bạn đang ở đâu 🔥
          </p>
        </div>

        <!-- BROWSER NOTIFICATION SECTION (MAIN) -->
        <div class="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200/80 mb-5">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-xl">🌐</span>
              <div>
                <div class="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                  Thông Báo Trực Tiếp Từ Trang Web
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-200 text-indigo-800">MiHi TOEIC</span>
                </div>
                <div class="text-[11px] text-indigo-800 font-medium">Nổ thông báo ngay trên màn hình máy tính / điện thoại cả khi đóng web</div>
              </div>
            </div>
          </div>

          <!-- Permission Status Box -->
          <div class="p-3 bg-white/90 rounded-xl border border-indigo-100 mb-3 text-xs flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="text-base">${hasPermission ? '✅' : (isDenied ? '❌' : '⚠️')}</span>
              <span class="font-bold text-slate-800">
                ${hasPermission ? 'Trình duyệt đã cho phép trang web gửi thông báo' : (isDenied ? 'Bạn đang chặn thông báo trên trình duyệt' : 'Chưa bật quyền thông báo')}
              </span>
            </div>
            ${!hasPermission ? `
              <button onclick="requestReminderPermission().then(() => openReminderSettingsModal())" class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-extrabold text-[11px] hover:bg-indigo-700 shadow-2xs cursor-pointer">
                Bật quyền
              </button>
            ` : ''}
          </div>

          <!-- Web Push Test Button -->
          <button onclick="testWebPushFromUI()" id="webpush-test-btn" class="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-[#5648ee] hover:brightness-105 active:scale-98 text-white font-black text-xs shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition cursor-pointer">
            <i data-lucide="bell" class="w-4 h-4"></i> 🔔 Bấm thử thông báo từ trang web ngay
          </button>
        </div>

        <!-- Cron-job.org URLs Box -->
        <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 mb-5 text-xs">
          <div class="text-xs font-black text-slate-800 mb-1 flex items-center gap-1.5">
            <span>⏰</span> Link cài đặt trên cron-job.org (Để web tự gửi lúc 8h sáng & 8h tối):
          </div>
          <div class="space-y-1.5 text-[11px] font-mono text-slate-600">
            <div class="p-2 bg-white rounded-lg border border-slate-200 select-all">
              <span class="text-amber-700 font-bold font-sans">🌅 8h Sáng:</span><br>
              <code>https://${window.location.host}/api/push/cron?force=morning</code>
            </div>
            <div class="p-2 bg-white rounded-lg border border-slate-200 select-all">
              <span class="text-rose-700 font-bold font-sans">🔥 20h Tối:</span><br>
              <code>https://${window.location.host}/api/push/cron?force=evening</code>
            </div>
          </div>
        </div>

        <!-- Settings Form -->
        <div class="space-y-3.5 mb-5">
          <!-- Master Toggle -->
          <div class="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div>
              <div class="text-xs font-black text-slate-800">Bật nhắc nhở mỗi ngày</div>
              <div class="text-[11px] text-slate-500 mt-0.5">Tự động gửi thông báo theo lịch trình ôn thi</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="reminder-toggle-input" ${settings.enabled ? 'checked' : ''} onchange="toggleMasterReminder(this.checked)" class="sr-only peer">
              <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5648ee]"></div>
            </label>
          </div>

          <!-- Morning 8h Schedule Box -->
          <div class="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-base">🌅</span>
                <div>
                  <div class="text-xs font-black text-amber-950">1. Nhắc nhở Buổi Sáng (Mặc định 8h00)</div>
                  <div class="text-[11px] text-amber-800 font-medium">Học Flashcard 1 chủ đề từ vựng (20-30 phút)</div>
                </div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${settings.morningEnabled ? 'checked' : ''} onchange="toggleMorningReminder(this.checked)" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>
            <div class="grid grid-cols-4 gap-2 mt-2">
              ${['07:00', '07:30', '08:00', '08:30'].map(t => `
                <button onclick="setMorningTime('${t}')" class="py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${settings.morningTime === t ? 'bg-amber-600 text-white shadow-xs' : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-100/60'}">
                  ${t}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Evening 8h (20h) Streak Rescue Box -->
          <div class="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/80">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-base">🔥</span>
                <div>
                  <div class="text-xs font-black text-rose-950">2. Cảnh Báo Cứu Streak Buổi Tối (Mặc định 20h00)</div>
                  <div class="text-[11px] text-rose-800 font-medium">Chỉ thông báo nếu bạn chưa học bài hôm đó!</div>
                </div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${settings.eveningEnabled ? 'checked' : ''} onchange="toggleEveningReminder(this.checked)" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>
            <div class="grid grid-cols-4 gap-2 mt-2">
              ${['19:30', '20:00', '20:30', '21:00'].map(t => `
                <button onclick="setEveningTime('${t}')" class="py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${settings.eveningTime === t ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-rose-200 text-rose-900 hover:bg-rose-100/60'}">
                  ${t}
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Buttons -->
        <div class="space-y-2.5">
          <div class="grid grid-cols-2 gap-2">
            <button onclick="testReminderNotificationNow('morning')" class="py-2.5 px-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer">
              🌅 Thử web 8h Sáng
            </button>
            <button onclick="testReminderNotificationNow('evening')" class="py-2.5 px-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer">
              🔥 Thử web 8h Tối
            </button>
          </div>
          <button onclick="closeModal('reminder-modal')" class="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer">
            Đóng
          </button>
        </div>

        <!-- Keep-Alive tip -->
        <div class="mt-4 p-3 bg-slate-50 rounded-2xl text-[11px] text-slate-500 leading-relaxed border border-slate-200/60">
          💡 <strong>Mẹo giữ server Render không ngủ:</strong> Thêm link <code>https://${window.location.hostname}/api/health</code> vào dịch vụ miễn phí như <a href="https://cron-job.org" target="_blank" class="text-sky-600 font-bold underline">cron-job.org</a> hoặc <a href="https://uptimerobot.com" target="_blank" class="text-sky-600 font-bold underline">UptimeRobot</a> để ping mỗi 10 phút nhé!
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (window.lucide) lucide.createIcons();
}

async function saveTelegramSettingsFromUI() {
  const tokenInput = document.getElementById('tele-bot-token');
  const chatInput = document.getElementById('tele-chat-id');
  const botToken = tokenInput ? tokenInput.value.trim() : '';
  const chatId = chatInput ? chatInput.value.trim() : '';

  if (!botToken || !chatId) {
    alert('Vui lòng điền cả Bot Token và Chat ID nhé!');
    return;
  }

  const btn = document.getElementById('tele-save-btn');
  if (btn) btn.innerHTML = '⏳ Đang lưu & xác thực...';

  try {
    const res = await fetch('/api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, chatId, enabled: true })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert('🎉 Đã kết nối Telegram thành công! Hãy bấm "Gửi tin nhắn thử nghiệm" để kiểm tra trên điện thoại.');
      await fetchTelegramStatus();
      openReminderSettingsModal();
    } else {
      alert('Lỗi: ' + (data.error || 'Không thể lưu cấu hình'));
    }
  } catch (err) {
    alert('Lỗi kết nối: ' + err.message);
  } finally {
    if (btn) btn.innerHTML = '💾 Lưu cấu hình Telegram';
  }
}

async function testTelegramFromUI() {
  const tokenInput = document.getElementById('tele-bot-token');
  const chatInput = document.getElementById('tele-chat-id');
  const botToken = tokenInput ? tokenInput.value.trim() : '';
  const chatId = chatInput ? chatInput.value.trim() : '';

  const btn = document.getElementById('tele-test-btn');
  if (btn) btn.innerHTML = '⏳ Đang gửi tới Telegram...';

  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, chatId })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert('🎉 Đã gửi tin nhắn thành công! Mở ứng dụng Telegram trên điện thoại để kiểm tra nhé!');
    } else {
      alert('Lỗi gửi Telegram: ' + (data.error || 'Vui lòng kiểm tra lại Bot Token và Chat ID'));
    }
  } catch (err) {
    alert('Lỗi gửi: ' + err.message);
  } finally {
    if (btn) btn.innerHTML = '✈️ Gửi tin nhắn thử nghiệm qua Telegram';
  }
}

function toggleMasterReminder(isEnabled) {
  const settings = getReminderSettings();
  settings.enabled = isEnabled;
  saveReminderSettings(settings);
  updateReminderBellUI();
  if (isEnabled && ('Notification' in window) && Notification.permission !== 'granted') {
    requestReminderPermission().then(() => openReminderSettingsModal());
  }
}

function toggleMorningReminder(isEnabled) {
  const settings = getReminderSettings();
  settings.morningEnabled = isEnabled;
  saveReminderSettings(settings);
  updateReminderBellUI();
  openReminderSettingsModal();
}

function toggleEveningReminder(isEnabled) {
  const settings = getReminderSettings();
  settings.eveningEnabled = isEnabled;
  saveReminderSettings(settings);
  updateReminderBellUI();
  openReminderSettingsModal();
}

function setMorningTime(timeStr) {
  const settings = getReminderSettings();
  settings.morningTime = timeStr;
  saveReminderSettings(settings);
  updateReminderBellUI();
  openReminderSettingsModal();
}

function setEveningTime(timeStr) {
  const settings = getReminderSettings();
  settings.eveningTime = timeStr;
  saveReminderSettings(settings);
  updateReminderBellUI();
  openReminderSettingsModal();
}

// ================= STUDY TIME TRACKER & DASHBOARD ENGINE =================
const STUDY_TIME_STORAGE_KEY = 'mihi_study_time_v1';
let lastUserInteractionTime = Date.now();
let currentStudyCategory = 'general';

function formatStudyTime(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getStudyTimeData() {
  try {
    const raw = localStorage.getItem(STUDY_TIME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.totalSeconds === 'number') {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading study time data:', e);
  }

  // Initial defaults
  const today = getLocalDateString();
  const defaults = {
    totalSeconds: 0,
    categories: {
      vocabulary: 0,
      grammar: 0,
      listening: 0,
      reading: 0,
      exam: 0,
      general: 0
    },
    daily: {
      [today]: {
        total: 0,
        vocabulary: 0,
        grammar: 0,
        listening: 0,
        reading: 0,
        exam: 0,
        general: 0
      }
    }
  };

  saveStudyTimeData(defaults);
  return defaults;
}

function saveStudyTimeData(data) {
  try {
    localStorage.setItem(STUDY_TIME_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving study time data:', e);
  }
}

function addStudyTime(seconds, category = 'vocabulary') {
  if (!seconds || seconds <= 0) return;
  const data = getStudyTimeData();
  const today = getLocalDateString();

  if (!data.categories) data.categories = {};
  if (!data.daily) data.daily = {};
  if (!data.daily[today]) {
    data.daily[today] = { total: 0, vocabulary: 0, grammar: 0, listening: 0, reading: 0, exam: 0, general: 0 };
  }

  data.totalSeconds = (data.totalSeconds || 0) + seconds;
  data.categories[category] = (data.categories[category] || 0) + seconds;

  data.daily[today].total = (data.daily[today].total || 0) + seconds;
  data.daily[today][category] = (data.daily[today][category] || 0) + seconds;

  saveStudyTimeData(data);

  // Auto-light streak when reaching today's progressive threshold (15p -> 30p -> 60p)
  const streakData = getStreakData();
  const goalInfo = getStreakGoalInfo(streakData.startDate || DEFAULT_STREAK_START_DATE, today);
  const todaySec = (data.daily && data.daily[today] && data.daily[today].total) || 0;
  if (todaySec >= goalInfo.requiredSeconds && streakData.lastActiveDate !== today) {
    recordStreakActivity('đủ mục tiêu ngày');
  }

  // If dashboard is currently visible, update numbers in real time
  const dbView = document.getElementById('view-dashboard');
  if (dbView && !dbView.classList.contains('hidden')) {
    const totalEl = document.getElementById('db-total-time');
    if (totalEl) totalEl.textContent = formatStudyTime(todaySec);
    renderCategoryBreakdown(data, today);
  }

  // Periodic sync to server for 9h target reminder
  syncStudyTimeToBackend(data, today);
}

let lastStudyTimeSync = 0;
function syncStudyTimeToBackend(data, today) {
  if (Date.now() - lastStudyTimeSync < 15000) return;
  lastStudyTimeSync = Date.now();
  const todaySeconds = data.daily && data.daily[today] ? data.daily[today].total : 0;
  fetch('/api/study-time/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: today,
      seconds: todaySeconds,
      categories: data.daily ? data.daily[today] : {}
    })
  }).catch(() => {});
  if (typeof syncAccountProgress === 'function') syncAccountProgress(false);
}

function initStudyTimeTracker() {
  const recordInteraction = () => {
    lastUserInteractionTime = Date.now();
  };

  ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
    window.addEventListener(evt, recordInteraction, { passive: true });
  });

  // Track active time every 5 seconds if user is active
  setInterval(() => {
    // Check if user interacted within last 2 minutes (120,000ms)
    const isUserActive = (Date.now() - lastUserInteractionTime) < 120000;
    if (!isUserActive) return;

    // Detect active category based on current UI view
    let activeCategory = 'general';

    const fcView = document.getElementById('view-flashcard');
    const examView = document.getElementById('view-exam');
    const lessonModal = document.getElementById('lesson-reader-modal');

    if (fcView && !fcView.classList.contains('hidden')) {
      activeCategory = 'vocabulary';
    } else if (examView && !examView.classList.contains('hidden')) {
      if (isSimulationMode) {
        activeCategory = 'exam';
      } else if (typeof activeSimulationPart === 'number' && activeSimulationPart <= 4) {
        activeCategory = 'listening';
      } else if (typeof activeSimulationPart === 'number' && activeSimulationPart >= 5) {
        activeCategory = 'reading';
      } else {
        activeCategory = 'exam';
      }
    } else if (lessonModal) {
      activeCategory = 'grammar';
    } else {
      const activeTabBtn = document.querySelector('.tab-btn.active');
      const activeTabId = activeTabBtn?.id || '';
      if (activeTabId.includes('grammar')) activeCategory = 'grammar';
      else if (activeTabId.includes('vocabulary')) activeCategory = 'vocabulary';
      else if (activeTabId.includes('simulation') || activeTabId.includes('fulltest') || activeTabId.includes('minitest')) activeCategory = 'exam';
      else if (activeTabId.includes('practice')) activeCategory = 'listening';
      else activeCategory = 'vocabulary';
    }

    currentStudyCategory = activeCategory;
    addStudyTime(5, activeCategory);
  }, 5000);
}

let currentCategoryTimeFilter = 'today';

function setCategoryFilter(filter) {
  currentCategoryTimeFilter = filter;
  const btnToday = document.getElementById('cat-filter-today');
  const btnAll = document.getElementById('cat-filter-all');
  if (btnToday && btnAll) {
    if (filter === 'today') {
      btnToday.className = 'px-2.5 py-1 rounded-md bg-white text-slate-900 shadow-2xs font-black transition';
      btnAll.className = 'px-2.5 py-1 rounded-md text-slate-500 hover:text-slate-800 transition font-bold';
    } else {
      btnAll.className = 'px-2.5 py-1 rounded-md bg-white text-slate-900 shadow-2xs font-black transition';
      btnToday.className = 'px-2.5 py-1 rounded-md text-slate-500 hover:text-slate-800 transition font-bold';
    }
  }
  const data = getStudyTimeData();
  const today = getLocalDateString();
  renderCategoryBreakdown(data, today);
}

function renderCategoryBreakdown(data, today) {
  const catEl = document.getElementById('db-category-cards');
  if (!catEl) return;
  const source = (currentCategoryTimeFilter === 'today')
    ? ((data.daily && data.daily[today]) || {})
    : (data.categories || {});

  const cats = [
    {
      key: 'vocabulary',
      name: 'Từ vựng (Flashcard & Quiz)',
      icon: 'sparkles',
      color: 'text-orange-600 bg-orange-50 border-orange-100',
      seconds: source.vocabulary || 0,
      sub: '48 chủ đề thông dụng',
      action: "switchTab('vocabulary')"
    },
    {
      key: 'grammar',
      name: 'Ngữ pháp TOEIC',
      icon: 'book-open',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-100',
      seconds: source.grammar || 0,
      sub: '38 chuyên đề lý thuyết & mẹo',
      action: "switchTab('grammar')"
    },
    {
      key: 'listening',
      name: 'Luyện nghe (Part 1 - 4)',
      icon: 'headphones',
      color: 'text-blue-600 bg-blue-50 border-blue-100',
      seconds: source.listening || 0,
      sub: 'Mô tả tranh, Hỏi-đáp, Hội thoại',
      action: "switchTab('practice')"
    },
    {
      key: 'reading',
      name: 'Luyện đọc (Part 5 - 7)',
      icon: 'file-text',
      color: 'text-teal-600 bg-teal-50 border-teal-100',
      seconds: source.reading || 0,
      sub: 'Hoàn thành câu, đoạn văn, bài đọc',
      action: "switchTab('practice')"
    },
    {
      key: 'exam',
      name: 'Đề thi thử (Full & Mini Test)',
      icon: 'award',
      color: 'text-[#5648ee] bg-indigo-50 border-indigo-100',
      seconds: source.exam || 0,
      sub: 'Thi chuẩn format ETS/IIG 200 câu',
      action: "switchTab('fulltest')"
    }
  ];

  catEl.innerHTML = cats.map(c => `
    <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-indigo-200 transition flex items-center justify-between gap-3 group">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl ${c.color} flex items-center justify-center font-black flex-shrink-0">
          <i data-lucide="${c.icon}" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="text-xs font-black text-slate-900 group-hover:text-[#5648ee] transition">${c.name}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">${c.sub}</div>
        </div>
      </div>
      <div class="text-right flex-shrink-0">
        <div class="text-sm font-black text-slate-800">${formatStudyTime(c.seconds)}</div>
        <button onclick="${c.action}" class="text-[10px] font-black text-[#5648ee] hover:underline cursor-pointer mt-0.5 block">Vào học →</button>
      </div>
    </div>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

function renderDashboardView() {
  const data = getStudyTimeData();
  const streakData = getStreakData();
  const today = getLocalDateString();
  const isTodayActive = (streakData.lastActiveDate === today);

  // 1. Date Quote
  const quoteEl = document.getElementById('dashboard-date-quote');
  if (quoteEl) {
    const now = new Date();
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = dayNames[now.getDay()];
    const dateFormatted = `${dayName}, ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    quoteEl.textContent = `${dateFormatted} • Bắt đầu hôm nay — chỉ vài phút mỗi ngày là đủ tạo thói quen.`;
  }

  // 2. Top Metrics
  const streakCountEl = document.getElementById('db-streak-count');
  if (streakCountEl) streakCountEl.textContent = streakData.currentStreak || 1;

  const todaySeconds = (data.daily && data.daily[today] && data.daily[today].total) || 0;

  const totalTimeEl = document.getElementById('db-total-time');
  if (totalTimeEl) totalTimeEl.textContent = formatStudyTime(todaySeconds);

  const xpEl = document.getElementById('db-xp-count');
  const earnedXp = 60 + Math.floor((data.totalSeconds || 0) / 60) * 2;
  if (xpEl) xpEl.textContent = `${earnedXp} XP`;

  // 3. Weekly Bar Chart (Monday -> Sunday)
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon...
  const distanceToMonday = (currentDayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - distanceToMonday);

  const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  let weeklyTotalSec = 0;
  const weekData = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = getLocalDateString(d);
    const daySec = (data.daily && data.daily[dateStr] && data.daily[dateStr].total) || 0;
    weeklyTotalSec += daySec;
    weekData.push({
      dateStr,
      dayNum: d.getDate(),
      dayLabel: dayLabels[i],
      seconds: daySec,
      minutes: Math.round(daySec / 60),
      isToday: (dateStr === today)
    });
  }

  const weeklyTotalEl = document.getElementById('db-weekly-total-time');
  if (weeklyTotalEl) weeklyTotalEl.textContent = formatStudyTime(weeklyTotalSec);

  // Render weekly chart bars
  const chartEl = document.getElementById('db-weekly-chart');
  if (chartEl) {
    const maxMinutes = Math.max(5, ...weekData.map(w => w.minutes));
    chartEl.innerHTML = weekData.map(w => {
      const heightPct = Math.max(8, Math.round((w.minutes / maxMinutes) * 100));
      const barColor = w.isToday 
        ? 'bg-gradient-to-t from-[#5648ee] to-[#7b6dfc] shadow-sm shadow-indigo-500/20' 
        : (w.minutes > 0 ? 'bg-gradient-to-t from-slate-400 to-slate-300' : 'bg-slate-100');

      return `
        <div class="flex-1 flex flex-col items-center h-full justify-end group">
          <span class="text-[10px] font-bold text-slate-500 mb-1 opacity-0 group-hover:opacity-100 transition">${w.minutes}p</span>
          <div class="w-full max-w-[38px] rounded-t-xl ${barColor} transition-all duration-500 cursor-pointer" style="height: ${heightPct}%;" title="${w.dayLabel} (${w.dayNum}): ${w.minutes} phút"></div>
          <span class="text-[11px] font-black mt-2 ${w.isToday ? 'text-[#5648ee]' : 'text-slate-400'}">${w.dayLabel}</span>
        </div>
      `;
    }).join('');
  }

  // 4. Category Breakdown: Học cái gì bao nhiêu phút
  renderCategoryBreakdown(data, today);

  // 5. Week Attendance (Tuần này)
  const attendRowEl = document.getElementById('db-week-attendance-row');
  const attendStatusEl = document.getElementById('db-attendance-status');

  if (attendStatusEl) {
    if (isTodayActive) {
      attendStatusEl.innerHTML = '<span class="text-emerald-600 font-black">✓ Đã điểm danh!</span>';
    } else {
      attendStatusEl.innerHTML = '<span class="text-amber-500 font-black">⚡ Chưa điểm danh hôm nay</span>';
    }
  }

  if (attendRowEl) {
    attendRowEl.innerHTML = weekData.map(w => {
      const isPastOrToday = (new Date(w.dateStr) <= new Date(today));
      const hasStudied = Array.isArray(streakData.history) && streakData.history.includes(w.dateStr);

      let circleContent = '';
      if (hasStudied) {
        circleContent = `
          <div class="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-xs mx-auto">
            ✓
          </div>
        `;
      } else if (w.isToday) {
        circleContent = `
          <div onclick="openStreakModal()" class="w-8 h-8 rounded-full bg-orange-100 border border-orange-300 text-orange-600 flex items-center justify-center font-black text-xs shadow-xs mx-auto animate-pulse cursor-pointer">
            🔥
          </div>
        `;
      } else {
        circleContent = `
          <div class="w-8 h-8 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center font-bold text-xs mx-auto">
            •
          </div>
        `;
      }

      return `
        <div class="flex flex-col items-center gap-1.5 p-1">
          <span class="text-[10px] font-black text-slate-400">${w.dayLabel}</span>
          ${circleContent}
        </div>
      `;
    }).join('');
  }

  // 6. Leaderboard (Bảng xếp hạng)
  const boardEl = document.getElementById('db-leaderboard-list');
  if (boardEl) {
    const userMinutesFormatted = formatStudyTime(data.totalSeconds);

    boardEl.innerHTML = `
      <!-- User's Highlighted Rank (Exact Match to Screenshot) -->
      <div class="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between gap-3 shadow-2xs">
        <div class="flex items-center gap-2.5">
          <span class="text-xs font-black text-slate-500 w-8">#1010</span>
          ${currentAuthUser ? `
            <div class="w-8 h-8 rounded-full overflow-hidden shadow-xs ring-2 ring-indigo-100 flex-shrink-0">
              <img src="${currentAuthUser.avatar || '/mihi.jpg'}" alt="${currentAuthUser.fullName}" class="w-full h-full object-cover">
            </div>
          ` : `
            <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-[#5648ee] to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-xs flex-shrink-0">
              B
            </div>
          `}
          <div>
            <div class="text-xs font-black text-slate-900">${currentAuthUser ? `Bạn (${currentAuthUser.fullName})` : 'Bạn (Khách)'}</div>
            <div class="text-[10px] text-amber-700 font-bold">Chăm chỉ mỗi ngày</div>
          </div>
        </div>
        <div class="px-2.5 py-1 rounded-full bg-white text-emerald-700 font-black text-xs border border-amber-200/70 shadow-2xs">
          ${userMinutesFormatted}
        </div>
      </div>

      <!-- Rank 1 -->
      <div class="p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between gap-3 transition">
        <div class="flex items-center gap-2.5">
          <span class="text-xs font-black text-amber-500 w-8 flex items-center gap-1">🥇 #1</span>
          <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm">
            🕶️
          </div>
          <div>
            <div class="text-xs font-bold text-slate-800">N.N</div>
            <div class="text-[10px] text-slate-400">🔥 2d</div>
          </div>
        </div>
        <span class="text-xs font-bold text-slate-600">26h 22m</span>
      </div>

      <!-- Rank 2 -->
      <div class="p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between gap-3 transition">
        <div class="flex items-center gap-2.5">
          <span class="text-xs font-black text-slate-400 w-8 flex items-center gap-1">🥈 #2</span>
          <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm">
            👤
          </div>
          <div>
            <div class="text-xs font-bold text-slate-800">dat phat</div>
            <div class="text-[10px] text-slate-400">🔥 8d</div>
          </div>
        </div>
        <span class="text-xs font-bold text-slate-600">25h 18m</span>
      </div>

      <!-- Rank 3 -->
      <div class="p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between gap-3 transition">
        <div class="flex items-center gap-2.5">
          <span class="text-xs font-black text-amber-700 w-8 flex items-center gap-1">🥉 #3</span>
          <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm">
            👩
          </div>
          <div>
            <div class="text-xs font-bold text-slate-800">Trần Thị Ngọc Dung</div>
            <div class="text-[10px] text-slate-400">🔥 15d</div>
          </div>
        </div>
        <span class="text-xs font-bold text-slate-600">22h 15m</span>
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

// ================= WRONG VOCABULARY 3-DAY SPACED REPETITION ENGINE =================
const WRONG_VOCAB_STORAGE_KEY = 'mihi_wrong_vocab_v1';
let wrongVocabList = [];
let isWrongVocabReviewMode = false;

function getLocalWrongVocab() {
  try {
    const raw = localStorage.getItem(WRONG_VOCAB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function saveLocalWrongVocab(list) {
  try {
    localStorage.setItem(WRONG_VOCAB_STORAGE_KEY, JSON.stringify(list || []));
  } catch (e) {}
}

async function loadWrongVocab() {
  // Render immediately from localStorage so UI never hangs on "Đang tải..."
  wrongVocabList = getLocalWrongVocab();
  renderHomeWrongVocabSection();

  try {
    const res = await fetch('/api/wrong-vocab');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items)) {
        // Merge server items with local items if server was empty or behind
        if (data.items.length > 0 || wrongVocabList.length === 0) {
          wrongVocabList = data.items;
          saveLocalWrongVocab(wrongVocabList);
        } else if (wrongVocabList.length > 0) {
          // Sync local items up to server
          fetch('/api/wrong-vocab/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cards: wrongVocabList })
          }).catch(() => {});
        }
        renderHomeWrongVocabSection(data.today);
      }
    }
  } catch (e) {
    console.error('Error loading wrong vocab:', e);
  }
}

async function recordWrongVocabWord(card) {
  if (!card || !card.word) return;
  const today = getLocalDateString();
  const dueDateObj = new Date();
  dueDateObj.setDate(dueDateObj.getDate() + 3);
  const dueDate = getLocalDateString(dueDateObj);

  const payloadCard = {
    id: card.id || String(card.word).trim().toLowerCase(),
    word: card.word,
    phonetic: card.phonetic || '',
    meaningVi: card.meaningVi || '',
    audioUrl: card.audioUrl || '',
    imageUrl: card.imageUrl || '',
    exampleEn: card.exampleEn || '',
    exampleVi: card.exampleVi || '',
    topicId: currentFlashcardTopicId || '',
    topicName: currentFlashcardTopicTitle || '',
    wrongDate: today,
    reviewDueDate: dueDate,
    notified: false
  };

  // Update local immediately
  const wordKey = String(payloadCard.word).trim().toLowerCase();
  const localList = getLocalWrongVocab();
  const idx = localList.findIndex(x => (x.id && payloadCard.id && x.id === payloadCard.id) || (x.word && x.word.toLowerCase() === wordKey));
  if (idx >= 0) localList[idx] = { ...payloadCard, wrongCount: (localList[idx].wrongCount || 1) + 1 };
  else localList.unshift({ ...payloadCard, wrongCount: 1 });
  wrongVocabList = localList;
  saveLocalWrongVocab(wrongVocabList);
  renderHomeWrongVocabSection(today);

  try {
    const res = await fetch('/api/wrong-vocab/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card: payloadCard })
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items)) {
        wrongVocabList = data.items;
        saveLocalWrongVocab(wrongVocabList);
        renderHomeWrongVocabSection(data.today);
      }
    }
  } catch (e) {
    console.error('Error saving wrong vocab:', e);
  }
}

async function markWrongVocabMastered(id, word, silent = false) {
  const wordKey = word ? String(word).trim().toLowerCase() : '';
  wrongVocabList = getLocalWrongVocab().filter(x => {
    if (id && x.id === id) return false;
    if (wordKey && x.word && x.word.toLowerCase() === wordKey) return false;
    return true;
  });
  saveLocalWrongVocab(wrongVocabList);
  if (!silent) renderHomeWrongVocabSection();

  try {
    const res = await fetch('/api/wrong-vocab/mastered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, word })
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items)) {
        wrongVocabList = data.items;
        saveLocalWrongVocab(wrongVocabList);
        if (!silent) renderHomeWrongVocabSection();
      }
    }
  } catch (e) {
    console.error('Error removing wrong vocab:', e);
  }
}

function renderHomeWrongVocabSection(todayStr = null) {
  const badgeEl = document.getElementById('home-wrong-vocab-badge');
  const actionsEl = document.getElementById('home-wrong-vocab-actions');
  const bodyEl = document.getElementById('home-wrong-vocab-body');
  if (!bodyEl) return;

  const today = todayStr || getLocalDateString();
  const total = wrongVocabList.length;
  const dueItems = wrongVocabList.filter(w => w.reviewDueDate && today >= w.reviewDueDate);

  if (badgeEl) {
    if (dueItems.length > 0) {
      badgeEl.textContent = `${dueItems.length} từ đến hạn ôn!`;
      badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse';
    } else {
      badgeEl.textContent = `${total} từ chờ ôn`;
      badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700';
    }
  }

  if (total === 0) {
    if (actionsEl) actionsEl.classList.add('hidden');
    bodyEl.innerHTML = `
      <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 text-xs font-medium text-center">
        🎉 Tuyệt vời! Hiện tại bạn chưa có từ vựng nào làm sai cần ôn lại. Khi làm <b>Kiểm tra từ mới</b> bị sai, từ đó sẽ tự động lưu vào đây và hẹn nhắc sau 3 ngày.
      </div>
    `;
    return;
  }

  if (actionsEl) actionsEl.classList.remove('hidden');

  const cardsHtml = wrongVocabList.slice(0, 8).map(w => {
    const isDue = w.reviewDueDate && today >= w.reviewDueDate;
    let dueLabel = 'Đến hạn ôn!';
    let dueClass = 'bg-rose-600 text-white';
    if (!isDue && w.reviewDueDate) {
      const diff = Math.max(1, Math.ceil((new Date(w.reviewDueDate + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000));
      dueLabel = `Còn ${diff} ngày`;
      dueClass = 'bg-amber-100 text-amber-800';
    }
    return `
      <div class="flex items-center justify-between gap-2 p-2.5 px-3 rounded-2xl bg-slate-50 hover:bg-rose-50/40 border border-slate-200/70 transition">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-black text-slate-900 text-xs">${w.word}</span>
            <span class="text-[11px] font-mono text-slate-400">${w.phonetic || ''}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${dueClass}">${dueLabel}</span>
          </div>
          <div class="text-[11px] text-slate-600 truncate mt-0.5">${w.meaningVi || ''}</div>
        </div>
        <button onclick="markWrongVocabMastered('${w.id}', '${String(w.word).replace(/'/g, "\\'")}')" class="w-7 h-7 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-400 hover:text-emerald-600 flex items-center justify-center flex-shrink-0 transition cursor-pointer" title="Đánh dấu đã thuộc & xóa khỏi danh sách">
          ✓
        </button>
      </div>
    `;
  }).join('');

  const moreNotice = wrongVocabList.length > 8
    ? `<div class="text-center text-[11px] text-slate-400 font-semibold mt-2">...và ${wrongVocabList.length - 8} từ khác. Bấm "Kiểm tra lại" để ôn toàn bộ ${wrongVocabList.length} từ!</div>`
    : '';

  bodyEl.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
      ${cardsHtml}
    </div>
    ${moreNotice}
  `;
  if (window.lucide) lucide.createIcons();
}

function startWrongVocabReview(mode = 'quiz') {
  if (!wrongVocabList || wrongVocabList.length === 0) {
    alert('Hiện tại chưa có từ vựng sai nào để ôn tập!');
    return;
  }

  isWrongVocabReviewMode = true;
  currentFlashcardTopicId = 'wrong_vocab_review';
  currentFlashcardTopicTitle = 'Ôn lại từ sai (Sau 3 ngày)';

  currentFlashcards = wrongVocabList.map(w => ({
    id: w.id || w.word,
    word: w.word,
    phonetic: w.phonetic || '',
    meaningVi: w.meaningVi || '',
    audioUrl: w.audioUrl || '',
    imageUrl: w.imageUrl || '',
    exampleEn: w.exampleEn || '',
    exampleVi: w.exampleVi || ''
  }));

  flashcardIndex = 0;
  flashcardStatus = {};
  flashcardFlags = new Set();
  quizQuestions = [];
  quizAnswers = {};
  quizFlags = new Set();
  quizCurrentIndex = 0;

  const titleEl = document.getElementById('fc-topic-title');
  if (titleEl) titleEl.textContent = currentFlashcardTopicTitle;

  showView('flashcard');
  switchFlashcardMode(mode === 'study' ? 'study' : 'quiz');
}

// ================= USER AUTHENTICATION (LOGIN / REGISTER) =================
const AUTH_TOKEN_KEY = 'mihi_auth_token_v1';
const AUTH_USER_KEY = 'mihi_auth_user_v1';
let currentAuthUser = null;

function getAuthToken() {
  try { return localStorage.getItem(AUTH_TOKEN_KEY) || ''; } catch (e) { return ''; }
}

function setAuthSession(token, user) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);

    if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_USER_KEY);
  } catch (e) {}
  currentAuthUser = user || null;
  updateAuthUI();
}

async function initAuth() {
  try {
    const cachedUser = localStorage.getItem(AUTH_USER_KEY);
    if (cachedUser) {
      currentAuthUser = JSON.parse(cachedUser);
      updateAuthUI();
    }
  } catch (e) {}

  const token = getAuthToken();
  if (!token) {
    updateAuthUI();
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.user) {
        setAuthSession(token, data.user);
        syncAccountProgress(true);
      } else {
        setAuthSession('', null);
      }
    }
  } catch (e) {
    console.error('Auth check error:', e);
  }
}

function updateAuthUI() {
  const loginBtn = document.getElementById('header-login-btn');
  const avatarEl = document.getElementById('header-user-avatar');
  const dbGreetingEl = document.getElementById('db-greeting-name');
  const dbAvatarEl = document.getElementById('db-greeting-avatar');
  const otherAvatars = document.querySelectorAll('.auth-only-avatar');

  if (currentAuthUser) {
    if (loginBtn) loginBtn.classList.add('hidden');
    if (avatarEl) {
      avatarEl.classList.remove('hidden');
      avatarEl.title = `${currentAuthUser.fullName} (@${currentAuthUser.username}) — Bấm xem tài khoản`;
      const img = avatarEl.querySelector('img');
      if (img) img.src = currentAuthUser.avatar || '/mihi.jpg';
    }
    if (dbGreetingEl) {
      dbGreetingEl.textContent = currentAuthUser.fullName || 'Phan Minh Hiếu';
    }
    if (dbAvatarEl) {
      dbAvatarEl.innerHTML = `<img src="${currentAuthUser.avatar || '/mihi.jpg'}" alt="${currentAuthUser.fullName}" class="w-full h-full object-cover">`;
    }
    otherAvatars.forEach(el => {
      el.classList.remove('hidden');
      const img = el.querySelector('img');
      if (img) img.src = currentAuthUser.avatar || '/mihi.jpg';
    });
  } else {
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (avatarEl) {
      avatarEl.classList.add('hidden');
    }
    if (dbGreetingEl) {
      dbGreetingEl.textContent = 'bạn mới';
    }
    if (dbAvatarEl) {
      dbAvatarEl.innerHTML = 'M';
    }
    otherAvatars.forEach(el => el.classList.add('hidden'));
  }
  if (window.lucide) lucide.createIcons();
}

function handleHeaderUserClick() {
  if (currentAuthUser) {
    openAccountModal();
  } else {
    openAuthModal('login');
  }
}

function openAuthModal(defaultTab = 'login') {
  const existing = document.getElementById('auth-modal');
  if (existing) existing.remove();

  const modalHtml = `
    <div id="auth-modal" onclick="if(event.target===this) closeModal('auth-modal')" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div class="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-150">
        <button onclick="closeModal('auth-modal')" class="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer">
          ✕
        </button>

        <!-- Brand Header -->
        <div class="text-center mb-5">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-[#5648ee] via-[#7564fb] to-[#ff6b3d] text-white font-black text-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-2.5">
            M
          </div>
          <h3 class="text-xl font-black text-slate-900">Tài khoản MiHi TOEIC</h3>
          <p class="text-xs text-slate-500 mt-0.5">Đăng nhập hoặc tạo tài khoản để đồng bộ tiến độ học tập</p>
        </div>

        <!-- Tabs: Đăng nhập / Đăng ký -->
        <div class="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl mb-5 text-xs font-black">
          <button id="auth-tab-login" onclick="switchAuthTab('login')" class="py-2 rounded-xl transition cursor-pointer">Đăng nhập</button>
          <button id="auth-tab-register" onclick="switchAuthTab('register')" class="py-2 rounded-xl transition cursor-pointer">Đăng ký</button>
        </div>

        <!-- Error / Success Box -->
        <div id="auth-error-box" class="hidden mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold"></div>

        <!-- PANEL 1: LOGIN FORM -->
        <form id="auth-login-form" onsubmit="submitAuthLogin(event)" class="space-y-3.5">
          <div>
            <label class="block text-xs font-extrabold text-slate-700 mb-1">Tên đăng nhập hoặc Email</label>
            <input id="auth-login-id" type="text" required placeholder="VD: minh_hieu hoặc email@gmail.com" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#5648ee]">
          </div>
          <div>
            <label class="block text-xs font-extrabold text-slate-700 mb-1">Mật khẩu</label>
            <div class="relative">
              <input id="auth-login-pass" type="password" required placeholder="Nhập mật khẩu..." class="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#5648ee]">
              <button type="button" onclick="toggleAuthPasswordVisibility('auth-login-pass')" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">👁️</button>
            </div>
          </div>
          <button type="submit" id="auth-login-submit" class="w-full py-3 rounded-2xl bg-gradient-to-r from-[#5648ee] to-[#4335df] hover:brightness-105 text-white font-black text-sm shadow-lg shadow-indigo-500/25 transition cursor-pointer">
            Đăng nhập ngay
          </button>
        </form>

        <!-- PANEL 2: REGISTER FORM -->
        <form id="auth-register-form" onsubmit="submitAuthRegister(event)" class="space-y-3 hidden">
          <div>
            <label class="block text-xs font-extrabold text-slate-700 mb-1">Họ và tên</label>
            <input id="auth-reg-name" type="text" required placeholder="VD: Phan Minh Hiếu" class="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#5648ee]">
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-extrabold text-slate-700 mb-1">Tên đăng nhập</label>
              <input id="auth-reg-user" type="text" required minlength="3" placeholder="minhhieu" class="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#5648ee]">
            </div>
            <div>
              <label class="block text-xs font-extrabold text-slate-700 mb-1">Email (tuỳ chọn)</label>
              <input id="auth-reg-email" type="email" placeholder="email@gmail.com" class="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#5648ee]">
            </div>
          </div>
          <div>
            <label class="block text-xs font-extrabold text-slate-700 mb-1">Mật khẩu (tối thiểu 6 ký tự)</label>
            <div class="relative">
              <input id="auth-reg-pass" type="password" required minlength="6" placeholder="••••••" class="w-full px-3.5 py-2 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#5648ee]">
              <button type="button" onclick="toggleAuthPasswordVisibility('auth-reg-pass')" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">👁️</button>
            </div>
          </div>
          <div>
            <label class="block text-xs font-extrabold text-slate-700 mb-1">Xác nhận mật khẩu</label>
            <input id="auth-reg-confirm" type="password" required minlength="6" placeholder="Nhập lại mật khẩu..." class="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#5648ee]">
          </div>
          <button type="submit" id="auth-reg-submit" class="w-full py-3 rounded-2xl bg-gradient-to-r from-[#ff6b3d] to-[#f59e0b] hover:brightness-105 text-white font-black text-sm shadow-lg shadow-orange-500/25 transition cursor-pointer mt-1">
            Tạo tài khoản mới
          </button>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  switchAuthTab(defaultTab);
}

function switchAuthTab(tab) {
  const loginTab = document.getElementById('auth-tab-login');
  const regTab = document.getElementById('auth-tab-register');
  const loginForm = document.getElementById('auth-login-form');
  const regForm = document.getElementById('auth-register-form');
  const errBox = document.getElementById('auth-error-box');
  if (errBox) errBox.classList.add('hidden');

  if (tab === 'register') {
    if (loginForm) loginForm.classList.add('hidden');
    if (regForm) regForm.classList.remove('hidden');
    if (regTab) regTab.className = 'py-2 rounded-xl bg-white text-[#5648ee] shadow-2xs transition cursor-pointer';
    if (loginTab) loginTab.className = 'py-2 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer';
  } else {
    if (regForm) regForm.classList.add('hidden');
    if (loginForm) loginForm.classList.remove('hidden');
    if (loginTab) loginTab.className = 'py-2 rounded-xl bg-white text-[#5648ee] shadow-2xs transition cursor-pointer';
    if (regTab) regTab.className = 'py-2 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer';
  }
}

function toggleAuthPasswordVisibility(inputId) {
  const inp = document.getElementById(inputId);
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

function showAuthError(msg) {
  const errBox = document.getElementById('auth-error-box');
  if (errBox) {
    errBox.textContent = msg;
    errBox.classList.remove('hidden');
  }
}

async function submitAuthLogin(e) {
  e.preventDefault();
  const identifier = document.getElementById('auth-login-id')?.value || '';
  const password = document.getElementById('auth-login-pass')?.value || '';
  const btn = document.getElementById('auth-login-submit');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthError(data.error || 'Đăng nhập thất bại.');
      if (btn) btn.disabled = false;
      return;
    }
    setAuthSession(data.token, data.user);
    await syncAccountProgress(true);
    closeModal('auth-modal');
  } catch (err) {
    showAuthError('Lỗi kết nối máy chủ.');
    if (btn) btn.disabled = false;
  }
}

async function submitAuthRegister(e) {
  e.preventDefault();
  const fullName = document.getElementById('auth-reg-name')?.value || '';
  const username = document.getElementById('auth-reg-user')?.value || '';
  const email = document.getElementById('auth-reg-email')?.value || '';
  const password = document.getElementById('auth-reg-pass')?.value || '';
  const confirm = document.getElementById('auth-reg-confirm')?.value || '';

  if (password !== confirm) {
    showAuthError('Mật khẩu xác nhận không khớp!');
    return;
  }

  const btn = document.getElementById('auth-reg-submit');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, username, email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthError(data.error || 'Đăng ký thất bại.');
      if (btn) btn.disabled = false;
      return;
    }
    setAuthSession(data.token, data.user);
    await syncAccountProgress(true);
    closeModal('auth-modal');
  } catch (err) {
    showAuthError('Lỗi kết nối máy chủ.');
    if (btn) btn.disabled = false;
  }
}

function openAccountModal() {
  if (!currentAuthUser) return openAuthModal('login');
  const existing = document.getElementById('account-modal');
  if (existing) existing.remove();

  const modalHtml = `
    <div id="account-modal" onclick="if(event.target===this) closeModal('account-modal')" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div class="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-150">
        <button onclick="closeModal('account-modal')" class="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer">
          ✕
        </button>

        <div class="text-center mb-5">
          <div class="w-16 h-16 mx-auto rounded-full overflow-hidden ring-4 ring-indigo-100 shadow-md mb-3">
            <img src="${currentAuthUser.avatar || '/mihi.jpg'}" alt="${currentAuthUser.fullName}" class="w-full h-full object-cover">
          </div>
          <h3 class="text-lg font-black text-slate-900">${currentAuthUser.fullName}</h3>
          <div class="text-xs text-slate-500 font-semibold">@${currentAuthUser.username}${currentAuthUser.email ? ` • ${currentAuthUser.email}` : ''}</div>
        </div>

        <form onsubmit="submitUpdateProfile(event)" class="space-y-3 mb-4">
          <div>
            <label class="block text-xs font-extrabold text-slate-700 mb-1">Đổi tên hiển thị</label>
            <div class="flex gap-2">
              <input id="account-fullname-input" type="text" required value="${String(currentAuthUser.fullName).replace(/"/g, '&quot;')}" class="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#5648ee]">
              <button type="submit" class="px-3.5 py-2 rounded-xl bg-[#5648ee] hover:bg-[#4335df] text-white text-xs font-black transition cursor-pointer">Lưu</button>
            </div>
          </div>
        </form>

        <div class="space-y-2">
          <button onclick="closeModal('account-modal'); showView('dashboard')" class="w-full py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#5648ee] font-black text-xs transition cursor-pointer">
            📊 Xem Dashboard Cá Nhân
          </button>
          <button onclick="logoutUser()" class="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-xs transition cursor-pointer">
            🚪 Đăng xuất
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function submitUpdateProfile(e) {
  e.preventDefault();
  const fullName = document.getElementById('account-fullname-input')?.value || '';
  const token = getAuthToken();
  if (!token) return;
  try {
    const res = await fetch('/api/auth/update-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ fullName })
    });
    const data = await res.json();
    if (res.ok && data.user) {
      setAuthSession(token, data.user);
      openAccountModal();
    }
  } catch (err) {}
}

async function syncAccountProgress(restoreToUi = false) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const fcProgress = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('mihi_fc_') || k.startsWith('mihi_flashcard_'))) {
        fcProgress[k] = localStorage.getItem(k);
      }
    }

    const payload = {
      streak: getStreakData(),
      studyTime: getStudyTimeData(),
      wrongVocab: getLocalWrongVocab(),
      flashcardProgress: fcProgress
    };

    const res = await fetch('/api/auth/progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      const merged = data.progress;
      if (merged) {
        if (merged.streak) {
          localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(merged.streak));
        }
        if (merged.studyTime) {
          localStorage.setItem(STUDY_TIME_STORAGE_KEY, JSON.stringify(merged.studyTime));
        }
        if (Array.isArray(merged.wrongVocab)) {
          wrongVocabList = merged.wrongVocab;
          saveLocalWrongVocab(wrongVocabList);
        }
        if (merged.flashcardProgress && typeof merged.flashcardProgress === 'object') {
          Object.keys(merged.flashcardProgress).forEach(k => {
            if (merged.flashcardProgress[k] !== undefined) {
              localStorage.setItem(k, merged.flashcardProgress[k]);
            }
          });
        }
        if (restoreToUi) {
          updateStreakUI();
          renderHomeWrongVocabSection();
          renderDashboardView();
        }
      }
    }
  } catch (e) {
    console.error('Account progress sync error:', e);
  }
}

async function logoutUser() {
  const token = getAuthToken();
  if (token) {
    // Save latest progress to server BEFORE logging out
    await syncAccountProgress(false);
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }).catch(() => {});
  }
  setAuthSession('', null);
  closeModal('account-modal');

  // Clear local progress cache for guest mode (account progress stays safely on server)
  try {
    localStorage.removeItem(STREAK_STORAGE_KEY);
    localStorage.removeItem(STUDY_TIME_STORAGE_KEY);
    localStorage.removeItem(WRONG_VOCAB_STORAGE_KEY);
  } catch (e) {}

  wrongVocabList = [];
  initStreak();
  renderHomeWrongVocabSection();
  showView('home');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}





