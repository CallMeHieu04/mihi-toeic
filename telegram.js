const fs = require('fs');
const path = require('path');
const dictionary = require('./dictionary');

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'telegram_config.json');

function getVietnamDate() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 7));
}

function getVietnamDateStr() {
  const d = getVietnamDate();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTelegramConfig() {
  let fileConfig = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) {
      console.error('Error reading telegram_config.json:', e);
    }
  }

  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || fileConfig.botToken || '9123628902:AAHnEqVmYO2uwfS2n3gVJeAyxQwM6WqDiKo',
    chatId: process.env.TELEGRAM_CHAT_ID || fileConfig.chatId || '6170605138',
    enabled: typeof fileConfig.enabled === 'boolean' ? fileConfig.enabled : true,
    morningEnabled: typeof fileConfig.morningEnabled === 'boolean' ? fileConfig.morningEnabled : true,
    morningTime: fileConfig.morningTime || '08:00',
    lastMorningNotifiedDate: fileConfig.lastMorningNotifiedDate || null,
    eveningEnabled: typeof fileConfig.eveningEnabled === 'boolean' ? fileConfig.eveningEnabled : true,
    eveningTime: fileConfig.eveningTime || '20:00',
    lastEveningNotifiedDate: fileConfig.lastEveningNotifiedDate || null,
    nightTargetEnabled: typeof fileConfig.nightTargetEnabled === 'boolean' ? fileConfig.nightTargetEnabled : true,
    nightTargetTime: fileConfig.nightTargetTime || '21:00',
    lastNightNotifiedDate: fileConfig.lastNightNotifiedDate || null
  };
}

function saveTelegramConfig(updated) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const current = getTelegramConfig();
  const merged = { ...current, ...updated };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

async function verifyBot(token) {
  if (!token) return { ok: false, error: 'Token is missing' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok) {
      return { ok: true, bot: data.result };
    }
    return { ok: false, error: data.description || 'Invalid token' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function sendTelegramMessage(text, replyMarkup = null, targetChatId = null) {
  const config = getTelegramConfig();
  const token = config.botToken;
  const chatId = targetChatId || config.chatId;

  if (!token || !chatId) {
    throw new Error('Chưa cấu hình Telegram Bot Token hoặc Chat ID');
  }

  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: false
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || 'Gửi tin nhắn Telegram thất bại');
  }

  return data.result;
}

const DEFAULT_STREAK_START_DATE = '2026-11-22';

function getStreakData() {
  const streakPath = path.join(DATA_DIR, 'streak.json');
  if (fs.existsSync(streakPath)) {
    try {
      return JSON.parse(fs.readFileSync(streakPath, 'utf-8'));
    } catch (e) {}
  }
  return null;
}

function getStreakGoalInfo(startDateStr = DEFAULT_STREAK_START_DATE, todayStr = null) {
  const today = todayStr || getVietnamDateStr();
  const start = new Date((startDateStr || DEFAULT_STREAK_START_DATE) + 'T00:00:00');
  const cur = new Date(today + 'T00:00:00');
  const diffDays = Math.max(0, Math.floor((cur - start) / 86400000));

  if (diffDays < 14) {
    return {
      requiredMinutes: 15,
      requiredSeconds: 15 * 60,
      stage: 1,
      stageName: 'Giai đoạn 1 (2 tuần đầu): 15 phút/ngày',
      daysElapsed: diffDays + 1
    };
  } else if (diffDays < 28) {
    return {
      requiredMinutes: 30,
      requiredSeconds: 30 * 60,
      stage: 2,
      stageName: 'Giai đoạn 2 (Tuần 3 - 4): 30 phút/ngày',
      daysElapsed: diffDays + 1
    };
  } else {
    return {
      requiredMinutes: 60,
      requiredSeconds: 60 * 60,
      stage: 3,
      stageName: 'Giai đoạn 3 (Duy trì): 60 phút/ngày',
      daysElapsed: diffDays + 1
    };
  }
}

function isStudiedToday() {
  const todayStr = getVietnamDateStr();
  const streakData = getStreakData();
  const startDate = (streakData && streakData.startDate) || DEFAULT_STREAK_START_DATE;
  const goalInfo = getStreakGoalInfo(startDate, todayStr);

  // Must study at least requiredMinutes (15p -> 30p -> 60p) to light today's streak!
  const studySec = getTodayStudyTimeSeconds();
  if (studySec >= goalInfo.requiredSeconds) {
    return true;
  }

  return false;
}

function getTodayStudyTimeSeconds() {
  const todayStr = getVietnamDateStr();
  let maxSec = 0;

  // 1. Check study_time.json
  const studyTimePath = path.join(DATA_DIR, 'study_time.json');
  if (fs.existsSync(studyTimePath)) {
    try {
      const studyData = JSON.parse(fs.readFileSync(studyTimePath, 'utf-8'));
      if (studyData[todayStr] && typeof studyData[todayStr].totalSeconds === 'number') {
        maxSec = Math.max(maxSec, studyData[todayStr].totalSeconds);
      }
    } catch (e) {}
  }

  // 2. Also sum history.json for today
  const historyPath = path.join(DATA_DIR, 'history.json');
  if (fs.existsSync(historyPath)) {
    try {
      const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      if (Array.isArray(history)) {
        let histSec = 0;
        history.forEach(item => {
          if (item.date && item.date.startsWith(todayStr)) {
            histSec += (item.timeSpentSeconds || 0);
          }
        });
        maxSec = Math.max(maxSec, histSec);
      }
    } catch (e) {}
  }

  return maxSec;
}

async function sendNightTargetReminder(baseUrl = 'https://mihi-toeic.onrender.com') {
  if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) baseUrl = 'https://mihi-toeic.onrender.com';
  const totalSec = getTodayStudyTimeSeconds();
  const TARGET_SECONDS = 3600; // 1 hour (60 minutes)

  // If already reached 1 hour or more, DO NOT send!
  if (totalSec >= TARGET_SECONDS) {
    const mins = Math.floor(totalSec / 60);
    console.log(`[Telegram] User already studied ${mins} mins (>= 60 mins). Night nag skipped.`);
    return { skipped: true, reason: `Đã học ${mins} phút (đạt mục tiêu >= 1 tiếng)` };
  }

  const studiedMins = Math.floor(totalSec / 60);
  const missingMins = Math.max(1, 60 - studiedMins);

  const text = `⏰ <b>MINH HIẾU ƠI! MỤC TIÊU 1 TIẾNG HỌC MỖI NGÀY!</b>

Bây giờ đã là <b>21:00 tối</b> rồi! 🌙
Hôm nay bạn học trên web chưa đủ 1 tiếng:

📊 <b>Tiến độ học hôm nay của bạn:</b>
• Đã học: <b>${studiedMins} phút</b> / 60 phút mục tiêu
• Còn thiếu: <b>${missingMins} phút</b> nữa để hoàn thành mục tiêu ngày!

🔥 Đừng để ngày hôm nay trôi qua dang dở nhé! Hãy dành ra <b>${missingMins} phút</b> vào lướt nhanh bộ thẻ Flashcard hoặc luyện 1 bài ngắn trước khi ngủ nào!`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: `🚀 Vào Học ${missingMins} Phút Nữa Ngay`, url: `${baseUrl}` }
      ]
    ]
  };

  return sendTelegramMessage(text, replyMarkup);
}

async function sendMorningReminder(baseUrl = 'https://mihi-toeic.onrender.com') {
  if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) baseUrl = 'https://mihi-toeic.onrender.com';
  const text = `🌅 <b>CHÀO BUỔI SÁNG MINH HIẾU!</b>

Hôm nay bạn đã sẵn sàng tiếp tục hành trình bứt phá mục tiêu TOEIC 600+ chưa?

🎯 <b>Lịch trình khởi động buổi sáng (20 - 30 phút):</b>
• Mở Flashcard học <b>1 chủ đề từ vựng mới</b> (20 từ)
• Ôn lại nhanh các từ vựng đã học hôm qua

🔥 <i>Bền bỉ mỗi ngày là chìa khóa chinh phục TOEIC đỉnh cao!</i>`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '📚 Mở Flashcard Từ Vựng Ngay', url: `${baseUrl}` }
      ]
    ]
  };

  return sendTelegramMessage(text, replyMarkup);
}

async function sendEveningStreakReminder(baseUrl = 'https://mihi-toeic.onrender.com') {
  if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) baseUrl = 'https://mihi-toeic.onrender.com';
  const studied = isStudiedToday();
  const vnDate = getVietnamDate();
  const dayOfWeek = vnDate.getDay(); // 0 = Sunday, 1 = Mon...
  const streakData = getStreakData();
  const goalInfo = getStreakGoalInfo((streakData && streakData.startDate) || DEFAULT_STREAK_START_DATE);
  const studiedMins = Math.floor(getTodayStudyTimeSeconds() / 60);
  const missingMins = Math.max(1, goalInfo.requiredMinutes - studiedMins);

  if (studied) {
    console.log('[Telegram Bot] User already reached daily streak goal. Evening streak is safe!');
    return { skipped: true, reason: 'Already reached daily streak goal' };
  }

  let scheduleFocus = '• <b>Thứ 3, 5, 7 (Reading):</b> Đọc 1 chuyên đề Ngữ pháp + Luyện 1 bài Part 5 & 1 bài Part 7 đoạn đơn.';
  if (dayOfWeek === 0) {
    scheduleFocus = '• <b>Chủ Nhật (Luyện Đề):</b> Làm 1 đề Mini Test hoặc Full Test 200 câu + Dành 45 phút chữa bài cặn kẽ.';
  } else if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
    scheduleFocus = '• <b>Thứ 2, 4, 6 (Listening):</b> Luyện 2-3 bài Part 1/2 hoặc Part 3/4 + Nghe lại transcript.';
  }

  const text = `🔥 <b>MINH HIẾU ƠI! CẢNH BÁO NGUY CƠ MẤT CHUỖI STREAK!</b>

Hôm nay bạn mới học <b>${studiedMins}/${goalInfo.requiredMinutes} phút</b> (${goalInfo.stageName})!
⏳ Bạn cần học thêm ít nhất <b>${missingMins} phút</b> nữa để thắp sáng chuỗi Streak hôm nay!

📚 <b>Trọng tâm bài học tối nay:</b>
${scheduleFocus}

👉 Vào web học thêm ${missingMins} phút ngay để giữ vững ngọn lửa Streak trước nửa đêm nhé!`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🔥 Vào Học Giữ Chuỗi Streak Ngay', url: `${baseUrl}` }
      ]
    ]
  };

  return sendTelegramMessage(text, replyMarkup);
}

async function checkTelegramScheduler(baseUrl = 'https://mihi-toeic.onrender.com', forceType = null) {
  const config = getTelegramConfig();
  if (!config.enabled && !forceType) {
    return { status: 'disabled' };
  }

  if (!config.botToken || !config.chatId) {
    return { status: 'not_configured' };
  }

  const today = getVietnamDateStr();
  const vnDate = getVietnamDate();
  const currentHours = String(vnDate.getHours()).padStart(2, '0');
  const currentMins = String(vnDate.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMins}`;

  const results = [];

  // Check Morning (08:00)
  const isMorningHours = currentTimeStr >= (config.morningTime || '08:00') && currentTimeStr < '12:00';
  if (forceType === 'morning' || (config.morningEnabled && config.lastMorningNotifiedDate !== today && isMorningHours)) {
    try {
      await sendMorningReminder(baseUrl);
      if (isMorningHours) {
        saveTelegramConfig({ lastMorningNotifiedDate: today });
      }
      results.push('Morning reminder sent');
    } catch (err) {
      console.error('[Telegram] Morning reminder error:', err);
      results.push('Morning reminder error: ' + err.message);
    }
  }

  // Check Evening (20:00)
  const isEveningHours = currentTimeStr >= (config.eveningTime || '20:00') && currentTimeStr <= '23:59';
  if (forceType === 'evening' || (config.eveningEnabled && config.lastEveningNotifiedDate !== today && isEveningHours)) {
    try {
      const res = await sendEveningStreakReminder(baseUrl);
      if (res && res.skipped) {
        results.push('Evening skipped (Already studied)');
      } else {
        if (isEveningHours) {
          saveTelegramConfig({ lastEveningNotifiedDate: today });
        }
        results.push('Evening streak alert sent');
      }
    } catch (err) {
      console.error('[Telegram] Evening reminder error:', err);
      results.push('Evening reminder error: ' + err.message);
    }
  }

  // Check 9h Tối (21:00) - Chưa học đủ 1 tiếng (Night Target)
  const isNightHours = currentTimeStr >= (config.nightTargetTime || '21:00') && currentTimeStr <= '23:59';
  if (forceType === 'night_target' || forceType === '21h' || (config.nightTargetEnabled && config.lastNightNotifiedDate !== today && isNightHours)) {
    try {
      const res = await sendNightTargetReminder(baseUrl);
      if (res && res.skipped) {
        results.push(res.reason || 'Night target skipped (Goal reached)');
      } else {
        if (isNightHours) {
          saveTelegramConfig({ lastNightNotifiedDate: today });
        }
        results.push('Night 1-hour target alert sent');
      }
    } catch (err) {
      console.error('[Telegram] Night target reminder error:', err);
      results.push('Night target error: ' + err.message);
    }
  }

  return {
    status: 'ok',
    currentTime: currentTimeStr,
    date: today,
    results
  };
}

module.exports = {
  getTelegramConfig,
  saveTelegramConfig,
  verifyBot,
  sendTelegramMessage,
  sendVoiceMessage,
  handleIncomingTelegramMessage,
  sendWordCardResponse,
  sendMorningReminder,
  sendEveningStreakReminder,
  sendNightTargetReminder,
  getTodayStudyTimeSeconds,
  checkTelegramScheduler,
  getVietnamDateStr,
  getVietnamDate
};

async function sendVoiceMessage(voiceUrl, caption = '', targetChatId = null) {
  const config = getTelegramConfig();
  const token = config.botToken;
  const chatId = targetChatId || config.chatId;
  if (!token || !chatId || !voiceUrl) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        voice: voiceUrl,
        caption: caption
      })
    });
    return await res.json();
  } catch (err) {
    console.error('[Telegram sendVoice error]:', err.message);
  }
}

async function handleIncomingTelegramMessage(msg) {
  if (!msg || !msg.text) return;
  const chatId = msg.chat.id;
  const rawText = msg.text.trim();
  const lower = rawText.toLowerCase();

  // 1. Welcome / Help
  if (lower === '/start' || lower === '/help') {
    const text = `👋 <b>XIN CHÀO MINH HIẾU!</b>

Chào mừng bạn đến với <b>MiHi TOEIC Bot</b> 🤖!

🔍 <b>TRA CỨU TỪ ĐIỂN TOEIC SIÊU TỐC:</b>
Bạn chỉ cần <b>nhắn bất kỳ từ tiếng Anh nào</b> vào đây (ví dụ: <code>abide by</code>, <code>contract</code>, <code>provision</code>, <code>marketing</code>...):
Bot sẽ gửi ngay:
• Nghĩa tiếng Việt & giải thích ngữ cảnh
• Phiên âm IPA chuẩn
• Câu ví dụ thực tế trong đề thi TOEIC
• 🔊 <b>Phát âm giọng bản xứ</b> để bạn luyện nghe & nói theo!

🎯 <b>CÁC LỆNH NHANH:</b>
• <code>/random</code>: Bốc ngẫu nhiên 1 từ vựng TOEIC kèm phát âm
• <code>/time</code>: Xem tổng thời gian học hôm nay trên web
• <code>/streak</code>: Xem chuỗi Streak hiện tại
• <code>/help</code>: Hướng dẫn sử dụng`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '📚 Mở Web MiHi TOEIC', url: 'https://mihi-toeic.onrender.com' }
        ]
      ]
    };
    return sendTelegramMessage(text, replyMarkup, chatId);
  }

  // 2. Random word
  if (lower === '/random') {
    const entry = dictionary.getRandomToeicWord();
    if (!entry) {
      return sendTelegramMessage('Chưa có từ vựng ngẫu nhiên!', null, chatId);
    }
    return sendWordCardResponse(chatId, entry);
  }

  // 3. Time check
  if (lower === '/time') {
    const sec = getTodayStudyTimeSeconds();
    const mins = Math.floor(sec / 60);
    const missing = Math.max(0, 60 - mins);
    const text = `⏱️ <b>TIẾN ĐỘ HỌC HÔM NAY CỦA BẠN:</b>

• Thời gian đã học: <b>${mins} phút</b>
• Mục tiêu mỗi ngày: <b>60 phút (1 tiếng)</b>
${missing > 0 ? `• Còn thiếu: <b>${missing} phút</b> nữa để hoàn thành mục tiêu ngày!` : '🎉 <b>Chúc mừng! Bạn đã hoàn thành xuất sắc mục tiêu 1 tiếng hôm nay!</b>'}

🔥 <i>Bền bỉ mỗi ngày cùng MiHi TOEIC nhé!</i>`;
    return sendTelegramMessage(text, null, chatId);
  }

  // 4. Streak check
  if (lower === '/streak') {
    const studied = isStudiedToday();
    const streakData = getStreakData();
    const studySec = getTodayStudyTimeSeconds();
    const studyMins = Math.floor(studySec / 60);
    const goalInfo = getStreakGoalInfo((streakData && streakData.startDate) || DEFAULT_STREAK_START_DATE);
    const missingMins = Math.max(0, goalInfo.requiredMinutes - studyMins);

    let streakCount = 2; // Default to current streak
    if (streakData && typeof streakData.currentStreak === 'number') {
      streakCount = streakData.currentStreak;
    }

    let text = '';
    if (studied) {
      text = `🔥 <b>TRẠNG THÁI CHUỖI STREAK HÔM NAY:</b>

🎉 <b>Chuỗi hiện tại: ${streakCount} ngày liên tiếp!</b> 🔥
📌 <b>Mức hiện tại:</b> ${goalInfo.stageName}
✅ <b>Tiến độ hôm nay:</b> Đã học <b>${studyMins}/${goalInfo.requiredMinutes} phút</b>!
🛡️ Ngọn lửa Streak hôm nay đã được thắp sáng an toàn!

👉 Hãy tiếp tục duy trì phong độ rực rỡ này vào ngày mai nhé!`;
    } else {
      text = `🔥 <b>TRẠNG THÁI CHUỖI STREAK HÔM NAY:</b>

⏳ <b>Chuỗi hiện tại: ${streakCount} ngày</b> (Chưa thắp lửa hôm nay)
📌 <b>Mức hiện tại:</b> ${goalInfo.stageName}
📊 <b>Tiến độ hôm nay:</b> Mới học <b>${studyMins}/${goalInfo.requiredMinutes} phút</b>
⚠️ Cần học thêm <b>${missingMins} phút</b> nữa trước nửa đêm để thắp chuỗi Streak!

👉 Hãy vào web lướt thẻ Flashcard hoặc luyện bài ngay để đủ ${goalInfo.requiredMinutes} phút nhé!`;
    }

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '🚀 Mở Web MiHi TOEIC Học Tiếp', url: 'https://mihi-toeic.onrender.com' }
        ]
      ]
    };
    return sendTelegramMessage(text, replyMarkup, chatId);
  }

  // 5. Look up word in dictionary!
  const entry = await dictionary.lookupWord(rawText);
  if (entry) {
    return sendWordCardResponse(chatId, entry);
  } else {
    const notFoundText = `🔍 Không tìm thấy từ "<b>${rawText}</b>".

💡 <b>Mẹo tra cứu:</b>
• Bạn hãy kiểm tra lại chính tả từ tiếng Anh nhé (Ví dụ: <code>school</code>, <code>contract</code>, <code>opportunity</code>...).
• Bạn có thể gõ bất kỳ từ vựng tiếng Anh nào để tra nghĩa, phiên âm và nghe phát âm chuẩn!`;
    return sendTelegramMessage(notFoundText, null, chatId);
  }
}

async function sendWordCardResponse(chatId, entry) {
  if (entry.isToeic) {
    let msg = `📖 <b>TỪ VỰNG TOEIC: ${entry.word.toUpperCase()}</b>\n`;
    if (entry.topicName) {
      msg += `🎯 <i>Chủ đề: ${entry.topicName}</i>\n\n`;
    }
    if (entry.phonetic) {
      msg += `🗣️ <b>Phiên âm (Anh - Mỹ / US):</b> <code>${entry.phonetic}</code>\n`;
    } else {
      msg += `🗣️ <b>Phiên âm (Anh - Mỹ / US):</b> <i>(Nghe chi tiết trong audio phát âm đính kèm)</i>\n`;
    }
    msg += `💡 <b>Nghĩa tiếng Việt:</b> <b>${entry.meaningVi}</b>\n`;
    if (entry.meaningEn) {
      msg += `🇺🇸 <b>Nghĩa tiếng Anh:</b> <i>${entry.meaningEn}</i>\n`;
    }
    if (entry.exampleEn) {
      msg += `\n📝 <b>Ví dụ trong đề thi:</b>\n• <i>${entry.exampleEn}</i>\n`;
      if (entry.exampleVi) {
        msg += `• 👉 <i>${entry.exampleVi}</i>\n`;
      }
    }
    msg += `\n🔥 <i>Thuộc bộ 600 từ vựng TOEIC trọng tâm</i>`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '📚 Mở Bộ Thẻ Flashcard Trên Web', url: 'https://mihi-toeic.onrender.com' }
        ]
      ]
    };

    await sendTelegramMessage(msg, replyMarkup, chatId);

    // Send audio pronunciation if available!
    if (entry.audioUrl) {
      await sendVoiceMessage(entry.audioUrl, `🔊 Phát âm Anh - Mỹ (US): ${entry.word}`, chatId);
    }
  } else {
    // Universal English - Vietnamese dictionary entry (Strictly US English)
    let msg = `📖 <b>TỪ ĐIỂN ANH - MỸ: ${entry.word.toUpperCase()}</b>\n`;
    if (entry.phonetic) {
      msg += `🗣️ <b>Phiên âm (Anh - Mỹ / US):</b> <code>${entry.phonetic}</code>\n`;
    } else {
      msg += `🗣️ <b>Phiên âm (Anh - Mỹ / US):</b> <i>(Nghe chi tiết trong audio phát âm đính kèm)</i>\n`;
    }
    msg += `💡 <b>Nghĩa tiếng Việt:</b> <b>${entry.meaningVi}</b>\n\n`;

    if (Array.isArray(entry.partsOfSpeech) && entry.partsOfSpeech.length > 0) {
      msg += `📚 <b>Từ loại & Các nghĩa phổ biến:</b>\n`;
      entry.partsOfSpeech.forEach(p => {
        msg += `• [<i>${p.pos}</i>]: ${p.meanings}\n`;
      });
      msg += `\n`;
    }

    if (entry.example) {
      msg += `📝 <b>Ví dụ:</b> <i>"${entry.example}"</i>\n\n`;
    }

    msg += `🇺🇸 <i>Phát âm & phiên âm chuẩn giọng Mỹ (US English)</i>`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '📚 Mở Web MiHi TOEIC Học Bài', url: 'https://mihi-toeic.onrender.com' }
        ]
      ]
    };

    await sendTelegramMessage(msg, replyMarkup, chatId);

    if (entry.audioUrl) {
      await sendVoiceMessage(entry.audioUrl, `🔊 Phát âm Anh - Mỹ (US): ${entry.word}`, chatId);
    }
  }
}
