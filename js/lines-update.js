const state = {
  processedRows: [],
  exportWorkbook: null
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  els.excelFile = document.getElementById("excelFile");
  els.downloadBtn = document.getElementById("downloadBtn");
  els.notice = document.getElementById("notice");
  els.resultsBody = document.getElementById("resultsBody");
  els.emptyState = document.getElementById("emptyState");
  els.resultsSearch = document.getElementById("resultsSearch");

  els.totalRows = document.getElementById("totalRows");
  els.totalUpdated = document.getElementById("totalUpdated");
  els.foundCount = document.getElementById("foundCount");
  els.notFound = document.getElementById("notFound");

  bindEvents();
});

function bindEvents() {
  els.excelFile.addEventListener("change", handleExcelUpload);
  els.downloadBtn.addEventListener("click", downloadUpdatedExcel);
  els.resultsSearch.addEventListener("input", filterResults);
}

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file || typeof XLSX === "undefined") return;

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
  const trackingNumber = String(
    row["Tracking Number"] ||
    row["Tracking No"] ||
    row["Tracking"] ||
    ""
  ).trim();

  const shipperCompanyOriginal = String(row["Shipper Company"] || "").trim();
  const shipperName = String(row["Shipper Name"] || "").trim();
  const shprAddlAddr = String(row["Shpr Addl Addr"] || "").trim();
  const shipperAddress1 = String(row["Shipper Address line 1"] || "").trim();

  const numberSource = findNumberSource([
    ["Shipper Company", shipperCompanyOriginal],
    ["Shipper Name", shipperName],
    ["Shpr Addl Addr", shprAddlAddr],
    ["Shipper Address line 1", shipperAddress1]
  ]);

  const baseName = chooseBaseName(shipperCompanyOriginal, shipperName);

  let finalShipperCompany = shipperCompanyOriginal;
  let sourceColumn = "";
  let statusLabel = "Not Found";

  if (baseName && numberSource.number) {
    finalShipperCompany = `${baseName} NTN ${numberSource.number}`.replace(/\s+/g, " ").trim();
    sourceColumn = numberSource.column;
    statusLabel = "Updated";
  } else if (baseName) {
    finalShipperCompany = baseName;
    statusLabel = "Not Found";
  }

  return {
    ...row,
    trackingNumber,
    shipperCompanyOriginal,
    finalShipperCompany,
    sourceColumn,
    statusLabel
  };
}

function chooseBaseName(shipperCompany, shipperName) {
  const companyHasNumber = containsNumberToken(shipperCompany);
  const companyNameClean = cleanName(shipperCompany);
  const shipperNameClean = cleanName(shipperName);

  if (companyNameClean && !companyHasNumber) return companyNameClean;
  if (shipperNameClean) return shipperNameClean;
  if (companyNameClean) return companyNameClean;
  return "";
}

function containsNumberToken(text) {
  const value = String(text || "").toUpperCase();
  return /NTN[\s.:#-]*[A-Z0-9-]+/.test(value) ||
         /CNIC[\s.:#-]*[0-9-]+/.test(value) ||
         /\b[0-9]{5}-[0-9]{7}-[0-9]\b/.test(value) ||
         /\b[A-Z]?[0-9]{6,}-[0-9]+\b/.test(value);
}

function cleanName(text) {
  let value = String(text || "");
  if (!value) return "";

  value = value.replace(/NTN[\s.:#-]*[A-Z0-9-]+(\([^)]*\))?/ig, " ");
  value = value.replace(/CNIC[\s.:#-]*[0-9-]+/ig, " ");
  value = value.replace(/\b[0-9]{5}-[0-9]{7}-[0-9]\b/g, " ");
  value = value.replace(/\b[A-Z]?[0-9]{6,}-[0-9]+\b/g, " ");
  value = value.replace(/\([^)]*\)/g, " ");
  value = value.replace(/\s+/g, " ").trim();

  return value;
}

function findNumberSource(entries) {
  for (const [column, text] of entries) {
    const number = extractNumber(text);
    if (number) {
      return { column, number };
    }
  }
  return { column: "", number: "" };
}

function extractNumber(text) {
  const value = String(text || "");

  let match = value.match(/NTN[\s.:#-]*([A-Z]?[0-9]{6,}-[0-9]+)/i);
  if (match && match[1]) return match[1].trim();

  match = value.match(/CNIC[\s.:#-]*([0-9-]+)/i);
  if (match && match[1]) return match[1].trim();

  match = value.match(/\b([0-9]{5}-[0-9]{7}-[0-9])\b/);
  if (match && match[1]) return match[1].trim();

  match = value.match(/\b([A-Z]?[0-9]{6,}-[0-9]+)\b/);
  if (match && match[1]) return match[1].trim();

  return "";
}

function updateSummary(rows) {
  const total = rows.length;
  const updated = rows.filter(r => r.statusLabel === "Updated").length;
  const found = rows.filter(r => r.sourceColumn).length;
  const notFound = rows.filter(r => r.statusLabel === "Not Found").length;

  els.totalRows.textContent = String(total);
  els.totalUpdated.textContent = String(updated);
  els.foundCount.textContent = String(found);
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
      <td>${escapeHtml(row.shipperCompanyOriginal)}</td>
      <td>${escapeHtml(row.finalShipperCompany)}</td>
      <td>${row.sourceColumn ? `<span class="source-pill">${escapeHtml(row.sourceColumn)}</span>` : ""}</td>
      <td>
        <span class="badge ${row.statusLabel === "Updated" ? "updated" : "notfound"}">
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
    [
      row.trackingNumber,
      row.shipperCompanyOriginal,
      row.finalShipperCompany,
      row.sourceColumn,
      row.statusLabel
    ].some(v => String(v || "").toLowerCase().includes(q))
  );

  renderResults(filtered);
}

function buildExportWorkbook(processedRows, originalSheetName) {
  const exportRows = processedRows.map((row) => {
    const newRow = { ...row };
    newRow["Tracking Number"] = row.trackingNumber;
    newRow["Shipper Company"] = row.finalShipperCompany;
    newRow["Source Column"] = row.sourceColumn;
    newRow["Filled Status"] = row.statusLabel;

    delete newRow.trackingNumber;
    delete newRow.shipperCompanyOriginal;
    delete newRow.finalShipperCompany;
    delete newRow.sourceColumn;
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
  XLSX.writeFile(state.exportWorkbook, "different-lines-ntn-update.xlsx");
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
