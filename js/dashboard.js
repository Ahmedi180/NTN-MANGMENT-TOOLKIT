document.addEventListener('DOMContentLoaded', function() {
  // Total records and stats
  const totalRecords = 1248;
  const activeNTN = 1080;
  const expiredNTN = 168;
  const updatedToday = 320;

  // Injecting data into dashboard
  document.getElementById('totalRecords').textContent = totalRecords;
  document.getElementById('activeNTN').textContent = activeNTN;
  document.getElementById('expiredNTN').textContent = expiredNTN;
  document.getElementById('updatedToday').textContent = updatedToday;

  // Simulate recent activity
  const recentUpdates = document.getElementById('recentUpdates');
  const updates = [
    'NTN 123456789 updated.',
    'New company added: XYZ Traders.',
    'Expired NTNs processed.'
  ];

  recentUpdates.innerHTML = updates.join('<br>');
});
