const STORE_KEY = "handover-update-app-data";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_COLUMNS = new Set(["Date", "Active Date"]);
const MULTILINE_COLUMNS = new Set(["Content", "Description"]);
const DASHBOARD_TITLE = "CASINO OPERATIONS";
const FIELD_MAPPINGS = [
  { sheet: "Daily Briefing", column: "Location", settingColumn: "Location" },
  { sheet: "Daily Briefing", column: "Pit", settingColumn: "Location" },
  { sheet: "Mass & VIP Program", table: "ACTIVE PROGRAMS", column: "VIP Room", settingColumn: "VIP ITO" },
  { sheet: "Mass & VIP Program", table: "ACTIVE PROGRAMS", column: "ITO Rep", settingColumn: "ITO Rep" },
  { sheet: "Mass & VIP Program", table: "ACTIVE SHUFFLE", column: "Location", settingColumn: "VIP ITO" },
  { sheet: "Mass & VIP Program", table: "ACTIVE SHUFFLE", column: "Shuffle Type", settingColumn: "Shuffle Type" },
  { sheet: "Patron Management", column: "Patron", settingColumn: "VIP Patron" },
  { sheet: "Patron Management", column: "Form", settingColumn: "Form of Patron" },
  { sheet: "Equipment", column: "Equipment", settingColumn: "Equipment" },
  { sheet: "Equipment", column: "Location", settingColumn: "Location" },
  { sheet: "Equipment", column: "Status", settingColumn: "Status" },
  { sheet: "SOP Update", column: "Game", settingColumn: "Game" },
  { sheet: "SOP Update", column: "SOP Form", settingColumn: "SOP Form" }
];

let appData = loadData();
let activeSheet = "Dashboard";

const nav = document.querySelector("#sheetNav");
const dashboard = document.querySelector("#dashboard");
const detailView = document.querySelector("#detailView");
const viewTitle = document.querySelector("#viewTitle");
const monthFilter = document.querySelector("#monthFilter");
const yearFilter = document.querySelector("#yearFilter");
const restoreFile = document.querySelector("#restoreFile");

document.querySelector("#handoverLogo").src = appData.handoverLogo;
document.querySelector("#sourceName").textContent = appData.source;
document.querySelector("#backupData").addEventListener("click", backupData);
document.querySelector("#restoreData").addEventListener("click", () => restoreFile.click());
restoreFile.addEventListener("change", restoreData);
document.querySelector("#resetData").addEventListener("click", () => {
  localStorage.removeItem(STORE_KEY);
  appData = structuredClone(window.INITIAL_HANDOVER_DATA);
  activeSheet = "Dashboard";
  render();
  showStatus("Data reset");
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

function loadData() {
  const saved = localStorage.getItem(STORE_KEY);
  return saved ? JSON.parse(saved) : structuredClone(window.INITIAL_HANDOVER_DATA);
}

function saveData() {
  localStorage.setItem(STORE_KEY, JSON.stringify(appData));
}

function backupData() {
  const stamp = new Date().toISOString().slice(0, 10);
  const payload = JSON.stringify(appData, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `handover-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showStatus("Backup file created");
}

function restoreData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || !Array.isArray(imported.sheets)) throw new Error("Invalid backup");
      appData = imported;
      saveData();
      activeSheet = "Dashboard";
      render();
      showStatus("Backup restored");
    } catch {
      showStatus("Could not restore this file");
    } finally {
      restoreFile.value = "";
    }
  };
  reader.readAsText(file);
}

function showStatus(message) {
  let status = document.querySelector(".status-toast");
  if (!status) {
    status = document.createElement("div");
    status.className = "status-toast";
    document.body.appendChild(status);
  }
  status.textContent = message;
  status.classList.add("show");
  window.clearTimeout(showStatus.timer);
  showStatus.timer = window.setTimeout(() => status.classList.remove("show"), 2200);
}

function allRows(sheet) {
  return sheet.tables.flatMap((table) => table.rows.map((row) => ({ table, row })));
}

function rowDate(row) {
  return row.Date || row["Active Date"] || "";
}

function rowMonth(row) {
  if (row.Month && MONTHS.includes(String(row.Month).slice(0, 3))) return String(row.Month).slice(0, 3);
  const date = rowDate(row);
  if (!date) return "";
  const parsed = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "" : MONTHS[parsed.getMonth()];
}

function rowYear(row) {
  if (row.Year) return String(row.Year).slice(0, 4);
  const date = rowDate(row);
  if (!date) return "";
  const parsed = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "" : String(parsed.getFullYear());
}

function matchesFilters(row) {
  const month = monthFilter.value;
  const year = yearFilter.value;
  return (!month || rowMonth(row) === month) && (!year || rowYear(row) === year);
}

function filteredRows(sheet) {
  return allRows(sheet).filter(({ row }) => matchesFilters(row));
}

function settingRows() {
  const settingSheet = appData.sheets.find((sheet) => sheet.name === "Setting");
  return settingSheet ? settingSheet.tables.flatMap((table) => table.rows) : [];
}

function settingOptions(settingColumn) {
  const values = settingRows()
    .map((row) => row[settingColumn])
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
    .map((value) => String(value).trim());
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function mappedSettingColumn(sheetName, tableTitle, column) {
  const mapping = FIELD_MAPPINGS.find((item) => {
    return item.sheet === sheetName && item.column === column && (!item.table || item.table === tableTitle);
  });
  return mapping ? mapping.settingColumn : "";
}

function isMappedField(sheetName, tableTitle, column) {
  return mappedSettingColumn(sheetName, tableTitle, column) !== "";
}

function optionsForField(sheetName, tableTitle, column, currentValue = "") {
  const settingColumn = mappedSettingColumn(sheetName, tableTitle, column);
  if (!settingColumn) return [];
  const options = settingOptions(settingColumn);
  const current = String(currentValue || "").trim();
  if (current && !options.includes(current)) options.unshift(current);
  return options;
}

function setupFilters() {
  const months = new Set();
  const years = new Set();
  appData.sheets.forEach((sheet) => {
    allRows(sheet).forEach(({ row }) => {
      const month = rowMonth(row);
      const year = rowYear(row);
      if (month) months.add(month);
      if (year) years.add(year);
    });
  });

  const previousMonth = monthFilter.value;
  const previousYear = yearFilter.value;
  monthFilter.innerHTML = `<option value="">All</option>${MONTHS.filter((m) => months.has(m))
    .map((m) => `<option value="${m}">${m}</option>`)
    .join("")}`;
  yearFilter.innerHTML = `<option value="">All</option>${[...years]
    .sort()
    .map((y) => `<option value="${y}">${y}</option>`)
    .join("")}`;
  monthFilter.value = [...monthFilter.options].some((option) => option.value === previousMonth) ? previousMonth : "";
  yearFilter.value = [...yearFilter.options].some((option) => option.value === previousYear) ? previousYear : "";
}

monthFilter.addEventListener("change", renderViews);
yearFilter.addEventListener("change", renderViews);

function render() {
  setupFilters();
  renderNav();
  renderViews();
}

function renderNav() {
  nav.innerHTML = "";
  nav.appendChild(navButton({ name: "Dashboard", logo: appData.handoverLogo }, totalVisibleRows(), activeSheet === "Dashboard"));
  appData.sheets.forEach((sheet) => {
    nav.appendChild(navButton(sheet, filteredRows(sheet).length, activeSheet === sheet.name));
  });
}

function navButton(sheet, count, isActive) {
  const button = document.createElement("button");
  button.className = `nav-button${isActive ? " active" : ""}`;
  button.type = "button";
  button.innerHTML = `<img src="${sheet.logo}" alt=""><span>${sheet.name}</span><b>${count}</b>`;
  button.addEventListener("click", () => {
    activeSheet = sheet.name;
    renderViews();
  });
  return button;
}

function renderViews() {
  renderNav();
  dashboard.innerHTML = "";
  detailView.innerHTML = "";
  viewTitle.textContent = activeSheet === "Dashboard" ? DASHBOARD_TITLE : activeSheet;
  if (activeSheet === "Dashboard") renderDashboard();
  else renderSheet(appData.sheets.find((sheet) => sheet.name === activeSheet));
}

function totalVisibleRows() {
  return appData.sheets.reduce((sum, sheet) => sum + filteredRows(sheet).length, 0);
}

function renderDashboard() {
  appData.sheets.forEach((sheet) => {
    const template = document.querySelector("#sheetCardTemplate").content.cloneNode(true);
    const button = template.querySelector(".sheet-card");
    button.querySelector("img").src = sheet.logo;
    button.querySelector("img").alt = sheet.name;
    button.querySelector(".sheet-card-title").textContent = sheet.name;
    button.querySelector(".sheet-card-count").textContent = filteredRows(sheet).length;
    button.addEventListener("click", () => {
      activeSheet = sheet.name;
      renderViews();
    });
    dashboard.appendChild(button);
  });
  appData.sheets.forEach(renderSheet);
}

function renderSheet(sheet) {
  sheet.tables.forEach((table) => {
    const section = document.createElement("article");
    section.className = "sheet-section";
    section.appendChild(sectionHeader(sheet, table));
    section.appendChild(renderTable(sheet, table));
    section.appendChild(quickPanel(sheet, table));
    detailView.appendChild(section);
  });
}

function sectionHeader(sheet, table) {
  const header = document.createElement("header");
  header.className = "section-header";
  header.innerHTML = `
    <div class="title-lockup">
      <img src="${sheet.logo}" alt="">
      <div>
        <h3>${table.title}</h3>
        <p>${filteredTableRows(table).length} item(s)</p>
      </div>
    </div>
    <button class="small-button secondary" type="button">Add Row</button>
  `;
  header.querySelector("button").addEventListener("click", () => {
    addBlankRow(table);
    saveData();
    render();
  });
  return header;
}

function filteredTableRows(table) {
  return table.rows.filter(matchesFilters);
}

function renderTable(sheet, table) {
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const rows = filteredTableRows(table);
  if (!rows.length) {
    wrap.innerHTML = `<div class="empty">No items for selected month and year.</div>`;
    return wrap;
  }
  const tableEl = document.createElement("table");
  tableEl.innerHTML = `
    <thead>
      <tr>${table.columns.map((column) => `<th>${column}</th>`).join("")}<th></th></tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = tableEl.querySelector("tbody");
  rows.forEach((row) => {
    const rowIndex = table.rows.indexOf(row);
    const tr = document.createElement("tr");
    table.columns.forEach((column) => {
      const td = document.createElement("td");
      td.className = DATE_COLUMNS.has(column) ? "date-cell" : "text-cell";
      if (MULTILINE_COLUMNS.has(column)) td.className += " long-cell";
      const options = optionsForField(sheet.name, table.title, column, row[column]);
      const field = createField(column, row[column], options);
      if (field.classList.contains("editable-text")) {
        field.className = "editable-text";
        field.contentEditable = "true";
        field.setAttribute("role", "textbox");
        field.setAttribute("aria-label", column);
      }
      field.addEventListener("input", () => {
        row[column] = fieldValue(field);
        syncDateParts(row, column);
        saveData();
        setupFilters();
      });
      field.addEventListener("change", () => {
        row[column] = fieldValue(field);
        syncDateParts(row, column);
        saveData();
        setupFilters();
      });
      td.appendChild(field);
      tr.appendChild(td);
    });
    const actions = document.createElement("td");
    actions.className = "actions-cell";
    actions.innerHTML = `<button class="delete-row" type="button" title="Delete row">Delete</button>`;
    actions.querySelector("button").addEventListener("click", () => {
      table.rows.splice(rowIndex, 1);
      saveData();
      render();
    });
    tr.appendChild(actions);
    tbody.appendChild(tr);
  });
  wrap.appendChild(tableEl);
  return wrap;
}

function quickPanel(sheet, table) {
  const panel = document.createElement("form");
  panel.className = "quick-panel";
  const columns = table.columns.filter((column) => !["Year", "Month"].includes(column));
  const dateColumn = columns.find((column) => DATE_COLUMNS.has(column)) || columns[0];
  const mappedColumns = columns.filter((column) => column !== dateColumn && isMappedField(sheet.name, table.title, column));
  const detailColumns = columns.filter((column) => column !== dateColumn && MULTILINE_COLUMNS.has(column));
  const otherColumns = columns.filter((column) => {
    return column !== dateColumn && !mappedColumns.includes(column) && !detailColumns.includes(column);
  });
  const chosenColumns = [...new Set([dateColumn, ...mappedColumns, ...detailColumns, ...otherColumns.slice(0, 2)])];
  panel.innerHTML = chosenColumns
    .map((column) => fieldMarkup(sheet.name, table.title, column))
    .join("");
  panel.innerHTML += `<button class="small-button" type="submit">Update</button>`;
  panel.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(panel);
    const row = {};
    table.columns.forEach((column) => {
      row[column] = form.get(column) || "";
    });
    syncDateParts(row, dateColumn);
    table.rows.unshift(row);
    saveData();
    render();
  });
  return panel;
}

function createField(column, value, options) {
  if (DATE_COLUMNS.has(column)) {
    const input = document.createElement("input");
    input.type = "date";
    input.value = value ?? "";
    return input;
  }
  if (options.length) {
    const select = document.createElement("select");
    select.innerHTML = `<option value=""></option>${options
      .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
      .join("")}`;
    select.value = value ?? "";
    return select;
  }
  const div = document.createElement("div");
  div.className = "editable-text";
  div.textContent = value ?? "";
  return div;
}

function fieldValue(field) {
  return field.classList.contains("editable-text") ? field.textContent : field.value;
}

function fieldMarkup(sheetName, tableTitle, column) {
  const type = DATE_COLUMNS.has(column) ? "date" : "text";
  const options = optionsForField(sheetName, tableTitle, column);
  if (options.length) {
    return `<label>${column}<select name="${column}"><option value=""></option>${options
      .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
      .join("")}</select></label>`;
  }
  const tag = MULTILINE_COLUMNS.has(column) ? "textarea" : `input type="${type}"`;
  return `<label>${column}<${tag} name="${column}"></${MULTILINE_COLUMNS.has(column) ? "textarea" : "input"}></label>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function addBlankRow(table) {
  const row = {};
  table.columns.forEach((column) => {
    row[column] = "";
  });
  table.rows.unshift(row);
}

function syncDateParts(row, changedColumn) {
  if (!DATE_COLUMNS.has(changedColumn) || !row[changedColumn]) return;
  const parsed = new Date(`${String(row[changedColumn]).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return;
  if ("Year" in row) row.Year = String(parsed.getFullYear());
  if ("Month" in row) row.Month = MONTHS[parsed.getMonth()];
}

render();
