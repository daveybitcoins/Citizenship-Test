(function () {
  "use strict";

  // ===== State =====
  const state = {
    testVersion: null,        // "2008" or "2025"
    mode: null,               // "study", "quiz", "missed"
    questions: [],            // current question set for this session
    currentIndex: 0,
    showAnswer: false,
    showSpanish: false,
    quizScore: 0,
    quizAnswered: 0,
    settings: {
      autoSpanish: false,
      shuffle: false,
    },
    progress: {
      "2008": {},
      "2025": {},
    },
  };

  // ===== DOM References =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const screens = {
    home: $("#screen-home"),
    dashboard: $("#screen-dashboard"),
    study: $("#screen-study"),
    results: $("#screen-results"),
  };

  // ===== LocalStorage =====
  function loadState() {
    try {
      const saved = localStorage.getItem("citizenship-test");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.progress) state.progress = data.progress;
        if (data.settings) Object.assign(state.settings, data.settings);
        if (data.testVersion) state.testVersion = data.testVersion;
      }
    } catch (e) {
      console.warn("Failed to load saved state:", e);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        "citizenship-test",
        JSON.stringify({
          progress: state.progress,
          settings: state.settings,
          testVersion: state.testVersion,
        })
      );
    } catch (e) {
      console.warn("Failed to save state:", e);
    }
  }

  // ===== Navigation =====
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo(0, 0);
  }

  // ===== Data Helpers =====
  function getQuestions() {
    return state.testVersion === "2025" ? QUESTIONS_2025 : QUESTIONS_2008;
  }

  function getProgress() {
    return state.progress[state.testVersion] || {};
  }

  function setQuestionStatus(questionId, status) {
    if (!state.progress[state.testVersion]) {
      state.progress[state.testVersion] = {};
    }
    state.progress[state.testVersion][questionId] = status;
    saveState();
  }

  function getQuestionStatus(questionId) {
    return (state.progress[state.testVersion] || {})[questionId] || "unseen";
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ===== Progress Stats =====
  function getStats() {
    const allQ = getQuestions();
    const progress = getProgress();
    let mastered = 0;
    let needPractice = 0;
    let unseen = 0;

    allQ.forEach((q) => {
      const status = progress[q.id] || "unseen";
      if (status === "mastered") mastered++;
      else if (status === "needs_practice") needPractice++;
      else unseen++;
    });

    return { mastered, needPractice, unseen, total: allQ.length };
  }

  function getCategoryStats() {
    const allQ = getQuestions();
    const progress = getProgress();
    const cats = {};

    allQ.forEach((q) => {
      if (!cats[q.category]) {
        cats[q.category] = { total: 0, mastered: 0 };
      }
      cats[q.category].total++;
      if (progress[q.id] === "mastered") {
        cats[q.category].mastered++;
      }
    });

    return cats;
  }

  // ===== Render Dashboard =====
  function renderDashboard() {
    const stats = getStats();
    const pct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;

    // Title
    $("#dash-title").textContent = state.testVersion === "2025" ? "2025 Test" : "2008 Test";

    // Progress ring
    const circumference = 2 * Math.PI * 52; // r=52
    const offset = circumference - (pct / 100) * circumference;
    $("#progress-ring-fill").style.strokeDashoffset = offset;
    $("#progress-pct").textContent = pct + "%";

    // Stats
    $("#stat-mastered").textContent = stats.mastered;
    $("#stat-practice").textContent = stats.needPractice;
    $("#stat-unseen").textContent = stats.unseen;

    // Quiz description
    const quizCount = state.testVersion === "2025" ? 20 : 10;
    const passCount = state.testVersion === "2025" ? 12 : 6;
    $("#quiz-desc").textContent = `${quizCount} random questions, need ${passCount} to pass`;

    // Category progress
    const catStats = getCategoryStats();
    const catContainer = $("#category-progress");
    let catHTML = "<h3>Progress by Category</h3>";

    Object.entries(catStats).forEach(([name, data]) => {
      const catPct = data.total > 0 ? Math.round((data.mastered / data.total) * 100) : 0;
      catHTML += `
        <div class="category-item">
          <div class="category-name">
            <span>${name}</span>
            <span>${data.mastered}/${data.total}</span>
          </div>
          <div class="category-bar">
            <div class="category-bar-fill" style="width: ${catPct}%"></div>
          </div>
        </div>`;
    });

    catContainer.innerHTML = catHTML;
    showScreen("dashboard");
  }

  // ===== Start Study Modes =====
  function startStudyAll() {
    const allQ = getQuestions();
    state.mode = "study";
    state.questions = state.settings.shuffle ? shuffle(allQ) : [...allQ];
    state.currentIndex = 0;
    state.showAnswer = false;
    state.showSpanish = false;
    renderStudy();
    showScreen("study");
  }

  function startQuiz() {
    const allQ = getQuestions();
    const count = state.testVersion === "2025" ? 20 : 10;
    state.mode = "quiz";
    state.questions = shuffle(allQ).slice(0, count);
    state.currentIndex = 0;
    state.quizScore = 0;
    state.quizAnswered = 0;
    state.showAnswer = false;
    state.showSpanish = false;
    renderStudy();
    showScreen("study");
  }

  function startMissed() {
    const allQ = getQuestions();
    const progress = getProgress();
    const missed = allQ.filter((q) => progress[q.id] === "needs_practice");

    if (missed.length === 0) {
      alert("No missed questions! Try studying all questions or taking a quiz first.");
      return;
    }

    state.mode = "missed";
    state.questions = shuffle(missed);
    state.currentIndex = 0;
    state.showAnswer = false;
    state.showSpanish = false;
    renderStudy();
    showScreen("study");
  }

  // ===== Render Study Card =====
  function renderStudy() {
    const q = state.questions[state.currentIndex];
    if (!q) return;

    // Header
    const modeLabels = { study: "Study All", quiz: "Practice Quiz", missed: "Missed Questions" };
    $("#study-mode-label").textContent = modeLabels[state.mode];
    $("#study-counter").textContent = `${state.currentIndex + 1} / ${state.questions.length}`;

    // Progress bar
    const progressPct = ((state.currentIndex + 1) / state.questions.length) * 100;
    $("#study-progress-bar").style.width = progressPct + "%";

    // Card content
    $("#card-category").textContent = q.category;
    $("#card-subcategory").textContent = q.subcategory;
    $("#card-question").textContent = q.question;

    // Answer
    const answerList = $("#answer-list");
    answerList.innerHTML = q.answers.map((a) => `<li>${a}</li>`).join("");

    // Spanish
    $("#spanish-text").textContent = q.spanishExplanation;

    // Reset visibility
    state.showAnswer = false;
    state.showSpanish = false;
    updateCardVisibility();

    // Navigation
    $("#btn-prev").disabled = state.currentIndex === 0;
    $("#btn-next").disabled = state.currentIndex >= state.questions.length - 1;
  }

  function updateCardVisibility() {
    const answerEl = $("#card-answer");
    const spanishEl = $("#card-spanish");
    const showBtn = $("#card-actions");
    const assessBtns = $("#card-actions-assess");
    const spanishBtn = $("#btn-spanish-toggle");

    if (state.showAnswer) {
      answerEl.classList.remove("hidden");
      showBtn.classList.add("hidden");
      assessBtns.classList.remove("hidden");
    } else {
      answerEl.classList.add("hidden");
      showBtn.classList.remove("hidden");
      assessBtns.classList.add("hidden");
    }

    if (state.showSpanish || state.settings.autoSpanish) {
      spanishEl.classList.remove("hidden");
      spanishBtn.classList.add("active");
    } else {
      spanishEl.classList.add("hidden");
      spanishBtn.classList.remove("active");
    }
  }

  function showAnswer() {
    state.showAnswer = true;
    updateCardVisibility();
  }

  function assessQuestion(status) {
    const q = state.questions[state.currentIndex];
    setQuestionStatus(q.id, status);

    if (state.mode === "quiz") {
      state.quizAnswered++;
      if (status === "mastered") state.quizScore++;

      // Check if quiz is complete
      if (state.quizAnswered >= state.questions.length) {
        showQuizResults();
        return;
      }
    }

    // Move to next question
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex++;
      renderStudy();
    } else if (state.mode === "quiz") {
      showQuizResults();
    } else {
      // End of study session
      showStudyComplete();
    }
  }

  function showStudyComplete() {
    const stats = getStats();
    $("#results-icon").textContent = "\u2705";
    $("#results-title").textContent = "Session Complete!";
    $("#results-score").textContent = stats.mastered;
    $("#results-total").textContent = `/ ${stats.total} mastered`;
    const msg = $("#results-msg");
    msg.textContent = "Great study session! Keep it up.";
    msg.className = "results-msg";

    // Show/hide appropriate buttons
    $("#btn-review-missed").style.display = stats.needPractice > 0 ? "" : "none";
    $("#btn-retry-quiz").style.display = "none";

    showScreen("results");
  }

  function showQuizResults() {
    const passThreshold = state.testVersion === "2025" ? 12 : 6;
    const total = state.questions.length;
    const passed = state.quizScore >= passThreshold;

    $("#results-icon").textContent = passed ? "\uD83C\uDF89" : "\uD83D\uDCDA";
    $("#results-title").textContent = "Quiz Complete!";
    $("#results-score").textContent = state.quizScore;
    $("#results-total").textContent = `/ ${total}`;

    const msg = $("#results-msg");
    if (passed) {
      msg.textContent = `You passed! You needed ${passThreshold} and got ${state.quizScore}. Great job!`;
      msg.className = "results-msg pass";
    } else {
      msg.textContent = `You needed ${passThreshold} to pass. Keep studying \u2014 you'll get there!`;
      msg.className = "results-msg fail";
    }

    // Show quiz-relevant buttons
    const missedCount = state.questions.filter(
      (q) => getQuestionStatus(q.id) === "needs_practice"
    ).length;
    $("#btn-review-missed").style.display = missedCount > 0 ? "" : "none";
    $("#btn-retry-quiz").style.display = "";

    showScreen("results");
  }

  // ===== Settings =====
  function openSettings() {
    $("#modal-settings").classList.remove("hidden");
    $("#setting-auto-spanish").checked = state.settings.autoSpanish;
    $("#setting-shuffle").checked = state.settings.shuffle;
  }

  function closeSettings() {
    $("#modal-settings").classList.add("hidden");
  }

  function resetProgress() {
    if (
      confirm(
        "Are you sure you want to reset all progress for the " +
          state.testVersion +
          " test? This cannot be undone."
      )
    ) {
      state.progress[state.testVersion] = {};
      saveState();
      closeSettings();
      renderDashboard();
    }
  }

  // ===== Event Listeners =====
  function init() {
    loadState();

    // Home: test version buttons
    $$(".test-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.testVersion = btn.dataset.test;
        saveState();
        renderDashboard();
      });
    });

    // Dashboard: back to home
    $("#btn-home").addEventListener("click", () => showScreen("home"));

    // Dashboard: study modes
    $("#btn-study-all").addEventListener("click", startStudyAll);
    $("#btn-quiz").addEventListener("click", startQuiz);
    $("#btn-missed").addEventListener("click", startMissed);

    // Dashboard: settings
    $("#btn-settings").addEventListener("click", openSettings);
    $("#btn-close-settings").addEventListener("click", closeSettings);
    $("#settings-backdrop").addEventListener("click", closeSettings);

    // Settings: toggles
    $("#setting-auto-spanish").addEventListener("change", (e) => {
      state.settings.autoSpanish = e.target.checked;
      saveState();
    });

    $("#setting-shuffle").addEventListener("change", (e) => {
      state.settings.shuffle = e.target.checked;
      saveState();
    });

    // Settings: reset
    $("#btn-reset-progress").addEventListener("click", resetProgress);

    // Study: show answer
    $("#btn-show-answer").addEventListener("click", showAnswer);

    // Study: spanish toggle
    $("#btn-spanish-toggle").addEventListener("click", () => {
      state.showSpanish = !state.showSpanish;
      updateCardVisibility();
    });

    // Study: assess
    $("#btn-got-it").addEventListener("click", () => assessQuestion("mastered"));
    $("#btn-need-practice").addEventListener("click", () =>
      assessQuestion("needs_practice")
    );

    // Study: navigation
    $("#btn-prev").addEventListener("click", () => {
      if (state.currentIndex > 0) {
        state.currentIndex--;
        renderStudy();
      }
    });

    $("#btn-next").addEventListener("click", () => {
      if (state.currentIndex < state.questions.length - 1) {
        state.currentIndex++;
        renderStudy();
      }
    });

    // Study: back to dashboard
    $("#btn-back-study").addEventListener("click", () => {
      renderDashboard();
    });

    // Results: buttons
    $("#btn-review-missed").addEventListener("click", () => {
      startMissed();
    });

    $("#btn-retry-quiz").addEventListener("click", () => {
      startQuiz();
    });

    $("#btn-back-dashboard").addEventListener("click", () => {
      renderDashboard();
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (!screens.study.classList.contains("active")) return;

      switch (e.key) {
        case " ":
        case "Enter":
          e.preventDefault();
          if (!state.showAnswer) {
            showAnswer();
          }
          break;
        case "ArrowRight":
          if (state.currentIndex < state.questions.length - 1) {
            state.currentIndex++;
            renderStudy();
          }
          break;
        case "ArrowLeft":
          if (state.currentIndex > 0) {
            state.currentIndex--;
            renderStudy();
          }
          break;
        case "s":
        case "S":
          state.showSpanish = !state.showSpanish;
          updateCardVisibility();
          break;
      }
    });

    // Swipe support for mobile
    let touchStartX = 0;
    let touchStartY = 0;

    const studyScreen = screens.study;

    studyScreen.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      },
      { passive: true }
    );

    studyScreen.addEventListener(
      "touchend",
      (e) => {
        const dx = e.changedTouches[0].screenX - touchStartX;
        const dy = e.changedTouches[0].screenY - touchStartY;

        // Only register horizontal swipes (not vertical scrolling)
        if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) {
          if (dx > 0 && state.currentIndex > 0) {
            // Swipe right = previous
            state.currentIndex--;
            renderStudy();
          } else if (dx < 0 && state.currentIndex < state.questions.length - 1) {
            // Swipe left = next
            state.currentIndex++;
            renderStudy();
          }
        }
      },
      { passive: true }
    );

    // Show home screen
    showScreen("home");
  }

  // Start the app
  init();
})();
