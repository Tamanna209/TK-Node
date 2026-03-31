(function () {
  const baseUrlEl = document.getElementById("baseUrl");
  const modeEl = document.getElementById("mode");
  const tokenEl = document.getElementById("token");
  const testKeyEl = document.getElementById("testKey");
  const loadBtn = document.getElementById("loadBtn");
  const messageEl = document.getElementById("message");
  const requestsEl = document.getElementById("requests");

  function setMessage(text, isError) {
    messageEl.textContent = text || "";
    messageEl.style.color = isError ? "#b91c1c" : "#6b7280";
  }

  function authHeaders() {
    const token = tokenEl.value.trim();
    const headers = {
      "Content-Type": "application/json",
    };
    if (modeEl.value === "admin" && token) {
      headers.Authorization = "Bearer " + token;
    }
    if (modeEl.value === "test" && testKeyEl.value.trim()) {
      headers["x-admin-test-key"] = testKeyEl.value.trim();
    }
    return headers;
  }

  function getBaseUrl() {
    return (baseUrlEl.value || "/api").replace(/\/+$/, "");
  }

  async function apiFetch(path, options) {
    const url = getBaseUrl() + path;
    const response = await fetch(url, options || {});
    const data = await response.json().catch(function () {
      return {};
    });
    if (!response.ok) {
      throw new Error(data.message || ("Request failed (" + response.status + ")"));
    }
    return data;
  }

  function renderSection(title, items) {
    if (!items || items.length === 0) {
      return (
        '<div class="request"><strong>' + title + '</strong><div class="muted">No requests.</div></div>'
      );
    }
    return (
      '<div class="request"><strong>' + title + "</strong>" +
      items
        .map(function (item) {
          const user = item.user || {};
          const statusClass = item.status || "pending";
          return (
            '<div class="request">' +
            '<div class="row">' +
            '<strong>' + (user.name || "Unknown User") + "</strong>" +
            '<span class="status ' + statusClass + '">' + (item.status || "pending") + "</span>" +
            "</div>" +
            '<div class="muted">UID: ' + item.uid + "</div>" +
            '<div class="muted">Phone: ' + (user.phoneNumber || "-") + "</div>" +
            '<div class="muted">Store: ' + (item.storeName || "-") + "</div>" +
            '<div class="muted">Requested: ' + (item.requestedAt || "-") + "</div>" +
            '<div class="row" style="margin-top:8px;">' +
            '<button class="btn-ok" data-action="approve" data-uid="' + item.uid + '">Approve</button>' +
            '<button class="btn-danger" data-action="reject" data-uid="' + item.uid + '">Reject</button>' +
            "</div>" +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderRequests(items) {
    if (!items || items.length === 0) {
      requestsEl.innerHTML = '<p class="muted">No requests found.</p>';
      return;
    }
    const pending = items.filter(function (x) { return x.status === "pending"; });
    const approved = items.filter(function (x) { return x.status === "approved"; });
    const rejected = items.filter(function (x) { return x.status === "rejected"; });
    requestsEl.innerHTML =
      renderSection("Pending", pending) +
      renderSection("Approved", approved) +
      renderSection("Rejected", rejected);
  }

  async function loadRequests() {
    try {
      setMessage("Loading...", false);
      const prefix = modeEl.value === "test" ? "/admin/test" : "/admin";
      const data = await apiFetch(prefix + "/seller-requests", {
        method: "GET",
        headers: authHeaders(),
      });
      renderRequests((data.data && data.data.requests) || []);
      setMessage("Loaded successfully.", false);
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  async function handleAction(action, uid) {
    try {
      if (!uid) return;
      setMessage("Processing " + action + "...", false);
      if (action === "approve") {
        const prefix = modeEl.value === "test" ? "/admin/test" : "/admin";
        await apiFetch(prefix + "/seller-requests/" + encodeURIComponent(uid) + "/approve", {
          method: "PUT",
          headers: authHeaders(),
        });
      } else {
        const reason = window.prompt("Rejection reason (required):", "Does not meet seller criteria");
        if (!reason || reason.trim().length < 5) {
          setMessage("Rejection cancelled: reason too short.", true);
          return;
        }
        const prefix = modeEl.value === "test" ? "/admin/test" : "/admin";
        await apiFetch(prefix + "/seller-requests/" + encodeURIComponent(uid) + "/reject", {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ reason: reason.trim() }),
        });
      }
      setMessage("Action completed.", false);
      await loadRequests();
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  loadBtn.addEventListener("click", function () {
    loadRequests();
  });

  requestsEl.addEventListener("click", function (event) {
    const target = event.target;
    if (!target || !target.dataset) return;
    const action = target.dataset.action;
    const uid = target.dataset.uid;
    if (action && uid) {
      handleAction(action, uid);
    }
  });
})();
