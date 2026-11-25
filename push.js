const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const DATA_DIR = path.join(__dirname, 'data');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
const SUBS_FILE = path.join(DATA_DIR, 'push_subscriptions.json');

// Initialize VAPID Keys
let vapidKeys = null;
if (fs.existsSync(VAPID_FILE)) {
  try {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'));
  } catch (e) {
    console.error('Error reading vapid.json:', e);
  }
}

if (!vapidKeys || !vapidKeys.publicKey || !vapidKeys.privateKey) {
  vapidKeys = webpush.generateVAPIDKeys();
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), 'utf-8');
}

webpush.setVapidDetails(
  'mailto:contact@mihitoeic.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

function getSubscriptions() {
  if (fs.existsSync(SUBS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
      if (Array.isArray(data)) return data;
    } catch (e) {}
  }
  return [];
}

function saveSubscription(sub) {
  if (!sub || !sub.endpoint) return;
  const subs = getSubscriptions();
  const existsIdx = subs.findIndex(s => s.endpoint === sub.endpoint);
  if (existsIdx !== -1) {
    subs[existsIdx] = sub;
  } else {
    subs.push(sub);
  }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf-8');
  return subs;
}

function removeSubscription(endpoint) {
  let subs = getSubscriptions();
  subs = subs.filter(s => s.endpoint !== endpoint);
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf-8');
}

async function sendPushToAll(payload) {
  const subs = getSubscriptions();
  if (subs.length === 0) {
    return { count: 0, successful: 0, failed: 0, reason: 'No subscriptions registered' };
  }

  const payloadString = JSON.stringify(payload);
  let successful = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payloadString);
      successful++;
    } catch (err) {
      failed++;
      console.error('[WebPush Error]:', err.statusCode, err.message);
      // Remove dead / expired subscriptions
      if (err.statusCode === 404 || err.statusCode === 410) {
        removeSubscription(sub.endpoint);
      }
    }
  }

  return { count: subs.length, successful, failed };
}

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

function getStreakGoalMinutes(startDateStr = '2026-11-22', todayStr = null) {
  const today = todayStr || getVietnamDateStr();
  const start = new Date(startDateStr + 'T00:00:00');
  const cur = new Date(today + 'T00:00:00');
  const diffDays = Math.max(0, Math.floor((cur - start) / 86400000));
  if (diffDays < 14) return 15;
  if (diffDays < 28) return 30;
  return 60;
}

function isStudiedToday() {
  const todayStr = getVietnamDateStr();
  let startDate = '2026-11-22';

  const streakPath = path.join(DATA_DIR, 'streak.json');
  if (fs.existsSync(streakPath)) {
    try {
      const s = JSON.parse(fs.readFileSync(streakPath, 'utf-8'));
      if (s && s.startDate) startDate = s.startDate;
    } catch (e) {}
  }

  const requiredSeconds = getStreakGoalMinutes(startDate, todayStr) * 60;
  let totalSec = 0;

  // 1. Check study_time.json
  const studyTimePath = path.join(DATA_DIR, 'study_time.json');
  if (fs.existsSync(studyTimePath)) {
    try {
      const studyData = JSON.parse(fs.readFileSync(studyTimePath, 'utf-8'));
      if (studyData[todayStr] && typeof studyData[todayStr].totalSeconds === 'number') {
        totalSec = Math.max(totalSec, studyData[todayStr].totalSeconds);
      }
    } catch (e) {}
  }

  // 2. Check history.json (tests taken)
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
        totalSec = Math.max(totalSec, histSec);
      }
    } catch (e) {}
  }

  return totalSec >= requiredSeconds;
}

async function triggerPushScheduler(forceType = null) {
  const vnDate = getVietnamDate();
  const currentHours = String(vnDate.getHours()).padStart(2, '0');
  const currentMins = String(vnDate.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMins}`;
  const dayOfWeek = vnDate.getDay();

  // 1. Morning Reminder (8h00 Sáng)
  if (forceType === 'morning' || currentTimeStr === '08:00') {
    const morningPayload = {
      title: '🌅 MiHi TOEIC: Chào buổi sáng Minh Hiếu!',
      body: 'Dành 20 - 30 phút mở Flashcard học 1 chủ đề từ vựng & ôn lại từ cũ hôm nay nhé! 🔥',
      icon: 'https://estudyme.com/images/icon/estudyme/favicon.png',
      badge: 'https://estudyme.com/images/icon/estudyme/favicon.png',
      tag: 'mihi-morning-webpush',
      data: { url: '/' }
    };
    return sendPushToAll(morningPayload);
  }

  // 2. Evening Streak Rescue (20h00 Tối - 8h Tối)
  if (forceType === 'evening' || currentTimeStr === '20:00') {
    if (isStudiedToday()) {
      return { skipped: true, reason: 'Already studied today, streak is safe!' };
    }

    let scheduleText = 'Đọc 1 chuyên đề Ngữ pháp + Luyện Reading Part 5/7 (60-80 phút)';
    if (dayOfWeek === 0) {
      scheduleText = 'Làm 1 đề Mini Test / Full Test 200 câu & chữa bài cặn kẽ';
    } else if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
      scheduleText = 'Luyện nghe Listening Part 1-4 (60-80 phút) + xem transcript';
    }

    const eveningPayload = {
      title: '🔥 MiHi TOEIC: Minh Hiếu ơi! Cứu Streak ngay!',
      body: `Hôm nay bạn chưa học bài! Ngọn lửa Streak sắp tắt rồi. Tối nay theo lịch: ${scheduleText}. Vào học ngay nào!`,
      icon: 'https://estudyme.com/images/icon/estudyme/favicon.png',
      badge: 'https://estudyme.com/images/icon/estudyme/favicon.png',
      tag: 'mihi-evening-webpush',
      data: { url: '/' }
    };
    return sendPushToAll(eveningPayload);
  }

  return { status: 'idle', currentTime: currentTimeStr };
}

module.exports = {
  vapidPublicKey: vapidKeys.publicKey,
  getSubscriptions,
  saveSubscription,
  removeSubscription,
  sendPushToAll,
  triggerPushScheduler
};
