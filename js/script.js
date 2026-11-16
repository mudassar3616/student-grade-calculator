// ---------- Settings ----------
const PASS_PERCENTAGE = 50;
const RING_CIRCUMFERENCE = 2 * Math.PI * 68; // Same radius as the SVG circle
const THEME_KEY = 'marks-calculator-theme';

const GRADE_SCALE = [
  { grade: 'A+', min: 90, message: 'Outstanding performance!' },
  { grade: 'A',  min: 80, message: 'Excellent work! You did very well.' },
  { grade: 'B',  min: 70, message: 'Great job! A solid score.' },
  { grade: 'C',  min: 60, message: 'Good effort! Keep working hard.' },
  { grade: 'D',  min: 50, message: 'You passed! Keep pushing to improve.' },
  { grade: 'F',  min: 0,  message: "Don't give up. Review and try again." },
];

// ---------- Elements ----------
const root = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const form = document.getElementById('calculator-form');
const obtainedInput = document.getElementById('obtained-marks');
const totalInput = document.getElementById('total-marks');
const obtainedError = document.getElementById('obtained-error');
const totalError = document.getElementById('total-error');
const resetBtn = document.getElementById('reset-btn');
const resultSection = document.getElementById('result-section');
const ringFill = document.getElementById('ring-fill');
const percentageValue = document.getElementById('percentage-value');
const gradeOutput = document.getElementById('grade-output');
const marksOutput = document.getElementById('marks-output');
const statusOutput = document.getElementById('status-output');
const messageOutput = document.getElementById('message-output');

// ---------- Theme ----------
function applyTheme(theme) {
  root.dataset.theme = theme;
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch (error) {
    // Storage is blocked. Use the device setting instead.
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

function toggleTheme() {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (error) {
    // Storage is blocked. The theme still changes for this visit.
  }
}

// ---------- Validation ----------
function showError(input, errorEl, message) {
  input.classList.add('is-invalid');
  input.setAttribute('aria-invalid', 'true');
  errorEl.textContent = message;
}

function clearError(input, errorEl) {
  input.classList.remove('is-invalid');
  input.removeAttribute('aria-invalid');
  errorEl.textContent = '';
}

function clearAllErrors() {
  clearError(obtainedInput, obtainedError);
  clearError(totalInput, totalError);
}

/**
 * Checks both inputs.
 * @returns {boolean} True when the values are valid.
 */
function validateMarks() {
  clearAllErrors();

  const obtainedText = obtainedInput.value.trim();
  const totalText = totalInput.value.trim();

  if (obtainedText === '') {
    showError(obtainedInput, obtainedError, 'Please enter your obtained marks.');
    return false;
  }

  if (totalText === '') {
    showError(totalInput, totalError, 'Please enter the total marks.');
    return false;
  }

  const obtained = Number(obtainedText);
  const total = Number(totalText);

  if (!Number.isFinite(obtained) || !Number.isFinite(total)) {
    showError(totalInput, totalError, 'Please enter valid numbers.');
    return false;
  }

  if (obtained < 0 || total < 0) {
    showError(obtainedInput, obtainedError, 'Marks cannot be negative.');
    return false;
  }

  if (total === 0) {
    showError(totalInput, totalError, 'Total marks cannot be zero.');
    return false;
  }

  if (obtained > total) {
    showError(obtainedInput, obtainedError, 'Obtained marks cannot be more than total marks.');
    return false;
  }

  return true;
}

// ---------- Calculation ----------
function getGrade(percentage) {
  return GRADE_SCALE.find((entry) => percentage >= entry.min);
}

function showResult() {
  const obtained = Number(obtainedInput.value);
  const total = Number(totalInput.value);
  const percentage = (obtained * 100) / total;
  const grade = getGrade(percentage);
  const isPass = percentage >= PASS_PERCENTAGE;

  // Percentage text and ring
  percentageValue.textContent = percentage.toFixed(2);
  ringFill.classList.toggle('is-fail', !isPass);
  ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - percentage / 100));

  // Grade
  gradeOutput.textContent = grade.grade;
  gradeOutput.classList.toggle('is-fail', !isPass);

  // Marks
  marksOutput.textContent = `${obtained} / ${total}`;

  // Status
  statusOutput.textContent = isPass ? 'PASS' : 'FAIL';
  statusOutput.className = `status ${isPass ? 'pass' : 'fail'}`;

  // Message
  messageOutput.textContent = grade.message;

  // Show section 2 and replay the pop animation
  resultSection.hidden = false;
  resultSection.classList.remove('is-animated');
  void resultSection.offsetWidth; // Forces the browser to restart the animation
  resultSection.classList.add('is-animated');

  resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideResult() {
  resultSection.hidden = true;
  ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
}

// ---------- Events ----------
form.addEventListener('submit', (event) => {
  event.preventDefault();

  if (validateMarks()) {
    showResult();
  } else {
    hideResult();
  }
});

resetBtn.addEventListener('click', () => {
  form.reset();
  clearAllErrors();
  hideResult();
  obtainedInput.focus();
});

// Clear the error as soon as the user edits the field
obtainedInput.addEventListener('input', () => clearError(obtainedInput, obtainedError));
totalInput.addEventListener('input', () => clearError(totalInput, totalError));

themeToggle.addEventListener('click', toggleTheme);

// ---------- Start ----------
initTheme();