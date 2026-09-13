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
            card.element.classList.remove("visible");
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

    // Intentionally no account ID, UUID, email, token, or other sensitive value.
    card.append(header, divider, manage);
    document.body.appendChild(card);

    return { element: card, avatar, profileElement };
}


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
