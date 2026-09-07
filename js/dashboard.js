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

const userRole =
    document.getElementById("userRole");

const userAvatar =
    document.getElementById("userAvatar");

const welcomeTitle =
    document.getElementById("welcomeTitle");

const dashboardDate =
    document.getElementById("dashboardDate");

const logoutButton =
    document.getElementById("logoutButton");

const userSection =
    document.getElementById("userSection");

const reportsNavItem =
    document.getElementById("reportsNavItem");

const dashboardDateFilter =
    document.getElementById(
        "dashboardDateFilter"
    );

const dashboardTodayButton =
    document.getElementById(
        "dashboardTodayButton"
    );

const dashboardDateLabel =
    document.getElementById(
        "dashboardDateLabel"
    );


// =========================================================
// OVERVIEW
// =========================================================

const teamsToday =
    document.getElementById("teamsToday");

const membersToday =
    document.getElementById("membersToday");

const profilingTimeToday =
    document.getElementById("profilingTimeToday");

const workActivityTimeToday =
    document.getElementById("workActivityTimeToday");

const totalTimeToday =
    document.getElementById("totalTimeToday");


// =========================================================
// TIME BREAKDOWN
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


const prodLossBreakdownTime =
    document.getElementById("prodLossBreakdownTime");

const prodLossBreakdownPercent =
    document.getElementById("prodLossBreakdownPercent");

const prodLossBreakdownBar =
    document.getElementById("prodLossBreakdownBar");


const trainingBreakdownTime =
    document.getElementById("trainingBreakdownTime");

const trainingBreakdownPercent =
    document.getElementById("trainingBreakdownPercent");

const trainingBreakdownBar =
    document.getElementById("trainingBreakdownBar");


// =========================================================
// PRODUCTIVITY
// =========================================================

const productivityProdTime =
    document.getElementById("productivityProdTime");

const productivityOtherTime =
    document.getElementById("productivityOtherTime");

const productivityRate =
    document.getElementById("productivityRate");

const productivityInsight =
    document.getElementById("productivityInsight");


// =========================================================
// ACTIVITY SUMMARY
// =========================================================

const prodActivityCount =
    document.getElementById("prodActivityCount");

const nonProdActivityCount =
    document.getElementById("nonProdActivityCount");

const prodLossActivityCount =
    document.getElementById("prodLossActivityCount");

const trainingActivityCount =
    document.getElementById("trainingActivityCount");


const prodTimeSummary =
    document.getElementById("prodTimeSummary");

const nonProdTimeSummary =
    document.getElementById("nonProdTimeSummary");

const prodLossTimeSummary =
    document.getElementById("prodLossTimeSummary");

const trainingTimeSummary =
    document.getElementById("trainingTimeSummary");


// =========================================================
// TABLES
// =========================================================

const recentWorkActivityTable =
    document.getElementById(
        "recentWorkActivityTable"
    );

const recentProfilingTable =
    document.getElementById(
        "recentProfilingTable"
    );


// =========================================================
// CATEGORY CONSTANTS
// =========================================================

const CATEGORY = {
    PROD: "PROD",
    NON_PROD: "NON-PROD",
    PROD_LOSS: "PROD LOSS",
    TRAINING: "TRAINING"
};


// =========================================================
// INITIALIZE
// =========================================================

async function initializeDashboard() {

    try {

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


        // =================================================
        // PROFILE
        // =================================================

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


        // =================================================
        // ROLE
        // =================================================

        const role =
            String(
                profile.role || ""
            )
                .trim()
                .toUpperCase();


        if (reportsNavItem) {

            reportsNavItem.style.display =
                role === "ADMIN"
                    ? "flex"
                    : "none";

        }


        // =================================================
        // USER DISPLAY
        // =================================================

        const fullName =
            profile.full_name ||
            "Analyst";


        if (userName) {
            userName.textContent =
                fullName;
        }


        if (userRole) {
            userRole.textContent =
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


        if (dashboardDate) {

            dashboardDate.textContent =
                new Date().toLocaleDateString(
                    undefined,
                    {
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                    }
                );

        }


        // =================================================
        // LOAD DATA
        // =================================================

        window.currentDashboardUserId =
        user.id;

        initializeDateFilter();

        await loadDashboardData(
            user.id,
            getLocalTodayString()
        );


        console.log(
            "Dashboard loaded successfully."
        );


    } catch (error) {

        console.error(
            "Dashboard initialization error:",
            error
        );


        showDashboardError(
            error
        );

    }

}


// =========================================================
// LOAD DASHBOARD DATA
// =========================================================

async function loadDashboardData(
    userId,
        selectedDate = null
    ) {

        const {
            startISO,
            endISO,
            date
        } =
            getDateRange(
                selectedDate
            );


    // =================================================
    // LOAD PROFILING JOBS
    // =================================================

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
                startISO
            )
            .lte(
                "finished_at",
                endISO
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
        jobs || [];


    // =================================================
    // LOAD WORK ACTIVITIES
    // =================================================

    const {
        data: activities,
        error: activitiesError
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
                startISO
            )
            .lte(
                "ended_at",
                endISO
            )
            .order(
                "ended_at",
                {
                    ascending: false
                }
            );


    if (activitiesError) {
        throw activitiesError;
    }


    const completedActivities =
        activities || [];


    // =================================================
    // PROFILING STATISTICS
    // =================================================

    const profilingSeconds =
        calculateProfilingTime(
            completedJobs
        );


    // =================================================
    // WORK ACTIVITY STATISTICS
    // =================================================

    const activityStats =
        calculateActivityStatistics(
            completedActivities
        );


    // =================================================
    // TOTALS
    // =================================================

    const workActivitySeconds =
        activityStats.prodSeconds +
        activityStats.nonProdSeconds +
        activityStats.prodLossSeconds +
        activityStats.trainingSeconds;


    const totalRecordedSeconds =
        profilingSeconds +
        workActivitySeconds;


    // =================================================
    // TEAM / MEMBER COUNTS
    // =================================================

    const uniqueTeams =
        new Set();


    let memberCount =
        0;


    completedJobs.forEach(
        job => {

            const teamKey =
                job.team_id ||
                job.team_name ||
                job.id;


            uniqueTeams.add(
                String(teamKey)
            );


            memberCount +=
                Number(
                    job.member_count
                ) || 0;

        }
    );


    // =================================================
    // UPDATE OVERVIEW
    // =================================================

    updateOverview(
        uniqueTeams.size,
        memberCount,
        profilingSeconds,
        workActivitySeconds,
        totalRecordedSeconds
    );


    // =================================================
    // UPDATE TIME BREAKDOWN
    // =================================================

    updateTimeBreakdown({

        profiling:
            profilingSeconds,

        prod:
            activityStats.prodSeconds,

        nonProd:
            activityStats.nonProdSeconds,

        prodLoss:
            activityStats.prodLossSeconds,

        training:
            activityStats.trainingSeconds,

        total:
            totalRecordedSeconds

    });


    // =================================================
    // UPDATE PRODUCTIVITY
    // =================================================

    updateProductivity(
        activityStats.prodSeconds,
        workActivitySeconds
    );


    // =================================================
    // UPDATE ACTIVITY SUMMARY
    // =================================================

    updateActivitySummary(
        activityStats
    );


    // =================================================
    // TABLES
    // =================================================

    renderRecentWorkActivities(
        completedActivities
    );


    renderRecentProfiling(
        completedJobs
    );

}


// =========================================================
// SELECTED DATE RANGE
// =========================================================

function getDateRange(dateString) {

    let selectedDate;

    if (dateString) {

        const parts =
            dateString.split("-");

        selectedDate =
            new Date(
                Number(parts[0]),
                Number(parts[1]) - 1,
                Number(parts[2])
            );

    } else {

        const now =
            new Date();

        selectedDate =
            new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate()
            );
    }


    const start =
        new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            0,
            0,
            0,
            0
        );


    const end =
        new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            23,
            59,
            59,
            999
        );


    return {

        startISO:
            start.toISOString(),

        endISO:
            end.toISOString(),

        date:
            selectedDate

    };

}

// =========================================================
// FORMAT FILTER DATE
// =========================================================

function formatFilterDate(
    dateString
) {

    const {
        date
    } =
        getDateRange(
            dateString
        );

    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    );

}


// =========================================================
// GET LOCAL TODAY AS YYYY-MM-DD
// =========================================================

function getLocalTodayString() {

    const now =
        new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );

    return `${year}-${month}-${day}`;

}


// =========================================================
// UPDATE DATE LABEL
// =========================================================

function updateDashboardDateLabel(
    dateString
) {

    if (!dashboardDateLabel) {
        return;
    }

    dashboardDateLabel.textContent =
        `Showing data for ${formatFilterDate(
            dateString
        )}`;

}


// =========================================================
// PROFILING TIME
// =========================================================

function calculateProfilingTime(
    jobs
) {

    let total =
        0;


    jobs.forEach(
        job => {

            const seconds =
                Number(
                    job.total_seconds
                ) || 0;


            if (seconds > 0) {

                total +=
                    seconds;

            } else {

                const start =
                    parseDate(
                        job.started_at
                    );

                const end =
                    parseDate(
                        job.finished_at
                    );


                if (
                    start &&
                    end &&
                    end > start
                ) {

                    total +=
                        Math.floor(
                            (
                                end - start
                            ) / 1000
                        );

                }

            }

        }
    );


    return total;

}


// =========================================================
// WORK ACTIVITY STATISTICS
// =========================================================

function calculateActivityStatistics(
    activities
) {

    const stats = {

        prodSeconds: 0,

        nonProdSeconds: 0,

        prodLossSeconds: 0,

        trainingSeconds: 0,

        prodCount: 0,

        nonProdCount: 0,

        prodLossCount: 0,

        trainingCount: 0

    };


    activities.forEach(
        activity => {

            const category =
                normalizeCategory(
                    activity.category
                );


            const duration =
                Math.max(
                    0,
                    Number(
                        activity.duration_seconds
                    ) || 0
                );


            switch (category) {

                case CATEGORY.PROD:

                    stats.prodSeconds +=
                        duration;

                    stats.prodCount++;

                    break;


                case CATEGORY.NON_PROD:

                    stats.nonProdSeconds +=
                        duration;

                    stats.nonProdCount++;

                    break;


                case CATEGORY.PROD_LOSS:

                    stats.prodLossSeconds +=
                        duration;

                    stats.prodLossCount++;

                    break;


                case CATEGORY.TRAINING:

                    stats.trainingSeconds +=
                        duration;

                    stats.trainingCount++;

                    break;

            }

        }
    );


    return stats;

}


// =========================================================
// CATEGORY NORMALIZATION
// =========================================================

function normalizeCategory(
    value
) {

    const category =
        String(
            value || ""
        )
            .trim()
            .toUpperCase();


    if (
        category === "PROD" ||
        category === "PRODUCTION"
    ) {

        return CATEGORY.PROD;

    }


    if (
        category === "NON-PROD" ||
        category === "NON PRODUCTION" ||
        category === "NON-PROD ACTIVITIES" ||
        category === "NON-PRODUCTION"
    ) {

        return CATEGORY.NON_PROD;

    }


    if (
        category === "PROD LOSS" ||
        category === "PRODUCTION LOSS" ||
        category === "PROD_LOSS"
    ) {

        return CATEGORY.PROD_LOSS;

    }


    if (
        category === "TRAINING"
    ) {

        return CATEGORY.TRAINING;

    }


    return category;

}


// =========================================================
// OVERVIEW
// =========================================================

function updateOverview(
    teams,
    members,
    profilingSeconds,
    workActivitySeconds,
    totalSeconds
) {

    if (teamsToday) {

        teamsToday.textContent =
            teams;

    }


    if (membersToday) {

        membersToday.textContent =
            members;

    }


    if (profilingTimeToday) {

        profilingTimeToday.textContent =
            formatDuration(
                profilingSeconds
            );

    }


    if (workActivityTimeToday) {

        workActivityTimeToday.textContent =
            formatDuration(
                workActivitySeconds
            );

    }


    if (totalTimeToday) {

        totalTimeToday.textContent =
            formatDuration(
                totalSeconds
            );

    }

}


// =========================================================
// TIME BREAKDOWN
// =========================================================

function updateTimeBreakdown(
    data
) {

    const total =
        Number(data.total) || 0;


    updateBreakdownItem(
        profilingBreakdownTime,
        profilingBreakdownPercent,
        profilingBreakdownBar,
        data.profiling,
        total
    );


    updateBreakdownItem(
        prodBreakdownTime,
        prodBreakdownPercent,
        prodBreakdownBar,
        data.prod,
        total
    );


    updateBreakdownItem(
        nonProdBreakdownTime,
        nonProdBreakdownPercent,
        nonProdBreakdownBar,
        data.nonProd,
        total
    );


    updateBreakdownItem(
        prodLossBreakdownTime,
        prodLossBreakdownPercent,
        prodLossBreakdownBar,
        data.prodLoss,
        total
    );


    updateBreakdownItem(
        trainingBreakdownTime,
        trainingBreakdownPercent,
        trainingBreakdownBar,
        data.training,
        total
    );

}


// =========================================================
// BREAKDOWN ITEM
// =========================================================

function updateBreakdownItem(
    timeElement,
    percentElement,
    barElement,
    seconds,
    total
) {

    const safeSeconds =
        Number(seconds) || 0;


    const percentage =
        total > 0
            ? Math.round(
                (
                    safeSeconds /
                    total
                ) * 100
            )
            : 0;


    if (timeElement) {

        timeElement.textContent =
            formatDuration(
                safeSeconds
            );

    }


    if (percentElement) {

        percentElement.textContent =
            `${percentage}%`;

    }


    if (barElement) {

        barElement.style.width =
            `${percentage}%`;

    }

}


// =========================================================
// PRODUCTIVITY
// =========================================================

function updateProductivity(
    prodSeconds,
    workActivitySeconds
) {

    const prod =
        Number(prodSeconds) || 0;

    const work =
        Number(workActivitySeconds) || 0;


    const other =
        Math.max(
            0,
            work - prod
        );


    const rate =
        work > 0
            ? Math.round(
                (
                    prod /
                    work
                ) * 100
            )
            : 0;


    if (productivityProdTime) {

        productivityProdTime.textContent =
            formatDuration(
                prod
            );

    }


    if (productivityOtherTime) {

        productivityOtherTime.textContent =
            formatDuration(
                other
            );

    }


    if (productivityRate) {

        productivityRate.textContent =
            `${rate}%`;

    }


    if (productivityInsight) {

        if (work <= 0) {

            productivityInsight.textContent =
                "No Work Activity has been recorded today.";

        } else {

            productivityInsight.textContent =
                `Productivity rate is ${rate}%. ` +
                `${formatDuration(prod)} of ${formatDuration(work)} ` +
                "of total Work Activity time is classified as PROD.";

        }

    }

}


// =========================================================
// ACTIVITY SUMMARY
// =========================================================

function updateActivitySummary(
    stats
) {

    if (prodActivityCount) {

        prodActivityCount.textContent =
            stats.prodCount;

    }


    if (nonProdActivityCount) {

        nonProdActivityCount.textContent =
            stats.nonProdCount;

    }


    if (prodLossActivityCount) {

        prodLossActivityCount.textContent =
            stats.prodLossCount;

    }


    if (trainingActivityCount) {

        trainingActivityCount.textContent =
            stats.trainingCount;

    }


    if (prodTimeSummary) {

        prodTimeSummary.textContent =
            formatDuration(
                stats.prodSeconds
            );

    }


    if (nonProdTimeSummary) {

        nonProdTimeSummary.textContent =
            formatDuration(
                stats.nonProdSeconds
            );

    }


    if (prodLossTimeSummary) {

        prodLossTimeSummary.textContent =
            formatDuration(
                stats.prodLossSeconds
            );

    }


    if (trainingTimeSummary) {

        trainingTimeSummary.textContent =
            formatDuration(
                stats.trainingSeconds
            );

    }

}


// =========================================================
// RECENT WORK ACTIVITIES
// =========================================================

function renderRecentWorkActivities(
    activities
) {

    if (!recentWorkActivityTable) {
        return;
    }


    if (
        !activities ||
        activities.length === 0
    ) {

        recentWorkActivityTable.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="status-empty"
                >
                    No completed Work Activity records today.
                </td>
            </tr>
        `;

        return;

    }


    const recent =
        activities.slice(
            0,
            8
        );


    recentWorkActivityTable.innerHTML =
        recent
            .map(
                activity => {

                    const category =
                        normalizeCategory(
                            activity.category
                        );


                    return `
                        <tr>

                            <td class="table-primary">
                                ${escapeHtml(
                                    activity.task_name ||
                                    "--"
                                )}
                            </td>

                            <td>
                                ${renderCategoryBadge(
                                    category
                                )}
                            </td>

                            <td class="table-duration">
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
                    `;

                }
            )
            .join("");

}


// =========================================================
// RECENT PROFILING
// =========================================================

function renderRecentProfiling(
    jobs
) {

    if (!recentProfilingTable) {
        return;
    }


    if (
        !jobs ||
        jobs.length === 0
    ) {

        recentProfilingTable.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="status-empty"
                >
                    No completed profiling records today.
                </td>
            </tr>
        `;

        return;

    }


    const recent =
        jobs.slice(
            0,
            8
        );


    recentProfilingTable.innerHTML =
        recent
            .map(
                job => {

                    return `
                        <tr>

                            <td class="table-primary">
                                ${escapeHtml(
                                    job.team_name ||
                                    "--"
                                )}
                            </td>

                            <td>
                                ${Number(
                                    job.member_count
                                ) || 0}
                            </td>

                            <td class="table-duration">
                                ${formatDuration(
                                    job.total_seconds
                                )}
                            </td>

                            <td>
                                <span class="status-badge status-completed">
                                    ${escapeHtml(
                                        job.status ||
                                        "COMPLETED"
                                    )}
                                </span>
                            </td>

                            <td>
                                ${formatDateTime(
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
// CATEGORY BADGE
// =========================================================

function renderCategoryBadge(
    category
) {

    let className =
        "category-neutral";

    let label =
        category || "--";


    if (
        category ===
        CATEGORY.PROD
    ) {

        className =
            "category-prod";

        label =
            "PROD";

    }


    if (
        category ===
        CATEGORY.NON_PROD
    ) {

        className =
            "category-nonprod";

        label =
            "NON-PROD";

    }


    if (
        category ===
        CATEGORY.PROD_LOSS
    ) {

        className =
            "category-loss";

        label =
            "PROD LOSS";

    }


    if (
        category ===
        CATEGORY.TRAINING
    ) {

        className =
            "category-training";

        label =
            "TRAINING";

    }


    return `
        <span class="category-badge ${className}">
            ${escapeHtml(label)}
        </span>
    `;

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
                ) || 0
            )
        );


    const hours =
        Math.floor(
            seconds / 3600
        );


    seconds %=
        3600;


    const minutes =
        Math.floor(
            seconds / 60
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
// FORMAT DATE TIME — 12-HOUR FORMAT
// =========================================================

function formatDateTime(value) {

    if (!value) {
        return "--";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "--";
    }

    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}


// =========================================================
// PARSE DATE
// =========================================================

function parseDate(
    value
) {

    if (!value) {
        return null;
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return null;

    }


    return date;

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
// DASHBOARD ERROR
// =========================================================

function showDashboardError(
    error
) {

    console.error(
        "Dashboard error:",
        error
    );


    if (productivityInsight) {

        productivityInsight.textContent =
            "Dashboard data could not be loaded. Check the browser console for the database error.";

    }

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


// =========================================================
// ACCOUNT MANAGEMENT
// =========================================================

function openAccountManagement() {

    window.location.href =
        "account.html";

}


if (userSection) {

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
// DATE FILTER
// =========================================================

function initializeDateFilter() {

    if (!dashboardDateFilter) {
        return;
    }


    const today =
        getLocalTodayString();


    dashboardDateFilter.value =
        today;


    updateDashboardDateLabel(
        today
    );


    // -----------------------------------------------------
    // DATE CHANGED
    // -----------------------------------------------------

    dashboardDateFilter.addEventListener(
        "change",
        async () => {

            const selectedDate =
                dashboardDateFilter.value;

            if (!selectedDate) {
                return;
            }


            updateDashboardDateLabel(
                selectedDate
            );


            try {

                await loadDashboardData(
                    window.currentDashboardUserId,
                    selectedDate
                );

            } catch (error) {

                console.error(
                    "Date filter error:",
                    error
                );

                showDashboardError(
                    error
                );

            }

        }
    );


    // -----------------------------------------------------
    // TODAY BUTTON
    // -----------------------------------------------------

    if (dashboardTodayButton) {

        dashboardTodayButton.addEventListener(
            "click",
            async () => {

                const today =
                    getLocalTodayString();


                dashboardDateFilter.value =
                    today;


                updateDashboardDateLabel(
                    today
                );


                try {

                    await loadDashboardData(
                        window.currentDashboardUserId,
                        today
                    );

                } catch (error) {

                    console.error(
                        "Today filter error:",
                        error
                    );

                    showDashboardError(
                        error
                    );

                }

            }
        );

    }

}




// =========================================================
// START
// =========================================================

initializeDashboard();