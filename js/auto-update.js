import { db } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

const state = {
  companies: [],
  processedRows: [],
  exportWorkbook: null
};

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  els.excelFile = document.getElementById("excelFile");
  els.downloadBtn = document.getElementById("downloadBtn");
  els.notice = document.getElementById("notice");
  els.resultsBody = document.getElementById("resultsBody");
  els.emptyState = document.getElementById("emptyState");
  els.resultsSearch = document.getElementById("resultsSearch");

  els.totalRows = document.getElementById("totalRows");
  els.totalFilled = document.getElementById("totalFilled");
  els.ntnFilled = document.getElementById("ntnFilled");
  els.cnicFilled = document.getElementById("cnicFilled");
  els.notFound = document.getElementById("notFound");

  bindEvents();
  await loadCompanies();
});

function bindEvents() {
  els.excelFile.addEventListener("change", handleExcelUpload);
  els.downloadBtn.addEventListener("click", downloadUpdatedExcel);
  els.resultsSearch.addEventListener("input", filterResults);
}

async function loadCompanies() {
  try {
    const snapshot = await get(ref(db, "companies"));
    const data = snapshot.exists() ? snapshot.val() : {};
    state.companies = Object.values(data).map((item) => ({
      company: String(item.company || "").trim(),
      ntn: String(item.ntn || "").trim(),
      cnic: String(item.cnic || "").trim(),
      status: String(item.status || "active").trim().toLowerCase()
    })).filter(item => item.company);

    if (!state.companies.length) {
      showNotice("Database empty hai. Pehle Tool 1 me companies add karo.");
    } else {
      showNotice(`${state.companies.length} companies loaded from database.`);
    }
  } catch (error) {
    console.error(error);
    showNotice("Database load nahi hua. Firebase config ya rules check karo.");
  }
}

async function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file || typeof XLSX === "undefined") return;

  if (!state.companies.length) {
    alert("Database me companies nahi hain. Pehle Tool 1 me data add karo.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!rows.length) {
        alert("Excel file empty hai.");
        return;
      }

      const processed = rows.map((row) => processRow(row));

      processed.sort((a, b) => {
        if (a.statusLabel === "Not Found" && b.statusLabel !== "Not Found") return -1;
        if (a.statusLabel !== "Not Found" && b.statusLabel === "Not Found") return 1;
        return 0;
      });

      state.processedRows = processed;
      buildExportWorkbook(processed, workbook.SheetNames[0]);
      updateSummary(processed);
      renderResults(processed);

      els.downloadBtn.disabled = false;
      showNotice("Processing completed. Not Found rows are shown on top.");
    } catch (error) {
      console.error(error);
      alert("Excel process nahi hua. Console check karo.");
    }
  };

  reader.readAsArrayBuffer(file);
  event.target.value = "";
}

function processRow(row) {
  const trackingNumber = String(row["Tracking Number"] || "").trim();
  const shipperCompany = String(row["Shipper Company"] || "").trim();

  const match = findBestCompanyMatch(shipperCompany);

  let source = "";
  let statusLabel = "Not Found";
  let updatedShipperCompany = shipperCompany;

  if (match) {
    if (match.status === "active" && match.ntn) {
      source = "NTN";
      statusLabel = "Filled";
      updatedShipperCompany = `${shipperCompany} ${match.ntn}`.trim();
    } else if (match.status === "expired" && match.cnic) {
      source = "CNIC";
      statusLabel = "Filled";
      updatedShipperCompany = `${shipperCompany} ${match.cnic}`.trim();
    }
  }

  return {
    ...row,
    trackingNumber,
    shipperCompany,
    updatedShipperCompany,
    source,
    statusLabel
  };
}

function findBestCompanyMatch(inputName) {
  const input = normalizeName(inputName);
  if (!input) return null;

  let best = null;
  let bestScore = 0;

  for (const company of state.companies) {
    const dbName = normalizeName(company.company);
    if (!dbName) continue;

    let score = 0;

    if (input === dbName) score = 100;
    else if (dbName.includes(input) || input.includes(dbName)) score = 85;
    else {
      const inputTokens = uniqueTokens(input);
      const dbTokens = uniqueTokens(dbName);
      const common = inputTokens.filter(t => dbTokens.includes(t));
      const coverage = common.length / Math.max(1, Math.min(inputTokens.length, dbTokens.length));

      if (coverage >= 0.75) score = 75;
      else if (coverage >= 0.5) score = 60;
      else if (common.length >= 2) score = 50;
    }

    if (score > bestScore) {
      bestScore = score;
      best = company;
    }
  }

  return bestScore >= 60 ? best : null;
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(industry|industries|ind|ltd|limited|pvt|private|co|company|corp|corporation)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueTokens(value) {
  return [...new Set(value.split(" ").filter(Boolean))];
}

function updateSummary(rows) {
  const total = rows.length;
  const filled = rows.filter(r => r.statusLabel === "Filled").length;
  const ntn = rows.filter(r => r.source === "NTN").length;
  const cnic = rows.filter(r => r.source === "CNIC").length;
  const notFound = rows.filter(r => r.statusLabel === "Not Found").length;

  els.totalRows.textContent = String(total);
  els.totalFilled.textContent = String(filled);
  els.ntnFilled.textContent = String(ntn);
  els.cnicFilled.textContent = String(cnic);
  els.notFound.textContent = String(notFound);
}

function renderResults(rows) {
  els.resultsBody.innerHTML = "";

  if (!rows.length) {
    els.emptyState.style.display = "block";
    return;
  }

  els.emptyState.style.display = "none";

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.trackingNumber)}</td>
      <td>${escapeHtml(row.updatedShipperCompany || row.shipperCompany)}</td>
      <td>${row.source ? `<span class="source-pill">${escapeHtml(row.source)}</span>` : ""}</td>
      <td>
        <span class="badge ${row.statusLabel === "Filled" ? "filled" : "notfound"}">
          ${escapeHtml(row.statusLabel)}
        </span>
      </td>
    `;
    els.resultsBody.appendChild(tr);
  });
}

function filterResults() {
  const q = String(els.resultsSearch.value || "").toLowerCase().trim();

  if (!q) {
    renderResults(state.processedRows);
    return;
  }

  const filtered = state.processedRows.filter((row) =>
    [row.trackingNumber, row.updatedShipperCompany, row.shipperCompany, row.source, row.statusLabel]
      .some(v => String(v || "").toLowerCase().includes(q))
  );

  renderResults(filtered);
}

function buildExportWorkbook(processedRows, originalSheetName) {
  const exportRows = processedRows.map((row) => {
    const newRow = { ...row };
    newRow["Tracking Number"] = row.trackingNumber;
    newRow["Shipper Company"] = row.updatedShipperCompany || row.shipperCompany;
    newRow["Match Source"] = row.source;
    newRow["Filled Status"] = row.statusLabel;

    delete newRow.trackingNumber;
    delete newRow.shipperCompany;
    delete newRow.updatedShipperCompany;
    delete newRow.source;
    delete newRow.statusLabel;

    return newRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, originalSheetName || "Updated");
  state.exportWorkbook = workbook;
}

function downloadUpdatedExcel() {
  if (!state.exportWorkbook) return;
  XLSX.writeFile(state.exportWorkbook, "auto-update-result.xlsx");
}

function showNotice(message) {
  els.notice.textContent = message;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
