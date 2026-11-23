const fs = require('fs');
const path = require('path');

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

function isStudiedToday() {
  const todayStr = getVietnamDateStr();
  const historyPath = path.join(DATA_DIR, 'history.json');
  if (fs.existsSync(historyPath)) {
    try {
      const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      if (Array.isArray(history)) {
        return history.some(item => item.date && item.date.startsWith(todayStr));
      }
    } catch (e) {}
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

  if (studied) {
    console.log('[Telegram Bot] User already studied today. Evening streak is safe!');
    return { skipped: true, reason: 'Already studied today' };
  }

  let scheduleFocus = '• <b>Thứ 3, 5, 7 (Reading):</b> Đọc 1 chuyên đề Ngữ pháp + Luyện 1 bài Part 5 & 1 bài Part 7 đoạn đơn.';
  if (dayOfWeek === 0) {
    scheduleFocus = '• <b>Chủ Nhật (Luyện Đề):</b> Làm 1 đề Mini Test hoặc Full Test 200 câu + Dành 45 phút chữa bài cặn kẽ.';
  } else if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
    scheduleFocus = '• <b>Thứ 2, 4, 6 (Listening):</b> Luyện 2-3 bài Part 1/2 hoặc Part 3/4 + Nghe lại transcript.';
  }

  const text = `🔥 <b>MINH HIẾU ƠI! CẢNH BÁO NGUY CƠ MẤT CHUỖI STREAK!</b>

Hôm nay bạn vẫn chưa hoàn thành buổi học nào trên MiHi TOEIC!
⏰ Chỉ còn vài giờ nữa là kết thúc ngày, đừng để ngọn lửa Streak bị tắt nhé!

📚 <b>Trọng tâm bài học tối nay (60 - 80 phút):</b>
${scheduleFocus}

👉 Dành ra vài phút vào học ngay để giữ vững chuỗi Streak rực rỡ nào!`;

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
  if (forceType === 'morning' || (config.morningEnabled && config.lastMorningNotifiedDate !== today && currentTimeStr >= config.morningTime)) {
    try {
      await sendMorningReminder(baseUrl);
      saveTelegramConfig({ lastMorningNotifiedDate: today });
      results.push('Morning reminder sent');
    } catch (err) {
      console.error('[Telegram] Morning reminder error:', err);
      results.push('Morning reminder error: ' + err.message);
    }
  }

  // Check Evening (20:00)
  if (forceType === 'evening' || (config.eveningEnabled && config.lastEveningNotifiedDate !== today && currentTimeStr >= config.eveningTime)) {
    try {
      const res = await sendEveningStreakReminder(baseUrl);
      saveTelegramConfig({ lastEveningNotifiedDate: today });
      results.push(res && res.skipped ? 'Evening skipped (Already studied)' : 'Evening streak alert sent');
    } catch (err) {
      console.error('[Telegram] Evening reminder error:', err);
      results.push('Evening reminder error: ' + err.message);
    }
  }

  // Check 9h Tối (21:00) - Chưa học đủ 1 tiếng (Night Target)
  if (forceType === 'night_target' || forceType === '21h' || (config.nightTargetEnabled && config.lastNightNotifiedDate !== today && currentTimeStr >= (config.nightTargetTime || '21:00'))) {
    try {
      const res = await sendNightTargetReminder(baseUrl);
      saveTelegramConfig({ lastNightNotifiedDate: today });
      results.push(res && res.skipped ? res.reason : 'Night 1-hour target alert sent');
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
  sendMorningReminder,
  sendEveningStreakReminder,
  sendNightTargetReminder,
  getTodayStudyTimeSeconds,
  checkTelegramScheduler,
  getVietnamDateStr,
  getVietnamDate
};
