import vocabulary, { themeOrder } from './words.js';

// ===== STATE MANAGEMENT =====
const STORAGE_KEY = 'vocab-app-state';
const DAILY_CAP_MINUTES = 10;
const BONUS_MULTIPLIER = 1.2;
const BONUS_THRESHOLD = 0.9; // 90%
const MONEY_THRESHOLD = 8;   // Score > 8 out of 10 → $1 Roblox Money

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
    state.robloxTime[today] = { earned: 0, bonus: false, moneyAwarded: false };
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

// Phase 3: Spelling test — type the word from its definition
function renderSpellingPhase(word, theme, weeklyWords, weekNum, weekLearned) {
  let answered = false;

  // Build hint: first letter + underscores (e.g. "g _ _ _ _ _ _ _ _")
  const hintLetters = word.word.split('').map((ch, i) => i === 0 ? ch : '_').join(' ');

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
        <div class="lsc-prompt">Type the word that means:</div>
        <div class="lsc-def">${word.definition}</div>
        <div class="lsc-pos">${word.partOfSpeech}</div>
        <div class="lsc-hint">${hintLetters}</div>
      </div>

      <div class="spell-input-row">
        <input type="text" id="spellInput" class="spell-input" placeholder="Type the word..." autocomplete="off" autocapitalize="none" spellcheck="false">
        <button class="spell-check-btn" id="spellCheckBtn">CHECK &#x2705;</button>
      </div>

      <div class="learn-test-feedback hidden" id="spellFeedback"></div>
      <button class="learn-test-next hidden" id="spellNext"></button>
    </div>
  `;

  const input = document.getElementById('spellInput');
  const checkBtn = document.getElementById('spellCheckBtn');
  const feedbackEl = document.getElementById('spellFeedback');
  const nextBtn = document.getElementById('spellNext');

  // Focus input
  setTimeout(() => input.focus(), 100);

  function checkSpelling() {
    if (answered) return;
    const userAnswer = input.value.trim().toLowerCase();
    if (!userAnswer) return; // don't check empty

    answered = true;
    const correctAnswer = word.word.toLowerCase();
    const isCorrect = userAnswer === correctAnswer;

    input.disabled = true;
    checkBtn.disabled = true;

    if (isCorrect) {
      input.classList.add('correct');

      // Mark as learned & award time
      if (!state.learnedWords.includes(word.word)) {
        state.learnedWords.push(word.word);
        const awarded = awardRobloxMinute();
        saveState(state);

        feedbackEl.innerHTML = `
          <div class="lt-correct">&#x2705; Perfect! <strong>${word.word}</strong> mastered!</div>
          ${awarded > 0 ? '<div class="lt-reward">&#x1F3AE; +1 ROBLOX MIN!</div>' : ''}
        `;

        if (awarded > 0) {
          const capReached = getTodayEarned() >= getTodayMaxMinutes();
          showRewardPopup(awarded, capReached);
        }
      } else {
        feedbackEl.innerHTML = `<div class="lt-correct">&#x2705; Perfect spelling!</div>`;
      }

      nextBtn.textContent = 'Next Word \u25B6';
      nextBtn.className = 'learn-test-next success';
      nextBtn.addEventListener('click', () => {
        learnIndex = (learnIndex + 1) % weeklyWords.length;
        render('learn');
      });
    } else {
      input.classList.add('wrong');

      feedbackEl.innerHTML = `
        <div class="lt-wrong">&#x274C; Not quite! The correct spelling is:</div>
        <div class="lt-answer spell-answer">${word.word}</div>
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
  }

  checkBtn.addEventListener('click', checkSpelling);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkSpelling();
  });

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
            const awarded = awardRobloxMinute();
            if (awarded > 0) {
              feedbackHTML += `<div style="text-align:center;margin-top:6px;font-family:'Press Start 2P',monospace;font-size:0.5rem;color:var(--roblox-green-light);">&#x1F3AE; +1 ROBLOX MIN!</div>`;
            }
            saveState(state);
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
