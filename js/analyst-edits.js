import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let analystRecordsPage = 1;
let analystRequestsPage = 1;

const $ = id => document.getElementById(id);

const TABLES = {
  profiling_jobs: ["team_id","team_name","member_count","status","started_at","finished_at","total_seconds"],
  timer_sessions: ["status","started_at","stopped_at","total_seconds"],
  timer_events: ["event_type","event_time"],
  task_logs: ["category","task_name","started_at","ended_at","duration_seconds","manual_duration_seconds","live_duration_seconds","duration_source","justification"],
  task_activity_events: ["event_type","event_time"],
  manual_time_requests: ["task_name","started_at","ended_at","duration_seconds","justification"]
};
const LABELS = {
  team_id:"Team ID",team_name:"Team",member_count:"Member count",status:"Status",
  started_at:"Started at",finished_at:"Finished at",stopped_at:"Stopped at",ended_at:"Ended at",
  total_seconds:"Total seconds",duration_seconds:"Duration seconds",manual_duration_seconds:"Manual duration seconds",
  live_duration_seconds:"Live duration seconds",duration_source:"Duration source",justification:"Justification",
  category:"Category",task_name:"Task name",event_type:"Event type",event_time:"Event time"
};
let currentUser = null;
let currentRole = "ANALYST";
let records = [];
let filteredRecords = [];
let analystRecordsTotal = 0;
let requests = [];
let pendingRequests = [];
let selectedRecord = null;
let selectedRequest = null;

let manualRequests = [];
let selectedManualRequest = null;
let reviewHistory = [];

function formatDuration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainderSeconds = total % 60;
    if (hours) return `${hours}h ${minutes}m${remainderSeconds ? ` ${remainderSeconds}s` : ""}`;
    if (minutes) return `${minutes}m${remainderSeconds ? ` ${remainderSeconds}s` : ""}`;
    return `${remainderSeconds}s`;
}

let historyCurrentPage = 1;

function setAnalystTab(tab) {
  const recordsActive = tab === "records";
  $("analystTabRecords").classList.toggle("active", recordsActive);
  $("analystTabRequests").classList.toggle("active", !recordsActive);
  $("analystTabRecords").setAttribute("aria-selected", String(recordsActive));
  $("analystTabRequests").setAttribute("aria-selected", String(!recordsActive));
  $("analystPanelRecords").hidden = !recordsActive;
  $("analystPanelRequests").hidden = recordsActive;
}

function setAdminTab(tab) {
  const tabs = ["edits","manual","history"];
  tabs.forEach(name => {
    const button = $(`adminTab${name[0].toUpperCase()}${name.slice(1)}`);
    const panel = $(`adminPanel${name[0].toUpperCase()}${name.slice(1)}`);
    const active = name === tab;
    if (button) {
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    }
    if (panel) panel.hidden = !active;
  });
  if (tab === "manual") loadManualRequests();
  if (tab === "history") loadReviewHistory();
}

function detailValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function detailCard(labelText, value, wide=false, fieldKey="") {
  const display = fieldKey ? formatReviewField(fieldKey,value) : detailValue(value);
  return `<div class="ae-detail-cell${wide?" ae-detail-wide":""}"><span>${esc(labelText)}</span><strong>${esc(display)}</strong></div>`;
}
function renderDetailGrid(items) {
  return `<div class="ae-detail-grid">${items.filter(Boolean).join("")}</div>`;
}
function renderRecordSnapshot(snapshot, title="Original record details") {
  if (!snapshot || typeof snapshot !== "object" || !Object.keys(snapshot).length) {
    return `<section class="ae-detail-section"><h4>${esc(title)}</h4><p class="ae-detail-muted">No original record snapshot is available for this request.</p></section>`;
  }
  const preferred = ["category","task_name","team_name","team_id","status","started_at","finished_at","ended_at","stopped_at","duration_seconds","total_seconds","manual_duration_seconds","live_duration_seconds","duration_source","justification"];
  const keys = [...preferred.filter(k=>Object.prototype.hasOwnProperty.call(snapshot,k)), ...Object.keys(snapshot).filter(k=>!preferred.includes(k))];
  return `<section class="ae-detail-section"><h4>${esc(title)}</h4>${renderDetailGrid(keys.map(k=>detailCard(label(k),snapshot[k],["justification"].includes(k),k)))}</section>`;
}
function requestSummaryItems(r) {
  const snapshot=r.original_data||{};
  const primaryDate=snapshot.started_at||snapshot.created_at||snapshot.event_time||r.created_at;
  const duration=snapshot.duration_seconds??snapshot.total_seconds??snapshot.manual_duration_seconds;
  return [
    detailCard("Request type",r.action==="DELETE"?"Deletion":"Edit"),
    detailCard("Record type",label(r.target_table)),
    detailCard("Record ID",r.target_record_id),
    detailCard("Submitted",dateFmt(r.created_at)),
    primaryDate?detailCard("Record date",dateFmt(primaryDate)):null,
    duration!==undefined?detailCard("Recorded duration",formatDuration(duration)):null
  ];
}
async function loadManualRequests() {
  const box = $("manualRequestsList");
  if (!box) return;
  box.innerHTML = `<div class="ae-loading">Loading manual time requests…</div>`;
  const {data,error} = await supabase
    .from("manual_time_requests")
    .select("id, analyst_id, category, task_name, started_at, ended_at, duration_seconds, justification, status, created_at")
    .eq("status","PENDING")
    .order("created_at",{ascending:false});
  if (error) {
    console.error("Manual time requests:",error);
    box.innerHTML = `<div class="ae-empty">${esc(error.message || "Unable to load manual time requests.")}</div>`;
    $("manualPendingCount").textContent = "—";
    return;
  }
  manualRequests = Array.isArray(data) ? data : [];
  $("manualPendingCount").textContent = String(manualRequests.length);
  if (!manualRequests.length) {
    box.innerHTML = `<div class="ae-empty">There are no pending manual time requests assigned for review.</div>`;
    return;
  }
  const ids = [...new Set(manualRequests.map(r=>r.analyst_id).filter(Boolean))];
  let names = new Map();
  if (ids.length) {
    const {data:profiles,error:profileError} = await supabase.from("profiles").select("id,full_name").in("id",ids);
    if (!profileError) names = new Map((profiles||[]).map(p=>[String(p.id),p.full_name||"Unknown Analyst"]));
  }
  manualRequests = manualRequests.map(r=>({...r, analyst_name:names.get(String(r.analyst_id)) || "Unknown Analyst"}));
  box.innerHTML = manualRequests.map((r,i)=>{
    const analyst = r.analyst_name || "Unknown Analyst";
    const start = r.started_at ? dateFmt(r.started_at) : "—";
    const end = r.ended_at ? dateFmt(r.ended_at) : "—";
    return `<article class="ae-request ae-manual-request">
      <div class="ae-request-top">
        <div><h3>${esc(analyst)} · Manual ${esc(r.category || "NON-PROD")}</h3><div class="ae-record-meta">Submitted ${esc(dateFmt(r.created_at))} · Request #${esc(String(r.id).slice(0,8))}</div></div>
        <div class="ae-manual-duration">${esc(formatDuration(r.duration_seconds))}</div>
      </div>
      <div class="ae-manual-grid">
        <div><span>Activity</span><strong>${esc(r.task_name||"—")}</strong></div>
        <div><span>Date</span><strong>${esc(start.split(",")[0])}</strong></div>
        <div><span>Start</span><strong>${esc(start)}</strong></div>
        <div><span>End</span><strong>${esc(end)}</strong></div>
      </div>
      <div class="ae-reason-block"><strong class="ae-kicker">ANALYST JUSTIFICATION</strong><div class="ae-reason">${esc(r.justification||"No justification provided.")}</div></div>
      <div class="ae-manual-actions"><button class="ae-button ae-button-success" type="button" data-manual-review="${i}" data-decision="APPROVED">✓ Accept</button><button class="ae-button ae-button-danger" type="button" data-manual-review="${i}" data-decision="REJECTED">✕ Reject</button></div>
    </article>`;
  }).join("");
}

function openManualReview(request, decision) {
  selectedManualRequest = request;
  const approve = decision === "APPROVED";
  $("manualReviewTitle").textContent = approve ? "Review & accept manual time" : "Review & reject manual time";
  const startDate = request.started_at ? new Date(request.started_at) : null;
  const endDate = request.ended_at ? new Date(request.ended_at) : null;
  const duration = Number(request.duration_seconds)||0;
  const computed = startDate && endDate ? Math.max(0,Math.round((endDate-startDate)/1000)) : null;
  const discrepancy = computed !== null ? computed-duration : null;
  $("manualReviewDetails").innerHTML = `
    <section class="ae-detail-section">
      <div class="ae-detail-heading"><div><span class="ae-kicker">REQUEST INFORMATION</span><h3>${esc(request.analyst_name||"Unknown Analyst")}</h3></div><span class="ae-status-pill">PENDING REVIEW</span></div>
      ${renderDetailGrid([
        detailCard("Request ID",request.id), detailCard("Submitted",dateFmt(request.created_at)),
        detailCard("Analyst ID",request.analyst_id), detailCard("Category",request.category || "NON-PROD"),
        detailCard("Activity",request.task_name||"—"),
        detailCard("Activity date",startDate?new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Manila"}).format(startDate):"—"),
        detailCard("Start time",dateFmt(request.started_at)), detailCard("End time",dateFmt(request.ended_at))
      ])}
    </section>
    <section class="ae-detail-section ae-duration-panel">
      <div><span class="ae-kicker">SUBMITTED DURATION</span><strong class="ae-duration-value">${esc(formatDuration(duration))}</strong></div>
      <div><span class="ae-kicker">TIME-RANGE CHECK</span><strong>${computed===null?"Unable to calculate":esc(formatDuration(computed))}</strong></div>
      ${discrepancy!==null?`<p class="ae-detail-muted ${discrepancy===0?"":"ae-detail-warning"}">${discrepancy===0?"The submitted duration matches the start/end time range.":`Duration difference: ${discrepancy>0?"+":"−"}${esc(formatDuration(Math.abs(discrepancy)))} (please verify the submitted duration).`}</p>`:""}
    </section>
    <section class="ae-detail-section"><h4>Analyst justification</h4><div class="ae-reason">${esc(request.justification||"No justification provided.")}</div></section>
    <section class="ae-detail-section"><h4>Review checklist</h4><ul class="ae-review-checklist"><li>Confirm the activity and category are appropriate.</li><li>Verify the date and start/end times.</li><li>Check that the duration matches the time range.</li><li>Consider whether this entry should be included in official productivity records.</li></ul></section>`;
  $("manualReviewJustification").value = "";
  $("manualReviewJustification").placeholder = approve
    ? "Optional review note (approval notes are not currently saved by the existing workflow)."
    : "Explain why this request is being rejected…";
  $("manualReviewJustification").closest("label").hidden = approve;
  $("manualApproveRequest").hidden = !approve;
  $("manualRejectRequest").hidden = approve;
  openModal("manualReviewModal");
}
async function decideManualRequest(decision) {
  if (!selectedManualRequest) return;
  const reason = $("manualReviewJustification").value.trim();
  if (decision === "REJECTED" && reason.length < 5) {
    showNotice("Please provide a rejection reason of at least 5 characters.",true);
    return;
  }
  const approve = $("manualApproveRequest"), reject = $("manualRejectRequest");
  approve.disabled = reject.disabled = true;
  const {error} = await supabase.rpc("review_manual_activity_request",{
    p_request_id:selectedManualRequest.id,
    p_decision:decision,
    p_rejection_reason:decision === "REJECTED" ? reason : null
  });
  approve.disabled = reject.disabled = false;
  if (error) {
    showNotice(error.message||"Unable to review the manual time request.",true);
    return;
  }
  closeModals();
  selectedManualRequest = null;
  showNotice(decision==="APPROVED"
    ? "Manual time approved. The entry can now be included in official productivity records."
    : "Manual time rejected. The analyst has been notified.");
  await loadManualRequests();
  if ($("adminPanelHistory") && !$("adminPanelHistory").hidden) await loadReviewHistory();
}

function historyStatus(status) {
  return statusPill(status);
}

function renderReviewHistory() {
  const box=$("reviewHistoryList");
  if (!box) return;
  const type=$("historyTypeFilter").value;
  const status=$("historyStatusFilter").value;
  const search=$("historySearch").value.trim().toLowerCase();
  const filtered=reviewHistory.filter(r=>{
    if(type!=="ALL" && r.request_type!==type) return false;
    if(status!=="ALL" && r.status!==status) return false;
    if(search && ![r.analyst_name,r.reviewer_name,r.record_label,r.request_id,r.action,r.analyst_justification,r.admin_justification].join(" ").toLowerCase().includes(search)) return false;
    return true;
  });
  const pageSize=Number($("historyPageSize")?.value||20);
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  historyCurrentPage=Math.min(Math.max(1,historyCurrentPage),totalPages);
  const start=(historyCurrentPage-1)*pageSize;
  const pageRows=filtered.slice(start,start+pageSize);
  $("historyResultSummary").textContent=filtered.length
    ? `Showing ${start+1}–${Math.min(start+pageRows.length,filtered.length)} of ${filtered.length} reviewed requests`
    : "No reviewed requests match these filters.";
  $("historyPageInfo").textContent=`Page ${historyCurrentPage} of ${totalPages}`;
  $("historyPrevPage").disabled=historyCurrentPage<=1;
  $("historyNextPage").disabled=historyCurrentPage>=totalPages;
  if(!pageRows.length) {
    box.innerHTML=`<tr><td colspan="6" class="ae-history-empty">No review history found. Try changing your filters.</td></tr>`;
    return;
  }
  box.innerHTML=pageRows.map((r,i)=>{
    const detail=r.request_type==="MANUAL_TIME"
      ? `Manual Non-Prod · ${r.record_label||"Activity"}`
      : `${r.action==="DELETE"?"Deletion":"Edit"} · ${label(r.target_table||"Record")}`;
    const changeText=r.request_type!=="MANUAL_TIME" && r.proposed_changes
      ? Object.entries(r.proposed_changes).map(([k,v])=>`${label(k)}: ${fmt(r.original_data?.[k])} → ${fmt(v)}`).join(" | ")
      : `Record: ${r.record_label||r.target_record_id||"—"}`;
    return `<tr>
      <td data-label="Reviewed">${esc(dateFmt(r.reviewed_at))}</td>
      <td data-label="Analyst"><strong>${esc(r.analyst_name||"Unknown")}</strong></td>
      <td data-label="Request"><span class="ae-history-request-type">${esc(detail)}</span><small>${esc(String(r.request_id||"").slice(0,10))}</small></td>
      <td data-label="Decision">${historyStatus(r.status)}</td>
      <td data-label="Reviewer">${esc(r.reviewer_name||"Admin unavailable")}</td>
      <td data-label="Details"><details class="ae-history-details"><summary>View</summary>
        <div class="ae-history-detail-content">
          <p><strong>Submitted:</strong> ${esc(dateFmt(r.submitted_at))}</p>
          <p><strong>Analyst justification:</strong> ${esc(r.analyst_justification||"—")}</p>
          <p><strong>Admin review:</strong> ${esc(r.admin_justification||"No review note recorded.")}</p>
          <p><strong>Change / record:</strong> ${esc(changeText||"—")}</p>
        </div>
      </details></td>
    </tr>`;
  }).join("");
}
async function loadReviewHistory() {
  const box=$("reviewHistoryList");
  if(!box)return;
  box.innerHTML=`<tr><td colspan="6" class="ae-history-empty">Loading review history…</td></tr>`;
  const {data,error}=await supabase.rpc("get_admin_record_correction_history",{p_limit:500});
  if(error) {
    console.error("Review history:",error);
    box.innerHTML=`<tr><td colspan="6" class="ae-history-empty">${esc(error.message||"Unable to load review history. Run the supplied SQL migration first.")}</td></tr>`;
    $("historyResultSummary").textContent="History could not be loaded.";
    return;
  }
  reviewHistory=Array.isArray(data)?data:[];
  historyCurrentPage=1;
  renderReviewHistory();
}



function esc(v) {
  return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function label(v){return LABELS[v] || String(v).replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());}
function fmt(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function dateFmt(v) {
    if (!v) return "—";
    const date = new Date(v);
    if (Number.isNaN(date.getTime())) return String(v);
    const dateText = new Intl.DateTimeFormat("en-GB", {
        day:"2-digit", month:"short", year:"numeric", timeZone:"Asia/Manila"
    }).format(date);
    const timeText = new Intl.DateTimeFormat("en-US", {
        hour:"2-digit", minute:"2-digit", hour12:true, timeZone:"Asia/Manila"
    }).format(date).toUpperCase();
    return `${dateText}, ${timeText} PHT`;
}
function manilaDateTimeInputToISO(value) {
  if (!value) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function localDateTime(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"Asia/Manila", year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", hourCycle:"h23"
  }).formatToParts(d).reduce((acc,p) => (acc[p.type]=p.value,acc), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
function showNotice(message, error=false) {
  const el=$("notice"); el.textContent=message; el.classList.toggle("error",error); el.hidden=false;
  window.scrollTo({top:0,behavior:"smooth"});
  window.setTimeout(()=>{if(el.textContent===message) el.hidden=true;},6500);
}
function statusPill(status){return `<span class="ae-status ${esc(String(status||"").toLowerCase())}">${esc(status||"PENDING")}</span>`;}
function recordTitle(r, table) {
  return r.task_name || r.team_name || r.category || r.event_type || `${label(table)} · ${String(r.id||"").slice(0,8)}`;
}
function recordDate(r) {
  return r.started_at || r.event_time || r.created_at || r.startedAt || r.finished_at || null;
}
function recordSummary(r, table) {
  const bits=[];
  if(r.category) bits.push(r.category);
  if(r.task_name) bits.push(r.task_name);
  if(r.status) bits.push(r.status);
  if(r.duration_seconds != null) bits.push(`${r.duration_seconds}s`);
  if(r.total_seconds != null) bits.push(`${r.total_seconds}s`);
  if(recordDate(r)) bits.push(dateFmt(recordDate(r)));
  bits.push(`ID ${String(r.id||"").slice(0,8)}`);
  return bits.join(" · ");
}
async function getRows(table, page, pageSize, search="") {
  const {data,error}=await supabase.rpc("get_my_analyst_editable_records_page",{
    p_table:table,
    p_page:page,
    p_page_size:pageSize,
    p_search:search.trim()||null,
    p_from_date:$("recordFromDate").value||null,
    p_to_date:$("recordToDate").value||null,
    p_sort:$("recordSort").value||"newest"
  });
  if(error) throw error;
  return {
    records:Array.isArray(data?.records)?data.records:[],
    totalCount:Number(data?.total_count||0)
  };
}
async function loadRecords() {
  const table=$("recordType").value;
  const pageSize=Number($("recordsPageSize").value||20);
  $("recordsList").innerHTML=`<div class="ae-loading">Loading page ${analystRecordsPage} of your records…</div>`;
  $("recordsPagination").hidden=true;
  try {
    const result=await getRows(table,analystRecordsPage,pageSize,$("recordSearch").value);
    records=result.records;
    filteredRecords=records;
    analystRecordsTotal=result.totalCount;
    renderRecords();
  } catch(e) {
    records=[]; filteredRecords=[]; analystRecordsTotal=0;
    $("recordsList").innerHTML=`<div class="ae-empty">${esc(e.message||"Unable to load records.")}</div>`;
  }
}
function renderRecords() {
  const box=$("recordsList");
  const pagination=$("recordsPagination");
  const pageSize=Number($("recordsPageSize").value||20);
  const totalPages=Math.max(1,Math.ceil(analystRecordsTotal/pageSize));
  analystRecordsPage=Math.min(Math.max(1,analystRecordsPage),totalPages);
  const start=(analystRecordsPage-1)*pageSize;
  if(!records.length){
    box.innerHTML=`<div class="ae-empty">No records match these filters. Try a different date range or search term.</div>`;
    pagination.hidden=analystRecordsTotal===0;
    $("recordsPageSummary").textContent="Showing 0 records";
    $("recordsPageInfo").textContent=`Page ${analystRecordsPage} of ${totalPages}`;
    $("recordsPrevPage").disabled=analystRecordsPage<=1;
    $("recordsNextPage").disabled=analystRecordsPage>=totalPages;
    return;
  }
  const table=$("recordType").value;
  box.innerHTML=records.map((r,i)=>`
    <article class="ae-record">
      <div><h3>${esc(recordTitle(r,table))}</h3><div class="ae-record-meta">${esc(recordSummary(r,table))}</div></div>
      <div class="ae-record-actions">
        <button class="ae-button" type="button" data-record-action="edit" data-index="${i}">Request edit</button>
        <button class="ae-button ae-button-danger" type="button" data-record-action="delete" data-index="${i}">Request deletion</button>
      </div>
    </article>`).join("");
  pagination.hidden=false;
  $("recordsPageSummary").textContent=`Showing ${start+1}–${Math.min(start+records.length,analystRecordsTotal)} of ${analystRecordsTotal} matching records`;
  $("recordsPageInfo").textContent=`Page ${analystRecordsPage} of ${totalPages}`;
  $("recordsPrevPage").disabled=analystRecordsPage<=1;
  $("recordsNextPage").disabled=analystRecordsPage>=totalPages;
}
function openModal(id){const el=$(id);el.classList.add("visible");el.setAttribute("aria-hidden","false");}
function closeModals(){document.querySelectorAll(".ae-modal").forEach(el=>{el.classList.remove("visible");el.setAttribute("aria-hidden","true");});}
function createField(key,value) {
  const isDate=/(?:_at|_time)$/.test(key);
  const isNumber=/(?:seconds|count|member_count)$/.test(key);
  const type=isDate?"datetime-local":isNumber?"number":"text";
  const val=isDate?localDateTime(value):value??"";
  return `<label class="ae-field">${esc(label(key))}<input data-edit-field="${esc(key)}" type="${type}" ${isNumber?'step="1" min="0"':""} value="${esc(val)}" ${key==="team_id"?'placeholder="UUID"':""}></label>`;
}
function openEdit(record, action) {
  selectedRecord=record;
  const table=$("recordType").value;
  const isDelete=action==="DELETE";
  $("editModalTitle").textContent=isDelete?"Request record deletion":"Request a record edit";
  $("editFields").innerHTML=isDelete
    ? `<div class="ae-warning">This will not delete the record immediately. An Admin must approve the request. If approved, dependent activity rows may also be removed according to the database relationships; their snapshots will be retained with the request.</div>`
    : TABLES[table].map(key=>createField(key,record[key])).join("");
  $("analystJustification").value="";
  $("submitEditRequest").dataset.action=action;
  $("submitEditRequest").dataset.table=table;
  $("submitEditRequest").disabled=false;
  openModal("editModal");
}
async function submitEdit() {
  const button=$("submitEditRequest");
  const justification=$("analystJustification").value.trim();
  if(justification.length<5){showNotice("Please provide a justification of at least 5 characters.",true);return;}
  const action=button.dataset.action;
  const table=button.dataset.table;
  const changes={};
  if(action==="UPDATE") {
    document.querySelectorAll("[data-edit-field]").forEach(input=>{
      const key=input.dataset.editField;
      let value=input.value;
      if(input.type==="number") value=value===""?null:Number(value);
      else if(input.type==="datetime-local") value=manilaDateTimeInputToISO(value);
      changes[key]=value;
    });
    if(!Object.keys(changes).length){showNotice("No editable fields were provided.",true);return;}
  }
  button.disabled=true; button.textContent="Submitting…";
  const {data,error}=await supabase.rpc("submit_analyst_edit_request",{
    p_target_table:table,
    p_target_record_id:String(selectedRecord.id),
    p_action:action,
    p_proposed_changes:changes,
    p_justification:justification
  });
  button.disabled=false; button.textContent="Submit request";
  if(error){showNotice(error.message||"Unable to submit the request.",true);return;}
  closeModals();
  showNotice(`Your ${action==="DELETE"?"deletion":"edit"} request was submitted. Official records remain unchanged until an Admin approves it.`);
  await loadMyRequests();
}
async function loadMyRequests() {
  const box=$("myRequests"); box.innerHTML=`<div class="ae-loading">Loading requests…</div>`;
  $("requestsPagination").hidden=true;
  const {data,error}=await supabase.rpc("get_my_analyst_edit_requests");
  if(error){box.innerHTML=`<div class="ae-empty">${esc(error.message)}</div>`;return;}
  requests=Array.isArray(data)?data:[];
  analystRequestsPage=1;
  renderMyRequests();
}
function renderMyRequests() {
  const box=$("myRequests");
  const pagination=$("requestsPagination");
  if(!requests.length){
    box.innerHTML=`<div class="ae-empty">You haven't submitted any edit or deletion requests yet.</div>`;
    pagination.hidden=true;
    return;
  }
  const pageSize=Number($("requestsPageSize").value||20);
  const totalPages=Math.max(1,Math.ceil(requests.length/pageSize));
  analystRequestsPage=Math.min(Math.max(1,analystRequestsPage),totalPages);
  const start=(analystRequestsPage-1)*pageSize;
  const pageRows=requests.slice(start,start+pageSize);
  box.innerHTML=pageRows.map(r=>{
    const changed=Object.keys(r.proposed_changes||{});
    const action=r.action==="DELETE"?"Deletion":"Edit";
    const details=r.action==="DELETE"?"Request to delete this record":changed.map(k=>`${label(k)}: ${fmt(r.original_data?.[k])} → ${fmt(r.proposed_changes?.[k])}`).join(" · ");
    return `<article class="ae-request">
      <div class="ae-request-top"><div><h3>${esc(action)} · ${esc(label(r.target_table))} · ${esc(String(r.target_record_id).slice(0,8))}</h3><div class="ae-record-meta">Submitted ${esc(dateFmt(r.created_at))}</div></div>${statusPill(r.status)}</div>
      <div class="ae-record-meta">${esc(details||"No field changes listed.")}</div>
      <div><strong class="ae-kicker">YOUR JUSTIFICATION</strong><div class="ae-reason">${esc(r.analyst_justification)}</div></div>
      ${r.reviewer_justification?`<div><strong class="ae-kicker">ADMIN REVIEW</strong><div class="ae-reason">${esc(r.reviewer_justification)}</div></div>`:""}
    </article>`;
  }).join("");
  pagination.hidden=false;
  $("requestsPageSummary").textContent=`Showing ${start+1}–${Math.min(start+pageRows.length,requests.length)} of ${requests.length} requests`;
  $("requestsPageInfo").textContent=`Page ${analystRequestsPage} of ${totalPages}`;
  $("requestsPrevPage").disabled=analystRequestsPage<=1;
  $("requestsNextPage").disabled=analystRequestsPage>=totalPages;
}
function formatReviewField(key, value) {
  if (value === null || value === undefined || value === "") return "—";
  if (/_at$|_date$|^date$/i.test(key)) return dateFmt(value);
  if (/(duration|seconds)$/i.test(key) && Number.isFinite(Number(value))) return formatDuration(value);
  return fmt(value);
}
function changedFields(r) {
  const keys=Object.keys(r.proposed_changes||{});
  if(r.action==="DELETE") return `<div class="ae-warning">Deletion request. Approval will delete the selected record and may cascade to its related activity rows. Captured related-row snapshots are retained in this request.</div>`;
  if(!keys.length) return `<div class="ae-empty">No proposed field changes.</div>`;
  return `<table class="ae-compare"><thead><tr><th>Field</th><th>Original value</th><th>Proposed value</th></tr></thead><tbody>${keys.map(k=>`<tr><th>${esc(label(k))}</th><td>${esc(formatReviewField(k,r.original_data?.[k]))}</td><td><strong>${esc(formatReviewField(k,r.proposed_changes?.[k]))}</strong></td></tr>`).join("")}</tbody></table>`;
}
function openReview(r) {
  selectedRequest=r;
  const snapshot=r.original_data||{};
  const isDelete=r.action==="DELETE";
  $("reviewDetails").innerHTML=`
    <section class="ae-detail-section">
      <div class="ae-detail-heading"><div><span class="ae-kicker">REQUEST INFORMATION</span><h3>${esc(r.requester_name||"Analyst")}</h3></div><span class="ae-status-pill">PENDING REVIEW</span></div>
      ${renderDetailGrid(requestSummaryItems(r))}
    </section>
    ${isDelete?`<div class="ae-warning ae-detail-impact"><strong>Deletion impact</strong><p>Approval will delete the selected record. Related rows may also be affected according to the database relationships. Review the original snapshot and related-row information before approving.</p><p><strong>Audit:</strong> The request's captured snapshot is retained with the request.</p></div>`:""}
    ${!isDelete?`<section class="ae-detail-section"><h4>Proposed changes</h4>${changedFields(r)}</section>`:""}
    ${renderRecordSnapshot(snapshot,"Original record snapshot")}
    <section class="ae-detail-section"><h4>Analyst justification</h4><div class="ae-reason">${esc(r.analyst_justification||"No justification provided.")}</div></section>
    <section class="ae-detail-section"><h4>Admin review checklist</h4><ul class="ae-review-checklist"><li>Confirm the record belongs to the requesting analyst.</li><li>Check the original values against the requested action.</li><li>For edits, verify every proposed value.</li><li>For deletions, consider the impact on related activity and reporting data.</li></ul></section>`;
  $("reviewJustification").value="";
  openModal("reviewModal");
}
async function loadPending() {
  const box=$("pendingRequests");box.innerHTML=`<div class="ae-loading">Loading pending requests…</div>`;
  const {data,error}=await supabase.rpc("get_pending_analyst_edit_requests");
  if(error){box.innerHTML=`<div class="ae-empty">${esc(error.message)}</div>`;$("pendingCount").textContent="Unavailable";return;}
  pendingRequests=Array.isArray(data)?data:[];
  $("pendingCount").textContent=`${pendingRequests.length} pending`;
  if(!pendingRequests.length){box.innerHTML=`<div class="ae-empty">There are no pending analyst edit requests.</div>`;return;}
  box.innerHTML=pendingRequests.map((r,i)=>`
    <article class="ae-request">
      <div class="ae-request-top"><div><h3>${esc(r.requester_name||"Analyst")} · ${esc(r.action)} · ${esc(label(r.target_table))}</h3><div class="ae-record-meta">Record ${esc(String(r.target_record_id).slice(0,12))} · ${esc(dateFmt(r.created_at))}</div></div>${statusPill("PENDING")}</div>
      <div class="ae-record-meta">${esc(r.action==="DELETE"?"Deletion requested":Object.keys(r.proposed_changes||{}).map(k=>label(k)).join(", "))}</div>
      <button type="button" class="ae-button" data-review-index="${i}">Review request</button>
    </article>`).join("");
}
async function decideRequest(decision) {
  if(!selectedRequest)return;
  const reason=$("reviewJustification").value.trim();
  if(reason.length<5){showNotice("Please provide an Admin justification of at least 5 characters.",true);return;}
  const approve=$("approveRequest"), reject=$("rejectRequest");
  approve.disabled=reject.disabled=true;
  const {data,error}=await supabase.rpc("review_analyst_edit_request",{
    p_request_id:selectedRequest.id,
    p_decision:decision,
    p_reviewer_justification:reason
  });
  approve.disabled=reject.disabled=false;
  if(error){showNotice(error.message||"Unable to review this request.",true);return;}
  closeModals();
  showNotice(decision==="APPROVED"?"Request approved and the official record has been updated.":"Request rejected. The original record remains unchanged.");
  await loadPending();
}
async function refreshAll() {
  if(currentRole==="ADMIN") {
    const activeTab=document.querySelector(".ae-admin-tab.active")?.dataset.adminTab||"edits";
    if(activeTab==="edits") await loadPending();
    if(activeTab==="manual") await loadManualRequests();
    if(activeTab==="history") await loadReviewHistory();
  } else {await loadRecords();await loadMyRequests();}
}
async function initialize() {
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user){window.location.href="../index.html";return;}
  currentUser=user;
  const {data:profile,error:profileError}=await supabase.from("profiles").select("role,status").eq("id",user.id).maybeSingle();
  if(profileError){showNotice(profileError.message,true);return;}
  currentRole=String(profile?.role||"ANALYST").toUpperCase();
  const reportsNavItem = $("reportsNavItem");
  if (reportsNavItem) {
    const isAdmin = currentRole === "ADMIN";
    reportsNavItem.style.display = isAdmin ? "flex" : "none";
    reportsNavItem.setAttribute("aria-hidden", String(!isAdmin));
    if (isAdmin) {
      reportsNavItem.removeAttribute("tabindex");
    } else {
      reportsNavItem.setAttribute("tabindex", "-1");
    }
  }
  if(String(profile?.status||"ACTIVE").toUpperCase()!=="ACTIVE"){showNotice("Your account is not active.",true);return;}
  $("analystArea").hidden=currentRole==="ADMIN";
  $("adminArea").hidden=currentRole!=="ADMIN";
  if(currentRole==="ADMIN"){
    $("pageHeading").textContent="Record Corrections & Approvals";
    $("pageIntro").textContent="Review analyst edits, manual time submissions, and your team's decision history.";
    await loadPending();
  } else {
    await loadRecords();await loadMyRequests();
  }
}
$("loadRecordsButton").addEventListener("click",loadRecords);
$("recordType").addEventListener("change",loadRecords);
$("recordsPageSize").addEventListener("change",()=>{analystRecordsPage=1;loadRecords();});
$("recordsPrevPage").addEventListener("click",()=>{if(analystRecordsPage>1){analystRecordsPage--;loadRecords();}});
$("recordsNextPage").addEventListener("click",()=>{const pages=Math.max(1,Math.ceil(analystRecordsTotal/Number($("recordsPageSize").value||20)));if(analystRecordsPage<pages){analystRecordsPage++;loadRecords();}});
$("requestsPageSize").addEventListener("change",()=>{analystRequestsPage=1;renderMyRequests();});
$("requestsPrevPage").addEventListener("click",()=>{analystRequestsPage--;renderMyRequests();});
$("requestsNextPage").addEventListener("click",()=>{analystRequestsPage++;renderMyRequests();});
$("recordSearch").addEventListener("keydown",e=>{if(e.key==="Enter")loadRecords();});
$("recordFromDate").addEventListener("change",()=>{analystRecordsPage=1;loadRecords();});
$("recordToDate").addEventListener("change",()=>{analystRecordsPage=1;loadRecords();});
$("recordSort").addEventListener("change",()=>{analystRecordsPage=1;loadRecords();});
$("clearRecordFilters").addEventListener("click",()=>{
  $("recordSearch").value="";
  $("recordFromDate").value="";
  $("recordToDate").value="";
  $("recordSort").value="newest";
  analystRecordsPage=1;
  loadRecords();
});
$("recordsList").addEventListener("click",e=>{
  const btn=e.target.closest("[data-record-action]");if(!btn)return;
  const record=records[Number(btn.dataset.index)];if(record)openEdit(record,btn.dataset.recordAction==="delete"?"DELETE":"UPDATE");
});
$("submitEditRequest").addEventListener("click",submitEdit);
$("pendingRequests").addEventListener("click",e=>{
  const btn=e.target.closest("[data-review-index]");if(!btn)return;
  const req=pendingRequests[Number(btn.dataset.reviewIndex)];if(req)openReview(req);
});
$("approveRequest").addEventListener("click",()=>decideRequest("APPROVED"));
$("rejectRequest").addEventListener("click",()=>decideRequest("REJECTED"));
$("refreshButton").addEventListener("click",refreshAll);
document.querySelectorAll("[data-admin-tab]").forEach(button=>{
  button.addEventListener("click",()=>setAdminTab(button.dataset.adminTab));
});
$("manualRequestsList").addEventListener("click",e=>{
  const button=e.target.closest("[data-manual-review]");
  if(!button)return;
  const request=manualRequests[Number(button.dataset.manualReview)];
  if(request)openManualReview(request,button.dataset.decision);
});
$("manualApproveRequest").addEventListener("click",()=>decideManualRequest("APPROVED"));
$("manualRejectRequest").addEventListener("click",()=>decideManualRequest("REJECTED"));
$("refreshManualRequests").addEventListener("click",loadManualRequests);
$("refreshReviewHistory").addEventListener("click",loadReviewHistory);
$("historyTypeFilter").addEventListener("change",()=>{historyCurrentPage=1;renderReviewHistory();});
$("historyStatusFilter").addEventListener("change",()=>{historyCurrentPage=1;renderReviewHistory();});
$("historySearch").addEventListener("input",()=>{historyCurrentPage=1;renderReviewHistory();});
$("historyPageSize").addEventListener("change",()=>{historyCurrentPage=1;renderReviewHistory();});
$("historyPrevPage").addEventListener("click",()=>{historyCurrentPage--;renderReviewHistory();});
$("historyNextPage").addEventListener("click",()=>{historyCurrentPage++;renderReviewHistory();});
$("analystTabRecords").addEventListener("click",()=>setAnalystTab("records"));
$("analystTabRequests").addEventListener("click",()=>setAnalystTab("requests"));
document.querySelectorAll("[data-close-modal]").forEach(btn=>btn.addEventListener("click",closeModals));
document.querySelectorAll(".ae-modal").forEach(modal=>modal.addEventListener("click",e=>{if(e.target===modal)closeModals();}));
initialize();
