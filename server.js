const express = require('express');
const cors = require('cors');

// أضف هذا السطر قبل معرفات الـ Routes
app.use(cors());
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'chairs.json');

app.use(express.json());
app.use(express.static(__dirname));

// دالة لقراءة بيانات الكراسين من ملف chairs.json
function readChairsData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('خطأ في قراءة ملف chairs.json:', err);
    return [];
  }
}

// دالة لحفظ البيانات إلى ملف chairs.json
function writeChairsData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('خطأ في كتابة ملف chairs.json:', err);
  }
}

// --- 1. جلب قائمة الكراسين ---
app.get('/api/chairs', (req, res) => {
  const chairs = readChairsData();
  res.json(chairs);
});

// --- 2. تقييم كرسين (مرة واحدة كل 24 ساعة حسب الـ IP) ---
app.post('/api/chairs/:id/rate', (req, res) => {
  const chairId = parseInt(req.params.id);
  const { rating } = req.body;
  const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'التقييم يجب أن يكون بين 1 و 5' });
  }

  let chairs = readChairsData();
  let chair = chairs.find(c => c.id === chairId);

  if (!chair) {
    return res.status(404).json({ error: 'الكرسين غير موجود' });
  }

  if (!chair.ratings) chair.ratings = [];

  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // التحقق إن كان نفس الـ IP قد قيّم هذا الكرسين خلال آخر 24 ساعة
  const previousRating = chair.ratings.find(r => r.ip === userIp && (now - r.timestamp) < TWENTY_FOUR_HOURS);

  if (previousRating) {
    const timeLeftHours = Math.ceil((TWENTY_FOUR_HOURS - (now - previousRating.timestamp)) / (1000 * 60 * 60));
    return res.status(429).json({ 
      error: `لقد قمت بتقييم هذا الكرسين مؤخراً! يمكنك التقييم مجدداً بعد ${timeLeftHours} ساعة.` 
    });
  }

  // إضافة التقييم الجديد
  chair.ratings.push({
    rating: parseInt(rating),
    ip: userIp,
    timestamp: now
  });

  writeChairsData(chairs);
  res.json({ message: 'تم إرسال تقييمك بنجاح! شكراً لك.' });
});

// --- 3. جلب نجم الأسبوع تلقائياً (صاحب أعلى معدل تقييم) ---
app.get('/api/weekly-star', (req, res) => {
  const chairs = readChairsData();

  if (!chairs || chairs.length === 0) {
    return res.json(null);
  }

  let topChair = null;
  let maxAvg = -1;

  chairs.forEach(chair => {
    if (chair.ratings && chair.ratings.length > 0) {
      const avg = chair.ratings.reduce((acc, r) => acc + r.rating, 0) / chair.ratings.length;
      if (avg > maxAvg) {
        maxAvg = avg;
        topChair = {
          id: chair.id,
          name: chair.name,
          image: chair.image,
          averageRating: avg.toFixed(1),
          totalVotes: chair.ratings.length
        };
      }
    }
  });

  res.json(topChair);
});

// --- 4. إضافة كرسين جديد (لوحة التحكم) ---
app.post('/api/chairs', (req, res) => {
  const { name, image } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'يرجى تزويد اسم الكرسين' });
  }

  const chairs = readChairsData();
  const newChair = {
    id: Date.now(),
    name: name,
    image: image || '1000216576.jpg',
    ratings: []
  };

  chairs.push(newChair);
  writeChairsData(chairs);

  res.status(201).json(newChair);
});

// --- 5. حذف كرسين (لوحة التحكم) ---
app.delete('/api/chairs/:id', (req, res) => {
  const chairId = parseInt(req.params.id);
  let chairs = readChairsData();

  const filteredChairs = chairs.filter(c => c.id !== chairId);

  if (chairs.length === filteredChairs.length) {
    return res.status(404).json({ error: 'الكرسين غير موجود' });
  }

  writeChairsData(filteredChairs);
  res.json({ message: 'تم حذف الكرسين بنجاح' });
});

app.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل الآن على البورت ${PORT}`);
});
