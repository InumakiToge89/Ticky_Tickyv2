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

document.addEventListener(
    "DOMContentLoaded",
    () => {
        initializeAccountMenu();
        initializeGlobalNotifications();
    }
);

function getInitials(name) {
    return String(name || "User")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || "")
        .join("") || "U";
}

function createAvatarImage(url) {
    const image = document.createElement("img");
    image.src = url;
    image.alt = "Profile picture";
    image.className = "global-user-avatar-image";
    return image;
}

async function initializeAccountMenu() {
    const profileElement = document.querySelector(
        ".user-section, .user-profile"
    );

    if (!profileElement || profileElement.dataset.accountMenuInitialized === "true") {
        return;
    }

    profileElement.dataset.accountMenuInitialized = "true";

    const avatar = profileElement.querySelector("#userAvatar");
    if (!avatar) return;

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return;

    const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

    const fullName = profileData?.full_name || "User";
    const role = profileData?.role || "USER";
    const initials = getInitials(fullName);

    const { data: publicData } = supabase
        .storage
        .from("Avatars")
        .getPublicUrl(`${user.id}`);

    const profileImage = publicData?.publicUrl
        ? `${publicData.publicUrl}?t=${Date.now()}`
        : null;

    // Remove any old/static hover cards so every page uses one safe card.
    document.getElementById("userHoverCard")?.remove();
    document.querySelectorAll(".global-account-card").forEach(card => card.remove());

    const card = createHoverCard(fullName, role, initials, profileElement);

    initializeDeveloperNavigation(fullName, role);
    initializeAnalystDeveloperRequest(fullName, role);

    function setAvatar(target, imageUrl) {
        target.replaceChildren();

        if (!imageUrl) {
            target.textContent = initials;
            return;
        }

        const image = createAvatarImage(imageUrl);
        image.onerror = () => {
            target.replaceChildren(document.createTextNode(initials));
        };
        target.appendChild(image);
    }

    // Use the same image source for the top avatar and hover card.
    if (profileImage) {
        setAvatar(avatar, profileImage);
        setAvatar(card.avatar, profileImage);
    } else {
        setAvatar(avatar, null);
        setAvatar(card.avatar, null);
    }

    profileElement.style.cursor = "pointer";
    profileElement.setAttribute("title", "Account Management");

    profileElement.addEventListener("click", () => {
        window.location.href = new URL(
            "account.html",
            window.location.href
        ).href;
    });

    let hideTimer;

    function showCard() {
        clearTimeout(hideTimer);
        positionCard();
        card.element.classList.add("visible");
    }

    function hideCardSoon() {
        hideTimer = setTimeout(() => {
            card.classList.remove("visible");
        }, 150);
    }

    function positionCard() {
        const rect = profileElement.getBoundingClientRect();
        const cardWidth = card.element.offsetWidth || 280;
        const left = Math.max(
            12,
            Math.min(rect.right - cardWidth, window.innerWidth - cardWidth - 12)
        );

        card.element.style.top = `${rect.bottom + 8}px`;
        card.element.style.left = `${left}px`;
    }

    profileElement.addEventListener("mouseenter", showCard);
    profileElement.addEventListener("mouseleave", hideCardSoon);
    profileElement.addEventListener("focusin", showCard);
    profileElement.addEventListener("focusout", hideCardSoon);

    card.element.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    card.element.addEventListener("mouseleave", hideCardSoon);
    window.addEventListener("resize", positionCard);
}

function createHoverCard(fullName, role, initials, profileElement) {
    const card = document.createElement("div");
    card.className = "global-account-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Account summary");

    const header = document.createElement("div");
    header.className = "global-account-header";

    const avatar = document.createElement("div");
    avatar.className = "global-account-avatar";
    avatar.textContent = initials;

    const info = document.createElement("div");
    info.className = "global-account-info";

    const name = document.createElement("div");
    name.className = "global-account-name";
    name.textContent = fullName;

    const roleElement = document.createElement("div");
    roleElement.className = "global-account-role";
    roleElement.textContent = role;

    info.append(name, roleElement);
    header.append(avatar, info);

    const divider = document.createElement("div");
    divider.className = "global-account-divider";

    const manage = document.createElement("a");
    manage.className = "global-account-manage";
    manage.href = new URL("account.html", window.location.href).href;
    manage.textContent = "Manage Account →";

    card.append(header, divider, manage);

    if (String(role).trim().toUpperCase() === "ANALYST") {
        const requestChange = document.createElement("button");
        requestChange.type = "button";
        requestChange.className = "global-developer-request";
        requestChange.textContent = "Request Edit / Delete";
        requestChange.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            card.classList.remove("visible");
            window.openDeveloperRequestModal?.();
        });
        card.appendChild(requestChange);
    }

    // Intentionally no account ID, UUID, email, token, or other sensitive value.
    document.body.appendChild(card);

    return { element: card, avatar, profileElement };
}


// =========================================================
// DEVELOPER CONSOLE ACCESS / ANALYST REQUESTS
// =========================================================

const DEV_REQUEST_TARGETS = [
    ["profiles", "Profiles / Account"],
    ["teams", "Teams"],
    ["profiling_jobs", "Profiling Jobs"],
    ["timer_sessions", "Timer Sessions"],
    ["timer_events", "Timer Events"],
    ["task_logs", "Work Activity Logs"],
    ["task_activity_events", "Work Activity Events"],
    ["manual_time_requests", "Manual Time Requests"],
    ["app_notifications", "Notifications"]
];

function getDeveloperPageUrl(fileName) {
    return new URL(fileName, window.location.href).href;
}

function initializeDeveloperNavigation(fullName, role) {
    const navigation = document.querySelector(".sidebar-navigation");
    if (!navigation) return;

    document.getElementById("developerConsoleNavItem")?.remove();

    const normalizedName = String(fullName || "").trim().toUpperCase();
    const normalizedRole = String(role || "").trim().toUpperCase();

    // The visible menu is intentionally conservative. The actual page and
    // database operations are protected again by the is_dev_owner() RPC.
    if (normalizedName !== "IVEE" || normalizedRole !== "ADMIN") return;

    const item = document.createElement("a");
    item.id = "developerConsoleNavItem";
    item.className = "nav-item";
    item.href = getDeveloperPageUrl("dev.html");
    item.innerHTML = `
        <span class="nav-icon">⚙</span>
        <span>Developer</span>
    `;

    if (window.location.pathname.toLowerCase().includes("/dev.html")) {
        item.classList.add("active");
    }

    navigation.appendChild(item);
}

function initializeAnalystDeveloperRequest(fullName, role) {
    if (String(role || "").trim().toUpperCase() !== "ANALYST") return;
    if (document.getElementById("globalDeveloperRequestLauncher")) return;

    const topbar = document.querySelector(".topbar");
    if (!topbar) return;

    const launcher = document.createElement("button");
    launcher.id = "globalDeveloperRequestLauncher";
    launcher.type = "button";
    launcher.className = "global-developer-request-launcher";
    launcher.title = "Request an edit or delete from the developer";
    launcher.textContent = "Request Change";
    launcher.addEventListener("click", () => window.openDeveloperRequestModal?.());

    const notificationWrap = document.getElementById("globalNotificationWrap");
    if (notificationWrap) {
        // Keep the analyst actions together on the right side of the topbar.
        notificationWrap.insertAdjacentElement("afterend", launcher);

        const requestsButton = document.createElement("a");
        requestsButton.id = "globalMyDeveloperRequests";
        requestsButton.className = "global-my-developer-requests";
        requestsButton.href = new URL("request-history.html", window.location.href).href;
        requestsButton.title = "View your developer requests";
        requestsButton.innerHTML = `<span aria-hidden="true">◌</span><span>My Requests</span>`;
        launcher.insertAdjacentElement("afterend", requestsButton);
    } else {
        topbar.appendChild(launcher);

        const requestsButton = document.createElement("a");
        requestsButton.id = "globalMyDeveloperRequests";
        requestsButton.className = "global-my-developer-requests";
        requestsButton.href = new URL("request-history.html", window.location.href).href;
        requestsButton.innerHTML = `<span aria-hidden="true">◌</span><span>My Requests</span>`;
        launcher.insertAdjacentElement("afterend", requestsButton);
    }

    // On the active Profiling Timer, give the analyst a direct way to request
    // a correction to the member count of the profiling job they are currently
    // working on. This does not change the count directly; it creates the same
    // protected request that Ivee reviews in the Developer Console.
    initializeTimerMemberCountRequest();
}

function initializeTimerMemberCountRequest() {
    const path = window.location.pathname.toLowerCase();
    if (!path.includes("timer.html")) return;
    if (document.getElementById("timerMemberCountRequestButton")) return;

    const memberCountElement = document.getElementById("memberCount");
    if (!memberCountElement) return;

    const infoCard = memberCountElement.closest(".timer-info-card");
    if (!infoCard) return;

    const button = document.createElement("button");
    button.id = "timerMemberCountRequestButton";
    button.type = "button";
    button.className = "timer-member-count-request";
    button.textContent = "Request Member Count Change";
    button.title = "Ask Ivee to correct the member count for this profiling job";

    const valueRow = document.createElement("div");
    valueRow.className = "timer-member-count-value-row";
    memberCountElement.parentNode.insertBefore(valueRow, memberCountElement);
    valueRow.appendChild(memberCountElement);
    valueRow.appendChild(button);

    button.addEventListener("click", () => {
        window.openDeveloperRequestModal?.();

        const modal = document.getElementById("globalDeveloperRequestModal");
        if (!modal) return;

        const area = modal.querySelector("select[name='target_table']");
        if (area) {
            area.value = "profiling_jobs";
            area.dispatchEvent(new Event("change"));
        }

        const action = modal.querySelector("select[name='action']");
        if (action) action.value = "UPDATE";

        const reference = modal.querySelector("input[name='target_record_reference']");
        const teamId = document.getElementById("teamId")?.textContent?.replace(/^Team ID:\s*/i, "").trim() || "";
        if (reference && teamId) reference.value = `Team ID ${teamId}`;

        const change = modal.querySelector("textarea[name='requested_change']");
        const currentCount = memberCountElement.textContent?.trim() || "current member count";
        if (change) {
            change.value = `Please change the member count from ${currentCount} to `;
            change.focus();
        }

        const reason = modal.querySelector("textarea[name='reason']");
        if (reason && !reason.value) {
            reason.value = "Member count correction while profiling this team.";
        }
    });
}

function detectDeveloperRequestTarget() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("teams")) return "teams";
    if (path.includes("timer")) return "timer_sessions";
    if (path.includes("profiling")) return "profiling_jobs";
    if (path.includes("work-timer")) return "task_logs";
    if (path.includes("history")) return "profiling_jobs";
    if (path.includes("reports")) return "task_logs";
    if (path.includes("account")) return "profiles";
    return "teams";
}

// Build a user-friendly list from records that are already visible on the
// current page. Analysts should never have to know or copy a UUID. The
// actual UUID is kept as the option value and submitted securely to Supabase.
function getVisibleDeveloperRequestRecords(table) {
    const records = [];

    const addRecord = (id, label, detail = "") => {
        const cleanId = String(id || "").trim();
        if (!cleanId) return;
        const key = `${table}:${cleanId}`;
        if (records.some(item => item.key === key)) return;
        records.push({
            key,
            id: cleanId,
            label: String(label || "Record").trim() || "Record",
            detail: String(detail || "").trim()
        });
    };

    // Teams page: the UUID is attached to the row controls, while the analyst
    // sees the Team ID and Team Name in the table.
    if (table === "teams") {
        document.querySelectorAll(".team-select-checkbox[data-id]").forEach(input => {
            const row = input.closest("tr");
            const cells = row ? Array.from(row.querySelectorAll("td")) : [];
            const visible = cells.map(cell => cell.innerText.trim()).filter(Boolean);
            addRecord(
                input.dataset.id,
                visible[1] || "Team",
                visible[2] ? `Team: ${visible[1] || "—"} • ${visible[2]}` : ""
            );
        });
    }

    // Profiling and History pages: each visible row/card exposes its hidden
    // profiling job UUID, while Team ID is displayed to the analyst.
    // Profiling Timer page: expose the active timer session internally while
    // showing only the session type/status to the analyst.
    if (table === "timer_sessions") {
        const timerPath = window.location.pathname.toLowerCase();
        const activeTimerSessionId = window.__tickyActiveTimerSessionId || sessionStorage.getItem("activeProfilingSessionId");
        const activeType = document.getElementById("sessionType")?.textContent?.trim() || sessionStorage.getItem("activeProfilingType") || "Current Session";
        const teamName = document.getElementById("teamName")?.textContent?.trim() || "Current Profiling";
        if (timerPath.includes("timer.html") && activeTimerSessionId) {
            addRecord(
                activeTimerSessionId,
                `${activeType} session`,
                `${teamName} • Current profiling session`
            );
        }
    }

    if (table === "profiling_jobs") {
        // The timer page does not render a normal profiling-job row. Its active
        // job UUID is kept in sessionStorage after the analyst opens/resumes it.
        // Expose that UUID internally to the request form while showing only
        // the Team ID/name/member count to the analyst.
        const timerPath = window.location.pathname.toLowerCase();
        const activeTimerJobId = sessionStorage.getItem("activeProfilingJobId");
        if (timerPath.includes("timer.html") && activeTimerJobId) {
            const teamIdText = document.getElementById("teamId")?.textContent || "";
            const teamId = teamIdText.replace(/^Team ID:\s*/i, "").trim();
            const teamName = document.getElementById("teamName")?.textContent?.trim() || "Current Profiling Job";
            const memberCount = document.getElementById("memberCount")?.textContent?.trim() || "";
            addRecord(
                activeTimerJobId,
                teamId ? `Team ${teamId}` : teamName,
                `${teamName}${memberCount ? ` • ${memberCount} members` : ""} • Current profiling job`
            );
        }

        document.querySelectorAll("[data-job-id]").forEach(element => {
            const id = element.dataset.jobId;
            const text = element.innerText.replace(/\s+/g, " ").trim();
            const teamMatch = text.match(/Team ID\s*:\s*([^•|]+)/i);
            const teamId = teamMatch ? teamMatch[1].trim() : "";
            const name = element.querySelector(".team-name, .pending-profiling-name")?.innerText?.trim() || "Profiling Job";
            addRecord(id, teamId ? `Team ${teamId}` : name, name);
        });
    }

    // Work Activity records: History rows expose the internal task-log ID
    // through data-task-log-id. Reports/work-activity cards may use the older
    // data-work-activity-id hook, so support both without exposing UUIDs.
    if (table === "task_logs") {
        document.querySelectorAll(".work-activity-row[data-task-log-id], [data-work-activity-id]").forEach(element => {
            const id = element.dataset.taskLogId || element.dataset.workActivityId;
            if (!id) return;
            const text = element.innerText.replace(/\s+/g, " ").trim();
            const title =
                element.querySelector(".task-name, .work-activity-name, [data-task-name]")?.innerText?.trim() ||
                (element.matches(".work-activity-row") ? text.split(/\s{2,}/)[1] || text.slice(0, 90) : text.slice(0, 90)) ||
                "Work Activity";
            addRecord(id, title, "Visible work activity record");
        });
    }

    // Manual time requests in Reports.
    if (table === "manual_time_requests") {
        document.querySelectorAll("[data-request-id]").forEach(element => {
            const id = element.dataset.requestId;
            const text = element.innerText.replace(/\s+/g, " ").trim();
            addRecord(id, text.slice(0, 90) || "Manual Time Request", "Visible request on this page");
        });
    }

    return records;
}

function renderDeveloperRequestRecordPicker(table) {
    const records = getVisibleDeveloperRequestRecords(table);
    if (!records.length) {
        return `
            <div class="global-developer-request-no-records">
                No selectable records are visible for this area on the current page. You can still enter a visible ID/reference below.
            </div>
        `;
    }

    return `
        <select name="visible_record_id" aria-label="Record on this page">
            <option value="">Choose a record from this page…</option>
            ${records.map(record => `
                <option value="${escapeAttribute(record.id)}">
                    ${escapeHtml(record.label)}${record.detail ? ` — ${escapeHtml(record.detail)}` : ""}
                </option>
            `).join("")}
        </select>
        <small class="global-developer-request-help">Select the row you mean. The system sends its internal record ID to Ivee automatically.</small>
    `;
}

function refreshDeveloperRequestRecordPicker(table, modal) {
    const container = modal.querySelector("[data-dev-record-picker]");
    if (!container) return;
    container.innerHTML = renderDeveloperRequestRecordPicker(table);
}

function openDeveloperRequestModal() {
    document.getElementById("globalDeveloperRequestModal")?.remove();

    const modal = document.createElement("div");
    modal.id = "globalDeveloperRequestModal";
    modal.className = "global-developer-request-modal";
    modal.innerHTML = `
        <div class="global-developer-request-dialog" role="dialog" aria-modal="true" aria-labelledby="globalDeveloperRequestTitle">
            <div class="global-developer-request-header">
                <div>
                    <span class="global-developer-request-eyebrow">DEVELOPER SUPPORT</span>
                    <h2 id="globalDeveloperRequestTitle">Request an Edit or Delete</h2>
                    <p>Send the request to Ivee without changing the database yourself.</p>
                </div>
                <button type="button" class="global-developer-request-close" data-dev-request-close>×</button>
            </div>

            <form id="globalDeveloperRequestForm" class="global-developer-request-form">
                <div class="global-developer-request-grid">
                    <label>
                        <span>Area</span>
                        <select name="target_table" required>
                            ${DEV_REQUEST_TARGETS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
                        </select>
                    </label>
                    <label>
                        <span>Action</span>
                        <select name="action" required>
                            <option value="UPDATE">Edit</option>
                            <option value="DELETE">Delete</option>
                        </select>
                    </label>
                </div>

                <label>
                    <span>Record on this page</span>
                    <div data-dev-record-picker class="global-developer-request-record-picker"></div>
                </label>

                <label>
                    <span>Visible Reference <small>(optional — e.g. Team ID, task name, or other ID you can actually see)</small></span>
                    <input name="target_record_reference" maxlength="200" placeholder="Example: Team ID 65147">
                </label>

                <label>
                    <span>What do you want changed?</span>
                    <textarea name="requested_change" rows="4" maxlength="5000" required placeholder="Describe exactly what should be edited or deleted."></textarea>
                </label>

                <label>
                    <span>Reason / Context</span>
                    <textarea name="reason" rows="3" maxlength="2000" placeholder="Explain why the correction is needed."></textarea>
                </label>

                <div class="global-developer-request-actions">
                    <button type="button" class="global-developer-request-secondary" data-dev-request-close>Cancel</button>
                    <button type="submit" class="global-developer-request-primary">Send Request</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    const tableSelector = modal.querySelector("select[name='target_table']");
    tableSelector.value = detectDeveloperRequestTarget();
    refreshDeveloperRequestRecordPicker(tableSelector.value, modal);
    tableSelector.addEventListener("change", () => {
        refreshDeveloperRequestRecordPicker(tableSelector.value, modal);
    });

    const close = () => modal.remove();
    modal.querySelectorAll("[data-dev-request-close]").forEach(button => button.addEventListener("click", close));
    modal.addEventListener("click", event => {
        if (event.target === modal) close();
    });

    modal.querySelector("form").addEventListener("submit", async event => {
        event.preventDefault();

        const form = event.currentTarget;
        const submitButton = form.querySelector("button[type='submit']");
        const formData = new FormData(form);
        const requestedChange = String(formData.get("requested_change") || "").trim();
        const reason = String(formData.get("reason") || "").trim();
        const selectedRecordId = String(formData.get("visible_record_id") || "").trim();
        const visibleReference = String(formData.get("target_record_reference") || "").trim();
        const recordReference = selectedRecordId || visibleReference;

        if (!requestedChange) {
            alert("Please describe what you want changed.");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Sending…";

        const { error } = await supabase.rpc("submit_dev_change_request", {
            p_target_table: String(formData.get("target_table") || ""),
            p_target_record_id: recordReference,
            p_action: String(formData.get("action") || "UPDATE"),
            p_requested_change: requestedChange,
            p_reason: reason
        });

        if (error) {
            console.error("Developer request submission error:", error);
            submitButton.disabled = false;
            submitButton.textContent = "Send Request";
            alert(error.message || "Unable to submit the request.");
            return;
        }

        close();
        showDeveloperRequestToast("Your request was sent to Ivee.");
    });
}

function showDeveloperRequestToast(message) {
    document.getElementById("globalDeveloperRequestToast")?.remove();
    const toast = document.createElement("div");
    toast.id = "globalDeveloperRequestToast";
    toast.className = "global-developer-request-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("visible"));
    setTimeout(() => {
        toast.classList.remove("visible");
        setTimeout(() => toast.remove(), 200);
    }, 2600);
}

window.openDeveloperRequestModal = openDeveloperRequestModal;


// =========================================================
// =========================================================
// GLOBAL NOTIFICATIONS
// =========================================================

let notificationState = {
    initialized: false,
    items: [],
    unreadCount: 0,
    pollTimer: null,
    openPanel: null
};

async function initializeGlobalNotifications() {

    if (document.getElementById("globalNotificationWrap")) {
        return;
    }

    const topbar = document.querySelector(".topbar");
    if (!topbar) {
        return;
    }

    const wrap = document.createElement("div");
    wrap.id = "globalNotificationWrap";
    wrap.className = "global-notification-wrap";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "global-notification-button";
    button.setAttribute("aria-label", "Open notifications");
    button.setAttribute("title", "Notifications");
    button.innerHTML = `
        <span class="global-notification-icon" aria-hidden="true">🔔</span>
        <span class="global-notification-label">Notifications</span>
        <span class="global-notification-badge" hidden>0</span>
    `;

    const panel = document.createElement("div");
    panel.className = "global-notification-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Notifications");
    panel.innerHTML = `
        <div class="global-notification-header">
            <div>
                <div class="global-notification-kicker">TICKY TICKY</div>
                <h2 class="global-notification-title">Notifications</h2>
            </div>
            <button type="button" class="global-notification-mark-all">Mark all read</button>
        </div>
        <div class="global-notification-list"></div>
    `;

    wrap.appendChild(button);
    document.body.appendChild(panel);

    const badge = button.querySelector(".global-notification-badge");
    const list = panel.querySelector(".global-notification-list");
    const markAll = panel.querySelector(".global-notification-mark-all");

    // Dashboard wraps .user-section inside .user-profile-wrapper. The previous
    // implementation tried to insert before the nested .user-section, which can
    // fail because it is not a direct child of .topbar. Insert before the direct
    // account wrapper instead so the button is present on every page.
    const topbarChildren = Array.from(topbar.children);
    const accountAnchor = topbarChildren.find(child =>
        child.matches(".user-profile-wrapper, .user-section, .user-profile")
    );

    if (accountAnchor) {
        topbar.insertBefore(wrap, accountAnchor);
    } else {
        topbar.appendChild(wrap);
    }

    function positionPanel() {
        const rect = button.getBoundingClientRect();
        const panelWidth = Math.min(430, window.innerWidth - 24);
        const left = Math.max(
            12,
            Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 12)
        );

        panel.style.top = `${rect.bottom + 10}px`;
        panel.style.left = `${left}px`;
    }

    function getNotificationIcon(item) {
        const type = String(item?.type || "").toUpperCase();
        if (type.includes("APPROV")) return "✓";
        if (type.includes("REJECT")) return "×";
        if (type.includes("MANUAL")) return "⏱";
        if (type.includes("SYSTEM")) return "⚙";
        return "•";
    }

    function getNotificationClass(item) {
        const type = String(item?.type || "").toUpperCase();
        if (type.includes("APPROV")) return "success";
        if (type.includes("REJECT")) return "danger";
        if (type.includes("MANUAL")) return "review";
        return "info";
    }

    function renderNotifications(items) {
        const rows = Array.isArray(items) ? items : [];

        if (!rows.length) {
            list.innerHTML = `
                <div class="global-notification-empty">
                    <div class="global-notification-empty-icon">✓</div>
                    <strong>You're all caught up</strong>
                    <span>No new notifications right now.</span>
                </div>
            `;
            return;
        }

        list.innerHTML = rows.map(item => `
            <button
                type="button"
                class="global-notification-item ${item.is_read ? "" : "unread"}"
                data-notification-id="${escapeAttribute(item.id)}"
            >
                <span class="global-notification-item-icon ${getNotificationClass(item)}">
                    ${escapeHtml(getNotificationIcon(item))}
                </span>
                <span class="global-notification-item-content">
                    <span class="global-notification-item-topline">
                        <span class="global-notification-item-title">${escapeHtml(item.title || "Notification")}</span>
                        ${item.is_read ? "" : '<span class="global-notification-new">NEW</span>'}
                    </span>
                    <span class="global-notification-item-message">${escapeHtml(item.message || "")}</span>
                    <span class="global-notification-item-time">${escapeHtml(formatNotificationTime(item.created_at))}</span>
                </span>
                <span class="global-notification-item-chevron" aria-hidden="true">›</span>
            </button>
        `).join("");
    }

    function formatNotificationStatus(status) {
        const value = String(status || "").trim().toUpperCase();
        if (value === "APPROVED") return "APPROVED";
        if (value === "REJECTED") return "REJECTED";
        if (value === "PENDING") return "PENDING";
        return value || "INFO";
    }

    function getNotificationStatusClass(status) {
        const value = String(status || "").trim().toUpperCase();
        if (value === "APPROVED") return "success";
        if (value === "REJECTED") return "danger";
        if (value === "PENDING") return "review";
        return "info";
    }

    function formatDetailDate(value) {
        if (!value) return "--";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "--";
        return date.toLocaleString([], {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function formatDetailDuration(seconds) {
        const total = Math.max(0, Math.round(Number(seconds) || 0));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        return [hours, minutes, secs]
            .map(value => String(value).padStart(2, "0"))
            .join(":");
    }

    function createNotificationModal() {
        let modal = document.getElementById("globalNotificationDetailModal");
        if (modal) return modal;

        modal = document.createElement("div");
        modal.id = "globalNotificationDetailModal";
        modal.className = "global-notification-detail-modal";
        modal.setAttribute("aria-hidden", "true");
        modal.innerHTML = `
            <div class="global-notification-detail-backdrop" data-notification-close></div>
            <section
                class="global-notification-detail-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="globalNotificationDetailTitle"
            >
                <div class="global-notification-detail-header">
                    <div class="global-notification-detail-heading">
                        <span id="globalNotificationDetailIcon" class="global-notification-detail-icon info">i</span>
                        <div>
                            <div class="global-notification-detail-kicker">TICKY TICKY</div>
                            <h2 id="globalNotificationDetailTitle">Notification Details</h2>
                        </div>
                    </div>
                    <button type="button" class="global-notification-detail-close" data-notification-close aria-label="Close notification details">×</button>
                </div>
                <div id="globalNotificationDetailBody" class="global-notification-detail-body"></div>
                <div class="global-notification-detail-footer">
                    <button type="button" class="global-notification-detail-button" data-notification-close>Close</button>
                </div>
            </section>
        `;

        document.body.appendChild(modal);

        modal.addEventListener("click", event => {
            if (event.target.closest("[data-notification-close]")) {
                closeNotificationDetails();
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && modal.classList.contains("visible")) {
                closeNotificationDetails();
            }
        });

        return modal;
    }

    function closeNotificationDetails() {
        const modal = document.getElementById("globalNotificationDetailModal");
        if (!modal) return;
        modal.classList.remove("visible");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("notification-details-open");
    }

    function detailRow(label, value, valueClass = "") {
        return `
            <div class="global-notification-detail-row">
                <span class="global-notification-detail-label">${escapeHtml(label)}</span>
                <span class="global-notification-detail-value ${valueClass}">${escapeHtml(value ?? "--")}</span>
            </div>
        `;
    }

    function detailBlock(label, value, valueClass = "") {
        return `
            <div class="global-notification-detail-block">
                <span class="global-notification-detail-label">${escapeHtml(label)}</span>
                <div class="global-notification-detail-block-value ${valueClass}">${escapeHtml(value ?? "--")}</div>
            </div>
        `;
    }

    async function openNotificationDetails(notification) {
        const modal = createNotificationModal();
        const icon = modal.querySelector("#globalNotificationDetailIcon");
        const title = modal.querySelector("#globalNotificationDetailTitle");
        const body = modal.querySelector("#globalNotificationDetailBody");

        title.textContent = notification?.title || "Notification Details";
        icon.textContent = getNotificationIcon(notification);
        icon.className = `global-notification-detail-icon ${getNotificationClass(notification)}`;

        body.innerHTML = `
            <div class="global-notification-detail-message">
                ${escapeHtml(notification?.message || "No additional message was provided.")}
            </div>
            <div class="global-notification-detail-loading">Loading related details…</div>
        `;

        modal.classList.add("visible");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("notification-details-open");

        const type = String(notification?.type || "").trim().toUpperCase();
        const referenceId = String(notification?.reference_id || "").trim();

        // Developer request decisions have their own request center. Keep the
        // notification detail compact, then give the analyst a direct route to
        // the full request timeline and completed result.
        if (type.includes("DEV_CHANGE_REQUEST")) {
            body.innerHTML = `
                <div class="global-notification-detail-message">
                    ${escapeHtml(notification?.message || "Your developer request was updated.")}
                </div>
                <div class="global-notification-detail-section">
                    <div class="global-notification-detail-section-title">Developer Request</div>
                    <div class="global-notification-detail-grid">
                        ${detailRow("Status", type.includes("UPDATE") ? "Updated" : "Submitted")}
                        ${detailRow("Received", formatDetailDate(notification?.created_at))}
                    </div>
                </div>
                <a class="global-notification-detail-action" href="${escapeAttribute(new URL("request-history.html", window.location.href).href)}">Open My Requests →</a>
            `;
            return;
        }

        // Manual Non-Prod notifications reference manual_time_requests.id.
        // The RLS policy permits the analyst or assigned administrator to view
        // the related request, so no privileged client access is needed here.
        if (!referenceId || !type.includes("MANUAL_TIME")) {
            body.innerHTML = `
                <div class="global-notification-detail-message">
                    ${escapeHtml(notification?.message || "No additional message was provided.")}
                </div>
                <div class="global-notification-detail-section">
                    <div class="global-notification-detail-section-title">Notification</div>
                    <div class="global-notification-detail-grid">
                        ${detailRow("Type", type || "INFO")}
                        ${detailRow("Received", formatDetailDate(notification?.created_at))}
                    </div>
                </div>
            `;
            return;
        }

        const { data: request, error } = await supabase
            .from("manual_time_requests")
            .select(`
                id,
                analyst_id,
                assigned_admin_id,
                task_name,
                started_at,
                ended_at,
                duration_seconds,
                justification,
                status,
                reviewed_by,
                reviewed_at,
                rejection_reason,
                created_at
            `)
            .eq("id", referenceId)
            .maybeSingle();

        if (error || !request) {
            console.error("Notification detail load error:", error);
            body.innerHTML = `
                <div class="global-notification-detail-message">
                    ${escapeHtml(notification?.message || "No additional message was provided.")}
                </div>
                <div class="global-notification-detail-section">
                    <div class="global-notification-detail-section-title">Notification</div>
                    <div class="global-notification-detail-grid">
                        ${detailRow("Type", type || "INFO")}
                        ${detailRow("Received", formatDetailDate(notification?.created_at))}
                    </div>
                    <div class="global-notification-detail-unavailable">Related request details are no longer available.</div>
                </div>
            `;
            return;
        }

        // The profiles table is intentionally restricted by RLS, so a normal
        // client-side profiles query can return the current analyst but not
        // the other admin/reviewer accounts. Use the existing security-definer
        // RPC that the manual-time workflow already uses to load active admins.
        let analystName = "--";
        let assignedAdmin = "--";
        let reviewer = "--";

        if (request.analyst_id) {
            const { data: analystProfile, error: analystProfileError } = await supabase
                .from("profiles")
                .select("id, full_name")
                .eq("id", request.analyst_id)
                .maybeSingle();

            if (analystProfileError) {
                console.error("Notification detail analyst lookup error:", analystProfileError);
            } else {
                analystName = analystProfile?.full_name || "--";
            }
        }

        const { data: activeAdmins, error: activeAdminsError } = await supabase
            .rpc("get_active_admins");

        if (activeAdminsError) {
            console.error("Notification detail admin lookup error:", activeAdminsError);
        } else {
            const adminMap = new Map(
                (Array.isArray(activeAdmins) ? activeAdmins : [])
                    .map(admin => [String(admin.id), admin.full_name || "Administrator"])
            );

            assignedAdmin = adminMap.get(String(request.assigned_admin_id)) || "--";
            reviewer = adminMap.get(String(request.reviewed_by)) || "--";
        }

        // If the reviewer is the same admin as the assigned approver, keep the
        // assigned-admin name when available. This also handles older requests
        // where only one of the two admin fields was populated.
        if (reviewer === "--" && request.reviewed_by && String(request.reviewed_by) === String(request.assigned_admin_id)) {
            reviewer = assignedAdmin;
        }

        if (assignedAdmin === "--" && request.assigned_admin_id && String(request.assigned_admin_id) === String(request.reviewed_by)) {
            assignedAdmin = reviewer;
        }

        const status = formatNotificationStatus(request.status);
        const statusClass = getNotificationStatusClass(request.status);

        body.innerHTML = `
            <div class="global-notification-detail-message">
                ${escapeHtml(notification?.message || "")}
            </div>

            <div class="global-notification-detail-status ${statusClass}">
                <span>Status</span>
                <strong>${escapeHtml(status)}</strong>
            </div>

            <div class="global-notification-detail-section">
                <div class="global-notification-detail-section-title">Request Information</div>
                <div class="global-notification-detail-grid">
                    ${detailRow("Activity", request.task_name || "--")}
                    ${detailRow("Category", "NON-PROD")}
                    ${detailRow("Duration", formatDetailDuration(request.duration_seconds))}
                    ${detailRow("Analyst", analystName)}
                    ${detailRow("Assigned Admin", assignedAdmin)}
                </div>
            </div>

            <div class="global-notification-detail-section">
                <div class="global-notification-detail-section-title">Time Details</div>
                <div class="global-notification-detail-grid">
                    ${detailRow("Start", formatDetailDate(request.started_at))}
                    ${detailRow("End", formatDetailDate(request.ended_at))}
                    ${detailRow("Submitted", formatDetailDate(request.created_at))}
                    ${detailRow("Reviewed", formatDetailDate(request.reviewed_at))}
                    ${detailRow("Reviewed By", reviewer)}
                </div>
            </div>

            ${detailBlock("Justification / Comment", request.justification || "--")}
            ${status === "REJECTED" ? detailBlock("Rejection Reason", request.rejection_reason || "No rejection reason was provided.", "rejection") : ""}
        `;
    }

    function updateBadge(count) {
        const safeCount = Math.max(0, Number(count) || 0);
        badge.hidden = safeCount === 0;
        badge.textContent = safeCount > 99 ? "99+" : String(safeCount);
        button.classList.toggle("has-unread", safeCount > 0);
        button.setAttribute(
            "aria-label",
            safeCount > 0
                ? `Open notifications, ${safeCount} unread`
                : "Open notifications"
        );
    }

    async function loadNotifications(showToastForNew = false) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) return;

        const { data, error } = await supabase
            .from("app_notifications")
            .select("id, type, title, message, reference_id, is_read, created_at")
            .eq("recipient_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);

        if (error) {
            console.error("Notification load error:", error);
            return;
        }

        const nextItems = Array.isArray(data) ? data : [];
        const previousIds = new Set(
            notificationState.items.map(item => String(item.id))
        );
        const newUnread = nextItems.filter(
            item => !item.is_read && !previousIds.has(String(item.id))
        );

        notificationState.items = nextItems;
        notificationState.unreadCount = nextItems.filter(item => !item.is_read).length;

        renderNotifications(nextItems);
        updateBadge(notificationState.unreadCount);

        if (
            showToastForNew &&
            notificationState.initialized &&
            newUnread.length > 0
        ) {
            showNotificationToast(newUnread[0], async () => {
                panel.classList.remove("visible");
                notificationState.openPanel = null;

                const notification = newUnread[0];
                const { data: { user } } = await supabase.auth.getUser();

                if (user && notification?.id) {
                    const { error: readError } = await supabase
                        .from("app_notifications")
                        .update({ is_read: true, read_at: new Date().toISOString() })
                        .eq("id", notification.id)
                        .eq("recipient_id", user.id);

                    if (readError) {
                        console.error("Notification toast read error:", readError);
                    } else {
                        await loadNotifications(false);
                    }
                }

                await openNotificationDetails(notification);
            });
        }

        notificationState.initialized = true;
    }

    button.addEventListener("click", event => {
        event.stopPropagation();
        const visible = panel.classList.contains("visible");
        panel.classList.toggle("visible", !visible);
        notificationState.openPanel = visible ? null : panel;
        if (!visible) positionPanel();
    });

    markAll.addEventListener("click", async event => {
        event.stopPropagation();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from("app_notifications")
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq("recipient_id", user.id)
            .eq("is_read", false);

        if (error) {
            console.error("Mark all notifications read error:", error);
            showAppNotice("error", "Notifications", "Unable to mark notifications as read.");
            return;
        }

        await loadNotifications(false);
    });

    list.addEventListener("click", async event => {
        const item = event.target.closest("[data-notification-id]");
        if (!item) return;

        const id = item.dataset.notificationId;
        if (!id) return;

        const notification = notificationState.items.find(
            candidate => String(candidate.id) === String(id)
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from("app_notifications")
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq("id", id)
            .eq("recipient_id", user.id);

        if (error) {
            console.error("Notification read error:", error);
            return;
        }

        // Keep the existing read/unread behavior, but also open a detailed
        // view instead of silently dismissing the useful notification context.
        await loadNotifications(false);
        panel.classList.remove("visible");
        notificationState.openPanel = null;

        if (notification) {
            await openNotificationDetails(notification);
        }
    });

    document.addEventListener("click", event => {
        if (!panel.contains(event.target) && !wrap.contains(event.target)) {
            panel.classList.remove("visible");
            notificationState.openPanel = null;
        }
    });

    window.addEventListener("resize", () => {
        if (panel.classList.contains("visible")) positionPanel();
    });

    await loadNotifications(false);

    notificationState.pollTimer = window.setInterval(
        () => loadNotifications(true),
        20000
    );
}

function showNotificationToast(notification, onClick = null) {
    document.querySelector(".global-notification-toast")?.remove();

    const toast = document.createElement("button");
    toast.type = "button";
    toast.className = "global-notification-toast";
    toast.innerHTML = `
        <span class="global-notification-toast-icon">🔔</span>
        <span class="global-notification-toast-content">
            <strong>${escapeHtml(notification?.title || "New notification")}</strong>
            <span>${escapeHtml(notification?.message || "You have a new notification.")}</span>
        </span>
        <span class="global-notification-toast-arrow">→</span>
    `;

    toast.addEventListener("click", () => {
        if (typeof onClick === "function") onClick();
        toast.remove();
    });

    document.body.appendChild(toast);

    window.setTimeout(() => toast.remove(), 7000);
}

function showAppNotice(type = "info", title = "Ticky Ticky", message = "") {
    document.querySelector(".app-notice")?.remove();

    const safeType = ["success", "error", "warning", "info"].includes(type)
        ? type
        : "info";

    const icons = {
        success: "✓",
        error: "×",
        warning: "!",
        info: "i"
    };

    const notice = document.createElement("div");
    notice.className = `app-notice app-notice-${safeType}`;
    notice.setAttribute("role", safeType === "error" ? "alert" : "status");
    notice.innerHTML = `
        <span class="app-notice-icon">${icons[safeType]}</span>
        <span class="app-notice-content">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(message)}</span>
        </span>
        <button type="button" class="app-notice-close" aria-label="Dismiss">×</button>
    `;

    notice.querySelector(".app-notice-close")?.addEventListener(
        "click",
        () => notice.remove()
    );

    document.body.appendChild(notice);

    window.setTimeout(() => notice.remove(), 5500);
}

window.showAppNotice = showAppNotice;

function formatNotificationTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value);
}
