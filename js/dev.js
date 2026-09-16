import { createClient } from
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

import {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
} from "./config.js";

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

const TABLES = {
    profiles: {
        label: "Profiles",
        description: "Employee accounts, roles, and account status.",
        columns: [
            ["id", "ID", false],
            ["full_name", "Full Name", true],
            ["employee_code", "Employee Code", true],
            ["role", "Role", true],
            ["status", "Status", true]
        ]
    },
    teams: {
        label: "Teams",
        description: "Teams available to analysts for profiling.",
        columns: [
            ["id", "ID", false],
            ["team_id", "Team ID", true],
            ["team_name", "Team Name", true],
            ["no_of_members", "Members", true],
            ["status", "Status", true],
            ["created_by", "Created By", false],
            ["created_at", "Created", false],
            ["updated_at", "Updated", false]
        ]
    },
    profiling_jobs: {
        label: "Profiling Jobs",
        description: "Profiling records and their current completion state.",
        columns: [
            ["id", "ID", false],
            ["analyst_id", "Analyst ID", true],
            ["team_id", "Team ID", true],
            ["team_name", "Team Name", true],
            ["member_count", "Member Count", true],
            ["status", "Status", true],
            ["started_at", "Started", true],
            ["finished_at", "Finished", true],
            ["total_seconds", "Total Seconds", true]
        ]
    },
    timer_sessions: {
        label: "Timer Sessions",
        description: "Team/member profiling timer sessions.",
        columns: [
            ["id", "ID", false],
            ["profiling_job_id", "Profiling Job", true],
            ["session_type", "Session Type", "special"],
            ["status", "Status", true],
            ["started_at", "Started", true],
            ["stopped_at", "Stopped", true],
            ["total_seconds", "Total Seconds", true]
        ]
    },
    timer_events: {
        label: "Timer Events",
        description: "Start, pause, resume, and stop events recorded by the profiling timer.",
        columns: [
            ["id", "ID", false],
            ["session_id", "Session", true],
            ["event_type", "Event Type", true],
            ["event_time", "Event Time", true]
        ]
    },
    task_logs: {
        label: "Work Activity Logs",
        description: "Analyst production and non-production work activity records.",
        columns: [
            ["id", "ID", false],
            ["analyst_id", "Analyst ID", true],
            ["category", "Category", true],
            ["task_name", "Task Name", true],
            ["started_at", "Started", true],
            ["ended_at", "Ended", true],
            ["duration_seconds", "Duration", true],
            ["manual_duration_seconds", "Manual Duration", true],
            ["live_duration_seconds", "Live Duration", true],
            ["duration_source", "Duration Source", true],
            ["justification", "Justification", true]
        ]
    },
    task_activity_events: {
        label: "Work Activity Events",
        description: "Detailed pause/resume/start/stop timeline events for work activity.",
        columns: [
            ["id", "ID", false],
            ["task_log_id", "Task Log", true],
            ["event_type", "Event Type", true],
            ["event_time", "Event Time", true]
        ]
    },
    manual_time_requests: {
        label: "Manual Time Requests",
        description: "Non-Prod time requests submitted by analysts for review.",
        columns: [
            ["id", "ID", false],
            ["analyst_id", "Analyst ID", true],
            ["assigned_admin_id", "Assigned Admin", true],
            ["task_name", "Task Name", true],
            ["started_at", "Started", true],
            ["ended_at", "Ended", true],
            ["duration_seconds", "Duration", true],
            ["justification", "Justification", true],
            ["status", "Status", true],
            ["reviewed_by", "Reviewed By", true],
            ["reviewed_at", "Reviewed At", true],
            ["rejection_reason", "Rejection Reason", true],
            ["created_at", "Created", false]
        ]
    },
    app_notifications: {
        label: "Notifications",
        description: "In-app notifications delivered to users.",
        columns: [
            ["id", "ID", false],
            ["recipient_id", "Recipient", true],
            ["type", "Type", true],
            ["title", "Title", true],
            ["message", "Message", true],
            ["reference_id", "Reference", true],
            ["is_read", "Read", true],
            ["read_at", "Read At", true],
            ["created_at", "Created", false]
        ]
    }
};

let currentTable = "profiles";
let currentRows = [];
let currentRequests = [];
let requestFilter = "PENDING";
let searchTerm = "";

const $ = id => document.getElementById(id);

const tableSelect = $("devTableSelect");
const tableDescription = $("devTableDescription");
const dataBody = $("devDataBody");
const dataSearch = $("devDataSearch");
const refreshDataButton = $("refreshDataButton");
const requestBody = $("devRequestBody");
const requestCount = $("devRequestCount");
const pendingCount = $("devPendingCount");
const tableCount = $("devTableCount");
const devError = $("devError");
const devHealthGrid = $("devHealthGrid");
const devHealthMessage = $("devHealthMessage");
const devHealthRunButton = $("devHealthRunButton");
const devHealthLastRun = $("devHealthLastRun");

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatValue(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function looksLikeDateColumn(name) {
    return /(^|_)(at|date|time)$/.test(name) || ["started_at", "ended_at", "finished_at", "stopped_at", "created_at", "updated_at", "read_at", "reviewed_at", "event_time"].includes(name);
}

function isSensitiveValueColumn(name) {
    return ["justification", "message", "rejection_reason"].includes(name);
}

function setError(message = "") {
    if (!devError) return;
    devError.textContent = message;
    devError.hidden = !message;
}

async function requireDevOwner() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        window.location.href = "../index.html";
        return false;
    }

    const { data, error } = await supabase.rpc("is_dev_owner");
    if (error || data !== true) {
        window.location.href = "dashboard.html";
        return false;
    }

    return true;
}

function initializeTableSelect() {
    tableSelect.innerHTML = Object.entries(TABLES)
        .map(([key, config]) => `<option value="${key}">${escapeHtml(config.label)}</option>`)
        .join("");
    tableSelect.value = currentTable;
    tableCount.textContent = String(Object.keys(TABLES).length);
}

function renderTableHeader() {
    const config = TABLES[currentTable];
    const header = $("devDataHeader");
    header.innerHTML = `
        ${config.columns.map(column => `<th>${escapeHtml(column[1])}</th>`).join("")}
        <th class="dev-action-header">Actions</th>
    `;
    tableDescription.textContent = config.description;
}

function renderDataRows() {
    const config = TABLES[currentTable];
    const query = searchTerm.trim().toLowerCase();
    const rows = query
        ? currentRows.filter(row => JSON.stringify(row).toLowerCase().includes(query))
        : currentRows;

    if (!rows.length) {
        dataBody.innerHTML = `<tr><td colspan="${config.columns.length + 1}" class="dev-empty">No records found.</td></tr>`;
        return;
    }

    dataBody.innerHTML = rows.map(row => {
        const rowId = String(row.id ?? "");
        const cells = config.columns.map(([key]) => {
            const value = row[key];
            const display = looksLikeDateColumn(key) ? formatDate(value) : formatValue(value);
            const full = escapeHtml(formatValue(value));
            return `<td title="${full}">${escapeHtml(display)}</td>`;
        }).join("");

        return `
            <tr data-row-id="${escapeHtml(rowId)}">
                ${cells}
                <td class="dev-row-actions">
                    <button type="button" class="dev-small-button" data-action="edit" data-id="${escapeHtml(rowId)}">Edit</button>
                    <button type="button" class="dev-small-button dev-danger-button" data-action="delete" data-id="${escapeHtml(rowId)}">Delete</button>
                </td>
            </tr>
        `;
    }).join("");
}

async function loadRows() {
    setError("");
    dataBody.innerHTML = `<tr><td colspan="20" class="dev-loading">Loading ${escapeHtml(TABLES[currentTable].label)}…</td></tr>`;

    const { data, error } = await supabase.rpc("dev_list_records", {
        p_table: currentTable,
        p_limit: 250
    });

    if (error) {
        console.error("Developer data load error:", error);
        setError(error.message || "Unable to load records.");
        dataBody.innerHTML = `<tr><td colspan="20" class="dev-empty">Unable to load records.</td></tr>`;
        return;
    }

    currentRows = Array.isArray(data) ? data : [];
    renderTableHeader();
    renderDataRows();
}

function createEditModal(row) {
    document.getElementById("devEditModal")?.remove();
    const config = TABLES[currentTable];
    const editable = config.columns.filter(column => column[2] === true || column[2] === "special");
    const isTimerSessionEditor = currentTable === "timer_sessions";

    const modal = document.createElement("div");
    modal.id = "devEditModal";
    modal.className = "dev-modal-overlay";
    modal.innerHTML = `
        <div class="dev-modal" role="dialog" aria-modal="true" aria-labelledby="devEditTitle">
            <div class="dev-modal-header">
                <div>
                    <span class="dev-eyebrow">EDIT RECORD</span>
                    <h2 id="devEditTitle">${escapeHtml(config.label)}</h2>
                    <p>Record ID: <code>${escapeHtml(row.id)}</code></p>
                </div>
                <button type="button" class="dev-modal-close" data-close>×</button>
            </div>
            <form id="devEditForm" class="dev-edit-form">
                ${editable.map(([key, label]) => {
                    const value = row[key];
                    const multiline = isSensitiveValueColumn(key);
                    const inputValue = value === null || value === undefined ? "" : String(value);
                    const specialSessionType = key === "session_type" && isTimerSessionEditor;
                    return `
                        <label class="dev-field ${specialSessionType ? "dev-field-special" : ""}">
                            <span>${escapeHtml(label)}</span>
                            ${specialSessionType
                                ? `<select name="session_type" class="dev-special-select">
                                    <option value="TEAM" ${String(inputValue).toUpperCase() === "TEAM" ? "selected" : ""}>TEAM</option>
                                    <option value="MEMBERS" ${String(inputValue).toUpperCase() === "MEMBERS" ? "selected" : ""}>MEMBERS</option>
                                   </select>
                                   <small>This is a paired profiling session. Changing it here safely swaps the companion session to keep TEAM ↔ MEMBERS.</small>`
                                : multiline
                                    ? `<textarea name="${escapeHtml(key)}" rows="4">${escapeHtml(inputValue)}</textarea>`
                                    : `<input name="${escapeHtml(key)}" value="${escapeHtml(inputValue)}" autocomplete="off">`}
                            ${specialSessionType ? "" : `<small>${escapeHtml(key)}</small>`}
                        </label>
                    `;
                }).join("")}
                <div class="dev-modal-actions">
                    <button type="button" class="dev-secondary-button" data-close>Cancel</button>
                    <button type="submit" class="dev-primary-button">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", close));
    modal.addEventListener("click", event => {
        if (event.target === modal) close();
    });

    modal.querySelector("form").addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.currentTarget.querySelector("button[type='submit']");
        button.disabled = true;
        button.textContent = "Saving…";

        try {
            const changes = {};
            new FormData(event.currentTarget).forEach((value, key) => {
                changes[key] = value === "" ? null : value;
            });

            let error = null;

        // Session type is intentionally handled by a paired RPC. This lets
        // Ivee edit it from Data Manager without ever creating TEAM/TEAM or
        // MEMBERS/MEMBERS. All other timer-session fields still use the
        // normal protected update RPC.
        if (currentTable === "timer_sessions" && Object.prototype.hasOwnProperty.call(changes, "session_type")) {
            const requestedType = String(changes.session_type || "").toUpperCase();
            delete changes.session_type;

            if (requestedType !== String(row.session_type || "").toUpperCase()) {
                // Pass the identifier as text. The database function compares
                // id::text, so this works whether timer_sessions.id is bigint
                // or uuid and avoids client-side type assumptions.
                const sessionId = String(row.id ?? "").trim();
                if (!sessionId) {
                    throw new Error("Invalid timer session ID.");
                }
                const result = await supabase.rpc("dev_switch_session_type_by_session", {
                    p_session_id: sessionId,
                    p_requested_type: requestedType
                });
                error = result.error;
                if (!error && result.data?.message) {
                    console.info("Session Type update:", result.data.message);
                }
            }
        }

        if (!error && Object.keys(changes).length > 0) {
            const result = await supabase.rpc("dev_update_record", {
                p_table: currentTable,
                p_record_id: String(row.id),
                p_changes: changes
            });
            error = result.error;
        }

            if (error) {
                console.error("Developer update error:", error);
                throw error;
            }

            close();
            await loadRows();
            showToast("Record updated successfully.", "success");
        } catch (error) {
            console.error("Developer update error:", error);
            button.disabled = false;
            button.textContent = "Save Changes";
            showDevErrorModal("Update failed", error?.message || "Unable to update this record.");
        }
    });
}

function createDeleteModal(row) {
    document.getElementById("devDeleteModal")?.remove();
    const config = TABLES[currentTable];

    const modal = document.createElement("div");
    modal.id = "devDeleteModal";
    modal.className = "dev-modal-overlay";
    modal.innerHTML = `
        <div class="dev-confirm-modal" role="dialog" aria-modal="true">
            <div class="dev-confirm-icon">!</div>
            <span class="dev-eyebrow">PERMANENT ACTION</span>
            <h2>Delete this ${escapeHtml(config.label)} record?</h2>
            <p>This removes the selected database record. Related records may be affected by your existing database constraints.</p>
            <code>${escapeHtml(row.id)}</code>
            <div class="dev-modal-actions">
                <button type="button" class="dev-secondary-button" data-close>Cancel</button>
                <button type="button" class="dev-danger-confirm" data-confirm-delete>Delete Record</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", close));
    modal.querySelector("[data-confirm-delete]").addEventListener("click", async event => {
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = "Deleting…";

        const { error } = await supabase.rpc("dev_delete_record", {
            p_table: currentTable,
            p_record_id: String(row.id)
        });

        if (error) {
            console.error("Developer delete error:", error);
            button.disabled = false;
            button.textContent = "Delete Record";
            showDevErrorModal("Delete failed", error.message || "Unable to delete this record.");
            return;
        }

        close();
        await loadRows();
        showToast("Record deleted successfully.", "success");
    });
}

async function loadRequests() {
    requestBody.innerHTML = `<div class="dev-loading-card">Loading change requests…</div>`;

    const [viewResult, pendingResult] = await Promise.all([
        supabase.rpc("dev_list_change_requests", {
            p_status: requestFilter
        }),
        requestFilter === "PENDING"
            ? Promise.resolve(null)
            : supabase.rpc("dev_list_change_requests", {
                p_status: "PENDING"
            })
    ]);

    const { data, error } = viewResult;

    if (error) {
        console.error("Developer requests load error:", error);
        requestBody.innerHTML = `<div class="dev-error-card">${escapeHtml(error.message || "Unable to load requests.")}</div>`;
        return;
    }

    currentRequests = Array.isArray(data) ? data : [];
    requestCount.textContent = String(currentRequests.length);

    if (requestFilter === "PENDING") {
        pendingCount.textContent = String(currentRequests.length);
    } else if (!pendingResult?.error) {
        pendingCount.textContent = String(Array.isArray(pendingResult?.data) ? pendingResult.data.length : 0);
    }

    renderRequests();
}

function renderRequests() {
    if (!currentRequests.length) {
        requestBody.innerHTML = `
            <div class="dev-empty-request">
                <div class="dev-empty-icon">✓</div>
                <h3>No ${escapeHtml(requestFilter.toLowerCase())} requests</h3>
                <p>Analyst edit/delete requests will appear here when submitted.</p>
            </div>
        `;
        return;
    }

    requestBody.innerHTML = currentRequests.map(request => `
        <article class="dev-request-card" data-request-id="${escapeHtml(request.id)}">
            <div class="dev-request-top">
                <div>
                    <div class="dev-request-badges">
                        <span class="dev-request-action ${String(request.action).toLowerCase()}">${escapeHtml(request.action)}</span>
                        <span class="dev-request-status ${String(request.status).toLowerCase()}">${escapeHtml(request.status)}</span>
                    </div>
                    <h3>${escapeHtml(request.requester_name || "Unknown Analyst")}</h3>
                </div>
                <time>${escapeHtml(formatDate(request.created_at))}</time>
            </div>

            <div class="dev-request-grid">
                <div><span>Area</span><strong>${escapeHtml(request.target_table_label || request.target_table)}</strong></div>
                <div><span>Record</span><strong><code>${escapeHtml(request.target_record_id || "Not specified")}</code></strong></div>
            </div>

            <div class="dev-request-section">
                <span>Requested Change</span>
                <p>${escapeHtml(request.requested_change || "No change description provided.")}</p>
            </div>

            <div class="dev-request-section">
                <span>Reason</span>
                <p>${escapeHtml(request.reason || "No reason provided.")}</p>
            </div>

            ${request.reviewer_note ? `
                <div class="dev-request-section dev-review-note">
                    <span>Review Note</span>
                    <p>${escapeHtml(request.reviewer_note)}</p>
                </div>
            ` : ""}

            ${request.status === "PENDING" ? `
                <div class="dev-request-actions">
                    <button type="button" class="dev-secondary-button" data-request-action="reject" data-id="${escapeHtml(request.id)}">Reject</button>
                    <button type="button" class="dev-primary-button" data-request-action="approve" data-id="${escapeHtml(request.id)}">Approve / Work on It</button>
                </div>
            ` : request.status === "APPROVED" ? `
                <div class="dev-request-actions">
                    <button type="button" class="dev-primary-button" data-request-action="complete" data-id="${escapeHtml(request.id)}">Mark Completed</button>
                    <button type="button" class="dev-secondary-button" data-request-action="reject" data-id="${escapeHtml(request.id)}">Reject</button>
                </div>
            ` : ""}
        </article>
    `).join("");
}

function openDevReviewModal(requestId, status) {
    const request = currentRequests.find(item => String(item.id) === String(requestId));
    if (!request) return;

    document.getElementById("devReviewModal")?.remove();

    const isReject = status === "REJECTED";
    const isComplete = status === "COMPLETED";
    const isSessionTypeSwitch =
        request.target_table === "timer_sessions" &&
        request.action === "UPDATE" &&
        String(request.requested_change || "").startsWith("SESSION_TYPE_SWITCH|");
    const sessionSwitchHint = isSessionTypeSwitch
        ? `<div class="dev-session-switch-note"><strong>Protected session sequence</strong><span>Completing this request will swap the paired timer labels together so the profiling flow remains TEAM ↔ MEMBERS. Do not manually edit the Session Type field.</span></div>`
        : "";
    const modal = document.createElement("div");
    modal.id = "devReviewModal";
    modal.className = "dev-modal-overlay";
    modal.innerHTML = `
        <div class="dev-review-modal" role="dialog" aria-modal="true" aria-labelledby="devReviewTitle">
            <div class="dev-review-header ${isReject ? "danger" : isComplete ? "success" : ""}">
                <div class="dev-review-symbol">${isReject ? "×" : isComplete ? "✓" : "↗"}</div>
                <div>
                    <span class="dev-eyebrow">REQUEST REVIEW</span>
                    <h2 id="devReviewTitle">${isReject ? "Reject Request" : isComplete ? "Complete Request" : "Update Request"}</h2>
                    <p>${isReject ? "Tell the analyst why this request cannot be completed." : isComplete ? "Confirm the change has been handled and leave a clear result note." : "Add a note before updating this request."}</p>
                </div>
                <button type="button" class="dev-modal-close" data-close>×</button>
            </div>

            ${sessionSwitchHint}
            <div class="dev-review-summary">
                <div><span>Analyst</span><strong>${escapeHtml(request.requester_name || "Unknown Analyst")}</strong></div>
                <div><span>Area</span><strong>${escapeHtml(request.target_table_label || request.target_table)}</strong></div>
                <div><span>Action</span><strong>${escapeHtml(request.action)}</strong></div>
            </div>

            <form id="devReviewForm" class="dev-review-form">
                <label class="dev-field">
                    <span>${isReject ? "Reason for rejection" : "Note for the analyst"}</span>
                    <textarea name="reviewer_note" rows="5" maxlength="2000" placeholder="${isReject ? "Explain what needs to be corrected or why the request cannot be completed." : "Example: Updated the member count from 72 to 78 in the Profiling Jobs record."}">${isComplete ? "Completed in the Developer Console." : ""}</textarea>
                    <small>This note will be visible to the analyst in My Requests.</small>
                </label>
                <div class="dev-modal-actions">
                    <button type="button" class="dev-secondary-button" data-close>Cancel</button>
                    <button type="submit" class="${isReject ? "dev-danger-confirm" : "dev-primary-button"}">${isReject ? "Reject Request" : isComplete ? "Complete Request" : "Save Update"}</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", close));
    modal.addEventListener("click", event => {
        if (event.target === modal) close();
    });

    modal.querySelector("form").addEventListener("submit", async event => {
        event.preventDefault();
        const submit = event.currentTarget.querySelector("button[type='submit']");
        const note = String(new FormData(event.currentTarget).get("reviewer_note") || "").trim();
        submit.disabled = true;
        submit.textContent = isReject ? "Rejecting…" : isComplete ? "Completing…" : "Saving…";

        const { error } = await supabase.rpc("dev_review_change_request", {
            p_request_id: requestId,
            p_status: status,
            p_reviewer_note: note
        });

        if (error) {
            console.error("Developer request review error:", error);
            submit.disabled = false;
            submit.textContent = isReject ? "Reject Request" : isComplete ? "Complete Request" : "Save Update";
            showToast(error.message || "Unable to update this request.", "error");
            return;
        }

        close();
        await loadRequests();
        showToast(`Request marked ${status.toLowerCase()}.`, "success");
    });
}

function showDevErrorModal(title, message) {
    document.getElementById("devErrorModal")?.remove();
    const modal = document.createElement("div");
    modal.id = "devErrorModal";
    modal.className = "dev-modal-overlay";
    modal.innerHTML = `
        <div class="dev-confirm-modal dev-feedback-modal" role="dialog" aria-modal="true">
            <div class="dev-feedback-icon">!</div>
            <span class="dev-eyebrow">DEVELOPER CONSOLE</span>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(message)}</p>
            <div class="dev-modal-actions"><button type="button" class="dev-primary-button" data-close>Close</button></div>
        </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector("[data-close]").addEventListener("click", close);
    modal.addEventListener("click", e => { if (e.target === modal) close(); });
}

function showToast(message, type = "success") {
    document.getElementById("devToast")?.remove();
    const toast = document.createElement("div");
    toast.id = "devToast";
    toast.className = `dev-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("visible"));
    setTimeout(() => {
        toast.classList.remove("visible");
        setTimeout(() => toast.remove(), 220);
    }, 2400);
}

async function loadDevHealth() {
    if (!devHealthGrid) return;
    if (devHealthRunButton) {
        devHealthRunButton.disabled = true;
        devHealthRunButton.textContent = "Checking…";
    }
    if (devHealthMessage) devHealthMessage.textContent = "Running integrity checks…";
    try {
        const { data, error } = await supabase.rpc("dev_health_check");
        if (error) throw error;
        const items = Array.isArray(data) ? data : [];
        devHealthGrid.innerHTML = items.map(item => `
            <div class="dev-health-card ${item.level === "ERROR" ? "error" : item.level === "WARN" ? "warn" : "ok"}">
                <span class="dev-health-icon">${item.level === "ERROR" ? "!" : item.level === "WARN" ? "~" : "✓"}</span>
                <div><strong>${escapeHtml(item.label || "Check")}</strong><span>${escapeHtml(String(item.value ?? "—"))}</span><small>${escapeHtml(item.detail || "")}</small></div>
            </div>`).join("");
        const errors = items.filter(i => i.level === "ERROR").length;
        const warns = items.filter(i => i.level === "WARN").length;
        if (devHealthMessage) devHealthMessage.textContent = errors ? `${errors} issue${errors === 1 ? "" : "s"} found.` : warns ? `${warns} warning${warns === 1 ? "" : "s"} found. No critical errors.` : "All checks passed.";
        if (devHealthLastRun) devHealthLastRun.textContent = `Last checked ${new Date().toLocaleString()}`;
    } catch (error) {
        console.error("Developer health check error:", error);
        devHealthGrid.innerHTML = `<div class="dev-health-failure"><strong>Health check unavailable</strong><span>${escapeHtml(error.message || "The diagnostic function could not be reached.")}</span><small>Run the latest supabase_dev_console.sql in Supabase SQL Editor, then refresh.</small></div>`;
        if (devHealthMessage) devHealthMessage.textContent = "Health check failed.";
    } finally {
        if (devHealthRunButton) {
            devHealthRunButton.disabled = false;
            devHealthRunButton.textContent = "Run Check";
        }
    }
}

function bindEvents() {
    tableSelect.addEventListener("change", async () => {
        currentTable = tableSelect.value;
        searchTerm = "";
        dataSearch.value = "";
        await loadRows();
    });

    dataSearch.addEventListener("input", () => {
        searchTerm = dataSearch.value;
        renderDataRows();
    });

    refreshDataButton.addEventListener("click", loadRows);

    if (devHealthRunButton) {
        devHealthRunButton.addEventListener("click", loadDevHealth);
    }

    dataBody.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");
        if (!button) return;
        const row = currentRows.find(item => String(item.id) === String(button.dataset.id));
        if (!row) return;
        if (button.dataset.action === "edit") createEditModal(row);
        if (button.dataset.action === "delete") createDeleteModal(row);
    });

    document.querySelectorAll("[data-request-filter]").forEach(button => {
        button.addEventListener("click", async () => {
            document.querySelectorAll("[data-request-filter]").forEach(item => item.classList.remove("active"));
            button.classList.add("active");
            requestFilter = button.dataset.requestFilter;
            await loadRequests();
        });
    });

    requestBody.addEventListener("click", event => {
        const button = event.target.closest("[data-request-action]");
        if (!button) return;
        const action = button.dataset.requestAction;
        const status = action === "approve" ? "APPROVED" : action === "complete" ? "COMPLETED" : "REJECTED";
        openDevReviewModal(button.dataset.id, status);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!await requireDevOwner()) return;
    initializeTableSelect();
    bindEvents();
    await Promise.all([loadRows(), loadRequests()]);
});
