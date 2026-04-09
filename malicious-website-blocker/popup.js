// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('protectionToggle');
  const statusLabel = document.getElementById('statusLabel');
  const domainInput = document.getElementById('domainInput');
  const addForm = document.getElementById('addDomainForm');
  const domainList = document.getElementById('domainList');
  const blockedCountEl = document.getElementById('blockedCount');
  const listCountEl = document.getElementById('listCount');

  // Load state
  chrome.storage.sync.get(['blockedDomains', 'isProtectionOn', 'blockedCount'], (data) => {
    const domains = data.blockedDomains || [];
    const isProtectionOn = data.isProtectionOn ?? true;
    const count = data.blockedCount || 0;

    toggle.checked = isProtectionOn;
    updateStatusLabel(isProtectionOn);
    blockedCountEl.textContent = count;
    listCountEl.textContent = domains.length;

    renderList(domains);
  });

  // Toggle Listener
  toggle.addEventListener('change', (e) => {
    const isOn = e.target.checked;
    chrome.storage.sync.set({ isProtectionOn: isOn });
    updateStatusLabel(isOn);
  });

  function updateStatusLabel(isOn) {
    statusLabel.textContent = isOn ? "Active" : "Disabled";
    statusLabel.style.color = isOn ? "var(--success-color)" : "var(--text-muted)";
  }

  // Add Domain
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let newDomain = domainInput.value.trim().toLowerCase();
    
    // basic url sanitization to just get the domain
    try {
      if (newDomain.startsWith('http')) {
        newDomain = new URL(newDomain).hostname;
      }
    } catch (e) {
      // Ignore if not valid URL, rely on raw input
    }
    
    // Remove www. if present
    newDomain = newDomain.replace(/^www\./, '');

    if (!newDomain || newDomain.includes('/')) {
        alert("Please enter a valid domain name (e.g., example.com)");
        return;
    }

    chrome.storage.sync.get(['blockedDomains'], (data) => {
      const domains = data.blockedDomains || [];
      if (!domains.includes(newDomain)) {
        domains.push(newDomain);
        chrome.storage.sync.set({ blockedDomains: domains }, () => {
          domainInput.value = '';
          renderList(domains);
          listCountEl.textContent = domains.length;
        });
      } else {
        domainInput.value = '';
      }
    });
  });

  // Render List
  function renderList(domains) {
    domainList.innerHTML = '';
    domains.forEach(domain => {
      const li = document.createElement('li');
      li.className = 'domain-item';
      
      const span = document.createElement('span');
      span.textContent = domain;

      const btn = document.createElement('button');
      btn.className = 'btn-remove';
      btn.innerHTML = '✕';
      btn.title = 'Remove Domain';
      btn.onclick = () => removeDomain(domain);

      li.appendChild(span);
      li.appendChild(btn);
      domainList.appendChild(li);
    });
  }

  // Remove Domain
  function removeDomain(target) {
    chrome.storage.sync.get(['blockedDomains'], (data) => {
      const domains = data.blockedDomains || [];
      const updated = domains.filter(d => d !== target);
      chrome.storage.sync.set({ blockedDomains: updated }, () => {
        renderList(updated);
        listCountEl.textContent = updated.length;
      });
    });
  }
});
