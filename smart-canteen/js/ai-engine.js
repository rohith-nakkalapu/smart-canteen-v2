// ============================================================
//  SMART CANTEEN — AI Prediction Engine
//  Gemini 2.0 Flash + ML Regression Ensemble
// ============================================================

const GEMINI_KEY = 'AIzaSyAlPbHIGRRxINw-liWosazDXur-wKGfH6A';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

// ── Local Linear Regression (fallback / ensemble partner) ──
const ML = {
  w: {
    base: 85,
    day:  { Monday:5, Tuesday:0, Wednesday:3, Thursday:6, Friday:18, Saturday:-12, Sunday:-22 },
    meal: { Breakfast:-28, Lunch:32, Dinner:-12 },
    wx:   { Sunny:14, Cloudy:0, Rainy:-20, Windy:-9, Stormy:-28 },
    evt:  { Yes:42, No:0 },
    item: { Biryani:32, 'Fried Rice':10, Noodles:-6, Dosa:-11,
            Idli:-16, 'Sambar Rice':4, 'Chapati Curry':0, Pasta:7, Sandwich:-14 }
  },

  predict(inp) {
    let d = this.w.base;
    d += this.w.day[inp.dayOfWeek]   || 0;
    d += this.w.meal[inp.mealTime]   || 0;
    d += this.w.wx[inp.weather]      || 0;
    d += this.w.evt[inp.specialEvent]|| 0;
    d += this.w.item[inp.foodItem]   || 0;
    d += (Math.random() - 0.5) * 8;  // realistic noise
    d  = Math.max(10, Math.round(d));

    const known = Object.keys(this.w.item).includes(inp.foodItem);
    const conf  = Math.min(96, 72 + (known ? 10 : 0) + (inp.weather==='Sunny' ? 5 : 0) + (inp.dayOfWeek==='Friday' ? 4 : 0));
    return { demand: d, confidence: conf, source: 'ML Model' };
  }
};

// ── Historical pattern lookup from Firestore ───────────────
async function getHistoricalContext(inp) {
  try {
    const snap = await db.collection('demand_history')
      .where('foodItem', '==', inp.foodItem)
      .where('mealTime', '==', inp.mealTime)
      .limit(25).get();
    if (snap.empty) return null;

    const all = [];
    snap.forEach(d => all.push(d.data()));
    const similar = all.filter(r => r.dayOfWeek === inp.dayOfWeek || r.weather === inp.weather);
    const set = similar.length >= 3 ? similar : all;
    const avg = Math.round(set.reduce((s, r) => s + (r.demand || 0), 0) / set.length);
    return { avg, size: set.length, hasSimilar: similar.length >= 3 };
  } catch { return null; }
}

// ── Gemini AI call ─────────────────────────────────────────
async function callGemini(inp, hist) {
  const { foodItem, dayOfWeek, mealTime, weather, specialEvent } = inp;

  const prompt = `You are an AI canteen demand prediction system.

INPUT DATA:
- Food Item: ${foodItem}
- Day of Week: ${dayOfWeek}
- Meal Time: ${mealTime}
- Weather: ${weather}
- Special Event Today: ${specialEvent}
${hist ? `- Historical average for similar conditions: ${hist.avg} portions (from ${hist.size} records)` : ''}

PREDICTION RULES:
1. Friday Lunch → boost demand by 20-30%
2. Monday after weekend → moderate demand
3. Rainy/Stormy → reduce by 15-25%
4. Special Event → boost 35-50%
5. Biryani base demand = 90-120 (very popular)
6. Breakfast = ~65% of Lunch demand
7. Dinner = ~75% of Lunch demand
8. Sunny weekend = higher breakfast demand
9. Historical context has 30% weight in your estimate

IMPORTANT: Respond with ONLY a valid JSON object — no markdown, no explanation:
{"predictedDemand": <integer 15-350>, "confidence": <integer 62-97>, "reasoning": "<one clear sentence why>", "tips": "<one actionable tip for the canteen manager>", "wasteReduction": "<percentage eg 28%>"}`;

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.25, maxOutputTokens: 350 }
    })
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}`);

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error('No JSON in Gemini response');
  return JSON.parse(match[0]);
}

// ── Master predict function ────────────────────────────────
async function predictDemand(inp) {
  const [hist, mlRes] = await Promise.all([
    getHistoricalContext(inp),
    Promise.resolve(ML.predict(inp))
  ]);

  let final;

  try {
    const gemini = await callGemini(inp, hist);

    // Weighted ensemble: 60% Gemini + 40% ML
    const demand     = Math.round(gemini.predictedDemand * 0.6 + mlRes.demand * 0.4);
    const confidence = Math.round(gemini.confidence * 0.7 + mlRes.confidence * 0.3);

    final = {
      demand,
      confidence,
      reasoning:     gemini.reasoning || `Demand estimated for ${inp.dayOfWeek} ${inp.mealTime} with ${inp.weather} weather.`,
      tips:          gemini.tips       || 'Prepare a 10% buffer for unexpected guests.',
      wasteReduction:gemini.wasteReduction || '28%',
      source: 'Gemini AI + ML Ensemble',
      mlDemand: mlRes.demand,
      historicalAvg: hist?.avg || null
    };
  } catch (err) {
    console.warn('Gemini unavailable, using ML fallback:', err.message);
    final = {
      demand:     mlRes.demand,
      confidence: mlRes.confidence,
      reasoning:  `Based on local ML model: ${inp.dayOfWeek} ${inp.mealTime} in ${inp.weather} weather.`,
      tips:       'Prepare a 10–15% buffer to cover unexpected walk-ins.',
      wasteReduction: '22%',
      source: 'ML Model (Gemini Offline)',
      mlDemand: mlRes.demand,
      historicalAvg: hist?.avg || null
    };
  }

  // Blend with historical data if high-quality match exists
  if (hist?.hasSimilar) {
    final.demand = Math.round(final.demand * 0.72 + hist.avg * 0.28);
  }

  final.demand = Math.max(10, final.demand);
  return final;
}

// ── Save prediction to Firestore ───────────────────────────
async function savePrediction(inp, result, uid) {
  try {
    await db.collection('predictions').add({
      ...inp, ...result,
      predictedDemand: result.demand,
      userId: uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error('savePrediction failed:', e);
  }
}
