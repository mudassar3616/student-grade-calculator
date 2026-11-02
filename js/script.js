/**
 * Student Grade Calculator
 * ---------------------------------------------------------------
 * Validates marks, calculates the percentage, assigns a grade, shows
 * how many more marks are needed for the next grade, and manages the
 * small interactive features around the form. Everything runs in the
 * browser. No data is sent to a server.
 */


/* ==============================================================
   1. CONFIGURATION
   ============================================================== */

/**
 * Grading scale ordered from highest to lowest minimum percentage.
 * The first entry the percentage reaches is the student's grade.
 */
const GRADE_SCALE = [
  { grade: 'A+', minPercentage: 90, message: 'Outstanding! You have achieved an exceptional result. Keep up the brilliant work!' },
  { grade: 'A', minPercentage: 80, message: 'Excellent work! Your dedication and hard work clearly paid off.' },
  { grade: 'B', minPercentage: 70, message: 'Great job! You have performed very well. Keep building on this success.' },
  { grade: 'C', minPercentage: 60, message: 'Good effort! You have a solid result, and a little more practice can take you even higher.' },
  { grade: 'D', minPercentage: 50, message: 'Well done for passing! Keep pushing yourself to reach the next level.' },
  { grade: 'F', minPercentage: 0, message: "Don't give up! Review your weaker areas, learn from this result and try again. You can do it." },
];

/** A student passes with a percentage of at least this value (grade D or higher). */
const PASSING_PERCENTAGE = 50;

/** Friendly messages shown beneath the fields. */
const MESSAGES = {
  obtainedRequired: 'Please enter your obtained marks.',
  totalRequired: 'Please enter the total marks.',
  invalidNumber: 'Please enter a valid number.',
  negativeValue: 'Marks cannot be negative.',
  totalNotZero: 'Total marks must be greater than zero.',
  obtainedTooHigh: 'Obtained marks cannot be greater than total marks.',
};

/** Short pause so the "Calculating..." state is visible. */
const CALCULATION_DELAY_MS = 400;

/** Number of recent calculations kept for this visit. */
const HISTORY_LIMIT = 5;

/** Marks used by the "Try a sample" button. */
const SAMPLE_MARKS = { obtained: 850, total: 1100 };

const THEME_STORAGE_KEY = 'gradeCalculator.theme';
const TOAST_DURATION_MS = 2600;
const BACK_TO_TOP_THRESHOLD_PX = 600;

/** Progress ring geometry: circumference of a circle with radius 68. */
const RING_RADIUS = 68;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;


/* ==============================================================
   2. DOM REFERENCES
   ============================================================== */

const form = document.getElementById('calculator-form');
const obtainedInput = document.getElementById('obtained-marks');
const totalInput = document.getElementById('total-marks');
const obtainedError = document.getElementById('obtained-error');
const totalError = document.getElementById('total-error');
const livePreview = document.getElementById('live-preview');
const calculateButton = document.getElementById('calculate-btn');
const calculateLabel = document.getElementById('calculate-label');
const resetButton = document.getElementById('reset-btn');
const sampleButton = document.getElementById('sample-btn');
const presetButtons = document.querySelectorAll('.chip');
const calculationSection = document.getElementById('calculator');

const resultCard = document.getElementById('result');
const resultAnnouncer = document.getElementById('result-announcer');
const statusPill = document.getElementById('status-pill');
const gradeBadge = document.getElementById('grade-badge');
const percentageValue = document.getElementById('percentage-value');
const ringFill = document.getElementById('ring-fill');
const obtainedOutput = document.getElementById('obtained-output');
const totalOutput = document.getElementById('total-output');
const goalOutput = document.getElementById('goal-output');
const resultMessage = document.getElementById('result-message');
const copyButton = document.getElementById('copy-btn');

const historySection = document.getElementById('history');
const historyList = document.getElementById('history-list');
const clearHistoryButton = document.getElementById('clear-history-btn');

const gradeCells = document.querySelectorAll('.grade-cell');

const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const navLinks = navMenu.querySelectorAll('.nav-link');
const themeToggle = document.getElementById('theme-toggle');
const backToTopButton = document.getElementById('back-to-top');
const toast = document.getElementById('toast');

/* Session state. Nothing here is saved after the page is closed. */
let calculationTimer = null;
let percentageFrame = null;
let toastTimer = null;
let currentResult = null;
const calculationHistory = [];


/* ==============================================================
   3. SMALL HELPERS
   ============================================================== */

/** @returns {boolean} True when the operating system requests reduced motion. */
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** @returns {'auto'|'smooth'} Scroll behaviour that respects reduced motion. */
function scrollBehavior() {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

/**
 * Restarts a CSS animation by forcing a reflow.
 * @param {HTMLElement} element
 */
function replayAnimation(element) {
  element.style.animation = 'none';
  void element.offsetWidth; // Reading offsetWidth makes the browser apply the reset.
  element.style.animation = '';
}

/**
 * Formats a mark for display, e.g. 1100 becomes "1,100".
 * @param {number} value
 * @returns {string}
 */
function formatMarks(value) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Creates an element with a class and text content.
 * @param {string} tagName
 * @param {string} className
 * @param {string} text
 * @returns {HTMLElement}
 */
function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

/** Reads the saved theme. Returns null if storage is blocked. */
function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    return null;
  }
}

/** Saves the theme choice. Fails quietly if storage is blocked. */
function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // The theme still applies for this visit.
  }
}


/* ==============================================================
   4. THEME (light and dark mode)
   ============================================================== */

/**
 * Applies a theme to the page and updates the toggle button.
 * @param {'light'|'dark'} theme
 */
function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

/** Uses the saved theme, or the device setting on a first visit. */
function initTheme() {
  const savedTheme = readStoredTheme();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  storeTheme(nextTheme);
}


/* ==============================================================
   5. VALIDATION
   ============================================================== */

/**
 * Checks one marks input on its own. Has no side effects.
 * @param {HTMLInputElement} input
 * @param {string} requiredMessage - Message shown when the field is empty.
 * @returns {{ value: number|null, error: string }}
 */
function parseMarks(input, requiredMessage) {
  // Browsers report text such as "1e" or "--" as bad input and clear the value.
  if (input.validity.badInput) {
    return { value: null, error: MESSAGES.invalidNumber };
  }

  const rawValue = input.value.trim();
  if (rawValue === '') {
    return { value: null, error: requiredMessage };
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return { value: null, error: MESSAGES.invalidNumber };
  }

  if (value < 0) {
    return { value: null, error: MESSAGES.negativeValue };
  }

  return { value, error: '' };
}

/**
 * Validates both fields, including the rules that compare them.
 * @returns {{ obtained: object, total: object, isValid: boolean }}
 */
function validateMarks() {
  const obtained = parseMarks(obtainedInput, MESSAGES.obtainedRequired);
  const total = parseMarks(totalInput, MESSAGES.totalRequired);

  // Total must be greater than zero (only checked when it is a valid number).
  if (!total.error && total.value === 0) {
    total.error = MESSAGES.totalNotZero;
  }

  // Obtained marks cannot exceed total marks.
  if (!obtained.error && !total.error && obtained.value > total.value) {
    obtained.error = MESSAGES.obtainedTooHigh;
  }

  return {
    obtained,
    total,
    isValid: !obtained.error && !total.error,
  };
}

/**
 * Shows or clears the error for one field.
 * @param {HTMLInputElement} input
 * @param {HTMLElement} errorElement
 * @param {string} message - An empty string clears the error.
 */
function setFieldError(input, errorElement, message) {
  const hasError = Boolean(message);
  input.classList.toggle('is-invalid', hasError);
  input.setAttribute('aria-invalid', String(hasError));
  errorElement.textContent = message;
}

/** Clears the errors on both fields. */
function clearAllErrors() {
  setFieldError(obtainedInput, obtainedError, '');
  setFieldError(totalInput, totalError, '');
}


/* ==============================================================
   6. CALCULATION
   ============================================================== */

/**
 * Percentage = (Obtained Marks / Total Marks) x 100, rounded to 2 decimals.
 * Multiplying before dividing keeps floating-point error small. The rounded
 * value is used for the grade, so the grade always matches what is displayed.
 * @param {number} obtained
 * @param {number} total - Must be greater than zero.
 * @returns {number}
 */
function calculatePercentage(obtained, total) {
  const exactPercentage = (obtained * 100) / total;
  return Math.round(exactPercentage * 100) / 100;
}

/**
 * Finds the grade entry for a percentage.
 * @param {number} percentage
 * @returns {{ grade: string, minPercentage: number, message: string }}
 */
function getGrade(percentage) {
  return GRADE_SCALE.find((entry) => percentage >= entry.minPercentage);
}

/**
 * Works out how many more marks are needed for the next grade up.
 * Marks are whole numbers, so the shortfall is rounded up.
 * @param {number} percentage
 * @param {number} obtained
 * @param {number} total
 * @returns {{ grade: string, marks: number }|null} Null when already at the top grade.
 */
function getNextGoal(percentage, obtained, total) {
  const currentIndex = GRADE_SCALE.indexOf(getGrade(percentage));
  if (currentIndex === 0) {
    return null;
  }

  const nextGrade = GRADE_SCALE[currentIndex - 1];
  const marksRequired = (nextGrade.minPercentage * total) / 100;
  // Round to 2 decimals first so floating-point noise cannot add an extra mark.
  const shortfall = Math.ceil(Math.round((marksRequired - obtained) * 100) / 100);

  return { grade: nextGrade.grade, marks: Math.max(1, shortfall) };
}

/**
 * Validates the form, then calculates after a short loading state.
 * Used by the form submit, the sample button and the history list.
 */
function runCalculation() {
  if (calculationTimer !== null) {
    return; // A calculation is already running.
  }

  const { obtained, total, isValid } = validateMarks();
  setFieldError(obtainedInput, obtainedError, obtained.error);
  setFieldError(totalInput, totalError, total.error);

  if (!isValid) {
    resultCard.hidden = true; // Never leave an outdated result on screen.
    currentResult = null;
    (obtained.error ? obtainedInput : totalInput).focus();
    return;
  }

  setLoading(true);

  calculationTimer = setTimeout(() => {
    const percentage = calculatePercentage(obtained.value, total.value);
    const result = {
      obtained: obtained.value,
      total: total.value,
      percentage,
      grade: getGrade(percentage),
      nextGoal: getNextGoal(percentage, obtained.value, total.value),
    };

    currentResult = result;
    showResult(result);
    addToHistory(result);
    setLoading(false);
    calculationTimer = null;
  }, CALCULATION_DELAY_MS);
}


/* ==============================================================
   7. RESULT DISPLAY
   ============================================================== */

/**
 * Counts the percentage up to its final value with an ease-out curve.
 * Cancels any count still running from an earlier calculation.
 * @param {number} targetValue
 */
function animatePercentage(targetValue) {
  cancelAnimationFrame(percentageFrame);

  if (prefersReducedMotion()) {
    percentageValue.textContent = targetValue.toFixed(2);
    return;
  }

  const duration = 1000;
  const startTime = performance.now();

  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    percentageValue.textContent = (targetValue * easedProgress).toFixed(2);

    if (progress < 1) {
      percentageFrame = requestAnimationFrame(step);
    }
  };

  percentageFrame = requestAnimationFrame(step);
}

/**
 * Animates the ring from empty to the given percentage.
 * @param {number} percentage - Between 0 and 100.
 */
function animateRing(percentage) {
  ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
  void ringFill.getBoundingClientRect(); // Paint the empty ring before filling it.
  ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - percentage / 100));
}

/**
 * Describes the next goal for the stats tile.
 * @param {{ grade: string, marks: number }|null} nextGoal
 * @returns {string}
 */
function describeNextGoal(nextGoal) {
  if (!nextGoal) {
    return 'Top grade reached';
  }
  const unit = nextGoal.marks === 1 ? 'mark' : 'marks';
  return `${nextGoal.marks} more ${unit}`;
}

/**
 * Highlights the grade in the grading scale that matches the result.
 * @param {string|null} gradeLetter - Pass null to clear the highlight.
 */
function highlightGradeCell(gradeLetter) {
  gradeCells.forEach((cell) => {
    cell.classList.toggle('is-active', cell.dataset.grade === gradeLetter);
  });
}

/**
 * Fills the result card and reveals it.
 * @param {object} result - The calculated result.
 */
function showResult(result) {
  const { obtained, total, percentage, grade, nextGoal } = result;
  const isPass = percentage >= PASSING_PERCENTAGE;
  const statusText = isPass ? 'PASS' : 'FAIL';

  resultCard.hidden = false;
  resultCard.classList.toggle('is-pass', isPass);
  resultCard.classList.toggle('is-fail', !isPass);

  statusPill.textContent = statusText;
  gradeBadge.textContent = grade.grade;
  obtainedOutput.textContent = formatMarks(obtained);
  totalOutput.textContent = formatMarks(total);
  goalOutput.textContent = describeNextGoal(nextGoal);
  resultMessage.textContent = grade.message;

  // One announcement for screen readers. The count-up is not announced frame by frame.
  resultAnnouncer.textContent = `Your result is ${percentage.toFixed(2)} percent. Grade ${grade.grade}. Status ${statusText}.`;

  animatePercentage(percentage);
  animateRing(percentage);
  highlightGradeCell(grade.grade);

  // Replay the entrance animations so repeated calculations feel fresh.
  replayAnimation(resultCard);
  replayAnimation(gradeBadge);

  resultCard.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
}

/** Clears the result, the errors and the grade highlight. */
function clearResult() {
  currentResult = null;
  resultCard.hidden = true;
  resultAnnouncer.textContent = '';
  ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
  cancelAnimationFrame(percentageFrame);
  highlightGradeCell(null);
}

/**
 * Shows the live percentage while both fields hold valid numbers.
 * Does not show errors. Those appear only after Calculate is pressed.
 */
function updateLivePreview() {
  const { value: obtained } = parseMarks(obtainedInput, '');
  const { value: total } = parseMarks(totalInput, '');
  const canPreview = obtained !== null && total !== null && total > 0 && obtained <= total;

  livePreview.hidden = !canPreview;
  if (canPreview) {
    const percentage = calculatePercentage(obtained, total);
    livePreview.textContent = `Live preview: ${percentage.toFixed(2)}% (grade ${getGrade(percentage).grade})`;
  }
}


/* ==============================================================
   8. FORM ACTIONS
   ============================================================== */

/**
 * Switches the Calculate button between its normal and loading states.
 * @param {boolean} isLoading
 */
function setLoading(isLoading) {
  calculateButton.classList.toggle('is-loading', isLoading);
  calculateButton.disabled = isLoading;
  calculateLabel.textContent = isLoading ? 'Calculating...' : 'Calculate Result';
}

/** Clears the inputs, errors and result so the student can start again. */
function handleReset() {
  clearTimeout(calculationTimer);
  calculationTimer = null;
  setLoading(false);

  form.reset();
  clearAllErrors();
  clearResult();
  updateLivePreview();

  obtainedInput.focus();
}

/** Fills the total from a quick preset button. */
function handlePresetClick(event) {
  totalInput.value = event.currentTarget.dataset.total;
  setFieldError(totalInput, totalError, '');
  updateLivePreview();
  obtainedInput.focus();
}

/** Fills in the sample marks, scrolls to the calculator and calculates. */
function handleSampleClick() {
  obtainedInput.value = String(SAMPLE_MARKS.obtained);
  totalInput.value = String(SAMPLE_MARKS.total);
  clearAllErrors();
  updateLivePreview();
  calculationSection.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  runCalculation();
}

/**
 * Clears a field's error as soon as the student starts correcting it.
 * @param {HTMLInputElement} input
 * @param {HTMLElement} errorElement
 */
function clearErrorOnInput(input, errorElement) {
  input.addEventListener('input', () => {
    if (input.classList.contains('is-invalid')) {
      setFieldError(input, errorElement, '');
    }
  });
}

/**
 * Copies text to the clipboard, with a fallback for browsers that block the Clipboard API.
 * @param {string} text
 * @returns {Promise<boolean>} True when the copy succeeded.
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand('copy');
    helper.remove();
    return copied;
  }
}

/**
 * Builds the plain-text summary that is copied to the clipboard.
 * @param {object} result
 * @returns {string}
 */
function buildResultText(result) {
  const goalLine = result.nextGoal
    ? `Next goal: ${result.nextGoal.marks} more marks for grade ${result.nextGoal.grade}`
    : 'Next goal: highest grade reached';

  return [
    'Grade Calculator result',
    `Obtained marks: ${formatMarks(result.obtained)} / ${formatMarks(result.total)}`,
    `Percentage: ${result.percentage.toFixed(2)}%`,
    `Grade: ${result.grade.grade}`,
    `Status: ${result.percentage >= PASSING_PERCENTAGE ? 'PASS' : 'FAIL'}`,
    goalLine,
  ].join('\n');
}

/** Copies the current result and confirms with a toast. */
async function handleCopyClick() {
  if (!currentResult) {
    return;
  }
  const copied = await copyText(buildResultText(currentResult));
  showToast(copied ? 'Result copied to clipboard' : 'Could not copy. Please copy the result manually.');
}


/* ==============================================================
   9. RECENT CALCULATIONS (this visit only)
   ============================================================== */

/**
 * Adds a result to the top of the history. An identical earlier entry is
 * moved to the top rather than repeated.
 * @param {object} result
 */
function addToHistory(result) {
  const existingIndex = calculationHistory.findIndex(
    (entry) => entry.obtained === result.obtained && entry.total === result.total
  );
  if (existingIndex !== -1) {
    calculationHistory.splice(existingIndex, 1);
  }

  calculationHistory.unshift(result);
  calculationHistory.splice(HISTORY_LIMIT);
  renderHistory();
}

/** Redraws the history list. The section is hidden while it is empty. */
function renderHistory() {
  historySection.hidden = calculationHistory.length === 0;
  historyList.replaceChildren();

  calculationHistory.forEach((entry, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'history-item';
    button.dataset.index = String(index);
    button.setAttribute(
      'aria-label',
      `Calculate ${formatMarks(entry.obtained)} out of ${formatMarks(entry.total)} again. Grade ${entry.grade.grade}.`
    );

    button.append(
      createElement('span', 'history-marks', `${formatMarks(entry.obtained)} / ${formatMarks(entry.total)}`),
      createElement('span', 'history-percent', `${entry.percentage.toFixed(2)}%`),
      createElement('span', 'history-grade', entry.grade.grade)
    );

    item.appendChild(button);
    historyList.appendChild(item);
  });
}

/**
 * Loads a past calculation into the form and calculates it again.
 * @param {number} index
 */
function restoreFromHistory(index) {
  const entry = calculationHistory[index];
  if (!entry) {
    return;
  }

  obtainedInput.value = String(entry.obtained);
  totalInput.value = String(entry.total);
  clearAllErrors();
  updateLivePreview();
  runCalculation();
}

function handleClearHistory() {
  calculationHistory.length = 0;
  renderHistory();
  showToast('Recent calculations cleared');
}


/* ==============================================================
   10. TOAST AND NAVIGATION
   ============================================================== */

/**
 * Shows a short message at the top of the screen.
 * @param {string} message
 */
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, TOAST_DURATION_MS);
}

/**
 * Opens or closes the mobile menu.
 * @param {boolean} isOpen
 */
function setMenuOpen(isOpen) {
  navMenu.classList.toggle('is-open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
}

/**
 * Marks the nav link for the section in view as the current one.
 * @param {string} sectionId
 */
function setActiveLink(sectionId) {
  navLinks.forEach((link) => {
    if (link.getAttribute('href') === `#${sectionId}`) {
      link.setAttribute('aria-current', 'true');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

/** Watches the sections linked from the navbar and updates the active link. */
function observeSections() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveLink(entry.target.id);
        }
      });
    },
    // A section counts as active when it crosses the middle of the screen.
    { rootMargin: '-45% 0px -50% 0px' }
  );

  navLinks.forEach((link) => {
    const section = document.querySelector(link.getAttribute('href'));
    if (section) {
      observer.observe(section);
    }
  });
}

/** Updates the navbar shadow and the back-to-top button. Runs on scroll. */
function handleScroll() {
  navbar.classList.toggle('is-scrolled', window.scrollY > 10);
  backToTopButton.classList.toggle('is-visible', window.scrollY > BACK_TO_TOP_THRESHOLD_PX);
}


/* ==============================================================
   11. INITIALISATION
   ============================================================== */

function init() {
  initTheme();
  renderHistory();
  updateLivePreview();

  // Form
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runCalculation();
  });
  resetButton.addEventListener('click', handleReset);
  copyButton.addEventListener('click', handleCopyClick);
  clearErrorOnInput(obtainedInput, obtainedError);
  clearErrorOnInput(totalInput, totalError);
  obtainedInput.addEventListener('input', updateLivePreview);
  totalInput.addEventListener('input', updateLivePreview);

  // Quick helpers
  presetButtons.forEach((button) => button.addEventListener('click', handlePresetClick));
  sampleButton.addEventListener('click', handleSampleClick);
  historyList.addEventListener('click', (event) => {
    const item = event.target.closest('.history-item');
    if (item) {
      restoreFromHistory(Number(item.dataset.index));
    }
  });
  clearHistoryButton.addEventListener('click', handleClearHistory);

  // Theme and navigation
  themeToggle.addEventListener('click', toggleTheme);
  navToggle.addEventListener('click', () => {
    setMenuOpen(!navMenu.classList.contains('is-open'));
  });
  navLinks.forEach((link) => {
    link.addEventListener('click', () => setMenuOpen(false));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navMenu.classList.contains('is-open')) {
      setMenuOpen(false);
      navToggle.focus();
    }
  });
  window.matchMedia('(min-width: 769px)').addEventListener('change', (event) => {
    if (event.matches) {
      setMenuOpen(false);
    }
  });
  backToTopButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  });

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
  observeSections();
}

init();