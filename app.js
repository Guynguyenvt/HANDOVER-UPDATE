const STORE_KEY = "handover-update-app-data";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_COLUMNS = new Set(["Date", "Active Date"]);
const MULTILINE_COLUMNS = new Set(["Content", "Description"]);
const DASHBOARD_TITLE = "CASINO OPERATIONS";

let appData = loadData();
let activeSheet = "Dashboard";

const nav = document.querySelector("#sheetNav");
const dashboard = document.querySelector("#dashboard");
const detailView = document.querySelector("#detailView");
const viewTitle = document.querySelector("#viewTitle");
const monthFilter = document.querySelector("#monthFilter");
const yearFilter = document.querySelector("#yearFilter");

document.querySelector("#handoverLogo").src = appData.handoverLogo;
document.querySelector("#sourceName").textContent = appData.source;
document.querySelector("#resetData").addEventListener("click", () => {
  localStorage.removeItem(STORE_KEY);
  appData = structuredClone(window.INITIAL_HANDOVER_DATA);
  activeSheet = "Dashboard";
  render();
});

function loadData() {
  const saved = localStorage.getItem(STORE_KEY);
  return saved ? JSON.parse(saved) : structuredClone(window.INITIAL_HANDOVER_DATA);
}

function saveData() {
  localStorage.setItem(STORE_KEY, JSON.stringify(appData));
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
      const field = DATE_COLUMNS.has(column) ? document.createElement("input") : document.createElement("div");
      if (!DATE_COLUMNS.has(column)) {
        field.className = "editable-text";
        field.contentEditable = "true";
        field.setAttribute("role", "textbox");
        field.setAttribute("aria-label", column);
      }
      field.value = row[column] ?? "";
      if (!DATE_COLUMNS.has(column)) field.textContent = row[column] ?? "";
      field.type = DATE_COLUMNS.has(column) ? "date" : "text";
      field.addEventListener("input", () => {
        row[column] = DATE_COLUMNS.has(column) ? field.value : field.textContent;
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
  const mainColumns = columns.filter((column) => column !== dateColumn).slice(0, 3);
  const chosenColumns = [dateColumn, ...mainColumns];
  panel.innerHTML = chosenColumns
    .map((column) => fieldMarkup(column))
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

function fieldMarkup(column) {
  const type = DATE_COLUMNS.has(column) ? "date" : "text";
  const tag = MULTILINE_COLUMNS.has(column) ? "textarea" : `input type="${type}"`;
  return `<label>${column}<${tag} name="${column}"></${MULTILINE_COLUMNS.has(column) ? "textarea" : "input"}></label>`;
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
