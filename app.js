const STORAGE_KEY = "gongsu-mvp-records";
const SETTINGS_KEY = "gongsu-mvp-settings";

const defaultPresets = [
  { label: "휴무", value: 0 },
  { label: "1공수", value: 1 },
  { label: "조출", value: 1.25 },
  { label: "연장", value: 1.5 },
  { label: "철야", value: 2 },
];

let records = loadJson(STORAGE_KEY, {});
let settings = loadJson(SETTINGS_KEY, {
  dailyRate: 180000,
  presets: defaultPresets,
});

const now = new Date();
let currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
let selectedDateKey = formatDate(new Date());
let bulkMode = false;
let bulkSelected = new Set();
let activeView = "calendar";

const calendarGrid = document.querySelector("#calendarGrid");
const monthTitle = document.querySelector("#monthTitle");
const savedStatus = document.querySelector("#savedStatus");
const totalWork = document.querySelector("#totalWork");
const expectedPay = document.querySelector("#expectedPay");
const recordedDays = document.querySelector("#recordedDays");
const presetRow = document.querySelector("#presetRow");
const selectedDateTitle = document.querySelector("#selectedDateTitle");
const selectedDateSub = document.querySelector("#selectedDateSub");
const workInput = document.querySelector("#workInput");
const labelInput = document.querySelector("#labelInput");
const memoInput = document.querySelector("#memoInput");
const rateInput = document.querySelector("#rateInput");
const settingsDialog = document.querySelector("#settingsDialog");
const bulkModeButton = document.querySelector("#bulkModeButton");
const bulkStatus = document.querySelector("#bulkStatus");

document.querySelector("#prevMonth").addEventListener("click", () => {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  render();
});

document.querySelector("#nextMonth").addEventListener("click", () => {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  render();
});

document.querySelector("#saveButton").addEventListener("click", saveSelectedDate);
document.querySelector("#clearDateButton").addEventListener("click", clearSelectedDate);
document.querySelector("#applyTeamNotice").addEventListener("click", applyTeamNotice);
document.querySelector("#settingsButton").addEventListener("click", () => settingsDialog.showModal());
document.querySelector("#seedButton").addEventListener("click", seedSampleData);
document.querySelector("#resetButton").addEventListener("click", resetAllData);
bulkModeButton.addEventListener("click", toggleBulkMode);
document.querySelector("#clearBulkButton").addEventListener("click", clearBulkSelectedDates);
document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.tab;
    if (tab === "settings") {
      settingsDialog.showModal();
      return;
    }
    setActiveView(tab);
  });
});

rateInput.addEventListener("input", () => {
  settings.dailyRate = Number(rateInput.value) || 0;
  persistSettings();
  renderSummary();
});

workInput.addEventListener("input", updateUnsavedStatus);
labelInput.addEventListener("input", updateUnsavedStatus);
memoInput.addEventListener("input", updateUnsavedStatus);

render();

function render() {
  renderTabs();
  renderPresets();
  renderCalendar();
  renderDetail();
  renderSummary();
  rateInput.value = settings.dailyRate;
  savedStatus.textContent = "자동 저장됨";
}

function renderCalendar() {
  calendarGrid.innerHTML = "";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  monthTitle.textContent = `${year}년 ${month + 1}월`;

  const firstDay = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstDay.getDay());
  const todayKey = formatDate(new Date());

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    const dateKey = formatDate(date);
    const record = records[dateKey];
    const button = document.createElement("button");
    button.className = "day-cell";
    button.type = "button";
    button.setAttribute("aria-label", `${dateKey} 기록 열기`);

    if (date.getMonth() !== month) button.classList.add("is-outside");
    if (dateKey === todayKey) button.classList.add("is-today");
    if (dateKey === selectedDateKey) button.classList.add("is-selected");
    if (bulkSelected.has(dateKey)) button.classList.add("is-bulk-selected");

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = date.getDate();
    button.append(number);

    if (record?.memo) {
      const dot = document.createElement("span");
      dot.className = "memo-dot";
      button.append(dot);
    }

    if (record) {
      const badge = document.createElement("span");
      badge.className = "work-badge";
      badge.textContent = `${record.label || "기록"} ${formatWork(record.workAmount)}`;
      button.append(badge);
    }

    button.addEventListener("click", () => {
      if (bulkMode) {
        toggleBulkDate(dateKey);
        return;
      }

      selectedDateKey = dateKey;
      if (date.getMonth() !== currentDate.getMonth()) {
        currentDate = new Date(date.getFullYear(), date.getMonth(), 1);
      }
      setActiveView("input", false);
      render();
    });

    calendarGrid.append(button);
  }
}

function renderPresets() {
  presetRow.innerHTML = "";
  settings.presets.forEach((preset) => {
    const button = document.createElement("button");
    button.className = "preset-button";
    button.type = "button";
    button.innerHTML = `<strong>${preset.label}</strong><span>${formatWork(preset.value)}</span>`;
    button.addEventListener("click", () => applyPreset(preset));
    presetRow.append(button);
  });
}

function renderDetail() {
  const selected = parseDateKey(selectedDateKey);
  const record = records[selectedDateKey] || {};
  selectedDateTitle.textContent = `${selected.getMonth() + 1}월 ${selected.getDate()}일 기록`;
  selectedDateSub.textContent = weekdayName(selected);
  workInput.value = record.workAmount ?? "";
  labelInput.value = record.label ?? "";
  memoInput.value = record.memo ?? "";
}

function renderSummary() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthRecords = Object.entries(records).filter(([dateKey]) => {
    const date = parseDateKey(dateKey);
    return date.getFullYear() === year && date.getMonth() === month;
  });

  const sum = monthRecords.reduce((acc, [, record]) => acc + (Number(record.workAmount) || 0), 0);
  totalWork.textContent = formatWork(sum);
  expectedPay.textContent = formatWon(sum * settings.dailyRate);
  recordedDays.textContent = `${monthRecords.length}일`;
  bulkModeButton.textContent = bulkMode ? "일괄 선택 끄기" : "일괄 선택 켜기";
  bulkStatus.textContent = `선택 ${bulkSelected.size}일`;
}

function renderTabs() {
  document.querySelectorAll(".mobile-view").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === activeView);
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === activeView);
  });
}

function setActiveView(view, shouldRender = true) {
  activeView = view;
  if (shouldRender) render();
}

function applyPreset(preset) {
  if (bulkMode && bulkSelected.size > 0) {
    bulkSelected.forEach((dateKey) => {
      records[dateKey] = {
        ...records[dateKey],
        workAmount: preset.value,
        label: preset.label,
        updatedAt: new Date().toISOString(),
      };
    });
    persistRecords();
    render();
    return;
  }

  selectedDateKey = selectedDateKey || formatDate(new Date());
  records[selectedDateKey] = {
    ...records[selectedDateKey],
    workAmount: preset.value,
    label: preset.label,
    updatedAt: new Date().toISOString(),
  };
  persistRecords();
  render();
}

function saveSelectedDate() {
  const workAmount = Number(workInput.value);
  const label = labelInput.value.trim();
  const memo = memoInput.value.trim();

  if (!Number.isFinite(workAmount) || workInput.value === "") {
    workInput.focus();
    savedStatus.textContent = "공수를 입력하세요";
    return;
  }

  records[selectedDateKey] = {
    workAmount,
    label: label || "직접입력",
    memo,
    updatedAt: new Date().toISOString(),
  };
  persistRecords();
  render();
}

function clearSelectedDate() {
  delete records[selectedDateKey];
  persistRecords();
  render();
}

function toggleBulkMode() {
  bulkMode = !bulkMode;
  if (!bulkMode) bulkSelected = new Set();
  render();
}

function toggleBulkDate(dateKey) {
  if (bulkSelected.has(dateKey)) {
    bulkSelected.delete(dateKey);
  } else {
    bulkSelected.add(dateKey);
  }
  render();
}

function clearBulkSelectedDates() {
  bulkSelected.forEach((dateKey) => {
    delete records[dateKey];
  });
  bulkSelected = new Set();
  persistRecords();
  render();
}

function applyTeamNotice() {
  const today = formatDate(new Date());
  selectedDateKey = today;
  currentDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  records[today] = {
    workAmount: 1.5,
    label: "팀확정",
    memo: "조장 확정 공수: P3 라인 돌발 연장 포함",
    updatedAt: new Date().toISOString(),
  };
  persistRecords();
  render();
}

function seedSampleData() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const samples = [
    [3, 1, "1공수", "정상 출력"],
    [4, 1.5, "연장", "P3라인 돌발 연장, OO팀장 지시"],
    [8, 0, "휴무", "우천으로 오전 대기 후 휴무 처리"],
    [12, 1.25, "조출", "자재 반입 일정으로 조출"],
    [18, 1.5, "연장", "공정 지연으로 2시간 추가 작업"],
  ];

  samples.forEach(([day, workAmount, label, memo]) => {
    const key = formatDate(new Date(year, month, day));
    records[key] = {
      workAmount,
      label,
      memo,
      updatedAt: new Date().toISOString(),
    };
  });

  persistRecords();
  render();
}

function resetAllData() {
  records = {};
  settings = {
    dailyRate: 180000,
    presets: defaultPresets,
  };
  persistRecords();
  persistSettings();
  render();
}

function persistRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  savedStatus.textContent = "저장됨";
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function updateUnsavedStatus() {
  savedStatus.textContent = "저장 전";
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function weekdayName(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatWork(value) {
  const number = Number(value) || 0;
  return `${Number.isInteger(number) ? number : number.toFixed(2).replace(/0$/, "")}공수`;
}

function formatWon(value) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}
