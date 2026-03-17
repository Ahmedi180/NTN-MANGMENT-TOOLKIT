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
  rows: [
    { id: 1, ref: '45530', company: 'JAY BROTHERS', cnic: '34603-6689825-5', ntn: '3277341-2', status: 'active' },
    { id: 2, ref: '45624', company: '3GEARZ', cnic: '34603-9787823-9', ntn: '2735176-9', status: 'expired' }
  ],
  filteredRows: [],
  selectedIds: new Set(),
  editingId: null
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
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

  state.filteredRows = [...state.rows];
  bindEvents();
  renderTable();
});

function bindEvents() {
  els.searchBtn.addEventListener('click', applySearch);
  els.searchBox.addEventListener('input', applySearch);
  els.selectAll.addEventListener('change', toggleSelectAll);
  els.bulkDeleteBtn.addEventListener('click', bulkDelete);
  els.addCompanyBtn.addEventListener('click', () => openModal());
  els.closeModalBtn.addEventListener('click', closeModal);
  els.cancelModalBtn.addEventListener('click', closeModal);
  els.saveCompanyBtn.addEventListener('click', saveCompany);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.row-actions')) closeAllMenus();
  });
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
      <td>${row.ref}</td>
      <td>${row.company}</td>
      <td>
        <div class="copy-cell">
          <span>${row.ntn}</span>
          <button class="mini-btn copy-btn" data-copy="${row.ntn}">Copy</button>
        </div>
      </td>
      <td>
        <div class="copy-cell">
          <span>${row.cnic}</span>
          <button class="mini-btn copy-btn" data-copy="${row.cnic}">Copy</button>
        </div>
      </td>
      <td>
        <span class="status-badge ${row.status === 'active' ? 'active' : 'expired'}">
          ${row.status === 'active' ? 'Active' : 'Expired'}
        </span>
      </td>
      <td>
        <div class="row-actions">
          <button class="icon-btn menu-toggle" type="button">⋮</button>
          <div class="action-menu hidden">
            <button class="expire-toggle" data-id="${row.id}" type="button">
              ${row.status === 'active' ? 'Expire' : 'Unexpire'}
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
    btn.addEventListener('click', () => toggleExpire(Number(btn.dataset.id)));
  });

  document.querySelectorAll('.edit-row').forEach((btn) => {
    btn.addEventListener('click', () => editRow(Number(btn.dataset.id)));
  });

  document.querySelectorAll('.delete-row').forEach((btn) => {
    btn.addEventListener('click', () => deleteRow(Number(btn.dataset.id)));
  });

  document.querySelectorAll('.row-check').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const id = Number(checkbox.dataset.id);
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
      String(v).toLowerCase().includes(q)
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

function bulkDelete() {
  if (!state.selectedIds.size) return;
  if (!confirm(`Delete ${state.selectedIds.size} selected record(s)?`)) return;
  state.rows = state.rows.filter((row) => !state.selectedIds.has(row.id));
  state.selectedIds.clear();
  applySearch();
}

function deleteRow(id) {
  if (!confirm('Delete this record?')) return;
  state.rows = state.rows.filter((row) => row.id !== id);
  state.selectedIds.delete(id);
  applySearch();
}

function toggleExpire(id) {
  const row = state.rows.find((r) => r.id === id);
  if (!row) return;
  row.status = row.status === 'active' ? 'expired' : 'active';
  applySearch();
}

function editRow(id) {
  const row = state.rows.find((r) => r.id === id);
  if (!row) return;

  state.editingId = id;
  els.modalTitle.textContent = 'Edit Company';
  els.refInput.value = row.ref;
  els.companyInput.value = row.company;
  els.ntnInput.value = row.ntn;
  els.cnicInput.value = row.cnic;
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

function saveCompany() {
  const ref = els.refInput.value.trim();
  const company = els.companyInput.value.trim();
  const ntn = els.ntnInput.value.trim();
  const cnic = els.cnicInput.value.trim();

  if (!ref || !company || !ntn || !cnic) {
    alert('Please fill all fields.');
    return;
  }

  if (state.editingId) {
    const row = state.rows.find((r) => r.id === state.editingId);
    if (row) {
      row.ref = ref;
      row.company = company;
      row.ntn = ntn;
      row.cnic = cnic;
    }
  } else {
    state.rows.unshift({
      id: Date.now(),
      ref,
      company,
      ntn,
      cnic,
      status: 'active'
    });
  }

  closeModal();
  applySearch();
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
