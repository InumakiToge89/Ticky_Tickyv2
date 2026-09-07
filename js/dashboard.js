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


// =========================================================
// ELEMENTS
// =========================================================

const userName =
    document.getElementById("userName");

const userRoleElement =
    document.getElementById("userRole");

const userAvatar =
    document.getElementById("userAvatar");

const welcomeTitle =
    document.getElementById("welcomeTitle");

const logoutButton =
    document.getElementById("logoutButton");


// =========================================================
// DASHBOARD ELEMENTS
// =========================================================

const teamsToday =
    document.getElementById("teamsToday");

const membersToday =
    document.getElementById("membersToday");

const totalTimeToday =
    document.getElementById("totalTimeToday");

const recentProfilingBody =
    document.getElementById("recentProfilingTable");

const prodTimeToday =
    document.getElementById("prodTimeToday");

const nonProdTimeToday =
    document.getElementById("nonProdTimeToday");

const activitiesToday =
    document.getElementById("activitiesToday");

const recentWorkActivityTable =
    document.getElementById("recentWorkActivityTable");

// =========================================================
// TIME BREAKDOWN ELEMENTS
// =========================================================

const profilingBreakdownTime =
    document.getElementById("profilingBreakdownTime");

const profilingBreakdownPercent =
    document.getElementById("profilingBreakdownPercent");

const profilingBreakdownBar =
    document.getElementById("profilingBreakdownBar");


const prodBreakdownTime =
    document.getElementById("prodBreakdownTime");

const prodBreakdownPercent =
    document.getElementById("prodBreakdownPercent");

const prodBreakdownBar =
    document.getElementById("prodBreakdownBar");


const nonProdBreakdownTime =
    document.getElementById("nonProdBreakdownTime");

const nonProdBreakdownPercent =
    document.getElementById("nonProdBreakdownPercent");

const nonProdBreakdownBar =
    document.getElementById("nonProdBreakdownBar");
    
// =========================================================
// PRODUCTIVITY SUMMARY ELEMENTS
// =========================================================

const summaryProfilingTime =
    document.getElementById(
        "summaryProfilingTime"
    );


const summaryProdTime =
    document.getElementById(
        "summaryProdTime"
    );


const summaryNonProdTime =
    document.getElementById(
        "summaryNonProdTime"
    );


const summaryTotalTime =
    document.getElementById(
        "summaryTotalTime"
    );


const productivityInsight =
    document.getElementById(
        "productivityInsight"
    );

// =========================================================
// INITIALIZE
// =========================================================

async function initializeDashboard() {

    try {

        // -------------------------------------------------
        // GET AUTHENTICATED USER
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


        // -------------------------------------------------
        // NOT LOGGED IN
        // -------------------------------------------------

        if (!user) {

            window.location.href =
                "../index.html";

            return;
        }


        // -------------------------------------------------
        // GET PROFILE
        // -------------------------------------------------

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from("profiles")
                .select(`
                    full_name,
                    employee_code,
                    role,
                    status
                `)
                .eq(
                    "id",
                    user.id
                )
                .single();


        if (profileError) {
            throw profileError;
        }


        // -------------------------------------------------
        // ACCOUNT STATUS
        // -------------------------------------------------

        const accountStatus =
            String(
                profile.status || ""
            )
                .trim()
                .toUpperCase();


        if (
            accountStatus !==
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
        // REPORTS VISIBILITY
        // ADMIN ONLY
        // -------------------------------------------------

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


        // -------------------------------------------------
        // DISPLAY USER
        // -------------------------------------------------

        const fullName =
            profile.full_name ||
            "Analyst";


        if (userName) {

            userName.textContent =
                fullName;

        }


        if (userRoleElement) {

            userRoleElement.textContent =
                profile.role ||
                "ANALYST";

        }


        if (welcomeTitle) {

            welcomeTitle.textContent =
                `Good day, ${fullName}! 👋`;

        }


        if (userAvatar) {

            userAvatar.textContent =
                getInitials(fullName);

        }


        // -------------------------------------------------
        // LOAD DASHBOARD
        // -------------------------------------------------

        await loadDashboardData(
            user.id
        );


        console.log(
            "Dashboard loaded successfully."
        );


    } catch (error) {

        console.error(
            "Dashboard initialization error:",
            error
        );

    }

}


// =========================================================
// LOAD DASHBOARD DATA
// =========================================================

async function loadDashboardData(
    userId
) {

    // -----------------------------------------------------
    // GET TODAY'S LOCAL DATE RANGE
    // -----------------------------------------------------

    const now =
        new Date();


    const startOfToday =
        new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0,
            0,
            0,
            0
        );


    const endOfToday =
        new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999
        );


    const startOfTodayISO =
        startOfToday.toISOString();


    const endOfTodayISO =
        endOfToday.toISOString();


    // -----------------------------------------------------
    // LOAD PROFILING JOBS
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
                userId
            )
            .eq(
                "status",
                "COMPLETED"
            )
            .gte(
                "finished_at",
                startOfTodayISO
            )
            .lte(
                "finished_at",
                endOfTodayISO
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


    const completedJobs =
        jobs ||
        [];


    // -----------------------------------------------------
    // LOAD WORK ACTIVITIES
    // -----------------------------------------------------

    const {
        data: workActivities,
        error: workActivitiesError
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
                userId
            )
            .not(
                "ended_at",
                "is",
                null
            )
            .gte(
                "ended_at",
                startOfTodayISO
            )
            .lte(
                "ended_at",
                endOfTodayISO
            )
            .order(
                "ended_at",
                {
                    ascending: false
                }
            );


    if (workActivitiesError) {

        throw workActivitiesError;

    }


    const completedWorkActivities =
        workActivities ||
        [];


    // -----------------------------------------------------
    // LOAD TIMER SESSIONS
    // ONLY IF PROFILING JOBS EXIST
    // -----------------------------------------------------

    let sessions =
        [];


    if (
        completedJobs.length > 0
    ) {

        const jobIds =
            completedJobs.map(
                job =>
                    job.id
            );


        const {
            data: timerSessions,
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


        sessions =
            timerSessions ||
            [];

    }


    // -----------------------------------------------------
    // GET TIMER EVENTS FOR ACTUAL DAILY ATTRIBUTION
    // -----------------------------------------------------

    const dashboardSessionIds =
        sessions
            .map(session => session.id)
            .filter(Boolean);

    let dashboardTimerEvents = [];

    if (dashboardSessionIds.length > 0) {

        const {
            data: eventRows,
            error: eventRowsError
        } =
            await supabase
                .from("timer_events")
                .select(`
                    session_id,
                    event_type,
                    event_time
                `)
                .in(
                    "session_id",
                    dashboardSessionIds
                )
                .order(
                    "event_time",
                    {
                        ascending: true
                    }
                );

        if (eventRowsError) {
            throw eventRowsError;
        }

        dashboardTimerEvents =
            eventRows || [];

    }


    // -----------------------------------------------------
    // PROFILING STATISTICS
    // -----------------------------------------------------

    let teamCount =
        0;


    let membersCount =
        0;


    let profilingSeconds =
        0;


    const dashboardEventsBySession = new Map();

    dashboardTimerEvents.forEach(event => {

        if (!dashboardEventsBySession.has(String(event.session_id))) {
            dashboardEventsBySession.set(
                String(event.session_id),
                []
            );
        }

        dashboardEventsBySession
            .get(String(event.session_id))
            .push(event);

    });


    function secondsWithinToday(start, end) {

        if (!start || !end || end <= start) {
            return 0;
        }

        const startToday = new Date(startOfToday);
        const endToday = new Date(endOfToday);

        const overlapStart =
            start > startToday
                ? start
                : startToday;

        const overlapEnd =
            end < endToday
                ? end
                : endToday;

        return Math.max(
            0,
            Math.floor(
                (overlapEnd - overlapStart) / 1000
            )
        );

    }


    completedJobs.forEach(
        job => {

            const jobSessions =
                sessions.filter(
                    session =>
                        String(
                            session.profiling_job_id
                        ) ===
                        String(
                            job.id
                        )
                );

            jobSessions.forEach(session => {

                const events =
                    dashboardEventsBySession.get(
                        String(session.id)
                    ) || [];

                let activeStart = null;

                events.forEach(event => {

                    const eventTime =
                        new Date(event.event_time);

                    if (Number.isNaN(eventTime.getTime())) {
                        return;
                    }

                    if (
                        event.event_type === "START" ||
                        event.event_type === "RESUME"
                    ) {
                        activeStart = eventTime;
                    }

                    if (
                        event.event_type === "PAUSE" ||
                        event.event_type === "STOP"
                    ) {

                        if (activeStart) {

                            profilingSeconds +=
                                secondsWithinToday(
                                    activeStart,
                                    eventTime
                                );

                        }

                        activeStart = null;

                    }

                });

                // A completed job normally has STOP events.
                // This fallback also handles incomplete legacy event history.
                if (
                    activeStart &&
                    job.finished_at
                ) {

                    const finishedAt =
                        new Date(job.finished_at);

                    if (!Number.isNaN(finishedAt.getTime())) {

                        profilingSeconds +=
                            secondsWithinToday(
                                activeStart,
                                finishedAt
                            );

                    }

                }

                if (
                    events.length === 0 &&
                    session.started_at &&
                    session.stopped_at
                ) {

                    const start =
                        new Date(session.started_at);

                    const end =
                        new Date(session.stopped_at);

                    if (
                        !Number.isNaN(start.getTime()) &&
                        !Number.isNaN(end.getTime())
                    ) {

                        profilingSeconds +=
                            secondsWithinToday(
                                start,
                                end
                            );

                    }

                }

            });


            const teamSession =
                jobSessions.find(
                    session =>
                        String(
                            session.session_type ||
                            ""
                        )
                            .trim()
                            .toUpperCase() ===
                        "TEAM"
                );


            if (teamSession) {

                teamCount++;

            }


            const membersSession =
                jobSessions.find(
                    session =>
                        String(
                            session.session_type ||
                            ""
                        )
                            .trim()
                            .toUpperCase() ===
                        "MEMBERS"
                );


            if (membersSession) {

                membersCount++;

            }

        }
    );


    // -----------------------------------------------------
    // WORK ACTIVITY STATISTICS
    // -----------------------------------------------------

    let prodSeconds =
        0;


    let nonProdSeconds =
        0;


    completedWorkActivities.forEach(
        activity => {

            const category =
                String(
                    activity.category ||
                    ""
                )
                    .trim()
                    .toUpperCase();


            const duration =
                Number(
                    activity.duration_seconds ||
                    0
                );


            if (
                category ===
                "PROD"
            ) {

                prodSeconds +=
                    duration;

            }


            if (
                category ===
                "NON-PROD"
            ) {

                nonProdSeconds +=
                    duration;

            }

        }
    );


    // -----------------------------------------------------
    // UPDATE ORIGINAL KPI CARDS
    // -----------------------------------------------------

    // -----------------------------------------------------
// CALCULATE TOTAL TIME TODAY
// -----------------------------------------------------

const totalTimeSeconds =
    profilingSeconds +
    prodSeconds +
    nonProdSeconds;


// -----------------------------------------------------
// UPDATE ORIGINAL KPI CARDS
// -----------------------------------------------------

updateDashboardKPIs(
    teamCount,
    membersCount,
    totalTimeSeconds
);


updateTimeBreakdown(
    profilingSeconds,
    prodSeconds,
    nonProdSeconds,
    totalTimeSeconds
);


updateProductivitySummary(
    profilingSeconds,
    prodSeconds,
    nonProdSeconds,
    totalTimeSeconds
);


    // -----------------------------------------------------
    // UPDATE WORK ACTIVITY KPI CARDS
    // -----------------------------------------------------

    updateWorkActivityKPIs(
        prodSeconds,
        nonProdSeconds,
        completedWorkActivities.length
    );


    // -----------------------------------------------------
    // RENDER TABLES
    // -----------------------------------------------------

    renderRecentProfiling(
        completedJobs
    );


    renderRecentWorkActivities(
        completedWorkActivities
    );

}


// =========================================================
// UPDATE KPI CARDS
// =========================================================

function updateDashboardKPIs(
    teamCount,
    membersCount,
    totalSeconds
) {

    if (teamsToday) {

        teamsToday.textContent =
            teamCount;

    }


    if (membersToday) {

        membersToday.textContent =
            membersCount;

    }


    if (totalTimeToday) {

        totalTimeToday.textContent =
            formatDuration(
                totalSeconds
            );

    }

}


// =========================================================
// UPDATE WORK ACTIVITY KPI CARDS
// =========================================================

function updateWorkActivityKPIs(
    prodSeconds,
    nonProdSeconds,
    activityCount
) {

    if (prodTimeToday) {

        prodTimeToday.textContent =
            formatDuration(
                prodSeconds
            );

    }


    if (nonProdTimeToday) {

        nonProdTimeToday.textContent =
            formatDuration(
                nonProdSeconds
            );

    }


    if (activitiesToday) {

        activitiesToday.textContent =
            activityCount;

    }

}


// =========================================================
// TODAY'S TIME BREAKDOWN
// =========================================================

function updateTimeBreakdown(
    profilingSeconds,
    prodSeconds,
    nonProdSeconds,
    totalSeconds
) {

    const safeTotal =
        Number(totalSeconds) || 0;


    // -----------------------------------------------------
    // CALCULATE PERCENTAGES
    // -----------------------------------------------------

    const profilingPercent =
        safeTotal > 0
            ? Math.round(
                (
                    Number(profilingSeconds) /
                    safeTotal
                ) * 100
            )
            : 0;


    const prodPercent =
        safeTotal > 0
            ? Math.round(
                (
                    Number(prodSeconds) /
                    safeTotal
                ) * 100
            )
            : 0;


    const nonProdPercent =
        safeTotal > 0
            ? Math.round(
                (
                    Number(nonProdSeconds) /
                    safeTotal
                ) * 100
            )
            : 0;


    // -----------------------------------------------------
    // PROFILING
    // -----------------------------------------------------

    if (profilingBreakdownTime) {

        profilingBreakdownTime.textContent =
            formatDuration(
                profilingSeconds
            );

    }


    if (profilingBreakdownPercent) {

        profilingBreakdownPercent.textContent =
            `${profilingPercent}%`;

    }


    if (profilingBreakdownBar) {

        profilingBreakdownBar.style.width =
            `${profilingPercent}%`;

    }


    // -----------------------------------------------------
    // PROD
    // -----------------------------------------------------

    if (prodBreakdownTime) {

        prodBreakdownTime.textContent =
            formatDuration(
                prodSeconds
            );

    }


    if (prodBreakdownPercent) {

        prodBreakdownPercent.textContent =
            `${prodPercent}%`;

    }


    if (prodBreakdownBar) {

        prodBreakdownBar.style.width =
            `${prodPercent}%`;

    }


    // -----------------------------------------------------
    // NON-PROD
    // -----------------------------------------------------

    if (nonProdBreakdownTime) {

        nonProdBreakdownTime.textContent =
            formatDuration(
                nonProdSeconds
            );

    }


    if (nonProdBreakdownPercent) {

        nonProdBreakdownPercent.textContent =
            `${nonProdPercent}%`;

    }


    if (nonProdBreakdownBar) {

        nonProdBreakdownBar.style.width =
            `${nonProdPercent}%`;

    }

}


// =========================================================
// PRODUCTIVITY SUMMARY
// =========================================================

function updateProductivitySummary(
    profilingSeconds,
    prodSeconds,
    nonProdSeconds,
    totalSeconds
) {

    const profiling =
        Number(profilingSeconds) || 0;


    const prod =
        Number(prodSeconds) || 0;


    const nonProd =
        Number(nonProdSeconds) || 0;


    const total =
        Number(totalSeconds) || 0;


    // -----------------------------------------------------
    // UPDATE SUMMARY VALUES
    // -----------------------------------------------------

    if (summaryProfilingTime) {

        summaryProfilingTime.textContent =
            formatDuration(
                profiling
            );

    }


    if (summaryProdTime) {

        summaryProdTime.textContent =
            formatDuration(
                prod
            );

    }


    if (summaryNonProdTime) {

        summaryNonProdTime.textContent =
            formatDuration(
                nonProd
            );

    }


    if (summaryTotalTime) {

        summaryTotalTime.textContent =
            formatDuration(
                total
            );

    }


    // -----------------------------------------------------
    // NO ACTIVITY
    // -----------------------------------------------------

    if (total <= 0) {

        if (productivityInsight) {

            productivityInsight.textContent =
                "No recorded activity yet today.";

        }

        return;

    }


    // -----------------------------------------------------
    // FIND THE LARGEST TIME CATEGORY
    // -----------------------------------------------------

    const categories = [

        {
            name: "Profiling",
            seconds: profiling
        },

        {
            name: "PROD Activities",
            seconds: prod
        },

        {
            name: "NON-PROD Activities",
            seconds: nonProd
        }

    ];


    const largestCategory =
        categories.reduce(
            (
                largest,
                current
            ) =>

                current.seconds >
                largest.seconds

                    ? current
                    : largest

        );


    const percentage =
        Math.round(
            (
                largestCategory.seconds /
                total
            ) * 100
        );


    // -----------------------------------------------------
    // UPDATE INSIGHT
    // -----------------------------------------------------

    if (productivityInsight) {

        productivityInsight.textContent =
            `Most of your recorded time today was spent on ${largestCategory.name} (${percentage}%).`;

    }

}


// =========================================================
// RECENT PROFILING
// =========================================================

function renderRecentProfiling(
    jobs
) {

    if (!recentProfilingBody) {
        return;
    }


    // -----------------------------------------------------
    // NO RECORDS
    // -----------------------------------------------------

    if (
        !jobs ||
        jobs.length === 0
    ) {

        recentProfilingBody.innerHTML =
            `
            <tr>

                <td
                    colspan="5"
                    class="status-empty"
                >
                    No profiling records today.
                </td>

            </tr>
            `;

        return;
    }


    // -----------------------------------------------------
    // DISPLAY MAXIMUM 5
    // -----------------------------------------------------

    const recentJobs =
        jobs.slice(
            0,
            5
        );


    recentProfilingBody.innerHTML =
        recentJobs
            .map(
                job => {

                    const duration =
                        formatDuration(
                            Number(
                                job.total_seconds ||
                                0
                            )
                        );


                    return `
                        <tr>

                            <td>
                                ${escapeHtml(
                                    job.team_name ||
                                    "--"
                                )}
                            </td>

                            <td>
                                TEAM + MEMBERS
                            </td>

                            <td>
                                ${duration}
                            </td>

                            <td>
                                <span class="status-badge completed">
                                    COMPLETED
                                </span>
                            </td>

                            <td>
                                ${formatDate(
                                    job.finished_at
                                )}
                            </td>

                        </tr>
                    `;

                }
            )
            .join("");

}


// =========================================================
// RECENT WORK ACTIVITIES
// =========================================================

function renderRecentWorkActivities(
    activities
) {

    if (
        !recentWorkActivityTable
    ) {

        return;

    }


    if (
        !activities ||
        activities.length === 0
    ) {

        recentWorkActivityTable.innerHTML =
            `
            <tr>

                <td
                    colspan="4"
                    class="status-empty"
                >
                    No work activities today.
                </td>

            </tr>
            `;

        return;

    }


    const recentActivities =
        activities.slice(
            0,
            5
        );


    recentWorkActivityTable.innerHTML =
        recentActivities
            .map(
                activity => `

                    <tr>

                        <td>

                            ${escapeHtml(
                                activity.task_name ||
                                "--"
                            )}

                        </td>


                        <td>

                            ${escapeHtml(
                                activity.category ||
                                "--"
                            )}

                        </td>


                        <td>

                            ${formatDuration(
                                activity.duration_seconds
                            )}

                        </td>


                        <td>

                            ${formatDateTime(
                                activity.ended_at
                            )}

                        </td>

                    </tr>

                `
            )
            .join("");

}


// =========================================================
// FORMAT DURATION
// =========================================================

function formatDuration(
    totalSeconds
) {

    let seconds =
        Math.max(
            0,
            Math.round(
                Number(
                    totalSeconds
                ) ||
                0
            )
        );


    const hours =
        Math.floor(
            seconds /
            3600
        );


    seconds %=
        3600;


    const minutes =
        Math.floor(
            seconds /
            60
        );


    seconds %=
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

function formatDate(
    value
) {

    if (!value) {
        return "--";
    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "--";

    }


    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );

}


// =========================================================
// FORMAT DATE TIME
// =========================================================

function formatDateTime(
    value
) {

    if (!value) {

        return "--";

    }


    const date =
        new Date(
            value
        );


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
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    );

}


// =========================================================
// INITIALS
// =========================================================

function getInitials(
    name
) {

    const parts =
        String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (
        parts.length === 0
    ) {

        return "--";

    }


    if (
        parts.length === 1
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
// HTML ESCAPE
// =========================================================

function escapeHtml(
    value
) {

    return String(
        value ??
        ""
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
// LOGOUT
// =========================================================

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async event => {

            event.preventDefault();


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

            }

        }
    );

}


// =====================================================
// ACCOUNT MANAGEMENT
// =====================================================

const userSection =
    document.getElementById(
        "userSection"
    );


function openAccountManagement() {

    window.location.href =
        "account.html";

}


if (
    userSection
) {

    userSection.addEventListener(
        "click",
        openAccountManagement
    );


    userSection.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" ||
                event.key === " "
            ) {

                event.preventDefault();

                openAccountManagement();

            }

        }
    );

}


// =========================================================
// START
// =========================================================

initializeDashboard();