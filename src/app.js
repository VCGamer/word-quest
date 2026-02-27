import vocabulary, { themeOrder } from './words.js';

// ===== STATE MANAGEMENT =====
const STORAGE_KEY = 'vocab-app-state';
const DAILY_CAP_MINUTES = 10;
const BONUS_MULTIPLIER = 1.2;
const BONUS_THRESHOLD = 0.9; // 90%
const MONEY_THRESHOLD = 8;   // Score > 8 out of 10 → $1 Roblox Money
const CORRECT_PER_MINUTE = 5; // 5 correct answers = 1 Roblox minute
const SCHOOL_REVIEW_REWARD = 10; // 100% on school review = 10 Roblox minutes

const SCHOOL_REVIEW_WORDS = [
  { correct: "doesn't", wrong: "does'nt" },
  { correct: "didn't", wrong: "did'nt" },
  { correct: "beginning", wrong: "bigenning" },
  { correct: "until", wrong: "untill" },
  { correct: "tomorrow", wrong: "tommorow" },
  { correct: "happened", wrong: "happend" },
  { correct: "wouldn't", wrong: "wouldnt" },
  { correct: "shouldn't", wrong: "shouldnt" },
  { correct: "meant", wrong: "ment" },
  { correct: "different", wrong: "deffrent" },
  { correct: "believe", wrong: "belive" },
  { correct: "usually", wrong: "usuefly" },
  { correct: "beautiful", wrong: "buetifull" },
];

function getDefaults() {
  return {
    learnedWords: [],
    quizScores: [],
    streak: 0,
    lastVisitDate: null,
    totalQuizzesTaken: 0,
    totalCorrect: 0,
    starredWords: [],
    robloxTime: {},
    todayBonusActive: false,
    robloxMoney: 0,
  };
}

function loadState() {
  const defaults = getDefaults();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaults, ...parsed };
    }
  } catch (e) { /* ignore */ }
  return defaults;
}

function saveState(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

let state = loadState();

// ===== ROBLOX TIME SYSTEM =====
function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getTodayRobloxData() {
  const today = getTodayStr();
  if (!state.robloxTime[today]) {
    state.robloxTime[today] = { earned: 0, bonus: false, moneyAwarded: false, correctCount: 0 };
  }
  // Migration: add correctCount if missing
  if (state.robloxTime[today].correctCount === undefined) {
    state.robloxTime[today].correctCount = 0;
  }
  // Migration: add schoolReviewDone if missing
  if (state.robloxTime[today].schoolReviewDone === undefined) {
    state.robloxTime[today].schoolReviewDone = false;
  }
  return state.robloxTime[today];
}

function getTodayMaxMinutes() {
  const data = getTodayRobloxData();
  return data.bonus ? Math.floor(DAILY_CAP_MINUTES * BONUS_MULTIPLIER) : DAILY_CAP_MINUTES;
}

function getTodayEarned() {
  return getTodayRobloxData().earned;
}

function isBonusActive() {
  return getTodayRobloxData().bonus;
}

function activateBonus() {
  const data = getTodayRobloxData();
  if (!data.bonus) {
    data.bonus = true;
    state.todayBonusActive = true;
    saveState(state);
  }
}

function awardRobloxMinute() {
  const data = getTodayRobloxData();
  const max = getTodayMaxMinutes();
  if (data.earned >= max) return 0;
  data.earned += 1;
  saveState(state);
  return 1;
}

// Track a correct answer; awards 1 minute every CORRECT_PER_MINUTE correct answers
// Returns { correctCount, awarded, capReached }
function trackCorrectAndAward() {
  const data = getTodayRobloxData();
  data.correctCount += 1;
  const currentCount = data.correctCount;
  let awarded = 0;
  if (currentCount % CORRECT_PER_MINUTE === 0) {
    awarded = awardRobloxMinute();
  } else {
    saveState(state);
  }
  const capReached = getTodayEarned() >= getTodayMaxMinutes();
  return { correctCount: currentCount, awarded, capReached, untilNext: CORRECT_PER_MINUTE - (currentCount % CORRECT_PER_MINUTE) };
}

function getTodayCorrectCount() {
  return getTodayRobloxData().correctCount;
}

function getTotalRobloxMinutes() {
  return Object.values(state.robloxTime).reduce((sum, d) => sum + d.earned, 0);
}

function awardRobloxMoney() {
  const data = getTodayRobloxData();
  if (data.moneyAwarded) return 0;
  data.moneyAwarded = true;
  state.robloxMoney = (state.robloxMoney || 0) + 1;
  saveState(state);
  return 1;
}

function getTotalRobloxMoney() {
  return state.robloxMoney || 0;
}

function isMoneyAwardedToday() {
  return getTodayRobloxData().moneyAwarded || false;
}

// ===== DATE & WEEKLY THEME =====
function getWeekNumber() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  return Math.floor(dayOfYear / 7);
}

function getCurrentThemeIndex() {
  return getWeekNumber() % themeOrder.length;
}

function getCurrentTheme() {
  return themeOrder[getCurrentThemeIndex()];
}

function getWeeklyWords() {
  const theme = getCurrentTheme();
  return vocabulary.filter(w => w.theme === theme.name);
}

function updateStreak() {
  const today = getTodayStr();
  if (state.lastVisitDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  if (state.lastVisitDate === yesterdayStr) {
    state.streak += 1;
  } else if (state.lastVisitDate !== today) {
    state.streak = 1;
  }
  state.lastVisitDate = today;
  saveState(state);
}

// ===== REWARD POPUPS =====
function showRewardPopup(minutes, capReached = false) {
  document.querySelectorAll('.reward-overlay, .reward-popup').forEach(el => el.remove());
  const overlay = document.createElement('div');
  overlay.className = 'reward-overlay';
  const popup = document.createElement('div');
  popup.className = `reward-popup ${capReached ? 'cap-reached' : ''}`;

  if (capReached) {
    popup.innerHTML = `
      <div class="reward-icon">&#x1F3C6;</div>
      <div class="reward-title">MAX REACHED!</div>
      <div class="reward-minutes capped">${getTodayMaxMinutes()} min</div>
      <div class="reward-sub">Today's limit reached! Come back tomorrow!</div>
      <button class="reward-dismiss" id="dismissReward">OK</button>
    `;
  } else {
    popup.innerHTML = `
      <div class="reward-icon">&#x1F3AE;</div>
      <div class="reward-title">+${minutes} ROBLOX MIN!</div>
      <div class="reward-minutes">${getTodayEarned()} / ${getTodayMaxMinutes()}</div>
      <div class="reward-sub">Keep learning to earn more!</div>
      <button class="reward-dismiss" id="dismissReward">NICE!</button>
    `;
  }

  document.body.appendChild(overlay);
  document.body.appendChild(popup);
  const dismiss = () => { overlay.remove(); popup.remove(); };
  document.getElementById('dismissReward').addEventListener('click', dismiss);
  overlay.addEventListener('click', dismiss);
  setTimeout(dismiss, 3000);
}

function showMoneyPopup() {
  document.querySelectorAll('.reward-overlay, .reward-popup').forEach(el => el.remove());
  const overlay = document.createElement('div');
  overlay.className = 'reward-overlay';
  const popup = document.createElement('div');
  popup.className = 'reward-popup money-reward';
  popup.innerHTML = `
    <div class="reward-icon">&#x1F4B0;</div>
    <div class="reward-title money-title">+ $1 ROBLOX MONEY!</div>
    <div class="reward-minutes money-amount">$${getTotalRobloxMoney()} total</div>
    <div class="reward-sub">Save up for a Roblox prepaid card!</div>
    <button class="reward-dismiss money-dismiss" id="dismissMoney">CHA-CHING!</button>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
  const dismiss = () => { overlay.remove(); popup.remove(); };
  document.getElementById('dismissMoney').addEventListener('click', dismiss);
  overlay.addEventListener('click', dismiss);
  setTimeout(dismiss, 4000);
}

// ===== RENDERING =====
const app = document.querySelector('#app');
let currentView = 'learn';

function render(view = 'learn') {
  currentView = view;
  switch (view) {
    case 'learn': renderLearn(); break;
    case 'quiz': renderQuiz(); break;
    case 'school': renderSchool(); break;
    case 'vault': renderVault(); break;
    case 'stats': renderStats(); break;
    default: renderLearn();
  }
  renderBottomNav(view);
}

// ===== COMPACT ROBLOX BAR =====
function robloxBarCompactHTML() {
  const earned = getTodayEarned();
  const max = getTodayMaxMinutes();
  const pct = Math.min((earned / max) * 100, 100);
  const bonus = isBonusActive();
  const isFull = earned >= max;
  const money = getTotalRobloxMoney();
  const correctCount = getTodayCorrectCount();
  const untilNext = CORRECT_PER_MINUTE - (correctCount % CORRECT_PER_MINUTE);
  const correctPct = ((correctCount % CORRECT_PER_MINUTE) / CORRECT_PER_MINUTE) * 100;

  return `
    <div class="robux-bar-compact">
      <div class="rbc-top">
        <span class="rbc-title">&#x1F3AE; ROBLOX TIME</span>
        <span class="rbc-tags">
          ${money > 0 ? `<span class="robux-money-tag">&#x1F4B0; $${money}</span>` : ''}
          ${bonus ? '<span class="robux-bonus-tag">1.2x</span>' : ''}
        </span>
      </div>
      <div class="rbc-row">
        <span class="rbc-earned">${earned}<span class="rbc-unit">/${max} min</span></span>
        <span class="rbc-streak">${state.streak >= 1 ? `&#x1F525; ${state.streak} day streak` : ''}</span>
      </div>
      <div class="robux-progress-bg">
        <div class="robux-progress-fill ${isFull ? 'maxed' : ''}" style="width: ${pct}%"></div>
      </div>
      <div class="rbc-next-min">
        <span>&#x2B50; ${untilNext} more correct for +1 min</span>
        <div class="rbc-mini-progress">
          <div class="rbc-mini-fill" style="width: ${correctPct}%"></div>
        </div>
      </div>
    </div>
  `;
}

// ===== BOTTOM NAV =====
function renderBottomNav(activeView) {
  // Remove existing bottom nav
  document.querySelectorAll('.bottom-nav').forEach(el => el.remove());

  const weeklyWords = getWeeklyWords();
  const allLearned = weeklyWords.every(w => state.learnedWords.includes(w.word));
  const learnedCount = vocabulary.filter(w => state.learnedWords.includes(w.word)).length;

  const nav = document.createElement('div');
  nav.className = 'bottom-nav';
  nav.innerHTML = `
    <button class="bnav-tab ${activeView === 'learn' ? 'active' : ''}" data-view="learn">
      <span class="bnav-icon">&#x1F4D6;</span>
      <span class="bnav-label">LEARN</span>
    </button>
    <button class="bnav-tab ${activeView === 'quiz' ? 'active' : ''}" data-view="quiz">
      <span class="bnav-icon">&#x2694;&#xFE0F;</span>
      <span class="bnav-label">QUIZ</span>
      ${allLearned ? '<span class="bnav-badge pulse">GO!</span>' : ''}
    </button>
    <button class="bnav-tab ${activeView === 'school' ? 'active' : ''}" data-view="school">
      <span class="bnav-icon">&#x1F3EB;</span>
      <span class="bnav-label">SCHOOL</span>
      ${!getTodayRobloxData().schoolReviewDone ? '<span class="bnav-badge pulse school-badge">NEW</span>' : ''}
    </button>
    <button class="bnav-tab ${activeView === 'vault' ? 'active' : ''}" data-view="vault">
      <span class="bnav-icon">&#x1F512;</span>
      <span class="bnav-label">VAULT</span>
      ${learnedCount > 0 ? `<span class="bnav-badge">${learnedCount}</span>` : ''}
    </button>
    <button class="bnav-tab ${activeView === 'stats' ? 'active' : ''}" data-view="stats">
      <span class="bnav-icon">&#x1F4CA;</span>
      <span class="bnav-label">STATS</span>
    </button>
  `;

  document.body.appendChild(nav);
  nav.querySelectorAll('.bnav-tab').forEach(btn => {
    btn.addEventListener('click', () => render(btn.dataset.view));
  });
}

// ===== LEARN VIEW =====
let learnIndex = 0; // session-level, tracks current word position

function renderLearn() {
  const theme = getCurrentTheme();
  const weeklyWords = getWeeklyWords();
  const weekNum = getCurrentThemeIndex() + 1;
  const weekLearned = weeklyWords.filter(w => state.learnedWords.includes(w.word));
  const allLearned = weekLearned.length >= weeklyWords.length;

  // If all learned, show quiz gate
  if (allLearned) {
    renderQuizGate(theme, weeklyWords, weekNum);
    return;
  }

  // Find first unlearned word if learnIndex is out of bounds
  if (learnIndex >= weeklyWords.length) learnIndex = 0;

  // Auto-advance to first unlearned word (if current is already learned)
  let checked = 0;
  while (state.learnedWords.includes(weeklyWords[learnIndex].word) && checked < weeklyWords.length) {
    learnIndex = (learnIndex + 1) % weeklyWords.length;
    checked++;
  }
  if (checked >= weeklyWords.length) {
    renderQuizGate(theme, weeklyWords, weekNum);
    return;
  }

  const word = weeklyWords[learnIndex];
  renderStudyPhase(word, theme, weeklyWords, weekNum, weekLearned);
}

// Phase 1: Study the word — see definition, examples, synonyms
function renderStudyPhase(word, theme, weeklyWords, weekNum, weekLearned) {
  app.innerHTML = `
    <div class="app-container">
      ${robloxBarCompactHTML()}

      <div class="learn-theme-label">
        <span class="ltl-week">WEEK ${weekNum}</span>
        <span class="ltl-name">${theme.emoji} ${theme.name}</span>
      </div>

      <div class="learn-progress-dots">
        ${weeklyWords.map((w, i) => {
          const learned = state.learnedWords.includes(w.word);
          const current = i === learnIndex;
          return `<button class="lpd ${learned ? 'done' : ''} ${current ? 'current' : ''}" data-idx="${i}" title="${w.word}">${learned ? '&#x2713;' : i + 1}</button>`;
        }).join('')}
      </div>

      <div class="learn-counter">Word ${learnIndex + 1} of ${weeklyWords.length} &mdash; ${weekLearned.length} mastered</div>

      <div class="learn-phase-tag study">&#x1F4D6; STUDY</div>

      <div class="learn-word-card">
        <div class="lwc-word">${word.word}</div>
        <div class="lwc-pos">${word.partOfSpeech}</div>
        <div class="lwc-def">${word.definition}</div>
        <div class="lwc-examples">
          ${word.examples.map(ex => `<div class="lwc-example">&#x1F3AF; ${ex}</div>`).join('')}
        </div>
        <div class="lwc-synonyms">&#x1F4A1; Similar: ${word.synonyms.join(', ')}</div>
      </div>

      <button class="learn-test-btn" id="testMeBtn">&#x1F3AF; TEST ME!</button>
      <div class="learn-test-hint">Answer correctly to master this word</div>
    </div>
  `;

  document.getElementById('testMeBtn').addEventListener('click', () => {
    renderTestPhase(word, theme, weeklyWords, weekNum, weekLearned);
    renderBottomNav('learn');
  });

  // Dot navigation
  app.querySelectorAll('.lpd').forEach(dot => {
    dot.addEventListener('click', () => {
      learnIndex = parseInt(dot.dataset.idx);
      render('learn');
    });
  });
}

// Phase 2: Mini-quiz — pick the correct definition from 4 choices
function renderTestPhase(word, theme, weeklyWords, weekNum, weekLearned) {
  // Build 4 options: 1 correct + 3 random wrong definitions
  const others = vocabulary
    .filter(w => w.word !== word.word)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const options = [
    { text: word.definition, correct: true },
    ...others.map(w => ({ text: w.definition, correct: false }))
  ].sort(() => Math.random() - 0.5);

  let answered = false;

  app.innerHTML = `
    <div class="app-container">
      ${robloxBarCompactHTML()}

      <div class="learn-theme-label">
        <span class="ltl-week">WEEK ${weekNum}</span>
        <span class="ltl-name">${theme.emoji} ${theme.name}</span>
      </div>

      <div class="learn-progress-dots">
        ${weeklyWords.map((w, i) => {
          const learned = state.learnedWords.includes(w.word);
          const current = i === learnIndex;
          return `<button class="lpd ${learned ? 'done' : ''} ${current ? 'current' : ''}" data-idx="${i}" title="${w.word}">${learned ? '&#x2713;' : i + 1}</button>`;
        }).join('')}
      </div>

      <div class="learn-phase-tag test">&#x1F3AF; TEST</div>

      <div class="learn-test-card">
        <div class="ltc-prompt">What does this word mean?</div>
        <div class="ltc-word">${word.word}</div>
        <div class="ltc-pos">${word.partOfSpeech}</div>
      </div>

      <div class="learn-test-options">
        ${options.map((opt, i) => `
          <button class="lto-btn" data-index="${i}">
            <span class="lto-letter">${['A', 'B', 'C', 'D'][i]}</span>
            <span class="lto-text">${opt.text}</span>
          </button>
        `).join('')}
      </div>

      <div class="learn-test-feedback hidden" id="ltFeedback"></div>
      <button class="learn-test-next hidden" id="ltNext"></button>
    </div>
  `;

  // Answer handling
  app.querySelectorAll('.lto-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      const idx = parseInt(btn.dataset.index);
      const isCorrect = options[idx].correct;
      const feedbackEl = document.getElementById('ltFeedback');
      const nextBtn = document.getElementById('ltNext');

      if (isCorrect) {
        btn.classList.add('correct');

        feedbackEl.innerHTML = `
          <div class="lt-correct">&#x2705; Correct! Now spell it!</div>
        `;

        nextBtn.textContent = '✏️ Spelling Test \u25B6';
        nextBtn.className = 'learn-test-next success';
        nextBtn.addEventListener('click', () => {
          renderSpellingPhase(word, theme, weeklyWords, weekNum, weekLearned);
          renderBottomNav('learn');
        });
      } else {
        btn.classList.add('wrong');
        // Highlight the correct answer
        const correctIdx = options.findIndex(o => o.correct);
        app.querySelectorAll('.lto-btn')[correctIdx].classList.add('correct');

        feedbackEl.innerHTML = `
          <div class="lt-wrong">&#x274C; Not quite! The answer is:</div>
          <div class="lt-answer">${word.definition}</div>
        `;

        nextBtn.textContent = '\uD83D\uDD04 Study Again';
        nextBtn.className = 'learn-test-next retry';
        nextBtn.addEventListener('click', () => {
          // Go back to study phase for the same word
          renderStudyPhase(word, theme, weeklyWords, weekNum, weekLearned);
          renderBottomNav('learn');
        });
      }

      feedbackEl.classList.remove('hidden');
      nextBtn.classList.remove('hidden');
    });
  });

  // Dot navigation (still works during test)
  app.querySelectorAll('.lpd').forEach(dot => {
    dot.addEventListener('click', () => {
      learnIndex = parseInt(dot.dataset.idx);
      render('learn');
    });
  });
}

// Phase 3: Spelling test — letter-by-letter input (prevents iPad autocomplete)
function renderSpellingPhase(word, theme, weeklyWords, weekNum, weekLearned) {
  let answered = false;
  const letters = word.word.split('');
  const wordLen = letters.length;
  const correctCount = getTodayCorrectCount();
  const untilNext = CORRECT_PER_MINUTE - (correctCount % CORRECT_PER_MINUTE);

  app.innerHTML = `
    <div class="app-container">
      ${robloxBarCompactHTML()}

      <div class="learn-theme-label">
        <span class="ltl-week">WEEK ${weekNum}</span>
        <span class="ltl-name">${theme.emoji} ${theme.name}</span>
      </div>

      <div class="learn-progress-dots">
        ${weeklyWords.map((w, i) => {
          const learned = state.learnedWords.includes(w.word);
          const current = i === learnIndex;
          return `<button class="lpd ${learned ? 'done' : ''} ${current ? 'current' : ''}" data-idx="${i}" title="${w.word}">${learned ? '&#x2713;' : i + 1}</button>`;
        }).join('')}
      </div>

      <div class="learn-phase-tag spell">&#x270F;&#xFE0F; SPELL</div>

      <div class="learn-spell-card">
        <div class="lsc-prompt">Spell the word that means:</div>
        <div class="lsc-def">${word.definition}</div>
        <div class="lsc-pos">${word.partOfSpeech}</div>
      </div>

      <div class="spell-letter-boxes" id="letterBoxes">
        ${letters.map((ch, i) => {
          if (i === 0) {
            return `<div class="spell-box hint" data-idx="${i}">${ch.toUpperCase()}</div>`;
          }
          return `<input class="spell-box" data-idx="${i}" type="text" maxlength="1" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`;
        }).join('')}
      </div>

      <div class="spell-progress-hint">
        &#x1F3AE; ${untilNext} more correct to earn +1 min
      </div>

      <button class="spell-check-btn" id="spellCheckBtn">CHECK &#x2705;</button>

      <div class="learn-test-feedback hidden" id="spellFeedback"></div>
      <button class="learn-test-next hidden" id="spellNext"></button>
    </div>
  `;

  const boxes = app.querySelectorAll('.spell-box:not(.hint)');
  const checkBtn = document.getElementById('spellCheckBtn');
  const feedbackEl = document.getElementById('spellFeedback');
  const nextBtn = document.getElementById('spellNext');

  // Focus first editable box
  if (boxes.length > 0) setTimeout(() => boxes[0].focus(), 100);

  // Letter box input handling
  boxes.forEach((box, i) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.length >= 1) {
        e.target.value = val.charAt(val.length - 1).toLowerCase();
        // Auto-advance to next box
        if (i < boxes.length - 1) {
          boxes[i + 1].focus();
        }
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (box.value === '' && i > 0) {
          e.preventDefault();
          boxes[i - 1].focus();
          boxes[i - 1].value = '';
        }
      } else if (e.key === 'Enter') {
        checkSpelling();
      } else if (e.key === 'ArrowLeft' && i > 0) {
        boxes[i - 1].focus();
      } else if (e.key === 'ArrowRight' && i < boxes.length - 1) {
        boxes[i + 1].focus();
      }
    });

    // Handle paste — spread across boxes
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData('text') || '').toLowerCase();
      for (let j = 0; j < pasted.length && (i + j) < boxes.length; j++) {
        boxes[i + j].value = pasted[j];
      }
      const nextIdx = Math.min(i + pasted.length, boxes.length - 1);
      boxes[nextIdx].focus();
    });
  });

  function checkSpelling() {
    if (answered) return;

    // Gather all letters
    const userLetters = [letters[0].toLowerCase()]; // first letter is the hint
    boxes.forEach(box => userLetters.push((box.value || '').toLowerCase()));
    const userAnswer = userLetters.join('');
    const correctAnswer = word.word.toLowerCase();

    // Don't check if not all filled
    const allFilled = Array.from(boxes).every(box => box.value.trim() !== '');
    if (userAnswer.length < wordLen || !allFilled) return;

    answered = true;
    const isCorrect = userAnswer === correctAnswer;

    // Disable all boxes
    boxes.forEach(box => box.disabled = true);
    checkBtn.disabled = true;

    // Color each box green/red
    letters.forEach((ch, i) => {
      if (i === 0) return; // skip hint
      const box = app.querySelector(`.spell-box[data-idx="${i}"]`);
      if (box.value.toLowerCase() === ch.toLowerCase()) {
        box.classList.add('correct');
      } else {
        box.classList.add('wrong');
      }
    });

    if (isCorrect) {
      // Also highlight the hint box green
      app.querySelector('.spell-box.hint').classList.add('all-correct');

      // Mark as learned & track correct answer
      if (!state.learnedWords.includes(word.word)) {
        state.learnedWords.push(word.word);
        saveState(state);
      }
      const result = trackCorrectAndAward();

      let feedbackHTML = `<div class="lt-correct">&#x2705; Perfect! <strong>${word.word}</strong> mastered!</div>`;
      if (result.awarded > 0) {
        feedbackHTML += `<div class="lt-reward">&#x1F3AE; +1 ROBLOX MIN!</div>`;
      } else {
        feedbackHTML += `<div class="lt-progress-hint">&#x1F3AF; ${result.untilNext} more to earn +1 min</div>`;
      }
      feedbackEl.innerHTML = feedbackHTML;

      if (result.awarded > 0) {
        showRewardPopup(result.awarded, result.capReached);
      }

      nextBtn.textContent = 'Next Word \u25B6';
      nextBtn.className = 'learn-test-next success';
      nextBtn.addEventListener('click', () => {
        learnIndex = (learnIndex + 1) % weeklyWords.length;
        render('learn');
      });
    } else {
      feedbackEl.innerHTML = `
        <div class="lt-wrong">&#x274C; Not quite! The correct spelling is:</div>
        <div class="lt-answer spell-answer">${word.word}</div>
      `;

      nextBtn.textContent = '\uD83D\uDD04 Study Again';
      nextBtn.className = 'learn-test-next retry';
      nextBtn.addEventListener('click', () => {
        renderStudyPhase(word, theme, weeklyWords, weekNum, weekLearned);
        renderBottomNav('learn');
      });
    }

    feedbackEl.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
  }

  checkBtn.addEventListener('click', checkSpelling);

  // Dot navigation
  app.querySelectorAll('.lpd').forEach(dot => {
    dot.addEventListener('click', () => {
      learnIndex = parseInt(dot.dataset.idx);
      render('learn');
    });
  });
}

function renderQuizGate(theme, weeklyWords, weekNum) {
  app.innerHTML = `
    <div class="app-container">
      ${robloxBarCompactHTML()}

      <div class="quiz-gate">
        <div class="qg-trophy">&#x1F3C6;</div>
        <div class="qg-title">ALL WORDS STUDIED!</div>
        <div class="qg-subtitle">${theme.emoji} ${theme.name} &mdash; Week ${weekNum}</div>
        <div class="qg-subtitle2">${weeklyWords.length} / ${weeklyWords.length} words mastered</div>

        <button class="qg-quiz-btn" id="startQuizBtn">
          <span class="qg-quiz-icon">&#x2694;&#xFE0F;</span>
          <span class="qg-quiz-text">TAKE THE QUIZ!</span>
          <span class="qg-quiz-sub">Score 9+ = &#x1F4B0; $1 &nbsp;|&nbsp; 90%+ = 1.2x Bonus</span>
        </button>

        <button class="qg-review-btn" id="reviewBtn">&#x1F504; Review Words Again</button>
      </div>
    </div>
  `;

  document.getElementById('startQuizBtn').addEventListener('click', () => render('quiz'));
  document.getElementById('reviewBtn').addEventListener('click', () => {
    learnIndex = 0;
    // Temporarily allow revisiting learned words
    renderLearnReview();
  });
}

function renderLearnReview() {
  const theme = getCurrentTheme();
  const weeklyWords = getWeeklyWords();
  const weekNum = getCurrentThemeIndex() + 1;
  const weekLearned = weeklyWords.filter(w => state.learnedWords.includes(w.word));

  if (learnIndex >= weeklyWords.length) {
    // Back to quiz gate
    renderQuizGate(theme, weeklyWords, weekNum);
    renderBottomNav('learn');
    return;
  }

  const word = weeklyWords[learnIndex];

  app.innerHTML = `
    <div class="app-container">
      ${robloxBarCompactHTML()}

      <div class="learn-theme-label">
        <span class="ltl-week">REVIEW MODE</span>
        <span class="ltl-name">${theme.emoji} ${theme.name}</span>
      </div>

      <div class="learn-progress-dots">
        ${weeklyWords.map((w, i) => {
          const current = i === learnIndex;
          return `<button class="lpd done ${current ? 'current' : ''}" data-idx="${i}" title="${w.word}">&#x2713;</button>`;
        }).join('')}
      </div>

      <div class="learn-counter">Reviewing word ${learnIndex + 1} of ${weeklyWords.length}</div>

      <div class="learn-word-card review-mode">
        <div class="lwc-word">${word.word}</div>
        <div class="lwc-pos">${word.partOfSpeech}</div>
        <div class="lwc-def">${word.definition}</div>
        <div class="lwc-examples">
          ${word.examples.map(ex => `<div class="lwc-example">&#x1F3AF; ${ex}</div>`).join('')}
        </div>
        <div class="lwc-synonyms">&#x1F4A1; Similar: ${word.synonyms.join(', ')}</div>
      </div>

      <button class="learn-got-it-btn review" id="nextReviewBtn">
        ${learnIndex < weeklyWords.length - 1 ? '&#x27A1;&#xFE0F; NEXT' : '&#x2694;&#xFE0F; DONE &mdash; QUIZ TIME!'}
      </button>
    </div>
  `;

  document.getElementById('nextReviewBtn').addEventListener('click', () => {
    learnIndex++;
    if (learnIndex >= weeklyWords.length) {
      render('quiz');
    } else {
      renderLearnReview();
      renderBottomNav('learn');
    }
  });

  app.querySelectorAll('.lpd').forEach(dot => {
    dot.addEventListener('click', () => {
      learnIndex = parseInt(dot.dataset.idx);
      renderLearnReview();
      renderBottomNav('learn');
    });
  });

  renderBottomNav('learn');
}

// ===== QUIZ VIEW =====
function renderQuiz() {
  const theme = getCurrentTheme();
  const weeklyWords = getWeeklyWords();
  const weekLearned = weeklyWords.filter(w => state.learnedWords.includes(w.word));
  const unstudied = weeklyWords.length - weekLearned.length;

  // Soft gate if not all words studied
  if (unstudied > 0) {
    app.innerHTML = `
      <div class="app-container">
        ${robloxBarCompactHTML()}
        <div class="quiz-gate-soft">
          <div class="qgs-icon">&#x1F4DA;</div>
          <div class="qgs-title">Study ${unstudied} more word${unstudied > 1 ? 's' : ''} first!</div>
          <div class="qgs-sub">You've learned ${weekLearned.length} of ${weeklyWords.length} words for ${theme.emoji} ${theme.name}</div>
          <div class="qgs-actions">
            <button class="qgs-btn primary" id="goLearnBtn">&#x1F4D6; Go Learn</button>
            <button class="qgs-btn secondary" id="tryAnywayBtn">&#x1F4AA; Try Anyway</button>
          </div>
        </div>
      </div>
    `;
    renderBottomNav('quiz');
    document.getElementById('goLearnBtn').addEventListener('click', () => render('learn'));
    document.getElementById('tryAnywayBtn').addEventListener('click', () => startQuiz());
    return;
  }

  startQuiz();
}

function startQuiz() {
  const theme = getCurrentTheme();
  const dailyWords = getWeeklyWords();

  const questions = dailyWords.map(word => {
    const others = vocabulary
      .filter(w => w.word !== word.word)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const options = [
      { text: word.definition, correct: true },
      ...others.map(w => ({ text: w.definition, correct: false }))
    ].sort(() => Math.random() - 0.5);
    return { word: word.word, partOfSpeech: word.partOfSpeech, options, fullWord: word };
  });

  let currentQ = 0;
  let score = 0;
  let answered = false;

  function renderQuestion() {
    if (currentQ >= questions.length) {
      renderQuizResults(score, questions.length);
      return;
    }

    const q = questions[currentQ];
    app.innerHTML = `
      <div class="app-container">
        <div class="boss-quiz-header">
          <div class="bqh-title">&#x2694;&#xFE0F; BOSS QUIZ</div>
          <div class="bqh-theme">${theme.emoji} ${theme.name}</div>
        </div>

        <div class="quiz-progress-bar">
          <div class="quiz-progress-fill" style="width: ${(currentQ / questions.length) * 100}%"></div>
        </div>

        <div class="quiz-status-row">
          <span class="quiz-score-display">Score: ${score} / ${questions.length}</span>
          <span class="quiz-counter">Q${currentQ + 1}/${questions.length}</span>
        </div>

        <div class="quiz-bonus-hint">&#x1F4B0; 9+ = $1 MONEY &nbsp;|&nbsp; 90%+ = 1.2x BONUS</div>

        <div class="quiz-question-card">
          <div class="quiz-prompt">What does this word mean?</div>
          <div class="quiz-word">${q.word}</div>
          <div class="quiz-pos">${q.partOfSpeech}</div>
        </div>

        <div class="quiz-options">
          ${q.options.map((opt, i) => `
            <button class="quiz-option" data-index="${i}">
              <span class="option-letter">${['A', 'B', 'C', 'D'][i]}</span>
              <span class="option-text">${opt.text}</span>
            </button>
          `).join('')}
        </div>

        <div class="quiz-feedback hidden" id="feedback"></div>
        <button class="quiz-next-btn hidden" id="nextQBtn">Next &#x25B6;</button>
      </div>
    `;

    renderBottomNav('quiz');

    app.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const idx = parseInt(btn.dataset.index);
        const isCorrect = q.options[idx].correct;

        if (isCorrect) {
          score++;
          btn.classList.add('correct');
          let feedbackHTML = `<div class="feedback-correct">&#x2705; Correct! Nice one!</div>`;
          if (!state.learnedWords.includes(q.word)) {
            state.learnedWords.push(q.word);
            saveState(state);
          }
          const result = trackCorrectAndAward();
          if (result.awarded > 0) {
            feedbackHTML += `<div style="text-align:center;margin-top:6px;font-family:'Press Start 2P',monospace;font-size:0.5rem;color:var(--roblox-green-light);">&#x1F3AE; +1 ROBLOX MIN!</div>`;
          } else {
            feedbackHTML += `<div style="text-align:center;margin-top:4px;font-size:0.7rem;color:var(--text-dim);">&#x2B50; ${result.untilNext} more for +1 min</div>`;
          }
          document.getElementById('feedback').innerHTML = feedbackHTML;
        } else {
          btn.classList.add('wrong');
          const correctIdx = q.options.findIndex(o => o.correct);
          app.querySelectorAll('.quiz-option')[correctIdx].classList.add('correct');
          document.getElementById('feedback').innerHTML = `
            <div class="feedback-wrong">
              &#x274C; Not quite! The answer is:<br>
              <strong>${q.options[correctIdx].text}</strong>
            </div>
            <div class="feedback-example">&#x1F3AF; ${q.fullWord.examples[0]}</div>
          `;
        }

        document.getElementById('feedback').classList.remove('hidden');
        document.getElementById('nextQBtn').classList.remove('hidden');
      });
    });

    document.getElementById('nextQBtn').addEventListener('click', () => {
      currentQ++;
      answered = false;
      renderQuestion();
    });
  }

  renderQuestion();

  function renderQuizResults(score, total) {
    const pct = Math.round((score / total) * 100);
    const gotBonus = pct >= BONUS_THRESHOLD * 100;
    const gotMoney = score > MONEY_THRESHOLD;
    let message, emoji;

    if (pct === 100) { message = "PERFECT! Word Master!"; emoji = "&#x1F3C6;"; }
    else if (pct >= 80) { message = "Epic! Almost flawless!"; emoji = "&#x1F31F;"; }
    else if (pct >= 60) { message = "Good run! Keep grinding!"; emoji = "&#x1F44D;"; }
    else { message = "Keep practising! You'll level up!"; emoji = "&#x1F4AA;"; }

    if (gotBonus) activateBonus();
    let moneyAwarded = 0;
    if (gotMoney) moneyAwarded = awardRobloxMoney();

    state.quizScores.push({ date: getTodayStr(), score, total });
    state.totalQuizzesTaken++;
    state.totalCorrect += score;
    saveState(state);

    const alreadyGotMoneyToday = isMoneyAwardedToday() && moneyAwarded === 0 && gotMoney;

    app.innerHTML = `
      <div class="app-container">
        <div class="quiz-results">
          <div class="results-emoji">${emoji}</div>
          <h2 class="results-title">&#x2694;&#xFE0F; QUEST COMPLETE!</h2>
          <div class="results-score">${score} / ${total}</div>
          <div class="results-pct">${pct}%</div>
          <p class="results-message">${message}</p>

          ${moneyAwarded > 0 ? `
            <div class="results-money">
              <div class="results-money-icon">&#x1F4B0;</div>
              <div class="results-money-title">+ $1 ROBLOX MONEY!</div>
              <div class="results-money-text">Total saved: $${getTotalRobloxMoney()} for Roblox prepaid card!</div>
            </div>
          ` : ''}

          ${alreadyGotMoneyToday ? `
            <div class="results-info-msg purple">&#x1F4B0; Already earned $1 today! Come back tomorrow!</div>
          ` : ''}

          ${!gotMoney && score <= MONEY_THRESHOLD ? `
            <div class="results-info-msg muted">&#x1F4B0; Score 9+ out of 10 to earn $1 Roblox Money!</div>
          ` : ''}

          ${gotBonus ? `
            <div class="results-bonus">
              <div class="results-bonus-title">&#x1F525; 1.2x BONUS UNLOCKED! &#x1F525;</div>
              <div class="results-bonus-text">Today's Roblox cap: ${getTodayMaxMinutes()} minutes!</div>
            </div>
          ` : `
            ${pct < 90 ? `<div class="results-info-msg muted">Score 90%+ to unlock 1.2x bonus!</div>` : ''}
          `}

          <div class="results-actions">
            <button class="results-btn retry-btn" id="retryBtn">&#x1F504; Retry</button>
            <button class="results-btn vault-btn" id="vaultBtn">&#x1F512; Vault</button>
            <button class="results-btn stats-btn" id="statsBtn">&#x1F4CA; Stats</button>
          </div>
        </div>
      </div>
    `;

    renderBottomNav('quiz');

    if (moneyAwarded > 0) showMoneyPopup();

    document.getElementById('retryBtn').addEventListener('click', () => startQuiz());
    document.getElementById('vaultBtn').addEventListener('click', () => render('vault'));
    document.getElementById('statsBtn').addEventListener('click', () => render('stats'));
  }
}

// ===== SCHOOL REVIEW QUIZ =====
function renderSchool() {
  const todayData = getTodayRobloxData();
  const alreadyDone = todayData.schoolReviewDone || false;

  app.innerHTML = `
    <div class="app-container">
      ${robloxBarCompactHTML()}

      <div class="school-header">
        <div class="school-icon">&#x1F3EB;</div>
        <div class="school-title">SCHOOL REVIEW</div>
        <div class="school-sub">Practise the ${SCHOOL_REVIEW_WORDS.length} words you got wrong!</div>
      </div>

      <div class="school-words-preview">
        ${SCHOOL_REVIEW_WORDS.map((w, i) => `
          <div class="swp-item">
            <span class="swp-num">${i + 1}</span>
            <span class="swp-wrong">${w.wrong}</span>
            <span class="swp-arrow">&#x2192;</span>
            <span class="swp-correct">${w.correct}</span>
          </div>
        `).join('')}
      </div>

      <div class="school-reward-info">
        <div class="sri-text">&#x1F3AE; 100% correct = <strong>+${SCHOOL_REVIEW_REWARD} ROBLOX MIN!</strong></div>
        ${alreadyDone ? '<div class="sri-done">&#x2705; Completed today! You can still practise.</div>' : ''}
      </div>

      <button class="school-start-btn" id="startSchoolBtn">
        ${alreadyDone ? '&#x1F504; PRACTICE AGAIN' : '&#x1F4DD; START QUIZ'}
      </button>
    </div>
  `;

  document.getElementById('startSchoolBtn').addEventListener('click', () => startSchoolReview());
}

function startSchoolReview() {
  const words = [...SCHOOL_REVIEW_WORDS].sort(() => Math.random() - 0.5);
  let currentIdx = 0;
  let correctCount = 0;

  function speakWord(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/'/g, ''));
      u.rate = 0.75;
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  }

  function renderSchoolWord() {
    if (currentIdx >= words.length) {
      renderSchoolResults(correctCount, words.length);
      return;
    }

    const entry = words[currentIdx];
    const word = entry.correct;
    const letters = word.split('');
    const wordLen = letters.length;
    let answered = false;

    // Hints: first letter + apostrophes
    const isHint = letters.map((ch, i) => i === 0 || ch === "'");

    app.innerHTML = `
      <div class="app-container">
        <div class="school-quiz-header">
          <span class="sqh-title">&#x1F3EB; SCHOOL REVIEW</span>
          <span class="sqh-counter">${currentIdx + 1} / ${words.length}</span>
        </div>

        <div class="school-progress-bar">
          <div class="school-progress-fill" style="width: ${(currentIdx / words.length) * 100}%"></div>
        </div>

        <div class="school-score-row">
          <span class="ssr-correct">&#x2705; ${correctCount}</span>
          <span class="ssr-wrong">&#x274C; ${currentIdx - correctCount}</span>
        </div>

        <div class="school-speak-card">
          <div class="ssc-prompt">Listen and spell the word:</div>
          <button class="ssc-play-btn" id="playWordBtn">&#x1F50A; PLAY WORD</button>
          <div class="ssc-hint">You wrote: <span class="ssc-wrong">${entry.wrong}</span></div>
        </div>

        <div class="spell-letter-boxes" id="letterBoxes">
          ${letters.map((ch, i) => {
            if (isHint[i]) {
              return `<div class="spell-box hint ${ch === "'" ? 'apostrophe' : ''}" data-idx="${i}">${ch === "'" ? "&#x2019;" : ch.toUpperCase()}</div>`;
            }
            return `<input class="spell-box" data-idx="${i}" type="text" maxlength="1" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`;
          }).join('')}
        </div>

        <button class="spell-check-btn" id="spellCheckBtn">CHECK &#x2705;</button>

        <div class="learn-test-feedback hidden" id="spellFeedback"></div>
        <button class="learn-test-next hidden" id="spellNext"></button>
      </div>
    `;

    renderBottomNav('school');

    // Auto-play word
    setTimeout(() => speakWord(word), 300);

    document.getElementById('playWordBtn').addEventListener('click', () => speakWord(word));

    const boxes = app.querySelectorAll('.spell-box:not(.hint)');
    const checkBtn = document.getElementById('spellCheckBtn');
    const feedbackEl = document.getElementById('spellFeedback');
    const nextBtn = document.getElementById('spellNext');

    if (boxes.length > 0) setTimeout(() => boxes[0].focus(), 400);

    // Letter box input handling
    boxes.forEach((box, idx) => {
      box.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val.length >= 1) {
          e.target.value = val.charAt(val.length - 1).toLowerCase();
          if (idx < boxes.length - 1) boxes[idx + 1].focus();
        }
      });

      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (box.value === '' && idx > 0) {
            e.preventDefault();
            boxes[idx - 1].focus();
            boxes[idx - 1].value = '';
          }
        } else if (e.key === 'Enter') {
          doCheck();
        } else if (e.key === 'ArrowLeft' && idx > 0) {
          boxes[idx - 1].focus();
        } else if (e.key === 'ArrowRight' && idx < boxes.length - 1) {
          boxes[idx + 1].focus();
        }
      });

      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData.getData('text') || '').toLowerCase();
        for (let j = 0; j < pasted.length && (idx + j) < boxes.length; j++) {
          boxes[idx + j].value = pasted[j];
        }
        const ni = Math.min(idx + pasted.length, boxes.length - 1);
        boxes[ni].focus();
      });
    });

    function doCheck() {
      if (answered) return;

      const userLetters = [];
      let allFilled = true;
      letters.forEach((ch, i) => {
        if (isHint[i]) {
          userLetters.push(ch.toLowerCase());
        } else {
          const box = app.querySelector(`.spell-box[data-idx="${i}"]`);
          const val = (box.value || '').toLowerCase();
          if (val.trim() === '') allFilled = false;
          userLetters.push(val);
        }
      });

      if (!allFilled) return;

      answered = true;
      const userAnswer = userLetters.join('');
      const correctAnswer = word.toLowerCase();
      const isCorrect = userAnswer === correctAnswer;

      boxes.forEach(box => box.disabled = true);
      checkBtn.disabled = true;

      // Color each box
      letters.forEach((ch, i) => {
        if (isHint[i]) return;
        const box = app.querySelector(`.spell-box[data-idx="${i}"]`);
        if (box.value.toLowerCase() === ch.toLowerCase()) {
          box.classList.add('correct');
        } else {
          box.classList.add('wrong');
        }
      });

      if (isCorrect) {
        correctCount++;
        app.querySelectorAll('.spell-box.hint').forEach(h => h.classList.add('all-correct'));
        feedbackEl.innerHTML = `<div class="lt-correct">&#x2705; Perfect!</div>`;
        nextBtn.textContent = currentIdx < words.length - 1 ? 'Next Word \u25B6' : 'See Results \uD83C\uDFC6';
        nextBtn.className = 'learn-test-next success';
      } else {
        feedbackEl.innerHTML = `
          <div class="lt-wrong">&#x274C; Correct spelling:</div>
          <div class="lt-answer spell-answer">${word}</div>
        `;
        nextBtn.textContent = currentIdx < words.length - 1 ? 'Next Word \u25B6' : 'See Results \uD83C\uDFC6';
        nextBtn.className = 'learn-test-next retry';
      }

      feedbackEl.classList.remove('hidden');
      nextBtn.classList.remove('hidden');

      nextBtn.addEventListener('click', () => {
        currentIdx++;
        renderSchoolWord();
      });
    }

    checkBtn.addEventListener('click', doCheck);
  }

  renderSchoolWord();
}

function renderSchoolResults(score, total) {
  const pct = Math.round((score / total) * 100);
  const isPerfect = score === total;
  const todayData = getTodayRobloxData();
  const alreadyDone = todayData.schoolReviewDone || false;

  let minutesAwarded = 0;
  if (isPerfect && !alreadyDone) {
    todayData.schoolReviewDone = true;
    const max = getTodayMaxMinutes();
    const canAward = Math.min(SCHOOL_REVIEW_REWARD, max - todayData.earned);
    if (canAward > 0) {
      todayData.earned += canAward;
      minutesAwarded = canAward;
    }
    saveState(state);
  }

  let emoji, message;
  if (isPerfect) { emoji = '&#x1F3C6;'; message = 'PERFECT SCORE!'; }
  else if (pct >= 80) { emoji = '&#x2B50;'; message = 'Almost there! Keep trying!'; }
  else { emoji = '&#x1F4AA;'; message = 'Keep practising!'; }

  app.innerHTML = `
    <div class="app-container">
      <div class="school-results">
        <div class="sr-emoji">${emoji}</div>
        <div class="sr-title">${message}</div>
        <div class="sr-score">${score} / ${total}</div>
        <div class="sr-pct">${pct}%</div>

        ${minutesAwarded > 0 ? `
          <div class="sr-reward">
            <div class="sr-reward-icon">&#x1F3AE;</div>
            <div class="sr-reward-text">+${minutesAwarded} ROBLOX MINUTES!</div>
          </div>
        ` : ''}

        ${isPerfect && alreadyDone && minutesAwarded === 0 ? `
          <div class="sr-already">&#x2705; Great practice! Already earned today's reward.</div>
        ` : ''}

        ${!isPerfect ? `
          <div class="sr-hint">Get 100% to earn ${SCHOOL_REVIEW_REWARD} Roblox minutes!</div>
        ` : ''}

        <div class="sr-actions">
          <button class="sr-btn retry" id="retrySchoolBtn">&#x1F504; Try Again</button>
          <button class="sr-btn review" id="reviewSchoolBtn">&#x1F3EB; Review Words</button>
        </div>
      </div>
    </div>
  `;

  renderBottomNav('school');

  if (minutesAwarded > 0) {
    showRewardPopup(minutesAwarded, getTodayEarned() >= getTodayMaxMinutes());
  }

  document.getElementById('retrySchoolBtn').addEventListener('click', () => startSchoolReview());
  document.getElementById('reviewSchoolBtn').addEventListener('click', () => renderSchool());
}

// ===== WORD VAULT =====
function renderVault() {
  const learnedWordObjects = vocabulary.filter(w => state.learnedWords.includes(w.word));
  const totalLearned = learnedWordObjects.length;
  let searchQuery = '';
  let expandedThemes = {};

  function renderVaultList() {
    if (totalLearned === 0) {
      app.innerHTML = `
        <div class="app-container">
          <div class="vault-empty">
            <div class="ve-icon">&#x1F512;</div>
            <div class="ve-title">Your vault is empty!</div>
            <div class="ve-sub">Start learning words to fill your collection!</div>
            <button class="ve-btn" id="goLearnBtn">&#x25B6;&#xFE0F; Start Learning</button>
          </div>
        </div>
      `;
      document.getElementById('goLearnBtn').addEventListener('click', () => render('learn'));
      return;
    }

    // Filter by search
    let filtered = learnedWordObjects;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(w =>
        w.word.toLowerCase().includes(q) ||
        w.definition.toLowerCase().includes(q)
      );
    }

    // Group by theme
    const grouped = {};
    filtered.forEach(w => {
      if (!grouped[w.theme]) grouped[w.theme] = [];
      grouped[w.theme].push(w);
    });

    // Order by themeOrder
    const orderedThemes = themeOrder
      .filter(t => grouped[t.name])
      .map(t => ({
        ...t,
        words: grouped[t.name].sort((a, b) => a.word.localeCompare(b.word)),
        totalInTheme: vocabulary.filter(v => v.theme === t.name).length,
        learnedInTheme: vocabulary.filter(v => v.theme === t.name && state.learnedWords.includes(v.word)).length,
      }));

    app.innerHTML = `
      <div class="app-container">
        <div class="vault-header">
          <span class="vault-title">&#x1F512; WORD VAULT</span>
          <span class="vault-count">${totalLearned} / ${vocabulary.length}</span>
        </div>

        <div class="search-bar">
          <input type="text" id="vaultSearch" class="search-input" placeholder="Search your words..." value="${searchQuery}">
        </div>

        <div class="vault-groups">
          ${orderedThemes.map(t => {
            const isExpanded = expandedThemes[t.name] || false;
            const isComplete = t.learnedInTheme >= t.totalInTheme;
            return `
              <div class="vault-group ${isComplete ? 'complete' : ''}">
                <button class="vg-header" data-theme="${t.name}">
                  <span class="vg-left">
                    <span class="vg-emoji">${t.emoji}</span>
                    <span class="vg-name">${t.name}</span>
                  </span>
                  <span class="vg-right">
                    <span class="vg-count">${t.learnedInTheme}/${t.totalInTheme}</span>
                    ${isComplete ? '<span class="vg-check">&#x2705;</span>' : ''}
                    <span class="vg-arrow ${isExpanded ? 'open' : ''}">&#x25B6;</span>
                  </span>
                </button>
                ${isExpanded ? `
                  <div class="vg-words">
                    ${t.words.map(w => `
                      <div class="word-card">
                        <div class="word-card-header">
                          <span class="wc-word">${w.word}</span>
                          <span class="wc-badges">
                            <span class="badge pos-badge">${w.partOfSpeech}</span>
                          </span>
                        </div>
                        <div class="wc-definition">${w.definition}</div>
                        <div class="wc-examples">
                          ${w.examples.map(ex => `<div class="wc-example-item">&#x1F3AF; ${ex}</div>`).join('')}
                        </div>
                        <div class="wc-meta">
                          <span class="wc-synonyms">Similar: ${w.synonyms.join(', ')}</span>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Search
    document.getElementById('vaultSearch').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderVaultList();
      renderBottomNav('vault');
      const input = document.getElementById('vaultSearch');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });

    // Expand/collapse
    app.querySelectorAll('.vg-header').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        expandedThemes[theme] = !expandedThemes[theme];
        renderVaultList();
        renderBottomNav('vault');
      });
    });
  }

  renderVaultList();
}

// ===== STATS HQ =====
function renderStats() {
  const totalWords = vocabulary.length;
  const learnedCount = state.learnedWords.length;
  const pct = Math.round((learnedCount / totalWords) * 100);
  const totalPossible = state.quizScores.reduce((sum, s) => sum + s.total, 0);
  const avgScore = totalPossible > 0
    ? Math.round((state.totalCorrect / totalPossible) * 100)
    : 0;

  const themes = [...new Set(vocabulary.map(w => w.theme))];
  const currentThemeName = getCurrentTheme().name;
  const themeStats = themeOrder.map(t => {
    const themeWords = vocabulary.filter(w => w.theme === t.name);
    const learned = themeWords.filter(w => state.learnedWords.includes(w.word));
    return { theme: t.name, emoji: t.emoji, total: themeWords.length, learned: learned.length, isCurrent: t.name === currentThemeName };
  });

  const recentScores = state.quizScores.slice(-5);
  const totalRoblox = getTotalRobloxMinutes();
  const todayEarned = getTodayEarned();
  const todayMax = getTodayMaxMinutes();

  const robloxDays = Object.entries(state.robloxTime)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7);

  app.innerHTML = `
    <div class="app-container">
      <div class="stats-header">
        <span class="stats-title">&#x1F4CA; STATS HQ</span>
      </div>

      <div class="player-card">
        <div class="pc-label">PLAYER STATS</div>
        <div class="pc-grid">
          <div class="pc-stat hero orange">
            <div class="pc-val">$${getTotalRobloxMoney()}</div>
            <div class="pc-key">&#x1F4B0; Roblox Money</div>
          </div>
          <div class="pc-stat hero green">
            <div class="pc-val">${totalRoblox}</div>
            <div class="pc-key">&#x1F3AE; Total Minutes</div>
          </div>
          <div class="pc-stat">
            <div class="pc-val">${state.streak}</div>
            <div class="pc-key">&#x1F525; Day Streak</div>
          </div>
          <div class="pc-stat">
            <div class="pc-val">${learnedCount}</div>
            <div class="pc-key">&#x1F4DA; Words Mastered</div>
          </div>
          <div class="pc-stat full-width">
            <div class="pc-val">${avgScore}%</div>
            <div class="pc-key">&#x1F3AF; Avg Quiz Score</div>
          </div>
        </div>
      </div>

      <div class="today-earnings">
        <h3>&#x1F4C5; Today's Earnings</h3>
        <div class="te-row">
          <span class="te-label">&#x1F3AE; Time</span>
          <span class="te-val">${todayEarned} / ${todayMax} min</span>
        </div>
        <div class="robux-progress-bg">
          <div class="robux-progress-fill ${todayEarned >= todayMax ? 'maxed' : ''}" style="width: ${Math.min((todayEarned / todayMax) * 100, 100)}%"></div>
        </div>
        <div class="te-row">
          <span class="te-label">&#x1F4B0; Money</span>
          <span class="te-val">${isMoneyAwardedToday() ? '&#x2705; $1 earned' : '&#x274C; Not yet'}</span>
        </div>
        <div class="te-row">
          <span class="te-label">&#x1F525; 1.2x Bonus</span>
          <span class="te-val">${isBonusActive() ? '&#x2705; ACTIVE' : '&#x274C; Score 90%+'}</span>
        </div>
      </div>

      <div class="overall-progress">
        <h3>Overall Progress</h3>
        <div class="big-progress-bar-bg">
          <div class="big-progress-bar-fill" style="width: ${pct}%">
            <span class="big-progress-text">${pct}%</span>
          </div>
        </div>
        <p class="progress-detail">${learnedCount} / ${totalWords} words</p>
      </div>

      <div class="theme-progress">
        <h3>Progress by Theme</h3>
        ${themeStats.map(ts => {
          const tp = ts.total > 0 ? Math.round((ts.learned / ts.total) * 100) : 0;
          return `
            <div class="theme-progress-row ${ts.isCurrent ? 'current-theme' : ''}">
              <div class="theme-progress-label">${ts.emoji} ${ts.theme}${ts.isCurrent ? ' &#x1F449;' : ''}</div>
              <div class="theme-progress-bar-bg">
                <div class="theme-progress-bar-fill" style="width: ${tp}%"></div>
              </div>
              <span class="theme-progress-count">${ts.learned}/${ts.total}</span>
            </div>
          `;
        }).join('')}
      </div>

      ${robloxDays.length > 0 ? `
        <div class="roblox-history">
          <h3>&#x1F3AE; Roblox Time History</h3>
          ${robloxDays.map(([date, data]) => `
            <div class="roblox-history-item">
              <span class="rh-date">${date}</span>
              <span>
                <span class="rh-earned">${data.earned} min</span>
                ${data.bonus ? '<span class="rh-bonus">1.2x</span>' : ''}
                ${data.moneyAwarded ? '<span class="rh-money">+$1</span>' : ''}
              </span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${recentScores.length > 0 ? `
        <div class="recent-quizzes">
          <h3>Recent Quizzes</h3>
          <div class="quiz-history">
            ${recentScores.map(s => `
              <div class="quiz-history-item">
                <span class="qh-date">${s.date}</span>
                <span class="qh-score">${s.score}/${s.total}</span>
                <span class="qh-bar">
                  ${Array.from({length: s.total}, (_, i) => `<span class="qh-dot ${i < s.score ? 'filled' : ''}"></span>`).join('')}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="reset-section">
        <button class="reset-btn" id="resetBtn">Reset All Progress</button>
      </div>
    </div>
  `;

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Are you sure? This resets ALL progress including Roblox time. This cannot be undone!')) {
      state = {
        learnedWords: [],
        quizScores: [],
        streak: 0,
        lastVisitDate: null,
        totalQuizzesTaken: 0,
        totalCorrect: 0,
        starredWords: [],
        robloxTime: {},
        todayBonusActive: false,
        robloxMoney: 0,
      };
      saveState(state);
      render('stats');
    }
  });
}

// ===== INIT =====
updateStreak();
render('learn');
