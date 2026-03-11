// ============================================================
//  FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyA3nAHiT_mx78DitpDAla525BcDK0jP8mg",
  authDomain: "project-1-eb9a7.firebaseapp.com",
  projectId: "project-1-eb9a7",
  storageBucket: "project-1-eb9a7.firebasestorage.app",
  messagingSenderId: "820583475390",
  appId: "1:820583475390:web:b8ad9e691b65ba15d596ef",
  measurementId: "G-91WYVEY9ND"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── Auth guard ──────────────────────────────────────────────
function checkAuth(redirect = true) {
  return new Promise((res, rej) => {
    auth.onAuthStateChanged(u => {
      if (u) { res(u); }
      else {
        if (redirect) window.location.href = '../index.html';
        rej('unauthenticated');
      }
    });
  });
}

// ── Seed sample data ────────────────────────────────────────
async function seedSampleData(uid) {
  try {
    const snap = await db.collection('demand_history').limit(1).get();
    if (!snap.empty) return;

    const rows = [
      { date:'2025-01-06', foodItem:'Biryani',       mealTime:'Lunch',     demand:120, weather:'Sunny',  specialEvent:false, dayOfWeek:'Monday'    },
      { date:'2025-01-07', foodItem:'Dosa',           mealTime:'Breakfast', demand:85,  weather:'Cloudy', specialEvent:false, dayOfWeek:'Tuesday'   },
      { date:'2025-01-08', foodItem:'Fried Rice',     mealTime:'Lunch',     demand:95,  weather:'Rainy',  specialEvent:false, dayOfWeek:'Wednesday' },
      { date:'2025-01-09', foodItem:'Biryani',        mealTime:'Lunch',     demand:150, weather:'Sunny',  specialEvent:true,  dayOfWeek:'Thursday'  },
      { date:'2025-01-10', foodItem:'Sambar Rice',    mealTime:'Lunch',     demand:110, weather:'Sunny',  specialEvent:false, dayOfWeek:'Friday'    },
      { date:'2025-01-13', foodItem:'Idli',           mealTime:'Breakfast', demand:70,  weather:'Cloudy', specialEvent:false, dayOfWeek:'Monday'    },
      { date:'2025-01-14', foodItem:'Noodles',        mealTime:'Dinner',    demand:60,  weather:'Rainy',  specialEvent:false, dayOfWeek:'Tuesday'   },
      { date:'2025-01-15', foodItem:'Biryani',        mealTime:'Lunch',     demand:130, weather:'Sunny',  specialEvent:false, dayOfWeek:'Wednesday' },
      { date:'2025-01-16', foodItem:'Chapati Curry',  mealTime:'Dinner',    demand:80,  weather:'Cloudy', specialEvent:false, dayOfWeek:'Thursday'  },
      { date:'2025-01-17', foodItem:'Fried Rice',     mealTime:'Lunch',     demand:105, weather:'Sunny',  specialEvent:true,  dayOfWeek:'Friday'    },
      { date:'2025-01-20', foodItem:'Biryani',        mealTime:'Lunch',     demand:140, weather:'Sunny',  specialEvent:false, dayOfWeek:'Monday'    },
      { date:'2025-01-21', foodItem:'Dosa',           mealTime:'Breakfast', demand:90,  weather:'Sunny',  specialEvent:false, dayOfWeek:'Tuesday'   },
      { date:'2025-01-22', foodItem:'Sambar Rice',    mealTime:'Lunch',     demand:115, weather:'Rainy',  specialEvent:false, dayOfWeek:'Wednesday' },
      { date:'2025-01-23', foodItem:'Noodles',        mealTime:'Dinner',    demand:55,  weather:'Cloudy', specialEvent:false, dayOfWeek:'Thursday'  },
      { date:'2025-01-24', foodItem:'Biryani',        mealTime:'Lunch',     demand:160, weather:'Sunny',  specialEvent:true,  dayOfWeek:'Friday'    },
      { date:'2025-02-03', foodItem:'Idli',           mealTime:'Breakfast', demand:75,  weather:'Cloudy', specialEvent:false, dayOfWeek:'Monday'    },
      { date:'2025-02-04', foodItem:'Fried Rice',     mealTime:'Lunch',     demand:100, weather:'Sunny',  specialEvent:false, dayOfWeek:'Tuesday'   },
      { date:'2025-02-05', foodItem:'Chapati Curry',  mealTime:'Dinner',    demand:85,  weather:'Rainy',  specialEvent:false, dayOfWeek:'Wednesday' },
      { date:'2025-02-06', foodItem:'Biryani',        mealTime:'Lunch',     demand:125, weather:'Sunny',  specialEvent:false, dayOfWeek:'Thursday'  },
      { date:'2025-02-07', foodItem:'Dosa',           mealTime:'Breakfast', demand:88,  weather:'Sunny',  specialEvent:false, dayOfWeek:'Friday'    },
      { date:'2025-02-10', foodItem:'Pasta',          mealTime:'Lunch',     demand:78,  weather:'Sunny',  specialEvent:false, dayOfWeek:'Monday'    },
      { date:'2025-02-11', foodItem:'Sandwich',       mealTime:'Breakfast', demand:62,  weather:'Cloudy', specialEvent:false, dayOfWeek:'Tuesday'   },
      { date:'2025-02-12', foodItem:'Biryani',        mealTime:'Lunch',     demand:145, weather:'Sunny',  specialEvent:true,  dayOfWeek:'Wednesday' },
    ];

    const batch = db.batch();
    rows.forEach(r => {
      const ref = db.collection('demand_history').doc();
      batch.set(ref, { ...r, seeded: true, createdBy: uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    });
    await batch.commit();
    console.log('✅ Sample data seeded');
  } catch (e) {
    console.warn('Seed skipped:', e.message);
  }
}

// ── Shared Utilities ────────────────────────────────────────
function showLoading(msg = 'Loading...') {
  const el = document.getElementById('loadingScreen');
  if (!el) return;
  document.getElementById('loadingText').textContent = msg;
  el.classList.add('on');
}

function hideLoading() {
  const el = document.getElementById('loadingScreen');
  if (el) el.classList.remove('on');
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDayName(dateStr) {
  if (!dateStr) return '—';
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(dateStr).getDay()];
}

// ════════════════════════════════════════════════════════════
//  SHARED LAYOUT BUILDER
// ════════════════════════════════════════════════════════════
function buildLayout(active, title, subtitle) {
  const navItems = [
    { id:'dashboard',  icon:'📊', label:'Dashboard',       badge:'' },
    { id:'prediction', icon:'🤖', label:'AI Prediction',   badge:'AI' },
    { id:'history',    icon:'📅', label:'Historical Data', badge:'' },
    { id:'about',      icon:'ℹ️', label:'About System',    badge:'' },
  ];

  const nav = navItems.map(n => `
    <a href="${n.id}.html" class="nav-item ${active===n.id?'active':''}">
      <div class="nav-icon">${n.icon}</div>
      <span>${n.label}</span>
      ${n.badge ? `<span class="nav-badge">${n.badge}</span>` : ''}
    </a>
  `).join('');

  return `
    <div class="sb-overlay" id="sbOverlay" onclick="closeSb()"></div>

    <aside class="sidebar" id="sidebar">
      <div class="sidebar-head">
        <div class="sidebar-logo-icon">🍽️</div>
        <div class="sidebar-logo-text">
          Smart Canteen
          <small>Demand Predictor</small>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-group-title">Main Menu</div>
        ${nav}
        <div class="nav-group-title" style="margin-top:24px;">Navigation</div>
        <a href="../home.html" class="nav-item">
          <div class="nav-icon">🌐</div>
          <span>Landing Page</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="user-card">
          <div class="user-ava" id="userAva">?</div>
          <div class="user-info">
            <div class="user-name" id="userName">Loading…</div>
            <div class="user-role">Canteen Manager</div>
          </div>
          <div class="online-dot"></div>
        </div>
        <button class="btn-logout" onclick="doLogout()">
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div style="display:flex;align-items:center;gap:16px;">
          <button class="hamburger" onclick="toggleSb()">☰</button>
          <div class="topbar-left">
            <h1>${title}</h1>
            <p>${subtitle}</p>
          </div>
        </div>
        <div class="topbar-right">
          <div class="topbar-date" id="topbarDate"></div>
          <div class="status-chip">
            <div class="status-dot"></div>
            AI Engine Online
          </div>
        </div>
      </header>

      <main class="content" id="pageContent">
  `;
}

function endLayout() {
  return `
      </main>
    </div>

    <div class="loading-screen" id="loadingScreen">
      <div class="spin"></div>
      <div class="loading-text" id="loadingText">Loading…</div>
    </div>
  `;
}

// ── Sidebar toggle ─────────────────────────────────────────
function toggleSb() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sbOverlay').classList.toggle('on');
}

function closeSb() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sbOverlay').classList.remove('on');
}

// ── Logout ─────────────────────────────────────────────────
async function doLogout() {
  if (!confirm('Sign out from Smart Canteen?')) return;
  await auth.signOut();
  window.location.href = '../index.html';
}

// ── User display ───────────────────────────────────────────
function initUser(user) {
  const name = user.displayName || user.email.split('@')[0];
  document.getElementById('userName').textContent = name;
  document.getElementById('userAva').textContent  = name.charAt(0).toUpperCase();
}

// ── Date display ───────────────────────────────────────────
function initTopbarDate() {
  const el = document.getElementById('topbarDate');
  if (!el) return;
  const d = new Date();
  el.textContent = d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}

// ── Auth error map ─────────────────────────────────────────
function authErrMsg(code) {
  return ({
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/too-many-requests': 'Too many attempts — please try again later.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-credential': 'Invalid credentials. Check email & password.',
    'auth/weak-password': 'Password must be at least 6 characters.',
  })[code] || 'Authentication failed. Please try again.';
}
