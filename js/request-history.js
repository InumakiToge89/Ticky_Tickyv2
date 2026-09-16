import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);
let requests = [];

function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function formatDate(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString([], {month:"short",day:"2-digit",year:"numeric",hour:"numeric",minute:"2-digit"}); }
function statusClass(status) { return String(status || "").toLowerCase(); }
function tableLabel(value) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()); }
function prettyValue(key, value) {
    if (value === null || value === undefined || value === "") return "—";
    if (/(_at|_date|_time)$/.test(key)) { const d = new Date(value); if (!Number.isNaN(d.getTime())) return d.toLocaleString([], {month:"short",day:"2-digit",year:"numeric",hour:"numeric",minute:"2-digit"}); }
    return String(value);
}

async function requireSignedIn() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) { window.location.href = "../index.html"; return null; }
    return user;
}

async function loadRequests() {
    const list = $("myRequestList");
    list.innerHTML = `<div class="my-request-loading">Loading your requests…</div>`;
    const { data, error } = await supabase.rpc("get_my_dev_change_requests");
    if (error) { list.innerHTML = `<div class="my-request-error">${escapeHtml(error.message || "Unable to load your requests.")}</div>`; return; }
    requests = Array.isArray(data) ? data : [];
    $("myRequestTotal").textContent = requests.length;
    $("myRequestPending").textContent = requests.filter(r => r.status === "PENDING" || r.status === "APPROVED").length;
    $("myRequestCompleted").textContent = requests.filter(r => r.status === "COMPLETED").length;
    renderRequests();
}

function renderRequests() {
    const list = $("myRequestList");
    if (!requests.length) {
        list.innerHTML = `<div class="my-request-empty"><div class="my-request-empty-mark">✓</div><h3>No requests yet</h3><p>When you need an edit or delete, use <b>Request Change</b>. Your requests and results will appear here.</p></div>`; return;
    }
    list.innerHTML = requests.map(r => {
        const status = statusClass(r.status);
        const action = r.action === "DELETE" ? "Delete" : "Edit";
        return `<article class="my-request-card ${status}">
            <div class="my-request-card-top"><div class="my-request-title-wrap"><span class="my-request-action ${action.toLowerCase()}">${action}</span><span class="my-request-status ${status}">${escapeHtml(r.status)}</span><h3>${escapeHtml(r.target_table_label || tableLabel(r.target_table))}</h3></div><time>${escapeHtml(formatDate(r.created_at))}</time></div>
            <div class="my-request-meta"><div><span>Record</span><strong>${escapeHtml(r.target_record_id || "Not specified")}</strong></div><div><span>Submitted</span><strong>${escapeHtml(formatDate(r.created_at))}</strong></div><div><span>Decision</span><strong>${escapeHtml(r.reviewer_name || "Awaiting review")}</strong></div></div>
            <div class="my-request-copy"><span>What you requested</span><p>${escapeHtml(r.requested_change || "No description provided.")}</p></div>
            ${r.reason ? `<div class="my-request-copy"><span>Your reason</span><p>${escapeHtml(r.reason)}</p></div>` : ""}
            ${r.reviewer_note ? `<div class="my-request-result-note"><span>Developer note</span><p>${escapeHtml(r.reviewer_note)}</p></div>` : ""}
            <div class="my-request-actions">
                ${r.status === "COMPLETED" ? `<button type="button" class="request-view-result" data-result="${escapeHtml(r.id)}">View Result ↗</button>` : r.status === "REJECTED" ? `<span class="request-closed-label">Request closed</span>` : `<span class="request-waiting-label">${r.status === "APPROVED" ? "Ivee is working on this request" : "Waiting for Ivee to review"}</span>`}
            </div>
        </article>`;
    }).join("");
}

async function openResultModal(requestId) {
    const request = requests.find(r => String(r.id) === String(requestId));
    if (!request) return;
    const { data, error } = await supabase.rpc("get_my_dev_request_result", { p_request_id: requestId });
    if (error) { openInfoModal("Result unavailable", error.message || "The result could not be loaded.", "!"); return; }
    const result = data || {};
    const record = result.record || null;
    const deleted = result.deleted === true;
    const modal = document.createElement("div");
    modal.className = "request-result-modal";
    modal.innerHTML = `<div class="request-result-dialog" role="dialog" aria-modal="true" aria-labelledby="requestResultTitle">
        <div class="request-result-head"><div class="request-result-icon ${deleted ? "deleted" : "completed"}">${deleted ? "×" : "✓"}</div><div><span class="request-history-eyebrow">DEVELOPER RESULT</span><h2 id="requestResultTitle">${deleted ? "Record Deleted" : "Change Completed"}</h2><p>${deleted ? "The requested record is no longer present in the system." : "This is the current record after Ivee completed your request."}</p></div><button class="request-result-close" data-close>×</button></div>
        <div class="request-result-request"><span>Your request</span><strong>${escapeHtml(request.requested_change)}</strong><small>${escapeHtml(request.target_table_label || tableLabel(request.target_table))} • ${escapeHtml(request.target_record_id || "—")}</small></div>
        ${deleted ? `<div class="request-deleted-state"><div>✓</div><h3>Deletion confirmed</h3><p>The system could not find the record after completion, which is consistent with a completed delete request.</p></div>` : record ? `<div class="request-current-record"><div class="request-current-record-head"><span>LIVE RECORD</span><strong>Current data</strong></div><div class="request-record-grid">${Object.entries(record).filter(([key]) => key !== "id").map(([key,value]) => `<div><span>${escapeHtml(tableLabel(key))}</span><strong>${escapeHtml(prettyValue(key,value))}</strong></div>`).join("")}</div></div>` : `<div class="request-deleted-state"><div>?</div><h3>Record not available</h3><p>The request is complete, but the target record could not be loaded.</p></div>`}
        <div class="request-result-footer"><span>Completed ${escapeHtml(formatDate(request.reviewed_at || request.created_at))}</span><button class="request-result-primary" data-close>Done</button></div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", close));
    modal.addEventListener("click", e => { if (e.target === modal) close(); });
}

function openInfoModal(title, message, icon="i") {
    const modal = document.createElement("div"); modal.className="request-result-modal";
    modal.innerHTML=`<div class="request-result-dialog request-info-dialog" role="dialog" aria-modal="true"><div class="request-result-head"><div class="request-result-icon">${icon}</div><div><span class="request-history-eyebrow">TICKY TICKY</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div><button class="request-result-close" data-close>×</button></div><div class="request-result-footer"><span></span><button class="request-result-primary" data-close>Close</button></div></div>`;
    document.body.appendChild(modal); const close=()=>modal.remove(); modal.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",close)); modal.addEventListener("click",e=>{if(e.target===modal)close();});
}

$("refreshMyRequests").addEventListener("click", loadRequests);
$("myRequestList").addEventListener("click", e => { const b=e.target.closest("[data-result]"); if(b) openResultModal(b.dataset.result); });
$("openNewRequest").addEventListener("click", e => { e.preventDefault(); window.openDeveloperRequestModal?.(); });

(async()=>{ const user=await requireSignedIn(); if(!user)return; await loadRequests(); })();
