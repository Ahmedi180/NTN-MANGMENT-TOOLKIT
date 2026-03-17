import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const state = {
  rows: [],
  filteredRows: [],
  selectedIds: new Set(),
  editingId: null
};

const els = {};

document.addEventListener('DOMContentLoaded', async () => {
  els.tableBody = document.getElementById('tableBody');
  els.searchBox = document.getElementById('searchBox');
  els.searchBtn = document.getElementById('searchBtn');
  els.selectAll = document.getElementById('selectAll');
  els.bulkBar = document.getElementById('bulkBar');
  els.selectedCount = document.getElementById('selectedCount');
  els.bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  els.emptyState = document.getElementById('emptyState');
  els.excelFile = document.getElementById('excelFile');
  els.addCompanyBtn = document.getElementById('addCompanyBtn');
  els.companyModal = document.getElementById('companyModal');
  els.modalTitle = document.getElementById('modalTitle');
  els.closeModalBtn = document.getElementById('closeModalBtn');
  els.cancelModalBtn = document.getElementById('cancelModalBtn');
  els.saveCompanyBtn = document.getElementById('saveCompanyBtn');
  els.refInput = document.getElementById('refInput');
  els.companyInput = document.getElementById('companyInput');
  els.ntnInput = document.getElementById('ntnInput');
  els.cnicInput = document.getElementById('cnicInput');

  bindEvents();
  await loadCompanies();
});

function bindEvents() {
  els.searchBtn.addEventListener('click', applySearch);
  els.searchBox.addEventListener('input', applySearch);
  els.selectAll.addEventListener('change', toggleSelectAll);
  els.bulkDeleteBtn.addEventListener('click', bulkDelete);
  els.addCompanyBtn.addEventListener('click', openModal);
  els.closeModalBtn.addEventListener('click', closeModal);
  els.cancelModalBtn.addEventListener('click', closeModal);
  els.saveCompanyBtn.addEventListener('click', saveCompany);

  if (els.excelFile) {
    els.excelFile.addEventListener('change', handleExcelUpload);
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.row-actions')) closeAllMenus();
  });
}

async function loadCompanies() {
  const snapshot = await getDocs(collection(db, "companies"));
  state.rows = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
  state.filteredRows = [...state.rows];
  renderTable();
}

function renderTable() {
  els.tableBody.innerHTML = '';

  if (!state.filteredRows.length) {
    els.emptyState.classList.remove('hidden');
  } else {
    els.emptyState.classList.add('hidden');
  }

  state.filteredRows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-id="${row.id}" ${state.selectedIds.has(row.id) ? 'checked' : ''}></td>
      <td>${escapeHtml(row.ref || '')}</td>
      <td>${escapeHtml(row.company || '')}</td>
      <td>
        <div class="copy-cell">
          <span>${escapeHtml(row.ntn || '')}</span>
          <button class="mini-btn copy-btn" data-copy="${escapeAttr(row.ntn || '')}" type="button">Copy</button>
        </div>
      </td>
      <td>
        <div class="copy-cell">
          <span>${escapeHtml(row.cnic || '')}</span>
          <button class="mini-btn copy-btn" data-copy="${escapeAttr(row.cnic || '')}" type="button">Copy</button>
        </div>
      </td>
      <td>
        <span class="status-badge ${(row.status || 'active') === 'active' ? 'active' : 'expired'}">
          ${(row.status || 'active') === 'active' ? 'Active' : 'Expired'}
        </span>
      </td>
      <td>
        <div class="row-actions">
          <button class="icon-btn menu-toggle" type="button">⋮</button>
          <div class="action-menu hidden">
            <button class="expire-toggle" data-id="${row.id}" type="button">
              ${(row.status || 'active') === 'active' ? 'Expire' : 'Unexpire'}
            </button>
            <button class="edit-row" data-id="${row.id}" type="button">Edit</button>
            <button class="delete-row" data-id="${row.id}" type="button">Delete</button>
          </div>
        </div>
      </td>
    `;
    els.tableBody.appendChild(tr);
  });

  wireRowEvents();
  syncBulkBar();
}

function wireRowEvents() {
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => copyText(btn.dataset.copy, btn));
  });

  document.querySelectorAll('.menu-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = btn.nextElementSibling;
      const wasHidden = menu.classList.contains('hidden');
      closeAllMenus();
      if (wasHidden) menu.classList.remove('hidden');
    });
  });

  document.querySelectorAll('.expire-toggle').forEach((btn) => {
    btn.addEventListener('click', () => toggleExpire(btn.dataset.id));
  });

  document.querySelectorAll('.edit-row').forEach((btn) => {
    btn.addEventListener('click', () => editRow(btn.dataset.id));
  });

  document.querySelectorAll('.delete-row').forEach((btn) => {
    btn.addEventListener('click', () => deleteRow(btn.dataset.id));
  });

  document.querySelectorAll('.row-check').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const id = checkbox.dataset.id;
      if (checkbox.checked) state.selectedIds.add(id);
      else state.selectedIds.delete(id);
      syncBulkBar();
    });
  });
}

function applySearch() {
  const q = els.searchBox.value.trim().toLowerCase();
  state.filteredRows = state.rows.filter((row) =>
    [row.ref, row.company, row.ntn, row.cnic, row.status].some((v) =>
      String(v || '').toLowerCase().includes(q)
    )
  );
  renderTable();
}

function toggleSelectAll() {
  const visibleIds = state.filteredRows.map((r) => r.id);
  if (els.selectAll.checked) visibleIds.forEach((id) => state.selectedIds.add(id));
  else visibleIds.forEach((id) => state.selectedIds.delete(id));
  renderTable();
}

function syncBulkBar() {
  els.selectedCount.textContent = String(state.selectedIds.size);
  els.bulkBar.classList.toggle('show', state.selectedIds.size > 0);

  const visibleIds = state.filteredRows.map((r) => r.id);
  els.selectAll.checked = visibleIds.length > 0 && visibleIds.every((id) => state.selectedIds.has(id));
}

async function bulkDelete() {
  if (!state.selectedIds.size) return;
  if (!confirm(`Delete ${state.selectedIds.size} selected record(s)?`)) return;

  for (const id of state.selectedIds) {
    await deleteDoc(doc(db, "companies", String(id)));
  }

  state.selectedIds.clear();
  await loadCompanies();
}

async function deleteRow(id) {
  if (!confirm('Delete this record?')) return;
  await deleteDoc(doc(db, "companies", String(id)));
  state.selectedIds.delete(id);
  await loadCompanies();
  closeAllMenus();
}

async function toggleExpire(id) {
  const row = state.rows.find((r) => String(r.id) === String(id));
  if (!row) return;

  const newStatus = row.status === 'active' ? 'expired' : 'active';
  await updateDoc(doc(db, "companies", String(id)), {
    status: newStatus
  });

  await loadCompanies();
  closeAllMenus();
}

function editRow(id) {
  const row = state.rows.find((r) => String(r.id) === String(id));
  if (!row) return;

  state.editingId = id;
  els.modalTitle.textContent = 'Edit Company';
  els.refInput.value = row.ref || '';
  els.companyInput.value = row.company || '';
  els.ntnInput.value = row.ntn || '';
  els.cnicInput.value = row.cnic || '';
  els.companyModal.classList.remove('hidden');
  closeAllMenus();
}

function openModal() {
  state.editingId = null;
  els.modalTitle.textContent = 'Add Company';
  els.refInput.value = '';
  els.companyInput.value = '';
  els.ntnInput.value = '';
  els.cnicInput.value = '';
  els.companyModal.classList.remove('hidden');
}

function closeModal() {
  els.companyModal.classList.add('hidden');
}

async function saveCompany() {
  const ref = els.refInput.value.trim();
  const company = els.companyInput.value.trim();
  const ntn = els.ntnInput.value.trim();
  const cnic = els.cnicInput.value.trim();

  if (!ref || !company || !ntn || !cnic) {
    alert('Please fill all fields.');
    return;
  }

  if (state.editingId) {
    await updateDoc(doc(db, "companies", state.editingId), {
      ref,
      company,
      ntn,
      cnic
    });
  } else {
    await addDoc(collection(db, "companies"), {
      ref,
      company,
      ntn,
      cnic,
      status: "active",
      createdAt: serverTimestamp()
    });
  }

  closeModal();
  await loadCompanies();
}

async function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file || typeof XLSX === "undefined") return;

  const reader = new FileReader();

  reader.onload = async function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    for (const row of json) {
      const ref = String(row.REFF || row.REF || "").trim();
      const company = String(row["COMPANY NAMES"] || row["COMPANY NAME"] || "").trim();
      const cnic = String(row.CNIC || "").trim();
      const ntn = String(row.NTN || "").trim();

      if (ref || company || cnic || ntn) {
        await addDoc(collection(db, "companies"), {
          ref,
          company,
          cnic,
          ntn,
          status: "active",
          createdAt: serverTimestamp()
        });
      }
    }

    alert("Excel imported successfully");
    event.target.value = "";
    await loadCompanies();
  };

  reader.readAsArrayBuffer(file);
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const old = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = old; }, 900);
  });
}

function closeAllMenus() {
  document.querySelectorAll('.action-menu').forEach((menu) => {
    menu.classList.add('hidden');
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
