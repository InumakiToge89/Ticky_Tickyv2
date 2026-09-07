import { createClient } from
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

import {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
} from "./config.js";


const supabase =
    createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );


// =========================================================
// ELEMENTS
// =========================================================

const userName =
    document.getElementById(
        "userName"
    );

const userRoleElement =
    document.getElementById(
        "userRole"
    );

const userAvatar =
    document.getElementById(
        "userAvatar"
    );

const logoutButton =
    document.getElementById(
        "logoutButton"
    );

const searchInput =
    document.getElementById(
        "searchInput"
    );

const fromDate =
    document.getElementById(
        "fromDate"
    );

const toDate =
    document.getElementById(
        "toDate"
    );

const resetFiltersButton =
    document.getElementById(
        "resetFiltersButton"
    );

// =========================================================
// PAGINATION
// =========================================================

const historyPagination =
    document.getElementById(
        "historyPagination"
    );

const historyPaginationInfo =
    document.getElementById(
        "historyPaginationInfo"
    );

const historyPageIndicator =
    document.getElementById(
        "historyPageIndicator"
    );

const historyPreviousPage =
    document.getElementById(
        "historyPreviousPage"
    );

const historyNextPage =
    document.getElementById(
        "historyNextPage"
    );


const historyRecordsPerPage = 10;

let historyCurrentPage = 1;

const historyTableBody =
    document.getElementById(
        "historyTableBody"
    );

const workActivityPagination =
    document.getElementById(
        "workActivityPagination"
    );

const workActivityPaginationInfo =
    document.getElementById(
        "workActivityPaginationInfo"
    );

const workActivityPageIndicator =
    document.getElementById(
        "workActivityPageIndicator"
    );

const workActivityPreviousPage =
    document.getElementById(
        "workActivityPreviousPage"
    );

const workActivityNextPage =
    document.getElementById(
        "workActivityNextPage"
    );


const workActivityRecordsPerPage = 10;

let workActivityCurrentPage = 1;

const recordCount =
    document.getElementById(
        "recordCount"
    );

const filteredTotalTime =
    document.getElementById(
        "filteredTotalTime"
    );

const historyError =
    document.getElementById(
        "historyError"
    );

const historyModal =
    document.getElementById(
        "historyModal"
    );

const closeHistoryModal =
    document.getElementById(
        "closeHistoryModal"
    );

const closeHistoryModalButton =
    document.getElementById(
        "closeHistoryModalButton"
    );

const modalTeamName =
    document.getElementById(
        "modalTeamName"
    );

const modalTeamId =
    document.getElementById(
        "modalTeamId"
    );

const modalTeamTime =
    document.getElementById(
        "modalTeamTime"
    );

const modalMembersTime =
    document.getElementById(
        "modalMembersTime"
    );

const modalTotalTime =
    document.getElementById(
        "modalTotalTime"
    );

const modalMemberCount =
    document.getElementById(
        "modalMemberCount"
    );

const modalStartedAt =
    document.getElementById(
        "modalStartedAt"
    );

const modalFinishedAt =
    document.getElementById(
        "modalFinishedAt"
    );


// =========================================================
// STATE
// =========================================================

let currentUser = null;

let historyRecords = [];

let workActivityRecords = [];


// =========================================================
// INITIALIZE
// =========================================================

async function initializeHistory() {

    try {

        // -------------------------------------------------
        // Get authenticated user
        // -------------------------------------------------

        const {
            data: {
                user
            },
            error: userError
        } =
            await supabase.auth.getUser();


        if (userError) {
            throw userError;
        }


        if (!user) {

            window.location.href =
                "../index.html";

            return;
        }


        currentUser =
            user;


        // -------------------------------------------------
        // Get profile
        // -------------------------------------------------

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from("profiles")
                .select(`
                    full_name,
                    role,
                    status
                `)
                .eq(
                    "id",
                    user.id
                )
                .single();


                        const reportsNavItem =
                document.getElementById(
                    "reportsNavItem"
                );

            const profileRole =
                String(
                    profile.role || ""
                )
                    .trim()
                    .toUpperCase();

            if (reportsNavItem) {

                reportsNavItem.style.display =
                    profileRole === "ADMIN"
                        ? "flex"
                        : "none";

            }


        if (profileError) {
            throw profileError;
        }


        // -------------------------------------------------
        // Verify account
        // -------------------------------------------------

        if (
            profile.status !==
            "ACTIVE"
        ) {

            await supabase.auth.signOut({
                scope: "local"
            });

            window.location.href =
                "../index.html";

            return;
        }


        // -------------------------------------------------
        // Display user
        // -------------------------------------------------

        userName.textContent =
            profile.full_name ||
            "Analyst";


        userRoleElement.textContent =
            profile.role ||
            "ANALYST";


        userAvatar.textContent =
            getInitials(
                profile.full_name ||
                "Analyst"
            );


        // -------------------------------------------------
        // Load history
        // -------------------------------------------------

        await loadHistory();

        await loadWorkActivityHistory();

    } catch (error) {

        console.error(
            "History initialization error:",
            error
        );


        showError(
            error.message ||
            "Unable to load history."
        );

    }

}


// =========================================================
// LOAD HISTORY
// =========================================================

async function loadHistory() {

    clearError();


    // -----------------------------------------------------
    // Get completed profiling jobs
    //
    // IMPORTANT:
    // We filter by the authenticated user's ID.
    // -----------------------------------------------------

    const {
        data: jobs,
        error: jobsError
    } =
        await supabase
            .from("profiling_jobs")
            .select(`
                id,
                analyst_id,
                team_name,
                team_id,
                member_count,
                status,
                started_at,
                finished_at,
                total_seconds
            `)
            .eq(
                "analyst_id",
                currentUser.id
            )
            .eq(
                "status",
                "COMPLETED"
            )
            .order(
                "finished_at",
                {
                    ascending: false
                }
            );


    if (jobsError) {
        throw jobsError;
    }


    if (
        !jobs ||
        jobs.length === 0
    ) {

        historyRecords = [];

        renderHistory();

        return;
    }


    // -----------------------------------------------------
    // Get timer sessions for these jobs
    // -----------------------------------------------------

    const jobIds =
        jobs.map(
            job => job.id
        );


    const {
        data: sessions,
        error: sessionsError
    } =
        await supabase
            .from("timer_sessions")
            .select(`
                id,
                profiling_job_id,
                session_type,
                status,
                started_at,
                stopped_at,
                total_seconds
            `)
            .in(
                "profiling_job_id",
                jobIds
            );


    if (sessionsError) {
        throw sessionsError;
    }


    // -----------------------------------------------------
    // Build history records
    // -----------------------------------------------------

    historyRecords =
        jobs.map(
            job => {

                const jobSessions =
                    (
                        sessions ||
                        []
                    ).filter(
                        session =>
                            String(
                                session.profiling_job_id
                            ) ===
                            String(job.id)
                    );


                const teamSession =
                    jobSessions.find(
                        session =>
                            session.session_type ===
                            "TEAM"
                    );


                const membersSession =
                    jobSessions.find(
                        session =>
                            session.session_type ===
                            "MEMBERS"
                    );


                const teamSeconds =
                    Number(
                        teamSession?.total_seconds ||
                        0
                    );


                const membersSeconds =
                    Number(
                        membersSession?.total_seconds ||
                        0
                    );


                const totalSeconds =
                    teamSeconds +
                    membersSeconds;


                return {

                    ...job,

                    teamSeconds,

                    membersSeconds,

                    totalSeconds

                };

            }
        );


    renderHistory();

}


// =========================================================
// LOAD WORK ACTIVITY HISTORY
// =========================================================

async function loadWorkActivityHistory() {

    try {

        const {
            data: logs,
            error
        } =
            await supabase
                .from("task_logs")
                .select(`
                    id,
                    analyst_id,
                    category,
                    task_name,
                    started_at,
                    ended_at,
                    duration_seconds
                `)
                .eq(
                    "analyst_id",
                    currentUser.id
                )
                .order(
                    "ended_at",
                    {
                        ascending: false
                    }
                );


        if (error) {

            throw error;

        }


        workActivityRecords =
            logs ||
            [];


        renderWorkActivityHistory();


    } catch (error) {

        console.error(
            "Work activity history error:",
            error
        );


        workActivityRecords =
            [];


        renderWorkActivityHistory();

    }

}

// =========================================================
// RENDER WORK ACTIVITY HISTORY
// =========================================================

function renderWorkActivityHistory() {

    const workActivityTableBody =
        document.getElementById(
            "workActivityTableBody"
        );


    if (
        !workActivityTableBody
    ) {

        return;

    }


    const totalRecords =
        workActivityRecords.length;


    // -----------------------------------------------------
    // EMPTY
    // -----------------------------------------------------

    if (
        totalRecords === 0
    ) {

        workActivityCurrentPage =
            1;


        workActivityTableBody.innerHTML = `
            <tr>

                <td
                    colspan="5"
                    class="status-empty"
                >

                    <div class="empty-icon">
                        ◷
                    </div>

                    No work activity records yet.

                </td>

            </tr>
        `;


        updateWorkActivityPagination(
            0
        );

        return;

    }


    // -----------------------------------------------------
    // CALCULATE PAGES
    // -----------------------------------------------------

    const totalPages =
        Math.ceil(
            totalRecords /
            workActivityRecordsPerPage
        );


    if (
        workActivityCurrentPage >
        totalPages
    ) {

        workActivityCurrentPage =
            totalPages;

    }


    if (
        workActivityCurrentPage <
        1
    ) {

        workActivityCurrentPage =
            1;

    }


    const startIndex =
        (
            workActivityCurrentPage - 1
        ) *
        workActivityRecordsPerPage;


    const endIndex =
        Math.min(
            startIndex +
            workActivityRecordsPerPage,
            totalRecords
        );


    const pageRecords =
        workActivityRecords.slice(
            startIndex,
            endIndex
        );


    // -----------------------------------------------------
    // RENDER CURRENT PAGE
    // -----------------------------------------------------

    workActivityTableBody.innerHTML =
        pageRecords
            .map(
                record => `
                    <tr>

                        <td>
                            ${escapeHtml(
                                record.category ||
                                "--"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                record.task_name ||
                                "--"
                            )}
                        </td>

                        <td>
                            ${formatDateTime(
                                record.started_at
                            )}
                        </td>

                        <td>
                            ${formatDateTime(
                                record.ended_at
                            )}
                        </td>

                        <td>
                            <span class="duration-cell">
                                ${formatDuration(
                                    record.duration_seconds
                                )}
                            </span>
                        </td>

                    </tr>
                `
            )
            .join("");


    updateWorkActivityPagination(
        totalRecords
    );

}

function updateWorkActivityPagination(
    totalRecords
) {

    if (
        !workActivityPagination
    ) {

        return;

    }


    if (
        totalRecords === 0
    ) {

        workActivityPagination.style.display =
            "none";

        return;

    }


    workActivityPagination.style.display =
        "flex";


    const totalPages =
        Math.ceil(
            totalRecords /
            workActivityRecordsPerPage
        );


    const startRecord =
        (
            (
                workActivityCurrentPage - 1
            ) *
            workActivityRecordsPerPage
        ) + 1;


    const endRecord =
        Math.min(
            workActivityCurrentPage *
            workActivityRecordsPerPage,
            totalRecords
        );


    workActivityPaginationInfo.textContent =
        `Showing ${startRecord}–${endRecord} of ${totalRecords} records`;


    workActivityPageIndicator.textContent =
        `Page ${workActivityCurrentPage} of ${totalPages}`;


    workActivityPreviousPage.disabled =
        workActivityCurrentPage <= 1;


    workActivityNextPage.disabled =
        workActivityCurrentPage >= totalPages;

}


// =========================================================
// RENDER HISTORY
// =========================================================

function renderHistory() {

    const filteredRecords =
        getFilteredRecords();


    // -----------------------------------------------------
    // SUMMARY
    // -----------------------------------------------------

    recordCount.textContent =
        filteredRecords.length;


    const totalSeconds =
        filteredRecords.reduce(
            (
                total,
                record
            ) =>
                total +
                Number(
                    record.totalSeconds ||
                    0
                ),
            0
        );


    filteredTotalTime.textContent =
        formatDuration(
            totalSeconds
        );


    // -----------------------------------------------------
    // EMPTY STATE
    // -----------------------------------------------------

    if (
        filteredRecords.length === 0
    ) {

        historyCurrentPage =
            1;


        historyTableBody.innerHTML = `
            <tr>

                <td
                    colspan="7"
                    class="status-empty"
                >

                    <div class="empty-icon">
                        ◷
                    </div>

                    No completed profiling records found.

                </td>

            </tr>
        `;


        updateHistoryPagination(
            0
        );

        return;
    }


    // -----------------------------------------------------
    // PAGE CALCULATION
    // -----------------------------------------------------

    const totalPages =
        Math.ceil(
            filteredRecords.length /
            historyRecordsPerPage
        );


    if (
        historyCurrentPage >
        totalPages
    ) {

        historyCurrentPage =
            totalPages;

    }


    if (
        historyCurrentPage <
        1
    ) {

        historyCurrentPage =
            1;

    }


    const startIndex =
        (
            historyCurrentPage - 1
        ) *
        historyRecordsPerPage;


    const endIndex =
        Math.min(
            startIndex +
            historyRecordsPerPage,
            filteredRecords.length
        );


    const pageRecords =
        filteredRecords.slice(
            startIndex,
            endIndex
        );


    // -----------------------------------------------------
    // RENDER CURRENT PAGE
    // -----------------------------------------------------

    historyTableBody.innerHTML =
        pageRecords
            .map(
                record =>
                    createHistoryRow(
                        record
                    )
            )
            .join("");


    // -----------------------------------------------------
    // PAGINATION
    // -----------------------------------------------------

    updateHistoryPagination(
        filteredRecords.length
    );

}

// =========================================================
// UPDATE HISTORY PAGINATION
// =========================================================

function updateHistoryPagination(
    totalRecords
) {

    if (
        !historyPagination
    ) {

        return;

    }


    // -----------------------------------------------------
    // NO RECORDS
    // -----------------------------------------------------

    if (
        totalRecords === 0
    ) {

        historyPagination.style.display =
            "none";

        return;

    }


    historyPagination.style.display =
        "flex";


    const totalPages =
        Math.ceil(
            totalRecords /
            historyRecordsPerPage
        );


    const startRecord =
        (
            (
                historyCurrentPage - 1
            ) *
            historyRecordsPerPage
        ) + 1;


    const endRecord =
        Math.min(
            historyCurrentPage *
            historyRecordsPerPage,
            totalRecords
        );


    // -----------------------------------------------------
    // INFO
    // -----------------------------------------------------

    if (
        historyPaginationInfo
    ) {

        historyPaginationInfo.textContent =
            `Showing ${startRecord}–${endRecord} of ${totalRecords} records`;

    }


    // -----------------------------------------------------
    // PAGE NUMBER
    // -----------------------------------------------------

    if (
        historyPageIndicator
    ) {

        historyPageIndicator.textContent =
            `Page ${historyCurrentPage} of ${totalPages}`;

    }


    // -----------------------------------------------------
    // BUTTONS
    // -----------------------------------------------------

    if (
        historyPreviousPage
    ) {

        historyPreviousPage.disabled =
            historyCurrentPage <= 1;

    }


    if (
        historyNextPage
    ) {

        historyNextPage.disabled =
            historyCurrentPage >= totalPages;

    }

}


// =========================================================
// CREATE HISTORY ROW
// =========================================================

function createHistoryRow(
    record
) {

    return `

        <tr
        
            class="history-row"
            data-job-id="${record.id}"
        
        >
            

            <td>

                <div class="team-cell">

                    <span class="team-name">
                        ${escapeHtml(
                            record.team_name
                        )}
                    </span>

                </div>

            </td>


            <td>

                <span class="team-subtitle">

                    ${escapeHtml(
                        String(
                            record.team_id
                        )
                    )}

                </span>

            </td>


            <td>

                <span class="member-count">

                    ${formatNumber(
                        record.member_count
                    )}

                </span>

            </td>


            <td>

                <span class="duration-cell">

                    ${formatDuration(
                        record.teamSeconds
                    )}

                </span>

            </td>


            <td>

                <span class="duration-cell">

                    ${formatDuration(
                        record.membersSeconds
                    )}

                </span>

            </td>


            <td>

                <span class="duration-cell total-duration">

                    ${formatDuration(
                        record.totalSeconds
                    )}

                </span>

            </td>


            <td>

                <span class="completed-date">

                    ${formatDateTime(
                        record.finished_at
                    )}

                </span>

            </td>

        </tr>

    `;

}


// =========================================================
// SHOW HISTORY DETAILS
// =========================================================

function showHistoryDetails(
    jobId
) {

    const record =
        historyRecords.find(
            item =>
                String(item.id) ===
                String(jobId)
        );


    if (!record) {

        showError(
            "The selected profiling record could not be found."
        );

        return;
    }


    modalTeamName.textContent =
        record.team_name ||
        "--";


    modalTeamId.textContent =
        `Team ID: ${
            record.team_id ??
            "--"
        }`;


    modalTeamTime.textContent =
        formatDuration(
            record.teamSeconds
        );


    modalMembersTime.textContent =
        formatDuration(
            record.membersSeconds
        );


    modalTotalTime.textContent =
        formatDuration(
            record.totalSeconds
        );


    modalMemberCount.textContent =
        formatNumber(
            record.member_count
        );


    modalStartedAt.textContent =
        formatDateTime(
            record.started_at
        );


    modalFinishedAt.textContent =
        formatDateTime(
            record.finished_at
        );


    historyModal.style.display =
        "flex";

}


// =========================================================
// HISTORY ROW CLICK
// =========================================================

historyTableBody.addEventListener(
    "click",
    event => {

        const row =
            event.target.closest(
                ".history-row"
            );


        if (!row) {
            return;
        }


        const jobId =
            row.dataset.jobId;


        if (!jobId) {
            return;
        }


        showHistoryDetails(
            jobId
        );

    }
);

// =========================================================
// HISTORY PAGINATION EVENTS
// =========================================================

historyPreviousPage.addEventListener(
    "click",
    () => {

        if (
            historyCurrentPage > 1
        ) {

            historyCurrentPage--;

            renderHistory();

        }

    }
);


historyNextPage.addEventListener(
    "click",
    () => {

        const filteredRecords =
            getFilteredRecords();


        const totalPages =
            Math.ceil(
                filteredRecords.length /
                historyRecordsPerPage
            );


        if (
            historyCurrentPage <
            totalPages
        ) {

            historyCurrentPage++;

            renderHistory();

        }

    }
);

workActivityPreviousPage.addEventListener(
    "click",
    () => {

        if (
            workActivityCurrentPage > 1
        ) {

            workActivityCurrentPage--;

            renderWorkActivityHistory();

        }

    }
);


workActivityNextPage.addEventListener(
    "click",
    () => {

        const totalPages =
            Math.ceil(
                workActivityRecords.length /
                workActivityRecordsPerPage
            );


        if (
            workActivityCurrentPage <
            totalPages
        ) {

            workActivityCurrentPage++;

            renderWorkActivityHistory();

        }

    }
);


// =========================================================
// WORK ACTIVITY ROW CLICK
// =========================================================

const workActivityTableBody =
    document.getElementById(
        "workActivityTableBody"
    );


if (workActivityTableBody) {

    workActivityTableBody.addEventListener(
        "click",
        event => {

            const row =
                event.target.closest(
                    ".work-activity-row"
                );


            if (!row) {

                return;

            }


            const taskLogId =
                row.dataset.taskLogId;


            if (!taskLogId) {

                return;

            }


            showWorkActivityDetails(
                taskLogId
            );

        }
    );

}


// =========================================================
// FILTERING
// =========================================================

function getFilteredRecords() {

    const search =
        (
            searchInput.value ||
            ""
        )
            .trim()
            .toLowerCase();


    const from =
        fromDate.value
            ? new Date(
                `${fromDate.value}T00:00:00`
            )
            : null;


    const to =
        toDate.value
            ? new Date(
                `${toDate.value}T23:59:59.999`
            )
            : null;


    return historyRecords.filter(
        record => {

            // ---------------------------------------------
            // Search
            // ---------------------------------------------

            if (search) {

                const teamName =
                    String(
                        record.team_name ||
                        ""
                    ).toLowerCase();


                const teamId =
                    String(
                        record.team_id ||
                        ""
                    ).toLowerCase();


                if (
                    !teamName.includes(
                        search
                    )
                    &&
                    !teamId.includes(
                        search
                    )
                ) {

                    return false;

                }

            }


            // ---------------------------------------------
            // Date range
            // ---------------------------------------------

            if (
                from ||
                to
            ) {

                if (
                    !record.finished_at
                ) {

                    return false;

                }


                const completedDate =
                    new Date(
                        record.finished_at
                    );


                if (
                    from &&
                    completedDate <
                    from
                ) {

                    return false;

                }


                if (
                    to &&
                    completedDate >
                    to
                ) {

                    return false;

                }

            }


            return true;

        }
    );

}


// =========================================================
// WORK ACTIVITY DETAILS MODAL
// =========================================================

const workActivityModal =
    document.getElementById(
        "workActivityModal"
    );


const closeWorkActivityModal =
    document.getElementById(
        "closeWorkActivityModal"
    );


const workActivityModalTitle =
    document.getElementById(
        "workActivityModalTitle"
    );


const workActivityModalCategory =
    document.getElementById(
        "workActivityModalCategory"
    );


const workActivityModalStarted =
    document.getElementById(
        "workActivityModalStarted"
    );


const workActivityModalFinished =
    document.getElementById(
        "workActivityModalFinished"
    );


const workActivityModalDuration =
    document.getElementById(
        "workActivityModalDuration"
    );


const workActivityTimeline =
    document.getElementById(
        "workActivityTimeline"
    );



// =========================================================
// SHOW WORK ACTIVITY DETAILS
// =========================================================

async function showWorkActivityDetails(
    taskLogId
) {

    const record =
        workActivityRecords.find(
            item =>
                String(
                    item.id
                ) ===
                String(
                    taskLogId
                )
        );


    if (!record) {

        showError(
            "The selected work activity could not be found."
        );

        return;

    }


    // -----------------------------------------------------
    // Fill activity summary
    // -----------------------------------------------------

    workActivityModalTitle.textContent =
        record.task_name ||
        "--";


    workActivityModalCategory.textContent =
        record.category ||
        "--";


    workActivityModalStarted.textContent =
        formatDateTime(
            record.started_at
        );


    workActivityModalFinished.textContent =
        formatDateTime(
            record.ended_at
        );


    workActivityModalDuration.textContent =
        formatDuration(
            record.duration_seconds
        );


    // Show loading state

    workActivityTimeline.innerHTML = `
        <div class="timeline-loading">
            Loading activity timeline...
        </div>
    `;


    workActivityModal.style.display =
        "flex";


    // -----------------------------------------------------
    // Load audit events
    // -----------------------------------------------------

    try {

        const {
            data: events,
            error
        } =
            await supabase
                .from(
                    "task_activity_events"
                )
                .select(`
                    id,
                    event_type,
                    event_time
                `)
                .eq(
                    "task_log_id",
                    taskLogId
                )
                .eq(
                    "analyst_id",
                    currentUser.id
                )
                .order(
                    "event_time",
                    {
                        ascending: true
                    }
                );


        if (error) {

            throw error;

        }


        renderWorkActivityTimeline(
            events ||
            []
        );


    } catch (error) {

        console.error(
            "Work activity timeline error:",
            error
        );


        workActivityTimeline.innerHTML = `
            <div class="timeline-empty">
                Unable to load the activity timeline.
            </div>
        `;

    }

}



// =========================================================
// RENDER WORK ACTIVITY TIMELINE
// =========================================================

function renderWorkActivityTimeline(
    events
) {

    if (
        !events ||
        events.length === 0
    ) {

        workActivityTimeline.innerHTML = `
            <div class="timeline-empty">
                No timeline events were recorded for this activity.
            </div>
        `;

        return;

    }


    const eventIcons = {

        START:
            "▶",

        PAUSE:
            "⏸",

        RESUME:
            "▶",

        STOP:
            "■"

    };


    workActivityTimeline.innerHTML =
        events
            .map(
                event => `

                    <div
                        class="timeline-event timeline-${String(
                            event.event_type ||
                            ""
                        ).toLowerCase()}"
                    >

                        <div class="timeline-event-icon">

                            ${
                                eventIcons[
                                    event.event_type
                                ] ||
                                "•"
                            }

                        </div>


                        <div class="timeline-event-content">

                            <div class="timeline-event-type">

                                ${escapeHtml(
                                    event.event_type ||
                                    "EVENT"
                                )}

                            </div>


                            <div class="timeline-event-time">

                                ${formatDateTime(
                                    event.event_time
                                )}

                            </div>

                        </div>

                    </div>

                `
            )
            .join("");

}



// =========================================================
// CLOSE WORK ACTIVITY MODAL
// =========================================================

if (closeWorkActivityModal) {

    closeWorkActivityModal.addEventListener(
        "click",
        () => {

            workActivityModal.style.display =
                "none";

        }
    );

}


if (workActivityModal) {

    workActivityModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                workActivityModal
            ) {

                workActivityModal.style.display =
                    "none";

            }

        }
    );

}


// =========================================================
// FORMAT DURATION
// =========================================================

function formatDuration(
    totalSeconds
) {

    totalSeconds =
        Math.max(
            0,
            Math.floor(
                Number(
                    totalSeconds
                ) ||
                0
            )
        );


    const hours =
        Math.floor(
            totalSeconds /
            3600
        );


    const minutes =
        Math.floor(
            (
                totalSeconds %
                3600
            ) /
            60
        );


    const seconds =
        totalSeconds %
        60;


    return [

        String(hours)
            .padStart(
                2,
                "0"
            ),

        String(minutes)
            .padStart(
                2,
                "0"
            ),

        String(seconds)
            .padStart(
                2,
                "0"
            )

    ].join(":");

}


// =========================================================
// FORMAT DATE
// =========================================================

function formatDateTime(
    value
) {

    if (!value) {
        return "--";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "--";

    }


    return date.toLocaleString(
        undefined,
        {
            year:
                "numeric",

            month:
                "short",

            day:
                "numeric",

            hour:
                "numeric",

            minute:
                "2-digit"
        }
    );

}


// =========================================================
// FORMAT NUMBER
// =========================================================

function formatNumber(
    value
) {

    const number =
        Number(value);


    if (
        Number.isNaN(
            number
        )
    ) {

        return "0";

    }


    return number.toLocaleString();

}


// =========================================================
// INITIALS
// =========================================================

function getInitials(
    name
) {

    const parts =
        String(
            name
        )
            .trim()
            .split(
                /\s+/
            )
            .filter(
                Boolean
            );


    if (
        parts.length ===
        0
    ) {

        return "--";

    }


    if (
        parts.length ===
        1
    ) {

        return parts[0]
            .substring(
                0,
                2
            )
            .toUpperCase();

    }


    return (
        parts[0][0] +
        parts[
            parts.length - 1
        ][0]
    ).toUpperCase();

}


// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// =========================================================
// ERROR
// =========================================================

function showError(
    message
) {

    historyError.textContent =
        message;

    historyError.style.display =
        "block";

}


function clearError() {

    historyError.textContent =
        "";

    historyError.style.display =
        "none";

}


// =========================================================
// FILTER EVENTS
// =========================================================

searchInput.addEventListener(
    "input",
    () => {

        historyCurrentPage = 1;

        renderHistory();

    }
);


fromDate.addEventListener(
    "change",
    () => {

        historyCurrentPage = 1;

        renderHistory();

    }
);


toDate.addEventListener(
    "change",
    () => {

        historyCurrentPage = 1;

        renderHistory();

    }
);


resetFiltersButton.addEventListener(
    "click",
    () => {

        searchInput.value =
            "";

        fromDate.value =
            "";

        toDate.value =
            "";

        historyCurrentPage = 1;

    }
);


// =========================================================
// LOGOUT
// =========================================================

logoutButton.addEventListener(
    "click",
    async event => {

        event.preventDefault();


        logoutButton.style.pointerEvents =
            "none";


        try {

            const {
                error
            } =
                await supabase.auth.signOut({
                    scope: "local"
                });


            if (error) {
                throw error;
            }


            window.location.href =
                "../index.html";


        } catch (error) {

            console.error(
                "Logout error:",
                error
            );


            logoutButton.style.pointerEvents =
                "";


            showError(
                error.message ||
                "Unable to log out."
            );

        }

    }
);


// =========================================================
// START
// =========================================================

initializeHistory();

// =========================================================
// CLOSE HISTORY MODAL
// =========================================================

function hideHistoryDetails() {

    historyModal.style.display =
        "none";

}


closeHistoryModal.addEventListener(
    "click",
    hideHistoryDetails
);


closeHistoryModalButton.addEventListener(
    "click",
    hideHistoryDetails
);


historyModal
    .querySelector(
        ".history-modal-overlay"
    )
    .addEventListener(
        "click",
        hideHistoryDetails
);


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Escape"
        ) {

            hideHistoryDetails();

        }

    }
);