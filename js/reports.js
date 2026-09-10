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

const userRole =
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

const reportsError =
    document.getElementById(
        "reportsError"
    );


// =========================================================
// KPI ELEMENTS
// =========================================================

const totalAnalysts =
    document.getElementById(
        "totalAnalysts"
    );

const completedJobs =
    document.getElementById(
        "completedJobs"
    );

const totalProductivity =
    document.getElementById(
        "totalProductivity"
    );

const averageProductivity =
    document.getElementById(
        "averageProductivity"
    );


// =========================================================
// FILTER ELEMENTS
// =========================================================

const analystFilter =
    document.getElementById(
        "analystFilter"
    );

const teamSearch =
    document.getElementById(
        "teamSearch"
    );

const fromDate =
    document.getElementById(
        "fromDate"
    );

const toDate =
    document.getElementById(
        "toDate"
    );

const applyFiltersButton =
    document.getElementById(
        "applyFiltersButton"
    );

const resetFiltersButton =
    document.getElementById(
        "resetFiltersButton"
    );

const exportCsvButton =
    document.getElementById(
        "exportCsvButton"
    );

const workActivityCategoryFilter =
    document.getElementById(
        "workActivityCategoryFilter"
    );


// =========================================================
// REPORT ELEMENTS
// =========================================================

const analystChart =
    document.getElementById(
        "analystChart"
    );

const sessionChart =
    document.getElementById(
        "sessionChart"
    );

const productivityTrendChart =
    document.getElementById(
        "productivityTrendChart"
    );

const reportsTableBody =
    document.getElementById(
        "reportsTableBody"
    );

const workActivityReportsTableBody =
    document.getElementById(
        "workActivityReportsTableBody"
    );

// =========================================================
// PAGINATION ELEMENTS
// =========================================================

const reportPagination =
    document.getElementById(
        "reportPagination"
    );


const paginationInfo =
    document.getElementById(
        "paginationInfo"
    );


const previousPageButton =
    document.getElementById(
        "previousPageButton"
    );


const pageIndicator =
    document.getElementById(
        "pageIndicator"
    );


const nextPageButton =
    document.getElementById(
        "nextPageButton"
    );

// =========================================================
// WORK ACTIVITY PAGINATION ELEMENTS
// =========================================================

const workActivityPagination =
    document.getElementById(
        "workActivityPagination"
    );


const workActivityPaginationInfo =
    document.getElementById(
        "workActivityPaginationInfo"
    );


const workActivityPreviousPageButton =
    document.getElementById(
        "workActivityPreviousPageButton"
    );


const workActivityPageIndicator =
    document.getElementById(
        "workActivityPageIndicator"
    );


const workActivityNextPageButton =
    document.getElementById(
        "workActivityNextPageButton"
    );


// =========================================================
// DATA STATE
// =========================================================

let reportRecords = [];

let workActivityReportRecords = [];

const recordsPerPage = 20;

let currentPage = 1;

const workActivityRecordsPerPage = 20;

let workActivityCurrentPage = 1;

let filteredRecords = [];

let currentSortColumn = "";

let currentSortDirection = "asc";


// =========================================================
// INITIALIZE
// =========================================================

async function initializeReports() {

    try {

        clearError();


        // -------------------------------------------------
        // GET CURRENT USER
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
        // CHECK ACCOUNT STATUS
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
        // ADMIN CHECK
        // -------------------------------------------------

        const role =
            String(
                profile.role || ""
            )
                .trim()
                .toUpperCase();


        if (
            role !==
            "ADMIN"
        ) {

            alert(
                "Administrator access is required to view Reports."
            );


            window.location.href =
                "dashboard.html";


            return;
        }


        // -------------------------------------------------
        // DISPLAY ADMIN INFORMATION
        // -------------------------------------------------

        userName.textContent =
            profile.full_name ||
            "Administrator";


        userRole.textContent =
            profile.role ||
            "ADMIN";


        userAvatar.textContent =
            getInitials(
                profile.full_name ||
                "Admin"
            );


        // -------------------------------------------------
        // LOAD REPORT DATA
        // -------------------------------------------------

        await loadReports();
        await loadWorkActivityReports();

        // Include analysts who appear only in work activity logs.
        populateAnalystFilter([
            ...reportRecords,
            ...workActivityReportRecords
        ]);

        // Re-render charts after work activity data is available
        // so profiling + PROD + NON-PROD appear together.
        renderReports(reportRecords);


        // -------------------------------------------------
        // BUTTON EVENTS
        // -------------------------------------------------

        if (
            applyFiltersButton
        ) {

            applyFiltersButton.addEventListener(
                "click",
                applyFilters
            );

        }


        if (
            resetFiltersButton
        ) {

            resetFiltersButton.addEventListener(
                "click",
                resetFilters
            );

        }


        if (
            exportCsvButton
        ) {

            exportCsvButton.addEventListener(
                "click",
                exportCsv
            );

        }

        // =========================================================
        // PAGINATION BUTTONS
        // =========================================================

        if (previousPageButton) {

            previousPageButton.addEventListener(
                "click",
                () => {

                    if (currentPage > 1) {

                        currentPage--;

                        renderReports(
                            getFilteredRecords()
                        );

                    }

                }
            );

        }


        if (nextPageButton) {

            nextPageButton.addEventListener(
                "click",
                () => {

                    const filteredRecords =
                        getFilteredRecords();


                    const totalPages =
                        Math.ceil(
                            filteredRecords.length /
                            recordsPerPage
                        );


                    if (
                        currentPage <
                        totalPages
                    ) {

                        currentPage++;

                        renderReports(
                            filteredRecords
                        );

                    }

                }
            );

        }

        initializeTableSorting();


        console.log(
            "Admin Reports loaded successfully."
        );


        console.log(
            "Completed jobs:",
            reportRecords.length
        );


    } catch (error) {

        console.error(
            "Reports initialization error:",
            error
        );


        showError(
            error.message ||
            "Unable to initialize Reports."
        );

    }

}


// =========================================================
// LOAD REPORTS
// =========================================================

async function loadReports() {

    clearError();

    // -----------------------------------------------------
    // GET COMPLETED PROFILING JOBS
    // -----------------------------------------------------

    const {
        data: jobs,
        error: jobsError
    } = await supabase
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

    console.log(
        "Completed profiling jobs:",
        jobs
    );

    if (!jobs || jobs.length === 0) {
        reportRecords = [];
        filteredRecords = [];
        populateAnalystFilter([]);
        renderReports([]);
        return;
    }

    // =====================================================
    // STAGE 1 + 2
    // LOAD ALL COMPLETED TIMER SESSIONS
    //
    // Do NOT filter timer_sessions by profiling_jobs.id here.
    // Older Ticky Ticky records may contain a legacy job ID.
    // Loading the complete completed-session set allows us to
    // recover those records using their real time window.
    // =====================================================

    async function fetchAllRows(
        tableName,
        selectColumns,
        pageSize = 1000
    ) {
        const rows = [];

        for (let from = 0; ; from += pageSize) {

            const {
                data,
                error
            } = await supabase
                .from(tableName)
                .select(selectColumns)
                .range(
                    from,
                    from + pageSize - 1
                );

            if (error) {
                throw error;
            }

            const page = data || [];

            rows.push(...page);

            if (page.length < pageSize) {
                break;
            }
        }

        return rows;
    }

    const sessions =
        await fetchAllRows(
            "timer_sessions",
            `
                id,
                profiling_job_id,
                session_type,
                status,
                started_at,
                stopped_at,
                total_seconds
            `
        );

    console.log(
        "Reports timer sessions loaded:",
        sessions.length
    );

    // -----------------------------------------------------
    // TIMER EVENTS
    // Loaded in batches so large report histories do not
    // create an oversized Supabase .in() request.
    // -----------------------------------------------------

    const sessionIds =
        sessions
            .map(
                session => session.id
            )
            .filter(
                id =>
                    id !== null &&
                    id !== undefined
            );

    let timerEvents = [];

    const EVENT_BATCH_SIZE = 100;

    for (
        let i = 0;
        i < sessionIds.length;
        i += EVENT_BATCH_SIZE
    ) {

        const batchIds =
            sessionIds.slice(
                i,
                i + EVENT_BATCH_SIZE
            );

        const {
            data: eventRows,
            error: eventsError
        } = await supabase
            .from("timer_events")
            .select(`
                session_id,
                event_type,
                event_time
            `)
            .in(
                "session_id",
                batchIds
            )
            .order(
                "event_time",
                {
                    ascending: true
                }
            );

        if (eventsError) {
            throw eventsError;
        }

        timerEvents.push(
            ...(eventRows || [])
        );
    }

    console.log(
        "Reports timer events loaded:",
        timerEvents.length
    );

    // -----------------------------------------------------
    // ANALYST PROFILES
    // -----------------------------------------------------

    const analystIds =
        [
            ...new Set(
                jobs
                    .map(
                        job =>
                            job.analyst_id
                    )
                    .filter(Boolean)
            )
        ];

    let profiles = [];

    if (analystIds.length > 0) {

        const {
            data: profileRows,
            error: profilesError
        } = await supabase
            .from("profiles")
            .select(`
                id,
                full_name,
                role
            `)
            .in(
                "id",
                analystIds
            );

        if (profilesError) {
            throw profilesError;
        }

        profiles =
            profileRows || [];
    }

    // =====================================================
    // TIME HELPERS
    // =====================================================

    function toMilliseconds(value) {

        const time =
            new Date(value).getTime();

        return Number.isFinite(time)
            ? time
            : NaN;
    }

    function safeSeconds(value) {

        const seconds =
            Number(value);

        return Number.isFinite(seconds) &&
            seconds > 0
            ? Math.floor(seconds)
            : 0;
    }

    function getEventsForSession(
        session
    ) {

        return timerEvents
            .filter(
                event =>
                    String(
                        event.session_id
                    ) ===
                    String(
                        session.id
                    )
            )
            .sort(
                (a, b) =>
                    toMilliseconds(
                        a.event_time
                    ) -
                    toMilliseconds(
                        b.event_time
                    )
            );
    }

    // Calculates ONLY active time from START/RESUME
    // through PAUSE/STOP.
    function calculateEventSeconds(
        session
    ) {

        if (!session) {
            return 0;
        }

        const events =
            getEventsForSession(
                session
            );

        let totalMilliseconds = 0;
        let activeStart = null;

        for (
            const event of events
        ) {

            const eventTime =
                toMilliseconds(
                    event.event_time
                );

            if (
                !Number.isFinite(
                    eventTime
                )
            ) {
                continue;
            }

            const type =
                String(
                    event.event_type ||
                    ""
                )
                    .trim()
                    .toUpperCase();

            if (
                type === "START" ||
                type === "RESUME"
            ) {

                // A repeated START/RESUME should not
                // create a second simultaneous interval.
                if (
                    activeStart === null
                ) {
                    activeStart =
                        eventTime;
                }

                continue;
            }

            if (
                type === "PAUSE" ||
                type === "STOP"
            ) {

                if (
                    activeStart !== null &&
                    eventTime > activeStart
                ) {

                    totalMilliseconds +=
                        eventTime -
                        activeStart;

                }

                activeStart = null;
            }
        }

        return Math.max(
            0,
            Math.floor(
                totalMilliseconds /
                1000
            )
        );
    }

    // Source-of-truth priority:
    // 1. timer_sessions.total_seconds
    // 2. timer_events active intervals
    // 3. started_at -> stopped_at for legacy records
    function getAccurateSessionSeconds(
        session
    ) {

        if (!session) {
            return 0;
        }

        const stored =
            safeSeconds(
                session.total_seconds
            );

        if (stored > 0) {
            return stored;
        }

        const eventSeconds =
            calculateEventSeconds(
                session
            );

        if (eventSeconds > 0) {
            return eventSeconds;
        }

        const start =
            toMilliseconds(
                session.started_at
            );

        const stop =
            toMilliseconds(
                session.stopped_at
            );

        if (
            Number.isFinite(start) &&
            Number.isFinite(stop) &&
            stop > start
        ) {

            return Math.floor(
                (
                    stop -
                    start
                ) / 1000
            );

        }

        return 0;
    }

    // -----------------------------------------------------
    // DAILY BREAKDOWN
    // -----------------------------------------------------

    function buildDailySessionBreakdown(
        sessionList
    ) {

        const breakdown = {};

        function addInterval(
            startMs,
            endMs
        ) {

            if (
                !Number.isFinite(startMs) ||
                !Number.isFinite(endMs) ||
                endMs <= startMs
            ) {
                return;
            }

            let cursor =
                new Date(
                    startMs
                );

            const end =
                new Date(
                    endMs
                );

            while (
                cursor < end
            ) {

                const dayStart =
                    new Date(
                        cursor
                    );

                dayStart.setHours(
                    0,
                    0,
                    0,
                    0
                );

                const nextDay =
                    new Date(
                        dayStart
                    );

                nextDay.setDate(
                    nextDay.getDate() + 1
                );

                const segmentEnd =
                    end < nextDay
                        ? end
                        : nextDay;

                const seconds =
                    Math.max(
                        0,
                        Math.floor(
                            (
                                segmentEnd -
                                cursor
                            ) / 1000
                        )
                    );

                if (
                    seconds > 0
                ) {

                    const dateKey =
                        [
                            cursor.getFullYear(),
                            String(
                                cursor.getMonth() + 1
                            ).padStart(
                                2,
                                "0"
                            ),
                            String(
                                cursor.getDate()
                            ).padStart(
                                2,
                                "0"
                            )
                        ].join("-");

                    breakdown[dateKey] =
                        (
                            breakdown[dateKey] ||
                            0
                        ) +
                        seconds;
                }

                cursor =
                    segmentEnd;
            }
        }

        (
            sessionList || []
        ).forEach(
            session => {

                const events =
                    getEventsForSession(
                        session
                    );

                let eventSeconds = 0;
                let activeStart = null;

                for (
                    const event of events
                ) {

                    const eventTime =
                        toMilliseconds(
                            event.event_time
                        );

                    if (
                        !Number.isFinite(
                            eventTime
                        )
                    ) {
                        continue;
                    }

                    const type =
                        String(
                            event.event_type ||
                            ""
                        )
                            .trim()
                            .toUpperCase();

                    if (
                        type === "START" ||
                        type === "RESUME"
                    ) {

                        if (
                            activeStart === null
                        ) {
                            activeStart =
                                eventTime;
                        }

                        continue;
                    }

                    if (
                        type === "PAUSE" ||
                        type === "STOP"
                    ) {

                        if (
                            activeStart !== null &&
                            eventTime > activeStart
                        ) {

                            addInterval(
                                activeStart,
                                eventTime
                            );

                            eventSeconds +=
                                Math.floor(
                                    (
                                        eventTime -
                                        activeStart
                                    ) / 1000
                                );
                        }

                        activeStart = null;
                    }
                }

                // If there are usable timer events, use those
                // exact active intervals for daily attribution.
                if (
                    eventSeconds > 0
                ) {
                    return;
                }

                // Legacy fallback. This is intentionally used
                // only when event data cannot produce a duration.
                const start =
                    toMilliseconds(
                        session.started_at
                    );

                const stop =
                    toMilliseconds(
                        session.stopped_at
                    );

                if (
                    Number.isFinite(start) &&
                    Number.isFinite(stop) &&
                    stop > start
                ) {

                    addInterval(
                        start,
                        stop
                    );
                }
            }
        );

        return breakdown;
    }

    function getBreakdownTotal(
        breakdown
    ) {

        return Object.values(
            breakdown || {}
        ).reduce(
            (
                total,
                value
            ) => {

                const seconds =
                    Number(value);

                return total +
                    (
                        Number.isFinite(
                            seconds
                        )
                            ? seconds
                            : 0
                    );

            },
            0
        );
    }

    // =====================================================
    // STAGE 1
    // BUILD AN UNAMBIGUOUS SESSION POOL
    //
    // Exact profiling_job_id matches always win.
    // Every timer session can belong to at most ONE report.
    // =====================================================

    const jobById =
        new Map(
            jobs.map(
                job => [
                    String(job.id),
                    job
                ]
            )
        );

    const sessionsByJobId =
        new Map();

    const assignedSessionIds =
        new Set();

    // First pass: exact foreign-key matches.
    for (
        const session of sessions
    ) {

        const job =
            jobById.get(
                String(
                    session.profiling_job_id
                )
            );

        if (!job) {
            continue;
        }

        const jobKey =
            String(
                job.id
            );

        if (
            !sessionsByJobId.has(
                jobKey
            )
        ) {
            sessionsByJobId.set(
                jobKey,
                []
            );
        }

        sessionsByJobId
            .get(jobKey)
            .push(session);

        assignedSessionIds.add(
            String(session.id)
        );
    }

    // =====================================================
    // STAGE 1 LEGACY RECOVERY
    //
    // For sessions whose profiling_job_id does not match
    // a current profiling_jobs.id, find the closest valid
    // profiling-job time window.
    //
    // A legacy session is assigned ONCE, preventing one timer
    // from being counted against multiple jobs.
    // =====================================================

    function getLegacyCandidateScore(
        session,
        job
    ) {

        const sessionStart =
            toMilliseconds(
                session.started_at
            );

        const sessionStop =
            toMilliseconds(
                session.stopped_at
            );

        const jobStart =
            toMilliseconds(
                job.started_at
            );

        const jobFinish =
            toMilliseconds(
                job.finished_at
            );

        if (
            !Number.isFinite(sessionStart) ||
            !Number.isFinite(sessionStop) ||
            !Number.isFinite(jobStart) ||
            !Number.isFinite(jobFinish) ||
            sessionStop <= sessionStart ||
            jobFinish <= jobStart
        ) {
            return null;
        }

        // Keep the same safety boundary as the previous
        // recovery logic, with a slightly more forgiving
        // two-minute clock boundary for legacy data.
        const tolerance =
            2 * 60 * 1000;

        if (
            sessionStart <
                jobStart - tolerance ||
            sessionStop >
                jobFinish + tolerance
        ) {
            return null;
        }

        const sessionMid =
            (
                sessionStart +
                sessionStop
            ) / 2;

        const jobMid =
            (
                jobStart +
                jobFinish
            ) / 2;

        const startDistance =
            Math.abs(
                sessionStart -
                jobStart
            );

        const stopDistance =
            Math.abs(
                sessionStop -
                jobFinish
            );

        const midpointDistance =
            Math.abs(
                sessionMid -
                jobMid
            );

        // Lower score = stronger match.
        return (
            startDistance +
            stopDistance +
            (
                midpointDistance *
                0.25
            )
        );
    }

    const legacyCandidates = [];

    for (
        const session of sessions
    ) {

        const sessionId =
            String(
                session.id
            );

        if (
            assignedSessionIds.has(
                sessionId
            )
        ) {
            continue;
        }

        const sessionType =
            String(
                session.session_type ||
                ""
            )
                .trim()
                .toUpperCase();

        if (
            sessionType !== "TEAM" &&
            sessionType !== "MEMBERS" &&
            sessionType !== "MEMBER"
        ) {
            continue;
        }

        for (
            const job of jobs
        ) {

            const score =
                getLegacyCandidateScore(
                    session,
                    job
                );

            if (
                score === null
            ) {
                continue;
            }

            legacyCandidates.push({
                session,
                job,
                score
            });
        }
    }

    // Strongest matches first.
    legacyCandidates.sort(
        (a, b) =>
            a.score -
            b.score
    );

    const legacyAssignedJobs =
        new Set();

    for (
        const candidate of legacyCandidates
    ) {

        const sessionKey =
            String(
                candidate.session.id
            );

        const jobKey =
            String(
                candidate.job.id
            );

        if (
            assignedSessionIds.has(
                sessionKey
            )
        ) {
            continue;
        }

        if (
            !sessionsByJobId.has(
                jobKey
            )
        ) {
            sessionsByJobId.set(
                jobKey,
                []
            );
        }

        // A session is allowed to be assigned once.
        sessionsByJobId
            .get(jobKey)
            .push(
                candidate.session
            );

        assignedSessionIds.add(
            sessionKey
        );

        legacyAssignedJobs.add(
            jobKey
        );
    }

    // =====================================================
    // STAGE 2 + 3
    // BUILD VALIDATED REPORT RECORDS
    // =====================================================

    reportRecords =
        jobs.map(
            job => {

                const jobKey =
                    String(
                        job.id
                    );

                const jobSessions =
                    (
                        sessionsByJobId.get(
                            jobKey
                        ) || []
                    ).slice();

                // -------------------------------------------------
                // SUM ALL TEAM/MEMBER SESSIONS
                // Never use Array.find() here.
                // -------------------------------------------------

                const teamSessions =
                    jobSessions.filter(
                        session => {

                            const type =
                                String(
                                    session.session_type ||
                                    ""
                                )
                                    .trim()
                                    .toUpperCase();

                            return (
                                type === "TEAM" ||
                                type.includes(
                                    "TEAM"
                                )
                            );
                        }
                    );

                const membersSessions =
                    jobSessions.filter(
                        session => {

                            const type =
                                String(
                                    session.session_type ||
                                    ""
                                )
                                    .trim()
                                    .toUpperCase();

                            return (
                                type === "MEMBERS" ||
                                type === "MEMBER" ||
                                type.includes(
                                    "MEMBER"
                                )
                            );
                        }
                    );

                const teamSeconds =
                    teamSessions.reduce(
                        (
                            total,
                            session
                        ) =>
                            total +
                            getAccurateSessionSeconds(
                                session
                            ),
                        0
                    );

                const membersSeconds =
                    membersSessions.reduce(
                        (
                            total,
                            session
                        ) =>
                            total +
                            getAccurateSessionSeconds(
                                session
                            ),
                        0
                    );

                const sessionTotalSeconds =
                    teamSeconds +
                    membersSeconds;

                const jobTotalSeconds =
                    safeSeconds(
                        job.total_seconds
                    );

                // -------------------------------------------------
                // STAGE 2:
                // SESSION TOTAL IS PRIMARY.
                // Job total is only a fallback when the detailed
                // session breakdown is genuinely unavailable.
                // -------------------------------------------------

                const hasDetailedSessionTime =
                    sessionTotalSeconds > 0;

                const totalSeconds =
                    hasDetailedSessionTime
                        ? sessionTotalSeconds
                        : jobTotalSeconds;

                // -------------------------------------------------
                // STAGE 5:
                // VALIDATE the stored job total against the
                // detailed TEAM + MEMBERS total.
                // -------------------------------------------------

                const differenceSeconds =
                    Math.abs(
                        sessionTotalSeconds -
                        jobTotalSeconds
                    );

                let accuracyStatus =
                    "NO_BREAKDOWN";

                if (
                    sessionTotalSeconds > 0 &&
                    jobTotalSeconds > 0
                ) {

                    accuracyStatus =
                        differenceSeconds <= 2
                            ? "VERIFIED"
                            : "INCONSISTENT";

                }
                else if (
                    sessionTotalSeconds > 0
                ) {

                    accuracyStatus =
                        "SESSION_VERIFIED";

                }
                else if (
                    jobTotalSeconds > 0
                ) {

                    accuracyStatus =
                        "JOB_TOTAL_ONLY";

                }

                const wasLegacyMatched =
                    jobSessions.some(
                        session =>
                            String(
                                session.profiling_job_id
                            ) !==
                            jobKey
                    );

                if (
                    wasLegacyMatched &&
                    accuracyStatus === "VERIFIED"
                ) {
                    accuracyStatus =
                        "LEGACY_VERIFIED";
                }
                else if (
                    wasLegacyMatched &&
                    accuracyStatus === "SESSION_VERIFIED"
                ) {
                    accuracyStatus =
                        "LEGACY_SESSION";
                }

                const dailyBreakdown =
                    buildDailySessionBreakdown(
                        jobSessions
                    );

                const analyst =
                    profiles.find(
                        profile =>
                            String(
                                profile.id
                            ) ===
                            String(
                                job.analyst_id
                            )
                    );

                return {

                    id:
                        job.id,

                    analyst_id:
                        job.analyst_id,

                    analystName:
                        analyst?.full_name ||
                        "Unknown Analyst",

                    analystRole:
                        analyst?.role ||
                        "ANALYST",

                    team_name:
                        job.team_name ||
                        "--",

                    team_id:
                        job.team_id ??
                        "--",

                    member_count:
                        job.member_count ??
                        0,

                    started_at:
                        job.started_at,

                    finished_at:
                        job.finished_at,

                    teamSeconds:
                        teamSeconds,

                    membersSeconds:
                        membersSeconds,

                    totalSeconds:
                        totalSeconds,

                    storedJobTotalSeconds:
                        jobTotalSeconds,

                    sessionTotalSeconds:
                        sessionTotalSeconds,

                    differenceSeconds:
                        differenceSeconds,

                    accuracyStatus:
                        accuracyStatus,

                    wasLegacyMatched:
                        wasLegacyMatched,

                    teamSessionCount:
                        teamSessions.length,

                    membersSessionCount:
                        membersSessions.length,

                    dailyBreakdown:
                        dailyBreakdown,

                    // Full session/event data used by the clickable
                    // report-details audit panel.
                    detailSessions:
                        jobSessions.map(
                            session => {
                                const sessionEvents =
                                    getEventsForSession(
                                        session
                                    );

                                const eventActiveSeconds =
                                    calculateEventSeconds(
                                        session
                                    );

                                const storedSeconds =
                                    safeSeconds(
                                        session.total_seconds
                                    );

                                const sessionStart =
                                    toMilliseconds(
                                        session.started_at
                                    );

                                const sessionStop =
                                    toMilliseconds(
                                        session.stopped_at
                                    );

                                const wallSeconds =
                                    Number.isFinite(sessionStart) &&
                                    Number.isFinite(sessionStop) &&
                                    sessionStop > sessionStart
                                        ? Math.floor(
                                            (sessionStop - sessionStart) / 1000
                                        )
                                        : 0;

                                const activeForPauseEstimate =
                                    eventActiveSeconds > 0
                                        ? eventActiveSeconds
                                        : storedSeconds;

                                return {
                                    ...session,
                                    events: sessionEvents,
                                    eventActiveSeconds,
                                    storedSeconds,
                                    wallSeconds,
                                    pauseSeconds: Math.max(
                                        0,
                                        wallSeconds - activeForPauseEstimate
                                    )
                                };
                            }
                        )

                };

            }
        );

    // =====================================================
    // STAGE 5 SUMMARY LOGGING
    // =====================================================

    const accuracySummary =
        reportRecords.reduce(
            (
                summary,
                record
            ) => {

                const key =
                    record.accuracyStatus ||
                    "UNKNOWN";

                summary[key] =
                    (
                        summary[key] ||
                        0
                    ) + 1;

                return summary;

            },
            {}
        );

    console.log(
        "REPORT ACCURACY SUMMARY:",
        accuracySummary
    );

    console.table(
        reportRecords.map(
            record => ({
                jobId: record.id,
                analyst: record.analystName,
                team: record.team_name,
                teamsSeconds: record.teamSeconds,
                membersSeconds: record.membersSeconds,
                detailedTotal: record.sessionTotalSeconds,
                storedJobTotal: record.storedJobTotalSeconds,
                difference: record.differenceSeconds,
                status: record.accuracyStatus
            })
        )
    );

    // -----------------------------------------------------
    // FILTERS + INITIAL RENDER
    // -----------------------------------------------------

    populateAnalystFilter(
        reportRecords
    );

    renderReports(
        reportRecords
    );

}


// =========================================================
// LOAD WORK ACTIVITY REPORTS
// =========================================================

async function loadWorkActivityReports() {

    try {

        if (
            workActivityReportsTableBody
        ) {

            workActivityReportsTableBody.innerHTML =
                `
                <tr>

                    <td
                        colspan="6"
                        class="status-empty"
                    >
                        Loading work activity logs...
                    </td>

                </tr>
                `;

        }


        // -------------------------------------------------
        // GET COMPLETED WORK ACTIVITY LOGS
        // -------------------------------------------------

        const {
            data: logs,
            error: logsError
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
                .not(
                    "ended_at",
                    "is",
                    null
                )
                .order(
                    "ended_at",
                    {
                        ascending: false
                    }
                );


                console.log(
                    "TASK LOGS RESULT:",
                    logs
                );

                console.log(
                    "TASK LOGS ERROR:",
                    logsError
                );


        if (logsError) {

            throw logsError;

        }


        workActivityReportRecords =
            logs ||
            [];


        // -------------------------------------------------
        // NO RECORDS
        // -------------------------------------------------

        if (
            workActivityReportRecords.length === 0
        ) {

            renderWorkActivityReports(
                []
            );

            return;

        }


        // -------------------------------------------------
        // GET UNIQUE ANALYST IDs
        // -------------------------------------------------

        const analystIds =
            [
                ...new Set(
                    workActivityReportRecords
                        .map(
                            record =>
                                record.analyst_id
                        )
                        .filter(Boolean)
                )
            ];


        let profiles = [];


        // -------------------------------------------------
        // GET ANALYST PROFILES
        // -------------------------------------------------

        if (
            analystIds.length > 0
        ) {

            const {
                data: profileRows,
                error: profilesError
            } =
                await supabase
                    .from("profiles")
                    .select(`
                        id,
                        full_name
                    `)
                    .in(
                        "id",
                        analystIds
                    );


            if (profilesError) {

                throw profilesError;

            }


            profiles =
                profileRows ||
                [];

        }


        // -------------------------------------------------
        // CREATE ANALYST LOOKUP
        // -------------------------------------------------

        const analystMap =
            new Map(
                profiles.map(
                    profile => [

                        String(
                            profile.id
                        ),

                        profile.full_name ||
                        "Unknown Analyst"

                    ]
                )
            );


        // -------------------------------------------------
        // ATTACH ANALYST NAME
        // -------------------------------------------------

        workActivityReportRecords =
            workActivityReportRecords.map(
                record => {

                    return {

                        ...record,

                        analystName:
                            analystMap.get(
                                String(
                                    record.analyst_id
                                )
                            ) ||
                            "Unknown Analyst"

                    };

                }
            );


        // -------------------------------------------------
        // RENDER TABLE
        // -------------------------------------------------

        renderWorkActivityReports(
            workActivityReportRecords
        );


        console.log(
            "Work activity reports loaded:",
            workActivityReportRecords
        );

    } catch (error) {

        console.error(
            "Work activity reports error:",
            error
        );


        workActivityReportRecords =
            [];


        renderWorkActivityReports(
            []
        );

    }

}


// =========================================================
// RENDER WORK ACTIVITY REPORTS
// =========================================================

function renderWorkActivityReports(
    records
) {

    if (
        !workActivityReportsTableBody
    ) {

        return;

    }


    const totalRecords =
        records?.length || 0;


    // -------------------------------------------------
    // NO RECORDS
    // -------------------------------------------------

    if (
        totalRecords === 0
    ) {

        workActivityReportsTableBody.innerHTML =
            `
            <tr>

                <td
                    colspan="6"
                    class="status-empty"
                >
                    No completed work activity logs found.
                </td>

            </tr>
            `;


        updateWorkActivityPagination(
            0
        );

        return;

    }


    // -------------------------------------------------
    // CALCULATE PAGES
    // -------------------------------------------------

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
        records.slice(
            startIndex,
            endIndex
        );


    // -------------------------------------------------
    // RENDER CURRENT PAGE
    // -------------------------------------------------

    workActivityReportsTableBody.innerHTML =
        pageRecords
            .map(
                record =>
                    `
                    <tr>

                        <td>
                            ${escapeHtml(
                                record.analystName ||
                                "Unknown Analyst"
                            )}
                        </td>


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
                            <strong>
                                ${formatDuration(
                                    Number(
                                        record.duration_seconds ||
                                        0
                                    )
                                )}
                            </strong>
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

                    </tr>
                    `
            )
            .join("");


    updateWorkActivityPagination(
        totalRecords
    );

}


// =========================================================
// UPDATE WORK ACTIVITY PAGINATION
// =========================================================

function updateWorkActivityPagination(
    totalRecords
) {

    if (
        !workActivityPagination
    ) {

        return;

    }


    // -------------------------------------------------
    // NO RECORDS
    // -------------------------------------------------

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
        ) +
        1;


    const endRecord =
        Math.min(
            workActivityCurrentPage *
            workActivityRecordsPerPage,
            totalRecords
        );


    if (
        workActivityPaginationInfo
    ) {

        workActivityPaginationInfo.textContent =
            `Showing ${startRecord}–${endRecord} of ${totalRecords} activities`;

    }


    if (
        workActivityPageIndicator
    ) {

        workActivityPageIndicator.textContent =
            `Page ${workActivityCurrentPage} of ${totalPages}`;

    }


    if (
        workActivityPreviousPageButton
    ) {

        workActivityPreviousPageButton.disabled =
            workActivityCurrentPage <= 1;

    }


    if (
        workActivityNextPageButton
    ) {

        workActivityNextPageButton.disabled =
            workActivityCurrentPage >= totalPages;

    }

}


// =========================================================
// ANALYST FILTER
// =========================================================

function populateAnalystFilter(
    records
) {

    if (!analystFilter) {
        return;
    }


    const currentValue =
        analystFilter.value;


    const analysts =
        [
            ...new Map(
                records.map(
                    record => [

                        String(
                            record.analyst_id
                        ),

                        record.analystName

                    ]
                )
            ).entries()
        ]
            .sort(
                (
                    a,
                    b
                ) =>
                    String(
                        a[1]
                    ).localeCompare(
                        String(
                            b[1]
                        )
                    )
            );


    analystFilter.innerHTML =
        `
        <option value="">
            All Analysts
        </option>
        `;


    analysts.forEach(
        (
            [
                id,
                name
            ]
        ) => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                id;


            option.textContent =
                name;


            analystFilter.appendChild(
                option
            );

        }
    );


    if (
        analysts.some(
            item =>
                item[0] ===
                currentValue
        )
    ) {

        analystFilter.value =
            currentValue;

    }

}


// =========================================================
// APPLY FILTERS
// =========================================================

function applyFilters() {

    // =====================================================
    // RESET BOTH PAGINATIONS
    // =====================================================

    currentPage = 1;

    workActivityCurrentPage = 1;


    // =====================================================
    // PROFILING DATA
    // =====================================================

    const profilingData =
        getFilteredRecords();


    renderReports(
        profilingData
    );


    // =====================================================
    // WORK ACTIVITY DATA
    // =====================================================

    const workActivityData =
        getFilteredWorkActivityRecords();


    renderWorkActivityReports(
        workActivityData
    );

}


// =========================================================
// GET FILTERED RECORDS
// =========================================================

function getFilteredRecords() {

    const analystValue =
        analystFilter?.value ||
        "";


    const teamValue =
    String(
        teamSearch?.value ||
        ""
    )
        .trim()
        .toLowerCase();


    const fromValue =
        fromDate?.value ||
        "";


    const toValue =
        toDate?.value ||
        "";


    return reportRecords.filter(
        record => {


            // ---------------------------------------------
            // ANALYST
            // ---------------------------------------------

            if (
                analystValue &&
                String(
                    record.analyst_id
                ) !==
                String(
                    analystValue
                )
            ) {

                return false;

            }


            // ---------------------------------------------
            // TEAM
            // ---------------------------------------------

                            if (
                    teamValue
                ) {

                    const teamId =
                        String(
                            record.team_id ??
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    const teamName =
                        String(
                            record.team_name ??
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    const matchesTeam =
                        teamId.includes(
                            teamValue
                        ) ||
                        teamName.includes(
                            teamValue
                        );


                    if (
                        !matchesTeam
                    ) {

                        return false;

                    }

                }


            // ---------------------------------------------
            // DATE
            // ---------------------------------------------

            if (
                fromValue ||
                toValue
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
                    Number.isNaN(
                        completedDate.getTime()
                    )
                ) {

                    return false;

                }


                if (
                    fromValue
                ) {

                    const from =
                        new Date(
                            `${fromValue}T00:00:00`
                        );


                    if (
                        completedDate <
                        from
                    ) {

                        return false;

                    }

                }


                if (
                    toValue
                ) {

                    const to =
                        new Date(
                            `${toValue}T23:59:59.999`
                        );


                    if (
                        completedDate >
                        to
                    ) {

                        return false;

                    }

                }

            }


            return true;

        }
    );

}


// =========================================================
// GET FILTERED WORK ACTIVITY RECORDS
// =========================================================


function getFilteredWorkActivityRecords() {

    const analystValue =
        analystFilter?.value ||
        "";

    const fromValue =
        fromDate?.value ||
        "";

    const toValue =
        toDate?.value ||
        "";

    const categoryValue =
        workActivityCategoryFilter?.value ||
        "";


    return workActivityReportRecords.filter(
        record => {

            // ---------------------------------------------
            // ANALYST
            // ---------------------------------------------

            if (
                analystValue &&
                String(
                    record.analyst_id
                ) !==
                String(
                    analystValue
                )
            ) {

                return false;

            }


            // ---------------------------------------------
            // CATEGORY
            // This must be OUTSIDE the date filter
            // ---------------------------------------------

            const recordCategory =
                String(
                    record.category ||
                    ""
                )
                    .trim()
                    .toUpperCase();


            const selectedCategory =
                String(
                    categoryValue
                )
                    .trim()
                    .toUpperCase();


            if (
                selectedCategory &&
                recordCategory !==
                selectedCategory
            ) {

                return false;

            }


            // ---------------------------------------------
            // DATE
            // Uses the completed date of the activity
            // ---------------------------------------------

            if (
                fromValue ||
                toValue
            ) {

                if (
                    !record.ended_at
                ) {

                    return false;

                }


                const completedDate =
                    new Date(
                        record.ended_at
                    );


                if (
                    Number.isNaN(
                        completedDate.getTime()
                    )
                ) {

                    return false;

                }


                // -----------------------------------------
                // FROM DATE
                // -----------------------------------------

                if (
                    fromValue
                ) {

                    const from =
                        new Date(
                            `${fromValue}T00:00:00`
                        );


                    if (
                        completedDate <
                        from
                    ) {

                        return false;

                    }

                }


                // -----------------------------------------
                // TO DATE
                // -----------------------------------------

                if (
                    toValue
                ) {

                    const to =
                        new Date(
                            `${toValue}T23:59:59.999`
                        );


                    if (
                        completedDate >
                        to
                    ) {

                        return false;

                    }

                }

            }


            return true;

        }
    );

}


// =========================================================
// RESET FILTERS
// =========================================================

function resetFilters() {

    if (analystFilter) {
        analystFilter.value = "";
    }


    if (teamSearch) {

    teamSearch.value =
        "";

        }


    if (fromDate) {
        fromDate.value = "";
    }


    if (toDate) {
        toDate.value = "";
    }

    if (
    workActivityCategoryFilter
    ) {

        workActivityCategoryFilter.value =
            "";

    }

    currentPage = 1;

    workActivityCurrentPage = 1;


    renderReports(
        reportRecords
    );

    renderWorkActivityReports(
    workActivityReportRecords
    );

}


// =========================================================
// RENDER EVERYTHING
// =========================================================

function renderReports(
    records
) {

    filteredRecords =
        Array.isArray(
            records
        )
            ? records
            : [];


    // -----------------------------------------------------
    // KPI
    // -----------------------------------------------------

    const uniqueAnalysts =
        new Set(
            filteredRecords
                .map(
                    record =>
                        record.analyst_id
                )
                .filter(Boolean)
        );


    const jobs =
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


    const averageSeconds =
        jobs >
        0
            ? Math.round(
                totalSeconds /
                jobs
            )
            : 0;


    if (totalAnalysts) {

        totalAnalysts.textContent =
            uniqueAnalysts.size;

    }


    if (completedJobs) {

        completedJobs.textContent =
            jobs;

    }


    if (totalProductivity) {

        totalProductivity.textContent =
            formatDuration(
                totalSeconds
            );

    }


    if (averageProductivity) {

        averageProductivity.textContent =
            formatDuration(
                averageSeconds
            );

    }


    // -----------------------------------------------------
    // TABLE
    // -----------------------------------------------------

    renderTable(
    sortRecords(
        filteredRecords
    )
        );


    // -----------------------------------------------------
    // CHARTS
    // -----------------------------------------------------

    const chartWorkActivityData =
        getFilteredWorkActivityRecords();

    renderAnalystChart(
        filteredRecords,
        chartWorkActivityData
    );


    renderSessionChart(
        filteredRecords
    );

    renderProductivityTrend(
        filteredRecords,
        chartWorkActivityData
    );

}


// =========================================================
// TABLE
// =========================================================

function renderTable(
    records
) {

    if (!reportsTableBody) {
        return;
    }

    const totalRecords =
        records?.length || 0;

    if (totalRecords === 0) {

        reportsTableBody.innerHTML =
            `
            <tr>
                <td
                    colspan="8"
                    class="status-empty"
                >
                    No completed profiling records found.
                </td>
            </tr>
            `;

        updatePagination(0);

        return;
    }

    const totalPages =
        Math.ceil(
            totalRecords /
            recordsPerPage
        );

    if (
        currentPage >
        totalPages
    ) {
        currentPage =
            totalPages;
    }

    if (
        currentPage < 1
    ) {
        currentPage = 1;
    }

    const startIndex =
        (
            currentPage - 1
        ) *
        recordsPerPage;

    const endIndex =
        Math.min(
            startIndex +
            recordsPerPage,
            totalRecords
        );

    const pageRecords =
        records.slice(
            startIndex,
            endIndex
        );

    function accuracyLabel(
        record
    ) {

        const status =
            record.accuracyStatus ||
            "UNKNOWN";

        const labels = {
            VERIFIED:
                "✓ Verified",
            SESSION_VERIFIED:
                "✓ Session",
            LEGACY_VERIFIED:
                "✓ Legacy match",
            LEGACY_SESSION:
                "✓ Legacy session",
            INCONSISTENT:
                "⚠ Check total",
            JOB_TOTAL_ONLY:
                "⚠ Job total only",
            NO_BREAKDOWN:
                "— No breakdown"
        };

        const label =
            labels[status] ||
            "—";

        const isWarning =
            status === "INCONSISTENT" ||
            status === "JOB_TOTAL_ONLY";

        const isLegacy =
            status === "LEGACY_VERIFIED" ||
            status === "LEGACY_SESSION";

        const title =
            status === "INCONSISTENT"
                ? `Detailed TEAM + MEMBERS time differs from the stored job total by ${formatDuration(record.differenceSeconds)}.`
                : status === "JOB_TOTAL_ONLY"
                    ? "No usable TEAM/MEMBERS session duration was found. The stored profiling job total is being used."
                    : isLegacy
                        ? "This report recovered a legacy timer session using its profiling-job time window."
                        : status === "NO_BREAKDOWN"
                            ? "No usable detailed profiling duration was found."
                            : "Detailed profiling time is available.";

        const textColor =
            isWarning
                ? "#b42318"
                : isLegacy
                    ? "#7567D8"
                    : "var(--text-secondary)";

        return `
            <span
                title="${escapeHtml(title)}"
                style="
                    display:inline-block;
                    margin-left:7px;
                    font-size:10px;
                    font-weight:700;
                    color:${textColor};
                    white-space:nowrap;
                "
            >
                ${escapeHtml(label)}
            </span>
        `;
    }

    reportsTableBody.innerHTML =
        pageRecords
            .map(
                record =>
                    `
                    <tr
                        class="report-clickable-row"
                        data-report-id="${escapeHtml(String(record.id))}"
                        data-report-accuracy="${escapeHtml(record.accuracyStatus || "UNKNOWN")}"
                        title="Click to view detailed session timeline"
                    >

                        <td>
                            ${escapeHtml(
                                record.analystName
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                record.team_name
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                String(
                                    record.team_id
                                )
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                record.member_count
                            )}
                        </td>

                        <td>
                            ${formatDuration(
                                record.teamSeconds
                            )}
                        </td>

                        <td>
                            ${formatDuration(
                                record.membersSeconds
                            )}
                        </td>

                        <td>
                            <strong>
                                ${formatDuration(
                                    record.totalSeconds
                                )}
                            </strong>
                            ${accuracyLabel(record)}
                        </td>

                        <td>
                            ${formatDateTime(
                                record.finished_at
                            )}
                        </td>

                    </tr>
                    `
            )
            .join("");

    updatePagination(
        totalRecords
    );
}


// =========================================================
// UPDATE PAGINATION
// =========================================================

function updatePagination(
    totalRecords
) {

    if (!reportPagination) {
        return;
    }


    // -----------------------------------------------------
    // NO RECORDS
    // -----------------------------------------------------

    if (totalRecords === 0) {

        reportPagination.style.display =
            "none";

        return;

    }


    reportPagination.style.display =
        "flex";


    const totalPages =
        Math.ceil(
            totalRecords /
            recordsPerPage
        );


    const startRecord =
        (
            (
                currentPage - 1
            ) *
            recordsPerPage
        ) +
        1;


    const endRecord =
        Math.min(
            currentPage *
            recordsPerPage,
            totalRecords
        );


    // -----------------------------------------------------
    // INFO
    // -----------------------------------------------------

    if (paginationInfo) {

        paginationInfo.textContent =
            `Showing ${startRecord}–${endRecord} of ${totalRecords} records`;

    }


    // -----------------------------------------------------
    // PAGE INDICATOR
    // -----------------------------------------------------

    if (pageIndicator) {

        pageIndicator.textContent =
            `Page ${currentPage} of ${totalPages}`;

    }


    // -----------------------------------------------------
    // BUTTON STATES
    // -----------------------------------------------------

    if (previousPageButton) {

        previousPageButton.disabled =
            currentPage <= 1;

    }


    if (nextPageButton) {

        nextPageButton.disabled =
            currentPage >= totalPages;

    }

    // =========================================================
    // WORK ACTIVITY PAGINATION BUTTONS
    // =========================================================

    if (
        workActivityPreviousPageButton
    ) {

        workActivityPreviousPageButton.addEventListener(
            "click",
            () => {

                if (
                    workActivityCurrentPage > 1
                ) {

                    workActivityCurrentPage--;

                    renderWorkActivityReports(
                        workActivityReportRecords
                    );

                }

            }
        );

    }


    if (
        workActivityNextPageButton
    ) {

        workActivityNextPageButton.addEventListener(
            "click",
            () => {

                const totalPages =
                    Math.ceil(
                        workActivityReportRecords.length /
                        workActivityRecordsPerPage
                    );


                if (
                    workActivityCurrentPage <
                    totalPages
                ) {

                    workActivityCurrentPage++;

                    renderWorkActivityReports(
                        workActivityReportRecords
                    );

                }

            }
        );

    }


}


// =========================================================
// TABLE SORTING
// =========================================================

function initializeTableSorting() {

    const headers =
        document.querySelectorAll(
            ".sortable-header"
        );


    headers.forEach(
        header => {

            header.addEventListener(
                "click",
                () => {

                    const column =
                        header.dataset.sort;


                    if (
                        currentSortColumn ===
                        column
                    ) {

                        currentSortDirection =
                            currentSortDirection ===
                            "asc"
                                ? "desc"
                                : "asc";

                    } else {

                        currentSortColumn =
                            column;

                        currentSortDirection =
                            "asc";

                    }


                    updateSortIndicators();


                    const sorted =
                        sortRecords(
                            filteredRecords
                        );


                    renderTable(
                        sorted
                    );

                }
            );

        }
    );

}


function sortRecords(
    records
) {

    const sorted =
        [
            ...records
        ];


    sorted.sort(
        (
            a,
            b
        ) => {

            let valueA;

            let valueB;


            switch (
                currentSortColumn
            ) {

                case "analyst":

                    valueA =
                        String(
                            a.analystName ||
                            ""
                        )
                            .toLowerCase();

                    valueB =
                        String(
                            b.analystName ||
                            ""
                        )
                            .toLowerCase();

                    break;


                case "team":

                    valueA =
                        String(
                            a.team_name ||
                            ""
                        )
                            .toLowerCase();

                    valueB =
                        String(
                            b.team_name ||
                            ""
                        )
                            .toLowerCase();

                    break;


                case "teamId":

                    valueA =
                        String(
                            a.team_id ??
                            ""
                        )
                            .toLowerCase();

                    valueB =
                        String(
                            b.team_id ??
                            ""
                        )
                            .toLowerCase();

                    break;


                case "members":

                    valueA =
                        Number(
                            a.member_count ||
                            0
                        );

                    valueB =
                        Number(
                            b.member_count ||
                            0
                        );

                    break;


                case "teamTime":

                    valueA =
                        Number(
                            a.teamSeconds ||
                            0
                        );

                    valueB =
                        Number(
                            b.teamSeconds ||
                            0
                        );

                    break;


                case "membersTime":

                    valueA =
                        Number(
                            a.membersSeconds ||
                            0
                        );

                    valueB =
                        Number(
                            b.membersSeconds ||
                            0
                        );

                    break;


                case "totalTime":

                    valueA =
                        Number(
                            a.totalSeconds ||
                            0
                        );

                    valueB =
                        Number(
                            b.totalSeconds ||
                            0
                        );

                    break;


                case "completed":

                    valueA =
                        new Date(
                            a.finished_at ||
                            0
                        ).getTime();

                    valueB =
                        new Date(
                            b.finished_at ||
                            0
                        ).getTime();

                    break;


                default:

                    return 0;

            }


            if (
                valueA <
                valueB
            ) {

                return currentSortDirection ===
                    "asc"
                    ? -1
                    : 1;

            }


            if (
                valueA >
                valueB
            ) {

                return currentSortDirection ===
                    "asc"
                    ? 1
                    : -1;

            }


            return 0;

        }
    );


    return sorted;

}

function updateSortIndicators() {

    const headers =
        document.querySelectorAll(
            ".sortable-header"
        );


    headers.forEach(
        header => {

            header.classList.remove(
                "sort-asc",
                "sort-desc"
            );


            if (
                header.dataset.sort ===
                currentSortColumn
            ) {

                header.classList.add(
                    currentSortDirection ===
                        "asc"
                        ? "sort-asc"
                        : "sort-desc"
                );

            }

        }
    );

}


// =========================================================
// ANALYST PRODUCTIVITY CHART
// =========================================================

function renderAnalystChart(
    profilingRecords,
    workRecords = []
) {

    if (!analystChart) {
        return;
    }


    const analystTotals = new Map();


    function ensureAnalyst(name) {

        if (!analystTotals.has(name)) {
            analystTotals.set(name, {
                profiling: 0,
                prod: 0,
                nonProd: 0,
                otherWork: 0
            });
        }

        return analystTotals.get(name);

    }


    (profilingRecords || []).forEach(record => {

        const name =
            record.analystName ||
            "Unknown Analyst";

        ensureAnalyst(name).profiling +=
            Number(record.totalSeconds || 0);

    });


    (workRecords || []).forEach(record => {

        const name =
            record.analystName ||
            "Unknown Analyst";

        const category =
            String(record.category || "")
                .trim()
                .toUpperCase();

        const seconds =
            Number(record.duration_seconds || 0);

        const totals =
            ensureAnalyst(name);

        if (category === "PROD") {
            totals.prod += seconds;
        } else if (category === "NON-PROD") {
            totals.nonProd += seconds;
        } else {
            totals.otherWork += seconds;
        }

    });


    const rows =
        [...analystTotals.entries()]
            .map(([name, totals]) => ({
                name,
                ...totals,
                total:
                    totals.profiling +
                    totals.prod +
                    totals.nonProd +
                    totals.otherWork
            }))
            .filter(row => row.total > 0)
            .sort((a, b) => b.total - a.total);


    if (rows.length === 0) {

        analystChart.innerHTML = `
            <div class="chart-empty"
                style="
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    min-height:220px;
                    color:var(--text-secondary);
                    font-size:14px;
                "
            >
                No productivity data available for the selected filters.
            </div>
        `;

        return;
    }


    const maximum =
        Math.max(
            ...rows.map(row => row.total),
            1
        );


    const formatSegment =
        (seconds, label, className) => {

            if (seconds <= 0) {
                return "";
            }

            const width =
                (seconds / maximum) * 100;

            return `
                <div
                    class="${className}"
                    style="
                        width:${width}%;
                        height:100%;
                        min-width:2px;
                    "
                    title="${label}: ${formatDuration(seconds)}"
                ></div>
            `;

        };


    analystChart.innerHTML = `
        <div
            style="
                width:100%;
                padding:8px 4px 4px;
                box-sizing:border-box;
            "
        >

            ${rows.map((row, index) => {

                const share =
                    rows.reduce(
                        (sum, item) => sum + item.total,
                        0
                    ) > 0
                        ? (
                            row.total /
                            rows.reduce(
                                (sum, item) => sum + item.total,
                                0
                            )
                        ) * 100
                        : 0;

                return `
                    <div style="margin-bottom:18px;">

                        <div
                            style="
                                display:flex;
                                justify-content:space-between;
                                align-items:center;
                                gap:12px;
                                margin-bottom:7px;
                            "
                        >

                            <div
                                style="
                                    display:flex;
                                    align-items:center;
                                    gap:8px;
                                    min-width:0;
                                    flex:1;
                                "
                            >

                                <span
                                    style="
                                        min-width:24px;
                                        height:24px;
                                        display:flex;
                                        align-items:center;
                                        justify-content:center;
                                        border-radius:50%;
                                        background:var(--light-green);
                                        color:var(--primary-green);
                                        font-size:11px;
                                        font-weight:800;
                                    "
                                >
                                    ${index + 1}
                                </span>

                                <span
                                    style="
                                        overflow:hidden;
                                        text-overflow:ellipsis;
                                        white-space:nowrap;
                                        color:var(--text-primary);
                                        font-size:13px;
                                        font-weight:700;
                                    "
                                    title="${escapeHtml(row.name)}"
                                >
                                    ${escapeHtml(row.name)}
                                </span>

                            </div>

                            <div
                                style="
                                    display:flex;
                                    align-items:center;
                                    gap:8px;
                                    white-space:nowrap;
                                "
                            >
                                <span
                                    style="
                                        color:var(--text-secondary);
                                        font-size:11px;
                                    "
                                >
                                    ${share.toFixed(1)}%
                                </span>

                                <strong
                                    style="
                                        color:var(--text-primary);
                                        font-size:13px;
                                    "
                                >
                                    ${formatDuration(row.total)}
                                </strong>
                            </div>

                        </div>


                        <div
                            style="
                                width:100%;
                                height:14px;
                                background:var(--light-green);
                                border-radius:999px;
                                overflow:hidden;
                                display:flex;
                            "
                        >
                            ${formatSegment(
                                row.profiling,
                                "Profiling",
                                "profiling-chart-segment"
                            )}

                            ${formatSegment(
                                row.prod,
                                "PROD",
                                "prod-chart-segment"
                            )}

                            ${formatSegment(
                                row.nonProd,
                                "NON-PROD",
                                "nonprod-chart-segment"
                            )}

                            ${formatSegment(
                                row.otherWork,
                                "Other Work",
                                "other-work-chart-segment"
                            )}
                        </div>

                        <div
                            style="
                                display:flex;
                                flex-wrap:wrap;
                                gap:10px;
                                margin-top:7px;
                                font-size:10px;
                                color:var(--text-secondary);
                            "
                        >
                            <span>Profiling: ${formatDuration(row.profiling)}</span>
                            <span>PROD: ${formatDuration(row.prod)}</span>
                            <span>NON-PROD: ${formatDuration(row.nonProd)}</span>
                            ${
                                row.otherWork > 0
                                    ? `<span>Other: ${formatDuration(row.otherWork)}</span>`
                                    : ""
                            }
                        </div>

                    </div>
                `;

            }).join("")}

        </div>
    `;

}


// =========================================================
// TEAM VS MEMBERS
// =========================================================


// =========================================================

function renderSessionChart(
    records
) {

    if (!sessionChart) {
        return;
    }


    const teamSeconds =
        records.reduce(
            (
                total,
                record
            ) =>
                total +
                Number(
                    record.teamSeconds ||
                    0
                ),
            0
        );


    const membersSeconds =
        records.reduce(
            (
                total,
                record
            ) =>
                total +
                Number(
                    record.membersSeconds ||
                    0
                ),
            0
        );


    const total =
        teamSeconds +
        membersSeconds;


    if (
        total <= 0
    ) {

        sessionChart.innerHTML = `
            <div class="chart-empty">
                No data available.
            </div>
        `;

        return;
    }


    const teamPercent =
        (
            teamSeconds /
            total
        ) * 100;


    const membersPercent =
        (
            membersSeconds /
            total
        ) * 100;


    sessionChart.innerHTML = `

        <div
            class="session-chart-content"
            style="
                width:100%;
                max-width:600px;
                display:flex;
                flex-direction:column;
                gap:24px;
            "
        >

            <!-- TOTAL -->

            <div
                style="
                    text-align:center;
                "
            >

                <div
                    style="
                        font-size:12px;
                        color:var(--text-secondary);
                        margin-bottom:6px;
                    "
                >
                    Total Profiling Time
                </div>


                <div
                    style="
                        font-size:32px;
                        font-weight:800;
                        color:var(--text-primary);
                    "
                >
                    ${formatDuration(total)}
                </div>

            </div>


            <!-- PROGRESS BAR -->

            <div
                style="
                    width:100%;
                    height:28px;
                    display:flex;
                    overflow:hidden;
                    border-radius:999px;
                    background:var(--light-green);
                "
            >

                <div
                    style="
                        width:${teamPercent}%;
                        background:var(--primary-green);
                    "
                    title="Team: ${formatDuration(teamSeconds)}"
                ></div>


                <div
                    style="
                        width:${membersPercent}%;
                        background:var(--medium-green);
                    "
                    title="Members: ${formatDuration(membersSeconds)}"
                ></div>

            </div>


            <!-- SUMMARY -->

            <div
                style="
                    display:grid;
                    grid-template-columns:repeat(2, minmax(0, 1fr));
                    gap:16px;
                "
            >

                <!-- TEAM -->

                <div>

                    <div
                        style="
                            font-size:12px;
                            font-weight:700;
                            color:var(--text-secondary);
                            text-transform:uppercase;
                            margin-bottom:6px;
                        "
                    >
                        ● Team
                    </div>


                    <div
                        style="
                            font-size:22px;
                            font-weight:800;
                            color:var(--text-primary);
                        "
                    >
                        ${formatDuration(teamSeconds)}
                    </div>


                    <div
                        style="
                            margin-top:4px;
                            font-size:12px;
                            color:var(--text-secondary);
                        "
                    >
                        ${teamPercent.toFixed(1)}% of total time
                    </div>

                </div>


                <!-- MEMBERS -->

                <div>

                    <div
                        style="
                            font-size:12px;
                            font-weight:700;
                            color:var(--text-secondary);
                            text-transform:uppercase;
                            margin-bottom:6px;
                        "
                    >
                        Members
                    </div>


                    <div
                        style="
                            font-size:22px;
                            font-weight:800;
                            color:var(--text-primary);
                        "
                    >
                        ${formatDuration(membersSeconds)}
                    </div>


                    <div
                        style="
                            margin-top:4px;
                            font-size:12px;
                            color:var(--text-secondary);
                        "
                    >
                        ${membersPercent.toFixed(1)}% of total time
                    </div>

                </div>

            </div>

        </div>

    `;

}


// =========================================================
// PRODUCTIVITY TREND
// =========================================================

function renderProductivityTrend(
    profilingRecords,
    workRecords = []
) {

    if (!productivityTrendChart) {
        return;
    }


    const dailyTotals = new Map();


    function addDaily(dateKey, seconds) {

        if (!dateKey || !seconds) {
            return;
        }

        dailyTotals.set(
            dateKey,
            (dailyTotals.get(dateKey) || 0) +
            Number(seconds || 0)
        );

    }


    (profilingRecords || []).forEach(record => {

        const breakdown =
            record.dailyBreakdown || {};

        Object.entries(breakdown).forEach(
            ([dateKey, seconds]) =>
                addDaily(dateKey, seconds)
        );

        // Legacy fallback when event history is unavailable.
        if (
            Object.keys(breakdown).length === 0 &&
            record.finished_at
        ) {

            const date = new Date(record.finished_at);

            if (!Number.isNaN(date.getTime())) {

                const dateKey = [
                    date.getFullYear(),
                    String(date.getMonth() + 1).padStart(2, "0"),
                    String(date.getDate()).padStart(2, "0")
                ].join("-");

                addDaily(
                    dateKey,
                    Number(record.totalSeconds || 0)
                );

            }

        }

    });


    // Work activities are already stored with their actual
    // duration. Their completion date is used for the daily
    // report because the work log is a completed activity.
    (workRecords || []).forEach(record => {

        if (!record.ended_at) {
            return;
        }

        const date = new Date(record.ended_at);

        if (Number.isNaN(date.getTime())) {
            return;
        }

        const dateKey = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");

        addDaily(
            dateKey,
            Number(record.duration_seconds || 0)
        );

    });


    const rows =
        [...dailyTotals.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]));


    if (rows.length === 0) {

        productivityTrendChart.innerHTML = `
            <div class="chart-empty">
                No productivity data available for the selected filters.
            </div>
        `;

        return;
    }


    const maximum =
        Math.max(
            ...rows.map(row => row[1]),
            1
        );


    const minimumWidth =
        Math.max(
            100,
            rows.length * 70
        );


    productivityTrendChart.innerHTML = `
        <div class="trend-scroll">

            <div
                class="trend-inner"
                style="
                    min-width:${minimumWidth}px;
                    display:flex;
                    flex-direction:column;
                "
            >

                <div
                    style="
                        flex:1;
                        min-height:200px;
                        display:flex;
                        align-items:flex-end;
                        gap:10px;
                        padding:10px 8px 0;
                        border-bottom:1px solid var(--border);
                        box-sizing:border-box;
                    "
                >

                    ${rows.map(([dateKey, seconds]) => {

                        const percentage =
                            (seconds / maximum) * 100;

                        const date =
                            new Date(`${dateKey}T00:00:00`);

                        const label =
                            date.toLocaleDateString(
                                undefined,
                                {
                                    month:"short",
                                    day:"numeric"
                                }
                            );

                        return `
                            <div
                                style="
                                    flex:1;
                                    min-width:40px;
                                    height:100%;
                                    display:flex;
                                    flex-direction:column;
                                    align-items:center;
                                    justify-content:flex-end;
                                    gap:6px;
                                "
                                title="${label}: ${formatDuration(seconds)}"
                            >

                                <span
                                    style="
                                        font-size:10px;
                                        color:var(--text-secondary);
                                        white-space:nowrap;
                                    "
                                >
                                    ${formatDuration(seconds)}
                                </span>

                                <div
                                    style="
                                        width:70%;
                                        max-width:48px;
                                        height:${Math.max(percentage, 3)}%;
                                        min-height:5px;
                                        background:var(--primary-green);
                                        border-radius:7px 7px 0 0;
                                        transition:height .3s ease;
                                    "
                                ></div>

                            </div>
                        `;

                    }).join("")}

                </div>


                <div
                    style="
                        display:flex;
                        gap:10px;
                        padding:8px 8px 4px;
                        box-sizing:border-box;
                    "
                >

                    ${rows.map(([dateKey]) => {

                        const date =
                            new Date(`${dateKey}T00:00:00`);

                        const label =
                            date.toLocaleDateString(
                                undefined,
                                {
                                    month:"short",
                                    day:"numeric"
                                }
                            );

                        return `
                            <div
                                style="
                                    flex:1;
                                    min-width:40px;
                                    text-align:center;
                                    overflow:hidden;
                                    text-overflow:ellipsis;
                                    white-space:nowrap;
                                    color:var(--text-secondary);
                                    font-size:10px;
                                "
                            >
                                ${label}
                            </div>
                        `;

                    }).join("")}

                </div>

            </div>

        </div>
    `;

}


// =========================================================
// EXCEL DESIGN HELPERS


// =========================================================

function styleExcelTitle(
    sheet,
    cell
) {

    if (!sheet[cell]) {
        return;
    }


    sheet[cell].s = {

        font: {
            bold: true,
            sz: 20,
            color: {
                rgb: "FFFFFF"
            }
        },

        fill: {
            fgColor: {
                rgb: "15803D"
            }
        },

        alignment: {
            horizontal: "center",
            vertical: "center"
        }

    };

}


function styleExcelSection(
    sheet,
    cell
) {

    if (!sheet[cell]) {
        return;
    }


    sheet[cell].s = {

        font: {
            bold: true,
            color: {
                rgb: "FFFFFF"
            }
        },

        fill: {
            fgColor: {
                rgb: "1E40AF"
            }
        },

        alignment: {
            vertical: "center"
        }

    };

}


function styleExcelTableHeader(
    sheet,
    range
) {

    const sheetRange =
        XLSX.utils.decode_range(
            range
        );


    for (
        let column = sheetRange.s.c;
        column <= sheetRange.e.c;
        column++
    ) {

        const cellAddress =
            XLSX.utils.encode_cell({
                r: sheetRange.s.r,
                c: column
            });


        if (
            !sheet[cellAddress]
        ) {
            continue;
        }


        sheet[cellAddress].s = {

            font: {
                bold: true,
                color: {
                    rgb: "FFFFFF"
                }
            },

            fill: {
                fgColor: {
                    rgb: "166534"
                }
            },

            alignment: {
                horizontal: "center",
                vertical: "center"
            }

        };

    }

}


function addExcelBorders(
    sheet,
    range
) {

    const sheetRange =
        XLSX.utils.decode_range(
            range
        );


    for (
        let row = sheetRange.s.r;
        row <= sheetRange.e.r;
        row++
    ) {

        for (
            let column = sheetRange.s.c;
            column <= sheetRange.e.c;
            column++
        ) {

            const cellAddress =
                XLSX.utils.encode_cell({
                    r: row,
                    c: column
                });


            if (
                !sheet[cellAddress]
            ) {
                continue;
            }


            sheet[cellAddress].s = {

                ...(
                    sheet[cellAddress].s ||
                    {}
                ),

                border: {

                    top: {
                        style: "thin",
                        color: {
                            rgb: "D1D5DB"
                        }
                    },

                    bottom: {
                        style: "thin",
                        color: {
                            rgb: "D1D5DB"
                        }
                    },

                    left: {
                        style: "thin",
                        color: {
                            rgb: "D1D5DB"
                        }
                    },

                    right: {
                        style: "thin",
                        color: {
                            rgb: "D1D5DB"
                        }
                    }

                }

            };

        }

    }

}

// =========================================================
// EXCEL CELL STYLE HELPER
// =========================================================

function applyExcelStyle(
    sheet,
    range,
    style
) {

    const decodedRange =
        XLSX.utils.decode_range(
            range
        );


    for (
        let row = decodedRange.s.r;
        row <= decodedRange.e.r;
        row++
    ) {

        for (
            let column = decodedRange.s.c;
            column <= decodedRange.e.c;
            column++
        ) {

            const address =
                XLSX.utils.encode_cell({
                    r: row,
                    c: column
                });


            if (
                !sheet[address]
            ) {

                sheet[address] = {
                    t: "s",
                    v: ""
                };

            }


            sheet[address].s = {

                ...(
                    sheet[address].s ||
                    {}
                ),

                ...style

            };

        }

    }

}

// =========================================================
// EXCEL EXPORT
// =========================================================

async function exportCsv() {

    // =====================================================
    // GET CURRENTLY FILTERED DATA
    // =====================================================

    const profilingData =
        getFilteredRecords();


    const workActivityData =
        getFilteredWorkActivityRecords();


    // =====================================================
    // CHECK IF THERE IS DATA
    // =====================================================

    if (
        profilingData.length === 0 &&
        workActivityData.length === 0
    ) {

        alert(
            "There is no report data to export."
        );

        return;

    }


    // =====================================================
    // CHECK EXCEL LIBRARY
    // =====================================================

    if (
        typeof XLSX === "undefined"
    ) {

        alert(
            "Excel export library failed to load."
        );

        return;

    }


    // =====================================================
    // EXCEL COLORS
    // =====================================================

    const COLORS = {

        darkGreen:
            "174D32",

        green:
            "237A4B",

        lightGreen:
            "DDEFE4",

        blue:
            "2F62B3",

        lightBlue:
            "E8F0FB",

        gray:
            "F4F6F8",

        border:
            "D6DCE1",

        white:
            "FFFFFF",

        darkText:
            "263238",

        prod:
            "1E8449",

        nonProd:
            "E67E22",

        prodLoss:
            "C0392B",

        training:
            "6C5CE7",

        teams:
            "237A4B",

        members:
            "2F62B3"

    };


    // =====================================================
    // COMMON BORDER
    // =====================================================

    const thinBorder = {

        top: {
            style: "thin",
            color: {
                rgb: COLORS.border
            }
        },

        bottom: {
            style: "thin",
            color: {
                rgb: COLORS.border
            }
        },

        left: {
            style: "thin",
            color: {
                rgb: COLORS.border
            }
        },

        right: {
            style: "thin",
            color: {
                rgb: COLORS.border
            }
        }

    };


    // =====================================================
    // HELPER: STYLE RANGE
    // =====================================================

    function styleRange(
        sheet,
        range,
        style
    ) {

        const decodedRange =
            XLSX.utils.decode_range(
                range
            );


        for (
            let row = decodedRange.s.r;
            row <= decodedRange.e.r;
            row++
        ) {

            for (
                let column = decodedRange.s.c;
                column <= decodedRange.e.c;
                column++
            ) {

                const cellAddress =
                    XLSX.utils.encode_cell({
                        r: row,
                        c: column
                    });


                if (
                    !sheet[cellAddress]
                ) {

                    sheet[cellAddress] = {
                        t: "s",
                        v: ""
                    };

                }


                sheet[cellAddress].s = {

                    ...(
                        sheet[cellAddress].s ||
                        {}
                    ),

                    ...style

                };

            }

        }

    }


    // =====================================================
    // HELPER: STYLE TABLE
    // =====================================================

    function styleTable(
        sheet,
        lastRow,
        lastColumn
    ) {

        styleRange(
            sheet,
            `A1:${lastColumn}1`,
            {

                fill: {
                    fgColor: {
                        rgb: COLORS.darkGreen
                    }
                },

                font: {
                    bold: true,
                    color: {
                        rgb: COLORS.white
                    },
                    sz: 11
                },

                alignment: {
                    horizontal: "center",
                    vertical: "center"
                },

                border:
                    thinBorder

            }
        );


        for (
            let row = 2;
            row <= lastRow;
            row++
        ) {

            styleRange(
                sheet,
                `A${row}:${lastColumn}${row}`,
                {

                    fill: {

                        fgColor: {

                            rgb:
                                row % 2 === 0
                                    ? COLORS.white
                                    : COLORS.gray

                        }

                    },

                    font: {

                        color: {
                            rgb: COLORS.darkText
                        },

                        sz: 10

                    },

                    alignment: {
                        vertical: "center"
                    },

                    border:
                        thinBorder

                }
            );

        }

    }


    // =====================================================
    // CALCULATE PROFILING TOTALS
    // =====================================================

    const totalTeamsSeconds =
        profilingData.reduce(
            (
                total,
                record
            ) =>
                total +
                Number(
                    record.teamSeconds ||
                    0
                ),
            0
        );


    const totalMembersSeconds =
        profilingData.reduce(
            (
                total,
                record
            ) =>
                total +
                Number(
                    record.membersSeconds ||
                    0
                ),
            0
        );


    const totalProfilingSeconds =
        profilingData.reduce(
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


    const profilingBreakdownTotal =
        totalTeamsSeconds +
        totalMembersSeconds;

    const inconsistentProfilingCount =
        profilingData.filter(
            record =>
                record.accuracyStatus ===
                "INCONSISTENT"
        ).length;

    const legacyRecoveredCount =
        profilingData.filter(
            record =>
                record.wasLegacyMatched
        ).length;



    // =====================================================
    // PROFILING PERCENTAGES
    // =====================================================

    const teamsPercentage =
        profilingBreakdownTotal > 0
            ? (
                totalTeamsSeconds /
                profilingBreakdownTotal
            ) * 100
            : 0;


    const membersPercentage =
        profilingBreakdownTotal > 0
            ? (
                totalMembersSeconds /
                profilingBreakdownTotal
            ) * 100
            : 0;


    // =====================================================
    // CALCULATE WORK ACTIVITY TOTALS
    // =====================================================

        const totalWorkActivitySeconds =
            workActivityData.reduce(
                (
                    total,
                    record
                ) =>
                    total +
                    Number(
                        record.duration_seconds ||
                        0
                    ),
                0
            ) +
            totalProfilingSeconds;


    // =====================================================
    // WORK ACTIVITY CATEGORIES
    // =====================================================

    const activityCategories = [

        "PROD",
        "NON-PROD",
        "PROD LOSS",
        "TRAINING"

    ];


    const activityCategoryTotals = {

        "PROD": 0,

        "NON-PROD": 0,

        "PROD LOSS": 0,

        "TRAINING": 0

    };


        workActivityData.forEach(
            record => {

                const category =
                    String(
                        record.category ||
                        ""
                    )
                    .trim()
                    .toUpperCase();


                if (
                    Object.prototype.hasOwnProperty.call(
                        activityCategoryTotals,
                        category
                    )
                ) {

                    activityCategoryTotals[
                        category
                    ] +=
                        Number(
                            record.duration_seconds ||
                            0
                        );

                }

            }
        );


// =====================================================
// PROFILING TIME COUNTS AS PROD
// =====================================================

activityCategoryTotals.PROD +=
    totalProfilingSeconds;


    // =====================================================
    // GET APPLIED FILTERS
    // =====================================================

    const selectedAnalyst =
        analystFilter?.options[
            analystFilter.selectedIndex
        ]?.text ||
        "All Analysts";


    const selectedCategory =
        workActivityCategoryFilter?.options[
            workActivityCategoryFilter.selectedIndex
        ]?.text ||
        "All Categories";


    const selectedTeam =
        teamSearch?.value?.trim() ||
        "All Teams";


    const selectedFromDate =
        fromDate?.value ||
        "Not specified";


    const selectedToDate =
        toDate?.value ||
        "Not specified";


    // =====================================================
    // CREATE WORKBOOK
    // =====================================================

    const workbook =
        XLSX.utils.book_new();


    // =====================================================
    // REPORT SUMMARY DATA
    // =====================================================

    const generatedDate =
        new Date();


    const summaryRows = [

        // =================================================
        // TITLE
        // =================================================

        [
            "TICKY TICKY PRODUCTIVITY REPORT",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "Executive Productivity Summary",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [],


        // =================================================
        // REPORT INFORMATION
        // =================================================

        [
            "REPORT INFORMATION",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "Generated",
            formatDateTime(
                generatedDate.toISOString()
            ),
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "Reporting Scope",
            "Filtered Report Data",
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [],


        // =================================================
        // KEY PERFORMANCE SUMMARY
        // =================================================

        [
            "DATA ACCURACY",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "Inconsistent Profiling Records",
            inconsistentProfilingCount,
            "",
            "Legacy-Recovered Records",
            legacyRecoveredCount,
            "",
            "",
            ""
        ],

        [
            "KEY PERFORMANCE SUMMARY",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "Total Profiling Sessions",
            profilingData.length,
            "",
            "Total Profiling Time",
            formatDuration(
                totalProfilingSeconds
            ),
            "",
            "",
            ""
        ],

        [
            "Total Work Activities",
            workActivityData.length,
            "",
            "Total Work Activity Time",
            formatDuration(
                totalWorkActivitySeconds
            ),
            "",
            "",
            ""
        ],

        [],


        // =================================================
        // PROFILING TIME BREAKDOWN
        // =================================================

        [
            "PROFILING TIME BREAKDOWN",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "Profiling Type",
            "Duration",
            "% of Profiling Time",
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "TEAMS",
            formatDuration(
                totalTeamsSeconds
            ),
            `${teamsPercentage.toFixed(1)}%`,
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "MEMBERS",
            formatDuration(
                totalMembersSeconds
            ),
            `${membersPercentage.toFixed(1)}%`,
            "",
            "",
            "",
            "",
            ""
        ],

        [],


        // =================================================
        // WORK ACTIVITY BREAKDOWN
        // =================================================

        [
            "WORK ACTIVITY BREAKDOWN",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "Category",
            "Duration",
            "% of Work Time",
            "",
            "",
            "",
            "",
            ""
        ]

    ];


    // =====================================================
    // ADD WORK ACTIVITY BREAKDOWN DATA
    // =====================================================

    activityCategories.forEach(
        category => {

            const categorySeconds =
                activityCategoryTotals[
                    category
                ] ||
                0;


            const percentage =
                totalWorkActivitySeconds > 0
                    ? (
                        categorySeconds /
                        totalWorkActivitySeconds
                    ) * 100
                    : 0;


            summaryRows.push(
                [

                    category,

                    formatDuration(
                        categorySeconds
                    ),

                    `${percentage.toFixed(1)}%`,

                    "",
                    "",
                    "",
                    "",
                    ""

                ]
            );

        }
    );


    // =====================================================
    // ADD FILTERS
    // =====================================================

    summaryRows.push(

        [],


        [
            "APPLIED FILTERS",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "Analyst",
            selectedAnalyst,
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "Activity Category",
            selectedCategory,
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "Team Search",
            selectedTeam,
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "From Date",
            selectedFromDate,
            "",
            "",
            "",
            "",
            "",
            ""
        ],

        [
            "To Date",
            selectedToDate,
            "",
            "",
            "",
            "",
            "",
            ""
        ]

    );


    // =====================================================
    // CREATE SUMMARY SHEET
    // =====================================================

    const summarySheet =
        XLSX.utils.aoa_to_sheet(
            summaryRows
        );


    // =====================================================
    // SUMMARY MERGES
    // =====================================================

    summarySheet["!merges"] = [

        XLSX.utils.decode_range(
            "A1:H1"
        ),

        XLSX.utils.decode_range(
            "A2:H2"
        ),

        XLSX.utils.decode_range(
            "A4:H4"
        ),

        XLSX.utils.decode_range(
            "A8:H8"
        ),

        XLSX.utils.decode_range(
            "A12:H12"
        ),

        XLSX.utils.decode_range(
            "A17:H17"
        ),

        XLSX.utils.decode_range(
            "A24:H24"
        )

    ];


    // =====================================================
    // SUMMARY COLUMN WIDTHS
    // =====================================================

    summarySheet["!cols"] = [

        { wch: 28 },
        { wch: 24 },
        { wch: 22 },
        { wch: 22 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 }

    ];


    // =====================================================
    // SUMMARY ROW HEIGHTS
    // =====================================================

    summarySheet["!rows"] = [

        { hpt: 32 },
        { hpt: 24 },
        { hpt: 8 },
        { hpt: 22 },
        { hpt: 20 },
        { hpt: 20 },
        { hpt: 8 },
        { hpt: 22 },
        { hpt: 24 },
        { hpt: 24 },
        { hpt: 8 },
        { hpt: 22 },
        { hpt: 22 },
        { hpt: 22 },
        { hpt: 8 },
        { hpt: 22 },
        { hpt: 22 },
        { hpt: 22 },
        { hpt: 22 },
        { hpt: 22 },
        { hpt: 22 },
        { hpt: 8 },
        { hpt: 22 }

    ];


    // =====================================================
    // MAIN TITLE
    // =====================================================

    styleRange(
        summarySheet,
        "A1:H1",
        {

            fill: {
                fgColor: {
                    rgb: COLORS.darkGreen
                }
            },

            font: {
                bold: true,
                color: {
                    rgb: COLORS.white
                },
                sz: 20
            },

            alignment: {
                horizontal: "center",
                vertical: "center"
            }

        }
    );


    // =====================================================
    // SUBTITLE
    // =====================================================

    styleRange(
        summarySheet,
        "A2:H2",
        {

            fill: {
                fgColor: {
                    rgb: COLORS.green
                }
            },

            font: {
                bold: true,
                color: {
                    rgb: COLORS.white
                },
                sz: 12
            },

            alignment: {
                horizontal: "center",
                vertical: "center"
            }

        }
    );


    // =====================================================
    // SECTION HEADINGS
    // =====================================================

    [
        "A4:H4",
        "A8:H8",
        "A10:H10",
        "A14:H14",
        "A19:H19",
        "A26:H26"
    ].forEach(
        range => {

            styleRange(
                summarySheet,
                range,
                {

                    fill: {
                        fgColor: {
                            rgb: COLORS.blue
                        }
                    },

                    font: {
                        bold: true,
                        color: {
                            rgb: COLORS.white
                        },
                        sz: 11
                    },

                    alignment: {
                        horizontal: "left",
                        vertical: "center"
                    }

                }
            );

        }
    );


    // =====================================================
    // REPORT INFORMATION
    // =====================================================

    styleRange(
        summarySheet,
        "A5:B6",
        {

            border:
                thinBorder,

            alignment: {
                vertical: "center"
            }

        }
    );


    [
        "A5",
        "A6"
    ].forEach(
        cell => {

            summarySheet[cell].s = {

                ...summarySheet[cell].s,

                font: {
                    bold: true,
                    color: {
                        rgb: COLORS.darkText
                    }
                },

                fill: {
                    fgColor: {
                        rgb: COLORS.gray
                    }
                }

            };

        }
    );


    // =====================================================
    // KPI CARDS
    // =====================================================

    styleRange(
        summarySheet,
        "A11:B12",
        {

            border:
                thinBorder,

            fill: {
                fgColor: {
                    rgb: COLORS.lightGreen
                }
            },

            alignment: {
                vertical: "center"
            }

        }
    );


    styleRange(
        summarySheet,
        "D11:E12",
        {

            border:
                thinBorder,

            fill: {
                fgColor: {
                    rgb: COLORS.lightBlue
                }
            },

            alignment: {
                vertical: "center"
            }

        }
    );


    [
        "A9",
        "A10",
        "D9",
        "D10"
    ].forEach(
        cell => {

            summarySheet[cell].s = {

                ...summarySheet[cell].s,

                font: {
                    bold: true,
                    color: {
                        rgb: COLORS.darkText
                    }
                }

            };

        }
    );


    [
        "B9",
        "B10",
        "E9",
        "E10"
    ].forEach(
        cell => {

            summarySheet[cell].s = {

                ...summarySheet[cell].s,

                font: {
                    bold: true,
                    sz: 12,
                    color: {
                        rgb: COLORS.darkGreen
                    }
                },

                alignment: {
                    horizontal: "center",
                    vertical: "center"
                }

            };

        }
    );


    // =====================================================
    // PROFILING BREAKDOWN TABLE
    // =====================================================

    styleRange(
        summarySheet,
        "A15:C15",
        {

            fill: {
                fgColor: {
                    rgb: COLORS.darkGreen
                }
            },

            font: {
                bold: true,
                color: {
                    rgb: COLORS.white
                }
            },

            alignment: {
                horizontal: "center",
                vertical: "center"
            },

            border:
                thinBorder

        }
    );


    styleRange(
        summarySheet,
        "A16:C17",
        {

            border:
                thinBorder,

            alignment: {
                vertical: "center"
            }

        }
    );


    // TEAMS ROW

    summarySheet["A16"].s = {

        ...summarySheet["A16"].s,

        fill: {
            fgColor: {
                rgb: COLORS.lightGreen
            }
        },

        font: {
            bold: true,
            color: {
                rgb: COLORS.darkText
            }
        }

    };


    summarySheet["B16"].s = {

        ...summarySheet["B16"].s,

        font: {
            bold: true,
            color: {
                rgb: COLORS.teams
            }
        },

        alignment: {
            horizontal: "center",
            vertical: "center"
        }

    };


    summarySheet["C16"].s = {

        ...summarySheet["C16"].s,

        font: {
            bold: true
        },

        alignment: {
            horizontal: "center",
            vertical: "center"
        }

    };


    // MEMBERS ROW

    summarySheet["A17"].s = {

        ...summarySheet["A17"].s,

        fill: {
            fgColor: {
                rgb: COLORS.lightBlue
            }
        },

        font: {
            bold: true,
            color: {
                rgb: COLORS.darkText
            }
        }

    };


    summarySheet["B17"].s = {

        ...summarySheet["B17"].s,

        font: {
            bold: true,
            color: {
                rgb: COLORS.members
            }
        },

        alignment: {
            horizontal: "center",
            vertical: "center"
        }

    };


    summarySheet["C17"].s = {

        ...summarySheet["C17"].s,

        font: {
            bold: true
        },

        alignment: {
            horizontal: "center",
            vertical: "center"
        }

    };


    // =====================================================
    // WORK ACTIVITY TABLE HEADER
    // =====================================================

    styleRange(
        summarySheet,
        "A20:C20",
        {

            fill: {
                fgColor: {
                    rgb: COLORS.darkGreen
                }
            },

            font: {
                bold: true,
                color: {
                    rgb: COLORS.white
                }
            },

            alignment: {
                horizontal: "center",
                vertical: "center"
            },

            border:
                thinBorder

        }
    );


    // =====================================================
    // WORK ACTIVITY BREAKDOWN ROWS
    // =====================================================

    const categoryRowMap = {

        "PROD": 19,

        "NON-PROD": 20,

        "PROD LOSS": 21,

        "TRAINING": 22

    };


    const categoryColorMap = {

        "PROD":
            COLORS.prod,

        "NON-PROD":
            COLORS.nonProd,

        "PROD LOSS":
            COLORS.prodLoss,

        "TRAINING":
            COLORS.training

    };


    activityCategories.forEach(
        category => {

            const row =
                categoryRowMap[
                    category
                ];


            styleRange(
                summarySheet,
                `A${row}:C${row}`,
                {

                    border:
                        thinBorder,

                    alignment: {
                        vertical: "center"
                    }

                }
            );


            // CATEGORY

            summarySheet[
                `A${row}`
            ].s = {

                ...summarySheet[
                    `A${row}`
                ].s,

                font: {
                    bold: true,
                    color: {
                        rgb: COLORS.darkText
                    }
                }

            };


            // DURATION

            summarySheet[
                `B${row}`
            ].s = {

                ...summarySheet[
                    `B${row}`
                ].s,

                font: {
                    bold: true,
                    color: {
                        rgb:
                            categoryColorMap[
                                category
                            ]
                    }
                },

                alignment: {
                    horizontal: "center",
                    vertical: "center"
                }

            };


            // PERCENTAGE

            summarySheet[
                `C${row}`
            ].s = {

                ...summarySheet[
                    `C${row}`
                ].s,

                font: {
                    bold: true
                },

                alignment: {
                    horizontal: "center",
                    vertical: "center"
                }

            };

        }
    );


    // =====================================================
    // APPLIED FILTERS
    // =====================================================

    styleRange(
        summarySheet,
        "A27:B31",
        {

            border:
                thinBorder,

            alignment: {
                vertical: "center"
            }

        }
    );


    for (
        let row = 27;
        row <= 31;
        row++
    ) {

        const labelCell =
            `A${row}`;


        summarySheet[
            labelCell
        ].s = {

            ...summarySheet[
                labelCell
            ].s,

            font: {
                bold: true,
                color: {
                    rgb: COLORS.darkText
                }
            },

            fill: {
                fgColor: {
                    rgb: COLORS.gray
                }
            }

        };

    }


    // =====================================================
    // ADD SUMMARY SHEET
    // =====================================================

    XLSX.utils.book_append_sheet(
        workbook,
        summarySheet,
        "Report Summary"
    );


    // =====================================================
    // PRODUCTIVITY DATA
    // =====================================================

    const productivityRows = [

        [
            "Analyst",
            "Team",
            "Team ID",
            "Members",
            "Teams Time",
            "Members Time",
            "Total Time",
            "Data Check",
            "Completed"
        ],

        ...profilingData.map(
            record => [

                record.analystName ||
                "Unknown Analyst",

                record.team_name ||
                "",

                record.team_id ||
                "",

                Number(
                    record.member_count ||
                    0
                ),

                excelDuration(
                    Number(
                        record.teamSeconds ||
                        0
                    )
                ),

                excelDuration(
                    Number(
                        record.membersSeconds ||
                        0
                    )
                ),

                excelDuration(
                    Number(
                        record.totalSeconds ||
                        0
                    )
                ),

                record.accuracyStatus ||
                "UNKNOWN",

                formatDateTime(
                    record.finished_at
                )

            ]
        )

    ];


    const productivitySheet =
        XLSX.utils.aoa_to_sheet(
            productivityRows
        );

        for (
            let row = 2;
            row <= productivityRows.length;
            row++
        ) {
            [
                `E${row}`,
                `F${row}`,
                `G${row}`
            ].forEach(
                cell => {

                    if (
                        productivitySheet[cell]
                    ) {
                        productivitySheet[cell].z =
                            "[h]:mm:ss";
                    }

                }
            );
        }        


    // =====================================================
    // PRODUCTIVITY DESIGN
    // =====================================================

    productivitySheet["!freeze"] = {

        xSplit: 0,
        ySplit: 1

    };


    productivitySheet["!autofilter"] = {

        ref:
            `A1:I${productivityRows.length}`

    };


    styleTable(
        productivitySheet,
        productivityRows.length,
        "I"
    );


    productivitySheet["!cols"] = [

        { wch: 24 },
        { wch: 38 },
        { wch: 12 },
        { wch: 12 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 24 }

    ];


    productivitySheet["!rows"] = [

        { hpt: 24 }

    ];


    for (
        let row = 2;
        row <= productivityRows.length;
        row++
    ) {

        [
            `C${row}`,
            `D${row}`,
            `E${row}`,
            `F${row}`,
            `G${row}`,
            `I${row}`
        ].forEach(
            cell => {

                if (
                    productivitySheet[cell]
                ) {

                    productivitySheet[cell].s = {

                        ...productivitySheet[cell].s,

                        alignment: {
                            horizontal: "center",
                            vertical: "center"
                        }

                    };

                }

            }
        );

    }


    XLSX.utils.book_append_sheet(
        workbook,
        productivitySheet,
        "Productivity Data"
    );


    // =====================================================
    // WORK ACTIVITY LOGS DATA
    // =====================================================

    const workActivityRows = [

        [
            "Analyst",
            "Category",
            "Task",
            "Duration",
            "Started",
            "Completed"
        ],

        ...workActivityData.map(
            record => [

                record.analystName ||
                "Unknown Analyst",

                record.category ||
                "",

                record.task_name ||
                "",

                excelDuration(
                    Number(
                        record.duration_seconds ||
                        0
                    )
                ),

                formatDateTime(
                    record.started_at
                ),

                formatDateTime(
                    record.ended_at
                )

            ]
        )

    ];


    const workActivitySheet =
        XLSX.utils.aoa_to_sheet(
            workActivityRows
        );

        for (
                let row = 2;
                row <= workActivityRows.length;
                row++
            ) {
                if (workActivitySheet[`D${row}`]) {
                    workActivitySheet[`D${row}`].z = "[h]:mm:ss";
                }
            }


    // =====================================================
    // WORK ACTIVITY LOGS DESIGN
    // =====================================================

    workActivitySheet["!freeze"] = {

        xSplit: 0,
        ySplit: 1

    };


    workActivitySheet["!autofilter"] = {

        ref:
            `A1:F${workActivityRows.length}`

    };


    styleTable(
        workActivitySheet,
        workActivityRows.length,
        "F"
    );


    workActivitySheet["!cols"] = [

        { wch: 24 },
        { wch: 18 },
        { wch: 38 },
        { wch: 16 },
        { wch: 24 },
        { wch: 24 }

    ];


    workActivitySheet["!rows"] = [

        { hpt: 24 }

    ];


    // =====================================================
    // CATEGORY COLORS
    // =====================================================

    for (
        let row = 2;
        row <= workActivityRows.length;
        row++
    ) {

        const category =
            String(
                workActivitySheet[
                    `B${row}`
                ]?.v ||
                ""
            )
                .trim()
                .toUpperCase();


        let categoryColor =
            null;


        if (
            category === "PROD"
        ) {

            categoryColor =
                COLORS.prod;

        }

        else if (
            category === "NON-PROD"
        ) {

            categoryColor =
                COLORS.nonProd;

        }

        else if (
            category === "PROD LOSS"
        ) {

            categoryColor =
                COLORS.prodLoss;

        }

        else if (
            category === "TRAINING"
        ) {

            categoryColor =
                COLORS.training;

        }


        if (
            categoryColor &&
            workActivitySheet[
                `B${row}`
            ]
        ) {

            workActivitySheet[
                `B${row}`
            ].s = {

                ...workActivitySheet[
                    `B${row}`
                ].s,

                fill: {
                    fgColor: {
                        rgb: categoryColor
                    }
                },

                font: {
                    bold: true,
                    color: {
                        rgb: COLORS.white
                    }
                },

                alignment: {
                    horizontal: "center",
                    vertical: "center"
                }

            };

        }


        if (
            workActivitySheet[
                `D${row}`
            ]
        ) {

            workActivitySheet[
                `D${row}`
            ].s = {

                ...workActivitySheet[
                    `D${row}`
                ].s,

                alignment: {
                    horizontal: "center",
                    vertical: "center"
                },

                font: {
                    bold: true
                }

            };

        }

    }


    XLSX.utils.book_append_sheet(
        workbook,
        workActivitySheet,
        "Work Activity Logs"
    );


// =====================================================
// SEND FINISHED XLSX TO CHART SERVER
// =====================================================

const xlsxArrayBuffer =
    XLSX.write(
        workbook,
        {
            bookType: "xlsx",
            type: "array"
        }
    );


const xlsxBytes =
    new Uint8Array(
        xlsxArrayBuffer
    );


let binary =
    "";

for (
    let i = 0;
    i < xlsxBytes.length;
    i++
) {

    binary += String.fromCharCode(
        xlsxBytes[i]
    );

}


const xlsxBase64 =
    btoa(
        binary
    );


// =====================================================
// SEND TO SERVER
// =====================================================

const response =
    await fetch(
        "https://ticky-ticky-excel-server.onrender.com/add-charts",
        {

            method:
                "POST",

            headers: {

                "Content-Type":
                    "application/json"

            },

            body:
                JSON.stringify({

                    xlsx:
                        xlsxBase64

                })

        }
    );


        if (
            !response.ok
        ) {

            const errorText =
                await response.text();

            throw new Error(
                errorText ||
                "Excel chart server failed."
            );

        }


        // =====================================================
        // RECEIVE FINAL XLSX
        // =====================================================

        const finalBlob =
            await response.blob();


        // =====================================================
        // DOWNLOAD FINAL FILE
        // =====================================================

        const downloadUrl =
            URL.createObjectURL(
                finalBlob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            downloadUrl;


        link.download =
            `ticky-ticky-report-${getDateStamp()}.xlsx`;


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            downloadUrl
        );

}

// =========================================================
// EXCEL ALTERNATING ROW STYLE
// =========================================================

function styleExcelDataRows(
    sheet,
    startRow,
    endRow,
    endColumn
) {

    for (
        let row = startRow;
        row <= endRow;
        row++
    ) {

        const fillColor =
            row % 2 === 0
                ? "F8FAFC"
                : "FFFFFF";


        for (
            let column = 0;
            column <= endColumn;
            column++
        ) {

            const cellAddress =
                XLSX.utils.encode_cell({
                    r: row - 1,
                    c: column
                });


            if (
                !sheet[cellAddress]
            ) {

                sheet[cellAddress] = {
                    t: "s",
                    v: ""
                };

            }


            sheet[cellAddress].s = {

                ...(
                    sheet[cellAddress].s ||
                    {}
                ),

                fill: {
                    fgColor: {
                        rgb: fillColor
                    }
                },

                alignment: {
                    vertical: "center"
                }

            };

        }

    }

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
// FORMAT NUMBER
// =========================================================

function formatNumber(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "0";

    }


    return number.toLocaleString();

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
// DATE STAMP
// =========================================================

function getDateStamp() {

    const date =
        new Date();


    return [

        date.getFullYear(),

        String(
            date.getMonth() + 1
        )
            .padStart(
                2,
                "0"
            ),

        String(
            date.getDate()
        )
            .padStart(
                2,
                "0"
            )

    ].join("-");

}


// =========================================================
// CSV ESCAPE
// =========================================================

function csvEscape(
    value
) {

    const stringValue =
        String(
            value ??
            ""
        );


    return `"${stringValue.replace(
        /"/g,
        '""'
    )}"`;

}

function excelDuration(totalSeconds) {

    return (
        Number(
            totalSeconds
        ) || 0
    ) / 86400;

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
// ERROR HANDLING
// =========================================================

function clearError() {

    if (!reportsError) {
        return;
    }


    reportsError.textContent =
        "";


    reportsError.style.display =
        "none";

}


function showError(
    message
) {

    if (!reportsError) {
        return;
    }


    reportsError.textContent =
        message ||
        "An unexpected error occurred.";


    reportsError.style.display =
        "block";

}


// =========================================================
// GET INITIALS
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
// LOGOUT
// =========================================================

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


            showError(
                error.message ||
                "Unable to log out."
            );

        }

    }
);

// =========================================================
// TICKY TICKY REPORTS — ENHANCED ANALYTICS
// =========================================================
// IMPORTANT:
// - Keeps the existing Supabase loading logic.
// - Keeps the existing Excel export untouched.
// - PROD = Production
// - NON-PROD = Non-Production
// - PROD LOSS = Production Loss
// - TRAINING = Training
// =========================================================

(function enhanceReportsPage() {

    // ---------------------------------------------------------
    // CATEGORY DEFINITIONS
    // ---------------------------------------------------------

    const REPORT_CATEGORIES = [
        {
            key: "PROD",
            label: "Production",
            className: "prod-chart-segment"
        },
        {
            key: "NON-PROD",
            label: "Non-Production",
            className: "nonprod-chart-segment"
        },
        {
            key: "PROD LOSS",
            label: "Production Loss",
            className: "prod-loss-chart-segment"
        },
        {
            key: "TRAINING",
            label: "Training",
            className: "training-chart-segment"
        }
    ];


    // ---------------------------------------------------------
    // CATEGORY NORMALIZER
    // ---------------------------------------------------------

    function enhancedNormalizeCategory(value) {

        const category =
            String(value || "")
                .trim()
                .toUpperCase();

        if (
            category === "PROD" ||
            category === "PRODUCTION"
        ) {
            return "PROD";
        }

        if (
            category === "NON-PROD" ||
            category === "NON PRODUCTION" ||
            category === "NON-PRODUCTION" ||
            category === "NON-PROD ACTIVITIES"
        ) {
            return "NON-PROD";
        }

        if (
            category === "PROD LOSS" ||
            category === "PRODUCTION LOSS" ||
            category === "PROD_LOSS"
        ) {
            return "PROD LOSS";
        }

        if (
            category === "TRAINING"
        ) {
            return "TRAINING";
        }

        return category;
    }


    // ---------------------------------------------------------
    // CALCULATE WORK CATEGORY TOTALS
    // ---------------------------------------------------------

    function calculateEnhancedCategoryTotals(records) {

        const totals = {
            "PROD": 0,
            "NON-PROD": 0,
            "PROD LOSS": 0,
            "TRAINING": 0
        };

        const counts = {
            "PROD": 0,
            "NON-PROD": 0,
            "PROD LOSS": 0,
            "TRAINING": 0
        };


        (records || []).forEach(record => {

            const category =
                enhancedNormalizeCategory(
                    record.category
                );

            const seconds =
                Math.max(
                    0,
                    Number(
                        record.duration_seconds
                    ) || 0
                );


            if (
                Object.prototype.hasOwnProperty.call(
                    totals,
                    category
                )
            ) {

                totals[category] += seconds;
                counts[category]++;

            }

        });


        return {
            totals,
            counts
        };

    }


    // ---------------------------------------------------------
    // UPDATE OPTIONAL KPI ELEMENT
    // ---------------------------------------------------------

    function setOptionalValue(
        ids,
        value
    ) {

        const idList =
            Array.isArray(ids)
                ? ids
                : [ids];


        for (
            const id of idList
        ) {

            const element =
                document.getElementById(id);


            if (element) {

                element.textContent =
                    value;

                return;

            }

        }

    }


    // ---------------------------------------------------------
    // UPDATE ENHANCED KPI CARDS
    // ---------------------------------------------------------

    function updateEnhancedKPIs(
        profilingRecords,
        workRecords
    ) {

        const categoryData =
            calculateEnhancedCategoryTotals(
                workRecords
            );


        const totals =
            categoryData.totals;

        const counts =
            categoryData.counts;


        // -----------------------------------------------------
        // PROFILING
        // -----------------------------------------------------

        const profilingSeconds =
            (profilingRecords || [])
                .reduce(
                    (
                        total,
                        record
                    ) =>
                        total +
                        Number(
                            record.totalSeconds || 0
                        ),
                    0
                );


        // -----------------------------------------------------
        // WORK ACTIVITY
        // -----------------------------------------------------

        const workSeconds =
            Object.values(
                totals
            ).reduce(
                (
                    total,
                    seconds
                ) =>
                    total + seconds,
                0
            );


        const totalRecordedSeconds =
            profilingSeconds +
            workSeconds;


        // -----------------------------------------------------
        // PRODUCTIVITY RATE
        //
        // Production compared with all recorded work
        // activities.
        // -----------------------------------------------------

        const productivityBase =
            workSeconds;


        const productivityRate =
            productivityBase > 0
                ? (
                    totals["PROD"] /
                    productivityBase
                ) * 100
                : 0;


        // -----------------------------------------------------
        // NON-PRODUCTION RATE
        // -----------------------------------------------------

        const nonProductionRate =
            productivityBase > 0
                ? (
                    totals["NON-PROD"] /
                    productivityBase
                ) * 100
                : 0;


        // -----------------------------------------------------
        // PRODUCTION LOSS RATE
        // -----------------------------------------------------

        const productionLossRate =
            productivityBase > 0
                ? (
                    totals["PROD LOSS"] /
                    productivityBase
                ) * 100
                : 0;


        // -----------------------------------------------------
        // TRAINING RATE
        // -----------------------------------------------------

        const trainingRate =
            productivityBase > 0
                ? (
                    totals["TRAINING"] /
                    productivityBase
                ) * 100
                : 0;


        // -----------------------------------------------------
        // ANALYST COUNT
        // -----------------------------------------------------

        const analysts =
            new Set(
                [
                    ...(profilingRecords || []),
                    ...(workRecords || [])
                ]
                    .map(
                        record =>
                            record.analyst_id
                    )
                    .filter(Boolean)
            );


        // -----------------------------------------------------
        // AVERAGE PRODUCTION / ANALYST
        // -----------------------------------------------------

        const averageProductionPerAnalyst =
            analysts.size > 0
                ? Math.round(
                    totals["PROD"] /
                    analysts.size
                )
                : 0;


        // -----------------------------------------------------
        // OPTIONAL KPI IDS
        // -----------------------------------------------------

        setOptionalValue(
            [
                "reportProdTime",
                "productionTime",
                "prodTime",
                "totalProdTime"
            ],
            formatDuration(
                totals["PROD"]
            )
        );


        setOptionalValue(
            [
                "reportNonProdTime",
                "nonProductionTime",
                "nonProdTime",
                "totalNonProdTime"
            ],
            formatDuration(
                totals["NON-PROD"]
            )
        );


        setOptionalValue(
            [
                "reportProdLossTime",
                "productionLossTime",
                "prodLossTime",
                "totalProdLossTime"
            ],
            formatDuration(
                totals["PROD LOSS"]
            )
        );


        setOptionalValue(
            [
                "reportTrainingTime",
                "trainingTime",
                "totalTrainingTime"
            ],
            formatDuration(
                totals["TRAINING"]
            )
        );


        setOptionalValue(
            [
                "reportTotalRecordedTime",
                "totalRecordedTime",
                "totalReportTime"
            ],
            formatDuration(
                totalRecordedSeconds
            )
        );


        setOptionalValue(
            [
                "reportProductivityRate",
                "productivityRate"
            ],
            `${productivityRate.toFixed(1)}%`
        );


        setOptionalValue(
            [
                "reportNonProdRate",
                "nonProductionRate"
            ],
            `${nonProductionRate.toFixed(1)}%`
        );


        setOptionalValue(
            [
                "reportProdLossRate",
                "productionLossRate"
            ],
            `${productionLossRate.toFixed(1)}%`
        );


        setOptionalValue(
            [
                "reportTrainingRate",
                "trainingRate"
            ],
            `${trainingRate.toFixed(1)}%`
        );


        setOptionalValue(
            [
                "reportWorkActivityCount",
                "workActivityCount"
            ],
            workRecords.length
        );


        setOptionalValue(
            [
                "reportAverageProd",
                "averageProductionPerAnalyst"
            ],
            formatDuration(
                averageProductionPerAnalyst
            )
        );


        // -----------------------------------------------------
        // CATEGORY COUNTS
        // -----------------------------------------------------

        setOptionalValue(
            [
                "prodActivityCount",
                "productionActivityCount"
            ],
            counts["PROD"]
        );


        setOptionalValue(
            [
                "nonProdActivityCount",
                "nonProductionActivityCount"
            ],
            counts["NON-PROD"]
        );


        setOptionalValue(
            [
                "prodLossActivityCount",
                "productionLossActivityCount"
            ],
            counts["PROD LOSS"]
        );


        setOptionalValue(
            [
                "trainingActivityCount"
            ],
            counts["TRAINING"]
        );

    }


    // ---------------------------------------------------------
    // CATEGORY BAR GRAPH
    // ---------------------------------------------------------
    //
    // FOUR SEPARATE BARS:
    //
    // Production
    // Non-Production
    // Production Loss
    // Training
    //
    // No combined total-time bar.
    // ---------------------------------------------------------

    function renderEnhancedCategoryChart(
        records
    ) {

        const chart =
            document.getElementById(
                "categoryTimeChart"
            ) ||
            document.getElementById(
                "workCategoryChart"
            ) ||
            document.getElementById(
                "analystChart"
            );


        if (!chart) {
            return;
        }


        const categoryData =
            calculateEnhancedCategoryTotals(
                records
            );


        const totals =
            categoryData.totals;


        const totalWorkSeconds =
            Object.values(
                totals
            ).reduce(
                (
                    total,
                    value
                ) =>
                    total + value,
                0
            );


        if (
            totalWorkSeconds <= 0
        ) {

            chart.innerHTML = `
                <div
                    class="chart-empty"
                    style="
                        min-height:220px;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        color:var(--text-secondary);
                        text-align:center;
                    "
                >
                    No work activity data available
                    for the selected filters.
                </div>
            `;

            return;

        }


        const maximum =
            Math.max(
                ...Object.values(
                    totals
                ),
                1
            );


        // -----------------------------------------------------
        // HEADER
        // -----------------------------------------------------

        let html = `
            <div
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:8px 4px;
                "
            >

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        gap:12px;
                        margin-bottom:18px;
                        padding-bottom:12px;
                        border-bottom:1px solid var(--border);
                    "
                >

                    <div>

                        <div
                            style="
                                font-size:13px;
                                font-weight:800;
                                color:var(--text-primary);
                            "
                        >
                            Work Time Distribution
                        </div>

                        <div
                            style="
                                margin-top:4px;
                                font-size:11px;
                                color:var(--text-secondary);
                            "
                        >
                            Separate category totals
                            for the selected filters
                        </div>

                    </div>

                    <strong
                        style="
                            font-size:13px;
                            color:var(--text-primary);
                            white-space:nowrap;
                        "
                    >
                        ${formatDuration(totalWorkSeconds)}
                    </strong>

                </div>
        `;


        // -----------------------------------------------------
        // FOUR CATEGORY BARS
        // -----------------------------------------------------

        REPORT_CATEGORIES.forEach(
            category => {

                const seconds =
                    totals[
                        category.key
                    ] || 0;


                const percent =
                    totalWorkSeconds > 0
                        ? (
                            seconds /
                            totalWorkSeconds
                        ) * 100
                        : 0;


                const width =
                    seconds > 0
                        ? Math.max(
                            2,
                            (
                                seconds /
                                maximum
                            ) * 100
                        )
                        : 0;


                html += `
                    <div
                        style="
                            margin-bottom:22px;
                        "
                    >

                        <div
                            style="
                                display:flex;
                                justify-content:space-between;
                                align-items:flex-end;
                                gap:12px;
                                margin-bottom:8px;
                            "
                        >

                            <div
                                style="
                                    min-width:0;
                                "
                            >

                                <div
                                    style="
                                        font-size:13px;
                                        font-weight:800;
                                        color:var(--text-primary);
                                    "
                                >
                                    ${category.label}
                                </div>

                                <div
                                    style="
                                        margin-top:3px;
                                        font-size:10px;
                                        color:var(--text-secondary);
                                    "
                                >
                                    ${percent.toFixed(1)}%
                                    of work activity time
                                </div>

                            </div>


                            <strong
                                style="
                                    font-size:13px;
                                    color:var(--text-primary);
                                    white-space:nowrap;
                                "
                            >
                                ${formatDuration(seconds)}
                            </strong>

                        </div>


                        <div
                            style="
                                width:100%;
                                height:18px;
                                background:var(--light-green);
                                border-radius:999px;
                                overflow:hidden;
                            "
                        >

                            <div
                                class="${category.className}"
                                style="
                                    width:${width}%;
                                    height:100%;
                                    min-width:${seconds > 0 ? "3px" : "0"};
                                    border-radius:999px;
                                    transition:width .35s ease;
                                "
                                title="${category.label}: ${formatDuration(seconds)}"
                            ></div>

                        </div>

                    </div>
                `;

            }
        );


        // -----------------------------------------------------
        // FOOTER SUMMARY
        // -----------------------------------------------------

        html += `

                <div
                    style="
                        margin-top:8px;
                        padding-top:14px;
                        border-top:1px solid var(--border);
                        display:grid;
                        grid-template-columns:
                            repeat(
                                auto-fit,
                                minmax(120px, 1fr)
                            );
                        gap:10px;
                    "
                >

                    ${REPORT_CATEGORIES.map(
                        category => {

                            const seconds =
                                totals[
                                    category.key
                                ] || 0;

                            return `
                                <div
                                    style="
                                        padding:10px;
                                        border:1px solid var(--border);
                                        border-radius:10px;
                                        background:var(--card-background);
                                    "
                                >

                                    <div
                                        style="
                                            font-size:10px;
                                            color:var(--text-secondary);
                                            margin-bottom:4px;
                                        "
                                    >
                                        ${category.label}
                                    </div>

                                    <strong
                                        style="
                                            font-size:12px;
                                            color:var(--text-primary);
                                        "
                                    >
                                        ${formatDuration(seconds)}
                                    </strong>

                                </div>
                            `;

                        }
                    ).join("")}

                </div>

            </div>
        `;


        chart.innerHTML =
            html;

    }


    // ---------------------------------------------------------
    // DATA-BASED OBSERVATIONS
    // ---------------------------------------------------------

    function renderEnhancedObservations(
        profilingRecords,
        workRecords
    ) {

        const target =
            document.getElementById(
                "reportObservations"
            ) ||
            document.getElementById(
                "dataObservations"
            ) ||
            document.getElementById(
                "reportInsights"
            );


        if (!target) {
            return;
        }


        const categoryData =
            calculateEnhancedCategoryTotals(
                workRecords
            );


        const totals =
            categoryData.totals;


        const totalWork =
            Object.values(
                totals
            ).reduce(
                (
                    total,
                    value
                ) =>
                    total + value,
                0
            );


        if (
            totalWork <= 0 &&
            profilingRecords.length === 0
        ) {

            target.innerHTML = `
                <div>
                    No recorded activity is available
                    for the selected filters.
                </div>
            `;

            return;

        }


        const highestCategory =
            REPORT_CATEGORIES
                .map(
                    category => ({
                        ...category,
                        seconds:
                            totals[
                                category.key
                            ] || 0
                    })
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        b.seconds -
                        a.seconds
                )[0];


        const productivityRate =
            totalWork > 0
                ? (
                    totals["PROD"] /
                    totalWork
                ) * 100
                : 0;


        const productionLossRate =
            totalWork > 0
                ? (
                    totals["PROD LOSS"] /
                    totalWork
                ) * 100
                : 0;


        target.innerHTML = `

            <div
                style="
                    display:grid;
                    gap:10px;
                "
            >

                <div>
                    <strong>
                        Highest recorded category:
                    </strong>
                    ${highestCategory.label}
                    —
                    ${formatDuration(
                        highestCategory.seconds
                    )}
                </div>


                <div>
                    <strong>
                        Production share:
                    </strong>
                    ${productivityRate.toFixed(1)}%
                    of recorded work activity time.
                </div>


                <div>
                    <strong>
                        Production Loss:
                    </strong>
                    ${productionLossRate.toFixed(1)}%
                    of recorded work activity time.
                </div>


                <div>
                    <strong>
                        Profiling jobs:
                    </strong>
                    ${profilingRecords.length}
                    completed record${
                        profilingRecords.length === 1
                            ? ""
                            : "s"
                    }.
                </div>

            </div>

        `;

    }


    // ---------------------------------------------------------
    // ENHANCED RENDER FUNCTION
    // ---------------------------------------------------------

    const originalRenderReports =
        renderReports;


    renderReports =
        function(
            records
        ) {

            const safeRecords =
                Array.isArray(
                    records
                )
                    ? records
                    : [];


            const workRecords =
                getFilteredWorkActivityRecords();


            // -------------------------------------------------
            // KEEP ORIGINAL REPORT RENDERING
            // -------------------------------------------------

            originalRenderReports(
                safeRecords
            );


            // -------------------------------------------------
            // ENHANCED KPI CALCULATIONS
            // -------------------------------------------------

            updateEnhancedKPIs(
                safeRecords,
                workRecords
            );


            // -------------------------------------------------
            // CATEGORY GRAPH
            // -------------------------------------------------

            renderEnhancedCategoryChart(
                workRecords
            );


            // -------------------------------------------------
            // OBSERVATIONS
            // -------------------------------------------------

            renderEnhancedObservations(
                safeRecords,
                workRecords
            );

        };


    // ---------------------------------------------------------
    // MAKE SURE WORK ACTIVITY TABLE USES 12-HOUR TIME
    // ---------------------------------------------------------

    const originalFormatDateTime =
        formatDateTime;


    // We intentionally do NOT replace the existing formatter
    // globally because Excel export also uses it.
    //
    // Instead, the existing formatter is left untouched so
    // Excel remains exactly as it is.


    // ---------------------------------------------------------
    // CATEGORY FILTER LABELS
    // ---------------------------------------------------------

    if (
        workActivityCategoryFilter
    ) {

        const options =
            workActivityCategoryFilter
                .querySelectorAll(
                    "option"
                );


        options.forEach(
            option => {

                const value =
                    enhancedNormalizeCategory(
                        option.value
                    );


                if (
                    value === "PROD"
                ) {

                    option.textContent =
                        "Production (PROD)";

                }

                else if (
                    value === "NON-PROD"
                ) {

                    option.textContent =
                        "Non-Production (NON-PROD)";

                }

                else if (
                    value === "PROD LOSS"
                ) {

                    option.textContent =
                        "Production Loss (PROD LOSS)";

                }

                else if (
                    value === "TRAINING"
                ) {

                    option.textContent =
                        "Training";

                }

            }
        );

    }



    // =========================================================
    // CLICKABLE REPORT DETAILS / TIMER AUDIT PANEL
    // =========================================================
    // Clicking any completed profiling row opens a detailed view
    // showing TEAM + MEMBERS sessions, START/PAUSE/RESUME/STOP
    // events, active time, pause time, and total reconciliation.

    function ensureReportDetailsStyles() {

        if (document.getElementById("reportDetailsStyles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "reportDetailsStyles";
        style.textContent = `
            .report-clickable-row {
                cursor: pointer;
                transition: background-color .15s ease, box-shadow .15s ease;
            }

            .report-clickable-row:hover {
                background: rgba(16, 185, 129, .10) !important;
                box-shadow: inset 3px 0 0 var(--accent, #10b981);
            }

            #reportDetailsModal {
                position: fixed;
                inset: 0;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: rgba(0, 0, 0, .48);
                backdrop-filter: blur(5px);
            }

            #reportDetailsModal .report-details-dialog {
                width: min(980px, 96vw);
                max-height: 92vh;
                overflow: hidden;
                background: var(--card-bg, #ffffff);
                color: var(--text-primary, #17211b);
                border: 1px solid rgba(16, 185, 129, .22);
                border-radius: 18px;
                box-shadow: 0 24px 70px rgba(0,0,0,.28);
                display: flex;
                flex-direction: column;
            }

            #reportDetailsModal .report-details-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
                padding: 20px 22px 16px;
                border-bottom: 1px solid rgba(16, 185, 129, .16);
            }

            #reportDetailsModal .report-details-title {
                margin: 0;
                font-size: 20px;
                font-weight: 800;
            }

            #reportDetailsModal .report-details-subtitle {
                margin-top: 4px;
                font-size: 12px;
                opacity: .72;
            }

            #reportDetailsModal .report-details-close {
                width: 36px;
                height: 36px;
                border: 0;
                border-radius: 10px;
                background: rgba(16, 185, 129, .10);
                cursor: pointer;
                font-size: 20px;
                line-height: 1;
            }

            #reportDetailsModal .report-details-body {
                overflow: auto;
                padding: 20px 22px 24px;
            }

            #reportDetailsModal .report-details-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 10px;
                margin-bottom: 18px;
            }

            #reportDetailsModal .report-detail-card {
                padding: 12px 13px;
                border-radius: 12px;
                background: rgba(16, 185, 129, .055);
                border: 1px solid rgba(16, 185, 129, .13);
            }

            #reportDetailsModal .report-detail-label {
                display: block;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: .04em;
                opacity: .62;
                margin-bottom: 4px;
            }

            #reportDetailsModal .report-detail-value {
                font-size: 13px;
                font-weight: 700;
                word-break: break-word;
            }

            #reportDetailsModal .report-details-summary {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 10px;
                margin-bottom: 18px;
            }

            #reportDetailsModal .report-time-card {
                padding: 14px;
                border-radius: 13px;
                border: 1px solid rgba(16, 185, 129, .15);
                background: rgba(255,255,255,.45);
            }

            #reportDetailsModal .report-time-card strong {
                display: block;
                margin-top: 4px;
                font-size: 18px;
            }

            #reportDetailsModal .report-accuracy-box {
                padding: 13px 14px;
                border-radius: 13px;
                margin-bottom: 20px;
                border: 1px solid rgba(16, 185, 129, .18);
                background: rgba(16, 185, 129, .055);
                font-size: 12px;
                line-height: 1.55;
            }

            #reportDetailsModal .report-accuracy-box.warning {
                border-color: rgba(180, 35, 24, .22);
                background: rgba(180, 35, 24, .055);
            }

            #reportDetailsModal .report-session-block {
                margin-top: 16px;
                border: 1px solid rgba(16, 185, 129, .15);
                border-radius: 14px;
                overflow: hidden;
            }

            #reportDetailsModal .report-session-heading {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 13px 15px;
                background: rgba(16, 185, 129, .065);
                border-bottom: 1px solid rgba(16, 185, 129, .12);
            }

            #reportDetailsModal .report-session-heading strong {
                font-size: 13px;
            }

            #reportDetailsModal .report-session-meta {
                font-size: 11px;
                opacity: .68;
                text-align: right;
            }

            #reportDetailsModal .report-event-list {
                list-style: none;
                margin: 0;
                padding: 0;
            }

            #reportDetailsModal .report-event-row {
                display: grid;
                grid-template-columns: 105px 1fr auto;
                align-items: center;
                gap: 10px;
                padding: 10px 15px;
                border-bottom: 1px solid rgba(16, 185, 129, .08);
                font-size: 12px;
            }

            #reportDetailsModal .report-event-row:last-child {
                border-bottom: 0;
            }

            #reportDetailsModal .report-event-type {
                font-weight: 800;
            }

            #reportDetailsModal .report-event-time {
                opacity: .72;
                text-align: right;
                white-space: nowrap;
            }

            #reportDetailsModal .event-start,
            #reportDetailsModal .event-resume {
                color: #087443;
            }

            #reportDetailsModal .event-pause {
                color: #a15c00;
            }

            #reportDetailsModal .event-stop {
                color: #b42318;
            }

            #reportDetailsModal .report-no-events {
                padding: 16px;
                font-size: 12px;
                opacity: .68;
            }

            @media (max-width: 760px) {
                #reportDetailsModal {
                    padding: 10px;
                }

                #reportDetailsModal .report-details-grid,
                #reportDetailsModal .report-details-summary {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                #reportDetailsModal .report-event-row {
                    grid-template-columns: 90px 1fr;
                }

                #reportDetailsModal .report-event-time {
                    grid-column: 2;
                    text-align: left;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function detailEventIcon(type) {
        const normalized = String(type || "").toUpperCase();

        if (normalized === "START") return "▶";
        if (normalized === "RESUME") return "▶";
        if (normalized === "PAUSE") return "⏸";
        if (normalized === "STOP") return "⏹";

        return "•";
    }

    function detailEventClass(type) {
        const normalized = String(type || "").toUpperCase();

        if (normalized === "START") return "event-start";
        if (normalized === "RESUME") return "event-resume";
        if (normalized === "PAUSE") return "event-pause";
        if (normalized === "STOP") return "event-stop";

        return "";
    }

    function getDetailWallSeconds(session) {
        const start = new Date(session?.started_at).getTime();
        const stop = new Date(session?.stopped_at).getTime();

        if (!Number.isFinite(start) || !Number.isFinite(stop) || stop <= start) {
            return 0;
        }

        return Math.floor((stop - start) / 1000);
    }

    function getDetailPauseSeconds(session, eventActiveSeconds) {
        const stored = Number(session?.storedSeconds || 0);
        const wall = Number(session?.wallSeconds || getDetailWallSeconds(session));
        const active = Number(eventActiveSeconds) > 0
            ? Number(eventActiveSeconds)
            : stored;

        if (wall <= 0 || active <= 0) {
            return 0;
        }

        return Math.max(0, wall - active);
    }

    function renderDetailSession(session, index) {
        const type = String(session?.session_type || "SESSION").toUpperCase();
        const events = Array.isArray(session?.events)
            ? [...session.events].sort(
                (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
            )
            : [];

        const eventActiveSeconds = Number(session?.eventActiveSeconds || 0);
        const storedSeconds = Number(session?.storedSeconds || 0);
        const wallSeconds = Number(session?.wallSeconds || getDetailWallSeconds(session));
        const pauseSeconds = Number(session?.pauseSeconds || getDetailPauseSeconds(session, eventActiveSeconds));
        const displayedActiveSeconds = storedSeconds || eventActiveSeconds || wallSeconds;

        const eventRows = events.length
            ? events.map(event => {
                const eventType = String(event?.event_type || "EVENT").toUpperCase();
                return `
                    <li class="report-event-row">
                        <span class="report-event-type ${detailEventClass(eventType)}">
                            ${detailEventIcon(eventType)} ${escapeHtml(eventType)}
                        </span>
                        <span>${escapeHtml(eventType === "PAUSE" ? "Timer paused" : eventType === "RESUME" ? "Timer resumed" : eventType === "START" ? "Timer started" : eventType === "STOP" ? "Timer stopped" : "Timer event recorded")}</span>
                        <span class="report-event-time">${escapeHtml(formatDateTime(event?.event_time))}</span>
                    </li>
                `;
            }).join("")
            : `<li class="report-no-events">No timer events were recorded for this session. The report is using stored/timestamp duration.</li>`;

        const recordedLabel = storedSeconds > 0
            ? formatDuration(storedSeconds)
            : "Not stored";

        const eventLabel = eventActiveSeconds > 0
            ? formatDuration(eventActiveSeconds)
            : "Not available";

        const pauseLabel = pauseSeconds > 0
            ? formatDuration(pauseSeconds)
            : "00:00:00";

        return `
            <section class="report-session-block">
                <div class="report-session-heading">
                    <div>
                        <strong>${escapeHtml(type)} SESSION #${index + 1}</strong>
                    </div>
                    <div class="report-session-meta">
                        Active: ${escapeHtml(formatDuration(displayedActiveSeconds))}<br>
                        Paused estimate: ${escapeHtml(pauseLabel)}
                    </div>
                </div>

                <div style="padding:12px 15px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;font-size:11px;">
                    <div><span style="opacity:.65;display:block;">STARTED</span><strong>${escapeHtml(formatDateTime(session?.started_at))}</strong></div>
                    <div><span style="opacity:.65;display:block;">STOPPED</span><strong>${escapeHtml(formatDateTime(session?.stopped_at))}</strong></div>
                    <div><span style="opacity:.65;display:block;">STORED ACTIVE TIME</span><strong>${escapeHtml(recordedLabel)}</strong></div>
                </div>

                <div style="padding:0 15px 10px;font-size:11px;opacity:.72;">
                    Event-derived active time: <strong>${escapeHtml(eventLabel)}</strong>
                    ${wallSeconds > 0 ? ` · Wall-clock span: <strong>${escapeHtml(formatDuration(wallSeconds))}</strong>` : ""}
                </div>

                <ul class="report-event-list">
                    ${eventRows}
                </ul>
            </section>
        `;
    }

    function closeReportDetails() {
        const modal = document.getElementById("reportDetailsModal");
        if (modal) {
            modal.remove();
            document.body.style.overflow = "";
        }
    }

    function openReportDetails(recordId) {
        const record = reportRecords.find(
            item => String(item?.id) === String(recordId)
        );

        if (!record) {
            return;
        }

        ensureReportDetailsStyles();
        closeReportDetails();

        const sessions = Array.isArray(record.detailSessions)
            ? [...record.detailSessions].sort(
                (a, b) => new Date(a?.started_at).getTime() - new Date(b?.started_at).getTime()
            )
            : [];

        const status = String(record.accuracyStatus || "UNKNOWN");
        const isWarning = status === "INCONSISTENT" || status === "JOB_TOTAL_ONLY";
        const statusText = {
            VERIFIED: "✓ Verified — detailed TEAM + MEMBERS time agrees with the stored profiling total.",
            SESSION_VERIFIED: "✓ Session verified — detailed timer sessions are available; no stored job total was available for comparison.",
            LEGACY_VERIFIED: "✓ Legacy match — the timer session was recovered using the profiling job time window and the totals agree.",
            LEGACY_SESSION: "✓ Legacy session — the timer session was recovered using the profiling job time window.",
            INCONSISTENT: `⚠ Check total — detailed TEAM + MEMBERS time differs from the stored profiling total by ${formatDuration(record.differenceSeconds)}.`,
            JOB_TOTAL_ONLY: "⚠ Job total only — no usable detailed TEAM/MEMBERS session duration was found.",
            NO_BREAKDOWN: "— No detailed timer breakdown was available."
        }[status] || "— Report accuracy status is unavailable.";

        const modal = document.createElement("div");
        modal.id = "reportDetailsModal";
        modal.innerHTML = `
            <div class="report-details-dialog" role="dialog" aria-modal="true" aria-labelledby="reportDetailsTitle">
                <div class="report-details-header">
                    <div>
                        <h2 id="reportDetailsTitle" class="report-details-title">Profiling Session Details</h2>
                        <div class="report-details-subtitle">Job #${escapeHtml(String(record.id))} · Click outside or press Esc to close</div>
                    </div>
                    <button type="button" class="report-details-close" aria-label="Close">×</button>
                </div>

                <div class="report-details-body">
                    <div class="report-details-grid">
                        <div class="report-detail-card"><span class="report-detail-label">Analyst</span><span class="report-detail-value">${escapeHtml(record.analystName)}</span></div>
                        <div class="report-detail-card"><span class="report-detail-label">Team</span><span class="report-detail-value">${escapeHtml(record.team_name)}</span></div>
                        <div class="report-detail-card"><span class="report-detail-label">Team ID</span><span class="report-detail-value">${escapeHtml(String(record.team_id))}</span></div>
                        <div class="report-detail-card"><span class="report-detail-label">Members</span><span class="report-detail-value">${escapeHtml(formatNumber(record.member_count))}</span></div>
                        <div class="report-detail-card"><span class="report-detail-label">Started</span><span class="report-detail-value">${escapeHtml(formatDateTime(record.started_at))}</span></div>
                        <div class="report-detail-card"><span class="report-detail-label">Completed</span><span class="report-detail-value">${escapeHtml(formatDateTime(record.finished_at))}</span></div>
                        <div class="report-detail-card"><span class="report-detail-label">TEAM Sessions</span><span class="report-detail-value">${escapeHtml(String(record.teamSessionCount || 0))}</span></div>
                        <div class="report-detail-card"><span class="report-detail-label">MEMBERS Sessions</span><span class="report-detail-value">${escapeHtml(String(record.membersSessionCount || 0))}</span></div>
                    </div>

                    <div class="report-details-summary">
                        <div class="report-time-card"><span class="report-detail-label">Teams Time</span><strong>${escapeHtml(formatDuration(record.teamSeconds))}</strong></div>
                        <div class="report-time-card"><span class="report-detail-label">Members Time</span><strong>${escapeHtml(formatDuration(record.membersSeconds))}</strong></div>
                        <div class="report-time-card"><span class="report-detail-label">Total Time</span><strong>${escapeHtml(formatDuration(record.totalSeconds))}</strong></div>
                    </div>

                    <div class="report-accuracy-box ${isWarning ? "warning" : ""}">
                        <strong>${escapeHtml(statusText)}</strong><br>
                        Stored job total: <strong>${escapeHtml(formatDuration(record.storedJobTotalSeconds))}</strong>
                        · Detailed session total: <strong>${escapeHtml(formatDuration(record.sessionTotalSeconds))}</strong>
                        · Difference: <strong>${escapeHtml(formatDuration(record.differenceSeconds))}</strong>
                    </div>

                    <div style="font-size:15px;font-weight:800;margin-bottom:8px;">Timer Timeline</div>
                    ${sessions.length
                        ? sessions.map((session, index) => renderDetailSession(session, index)).join("")
                        : `<div class="report-no-events">No detailed TEAM/MEMBERS sessions are attached to this profiling job.</div>`}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = "hidden";

        modal.querySelector(".report-details-close")?.addEventListener("click", closeReportDetails);

        modal.addEventListener("click", event => {
            if (event.target === modal) {
                closeReportDetails();
            }
        });
    }

    function initializeReportRowDetails() {
        if (!reportsTableBody || reportsTableBody.dataset.detailsListenerAttached === "1") {
            return;
        }

        reportsTableBody.dataset.detailsListenerAttached = "1";

        reportsTableBody.addEventListener("click", event => {
            const row = event.target.closest("tr[data-report-id]");
            if (!row) {
                return;
            }

            openReportDetails(row.dataset.reportId);
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeReportDetails();
            }
        });
    }

    ensureReportDetailsStyles();
    initializeReportRowDetails();

    // ---------------------------------------------------------
    // START REPORTS
    // ---------------------------------------------------------

    // =========================================================
// TICKY TICKY REPORTS - VISUAL ENHANCEMENT PATCH
// =========================================================
// Adds:
// - Working category breakdown chart
// - Separate colors for all work categories
// - Category legend
// - Data-based observations
// - Enhanced KPI values
// - Keeps existing Excel export untouched
// =========================================================

(function () {

    // ---------------------------------------------------------
    // ELEMENTS
    // ---------------------------------------------------------

    const enhancedCategoryChart =
        document.getElementById(
            "categoryBreakdownChart"
        );

    const enhancedInsightList =
        document.getElementById(
            "reportInsightList"
        );

    const enhancedTotalRecorded =
        document.getElementById(
            "reportTotalRecordedTime"
        );

    const enhancedProdTime =
        document.getElementById(
            "reportProdTime"
        );

    const enhancedNonProdTime =
        document.getElementById(
            "reportNonProdTime"
        );

    const enhancedProdLossTime =
        document.getElementById(
            "reportProdLossTime"
        );

    const enhancedTrainingTime =
        document.getElementById(
            "reportTrainingTime"
        );

    const enhancedProductivityRate =
        document.getElementById(
            "reportProductivityRate"
        );

    const enhancedNonProdRate =
        document.getElementById(
            "reportNonProdRate"
        );

    const enhancedProdLossRate =
        document.getElementById(
            "reportProdLossRate"
        );

    const enhancedActivityCount =
        document.getElementById(
            "reportActivityCount"
        );

    const enhancedAvgProdPerAnalyst =
        document.getElementById(
            "reportAvgProdPerAnalyst"
        );


    // ---------------------------------------------------------
    // CATEGORY DEFINITIONS
    // ---------------------------------------------------------

    const REPORT_CATEGORY_CONFIG = {
        "PROD": {
            label: "Production (PROD)",
            color: "#159A70"
        },

        "NON-PROD": {
            label: "Non-Production (NON-PROD)",
            color: "#E59A28"
        },

        "PROD LOSS": {
            label: "Production Loss (PROD LOSS)",
            color: "#D3544D"
        },

        "TRAINING": {
            label: "Training",
            color: "#7567D8"
        }
    };


    // ---------------------------------------------------------
    // SAFE CATEGORY NORMALIZATION
    // ---------------------------------------------------------

    function enhancedNormalizeCategory(value) {

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
            return "PROD";
        }

        if (
            category === "NON-PROD" ||
            category === "NON PRODUCTION" ||
            category === "NON-PRODUCTION" ||
            category === "NON-PROD ACTIVITIES"
        ) {
            return "NON-PROD";
        }

        if (
            category === "PROD LOSS" ||
            category === "PRODUCTION LOSS" ||
            category === "PROD_LOSS"
        ) {
            return "PROD LOSS";
        }

        if (
            category === "TRAINING"
        ) {
            return "TRAINING";
        }

        return category;
    }


    // ---------------------------------------------------------
    // CATEGORY TOTAL CALCULATION
    // ---------------------------------------------------------

    function getEnhancedCategoryTotals(
        profilingRecords = [],
        workRecords = []
    ) {

        const totals = {
            "PROD": 0,
            "NON-PROD": 0,
            "PROD LOSS": 0,
            "TRAINING": 0
        };


        // -----------------------------------------------------
        // PROFILING TIME
        // -----------------------------------------------------
        //
        // Profiling is treated as Production for the report's
        // productivity view.
        //
        // The existing report already calculates profiling
        // separately, so this does not change database values.
        // -----------------------------------------------------

        (profilingRecords || []).forEach(
            record => {

                const seconds =
                    Math.max(
                        0,
                        Number(
                            record.totalSeconds ||
                            record.total_seconds ||
                            0
                        )
                    );

                totals["PROD"] +=
                    seconds;
            }
        );


        // -----------------------------------------------------
        // WORK ACTIVITY TIME
        // -----------------------------------------------------

        (workRecords || []).forEach(
            record => {

                const category =
                    enhancedNormalizeCategory(
                        record.category
                    );

                const seconds =
                    Math.max(
                        0,
                        Number(
                            record.duration_seconds ||
                            0
                        )
                    );

                if (
                    Object.prototype.hasOwnProperty.call(
                        totals,
                        category
                    )
                ) {

                    totals[category] +=
                        seconds;

                }

            }
        );


        return totals;
    }


    // ---------------------------------------------------------
    // CATEGORY BREAKDOWN CHART
    // ---------------------------------------------------------

    function renderEnhancedCategoryChart(
        profilingRecords = [],
        workRecords = []
    ) {

        if (
            !enhancedCategoryChart
        ) {
            return;
        }


        const totals =
            getEnhancedCategoryTotals(
                profilingRecords,
                workRecords
            );


        const rows = [
            {
                key: "PROD"
            },
            {
                key: "NON-PROD"
            },
            {
                key: "PROD LOSS"
            },
            {
                key: "TRAINING"
            }
        ].map(
            item => {

                return {
                    key: item.key,
                    label:
                        REPORT_CATEGORY_CONFIG[
                            item.key
                        ].label,

                    color:
                        REPORT_CATEGORY_CONFIG[
                            item.key
                        ].color,

                    seconds:
                        totals[
                            item.key
                        ] || 0
                };

            }
        );


        const total =
            rows.reduce(
                (
                    sum,
                    row
                ) =>
                    sum +
                    row.seconds,
                0
            );


        if (
            total <= 0
        ) {

            enhancedCategoryChart.innerHTML = `
                <div
                    style="
                        min-height:220px;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        text-align:center;
                        color:var(--text-secondary);
                        font-size:14px;
                    "
                >
                    No work activity or profiling time
                    is available for the selected filters.
                </div>
            `;

            return;
        }


        const maximum =
            Math.max(
                ...rows.map(
                    row =>
                        row.seconds
                ),
                1
            );


        enhancedCategoryChart.innerHTML = `

            <div
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:10px 6px;
                "
            >

                <!-- LEGEND -->

                <div
                    style="
                        display:flex;
                        flex-wrap:wrap;
                        gap:14px;
                        margin-bottom:22px;
                        padding-bottom:14px;
                        border-bottom:1px solid
                            rgba(20,150,110,.20);
                    "
                >

                    ${rows.map(
                        row => `

                            <div
                                style="
                                    display:flex;
                                    align-items:center;
                                    gap:7px;
                                    font-size:11px;
                                    font-weight:700;
                                    color:var(--text-secondary);
                                "
                            >

                                <span
                                    style="
                                        width:11px;
                                        height:11px;
                                        border-radius:3px;
                                        background:${row.color};
                                        display:inline-block;
                                        flex-shrink:0;
                                    "
                                ></span>

                                ${escapeHtml(
                                    row.label
                                )}

                            </div>

                        `
                    ).join("")}

                </div>


                <!-- TOTAL -->

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        margin-bottom:18px;
                    "
                >

                    <span
                        style="
                            font-size:12px;
                            color:var(--text-secondary);
                            font-weight:600;
                        "
                    >
                        Total Categorized Time
                    </span>

                    <strong
                        style="
                            font-size:15px;
                            color:var(--text-primary);
                        "
                    >
                        ${formatDuration(total)}
                    </strong>

                </div>


                <!-- CATEGORY BARS -->

                <div>

                    ${rows.map(
                        row => {

                            const percent =
                                total > 0
                                    ? (
                                        row.seconds /
                                        total
                                    ) * 100
                                    : 0;


                            const width =
                                row.seconds > 0
                                    ? Math.max(
                                        (
                                            row.seconds /
                                            maximum
                                        ) * 100,
                                        2
                                    )
                                    : 0;


                            return `

                                <div
                                    style="
                                        margin-bottom:20px;
                                    "
                                >

                                    <!-- LABEL -->

                                    <div
                                        style="
                                            display:flex;
                                            justify-content:space-between;
                                            align-items:center;
                                            gap:12px;
                                            margin-bottom:7px;
                                        "
                                    >

                                        <div
                                            style="
                                                display:flex;
                                                align-items:center;
                                                gap:8px;
                                                min-width:0;
                                            "
                                        >

                                            <span
                                                style="
                                                    width:10px;
                                                    height:10px;
                                                    border-radius:3px;
                                                    background:${row.color};
                                                    display:inline-block;
                                                    flex-shrink:0;
                                                "
                                            ></span>

                                            <span
                                                style="
                                                    font-size:13px;
                                                    font-weight:700;
                                                    color:var(--text-primary);
                                                "
                                            >
                                                ${escapeHtml(
                                                    row.label
                                                )}
                                            </span>

                                        </div>


                                        <strong
                                            style="
                                                font-size:13px;
                                                color:var(--text-primary);
                                                white-space:nowrap;
                                            "
                                        >
                                            ${formatDuration(
                                                row.seconds
                                            )}
                                        </strong>

                                    </div>


                                    <!-- TRACK -->

                                    <div
                                        style="
                                            width:100%;
                                            height:18px;
                                            background:rgba(20,150,110,.10);
                                            border-radius:999px;
                                            overflow:hidden;
                                        "
                                        title="${escapeHtml(
                                            row.label
                                        )}: ${formatDuration(
                                            row.seconds
                                        )} (${percent.toFixed(1)}%)"
                                    >

                                        <div
                                            style="
                                                width:${width}%;
                                                min-width:${
                                                    row.seconds > 0
                                                        ? "3px"
                                                        : "0"
                                                };
                                                height:100%;
                                                background:${row.color};
                                                border-radius:999px;
                                                transition:width .35s ease;
                                            "
                                        ></div>

                                    </div>


                                    <!-- PERCENT -->

                                    <div
                                        style="
                                            margin-top:5px;
                                            font-size:10px;
                                            color:var(--text-secondary);
                                        "
                                    >
                                        ${percent.toFixed(1)}%
                                        of categorized time
                                    </div>

                                </div>

                            `;

                        }
                    ).join("")}

                </div>

            </div>

        `;
    }


    // ---------------------------------------------------------
    // DATA-BASED OBSERVATIONS
    // ---------------------------------------------------------

    function renderEnhancedInsights(
        profilingRecords = [],
        workRecords = []
    ) {

        if (
            !enhancedInsightList
        ) {
            return;
        }


        const totals =
            getEnhancedCategoryTotals(
                profilingRecords,
                workRecords
            );


        const prod =
            totals["PROD"] || 0;

        const nonProd =
            totals["NON-PROD"] || 0;

        const prodLoss =
            totals["PROD LOSS"] || 0;

        const training =
            totals["TRAINING"] || 0;


        const total =
            prod +
            nonProd +
            prodLoss +
            training;


        const analysts =
            new Set(
                [
                    ...(profilingRecords || [])
                        .map(
                            record =>
                                record.analystName ||
                                record.analyst_name ||
                                record.analyst_id
                        ),

                    ...(workRecords || [])
                        .map(
                            record =>
                                record.analystName ||
                                record.analyst_name ||
                                record.analyst_id
                        )
                ]
                .filter(Boolean)
                .map(
                    value =>
                        String(value)
                )
            );


        const insights = [];


        if (
            total <= 0
        ) {

            insights.push(
                "No recorded time is available for the selected filters."
            );

        } else {

            const prodRate =
                (
                    prod /
                    total
                ) * 100;

            const nonProdRate =
                (
                    nonProd /
                    total
                ) * 100;

            const lossRate =
                (
                    prodLoss /
                    total
                ) * 100;

            const trainingRate =
                (
                    training /
                    total
                ) * 100;


            insights.push(
                `Production represents ${prodRate.toFixed(1)}% of the ${formatDuration(total)} categorized time.`
            );


            if (
                nonProd > 0
            ) {

                insights.push(
                    `Non-Production accounts for ${formatDuration(nonProd)} (${nonProdRate.toFixed(1)}%).`
                );

            }


            if (
                prodLoss > 0
            ) {

                insights.push(
                    `Production Loss accounts for ${formatDuration(prodLoss)} (${lossRate.toFixed(1)}%).`
                );

            }


            if (
                training > 0
            ) {

                insights.push(
                    `Training accounts for ${formatDuration(training)} (${trainingRate.toFixed(1)}%).`
                );

            }


            if (
                analysts.size > 0
            ) {

                const avgProd =
                    Math.round(
                        prod /
                        analysts.size
                    );


                insights.push(
                    `Average Production time per recorded analyst is ${formatDuration(avgProd)}.`
                );

            }


            insights.push(
                `${(workRecords || []).length.toLocaleString()} completed work activities and ${(profilingRecords || []).length.toLocaleString()} completed profiling jobs are included in the selected report data.`
            );

        }


        enhancedInsightList.innerHTML =
            insights
                .map(
                    text => `
                        <li>
                            ${escapeHtml(text)}
                        </li>
                    `
                )
                .join("");

    }


    // ---------------------------------------------------------
    // ENHANCED KPI UPDATE
    // ---------------------------------------------------------

    function updateEnhancedKPIs(
        profilingRecords = [],
        workRecords = []
    ) {

        const totals =
            getEnhancedCategoryTotals(
                profilingRecords,
                workRecords
            );


        const prod =
            totals["PROD"] || 0;

        const nonProd =
            totals["NON-PROD"] || 0;

        const prodLoss =
            totals["PROD LOSS"] || 0;

        const training =
            totals["TRAINING"] || 0;


        const workTotal =
            nonProd +
            prodLoss +
            training;


        const total =
            prod +
            nonProd +
            prodLoss +
            training;


        const productivityRate =
            total > 0
                ? (
                    prod /
                    total
                ) * 100
                : 0;


        const nonProdRate =
            total > 0
                ? (
                    nonProd /
                    total
                ) * 100
                : 0;


        const prodLossRate =
            total > 0
                ? (
                    prodLoss /
                    total
                ) * 100
                : 0;


        if (
            enhancedTotalRecorded
        ) {

            enhancedTotalRecorded.textContent =
                formatDuration(total);

        }


        if (
            enhancedProdTime
        ) {

            enhancedProdTime.textContent =
                formatDuration(prod);

        }


        if (
            enhancedNonProdTime
        ) {

            enhancedNonProdTime.textContent =
                formatDuration(nonProd);

        }


        if (
            enhancedProdLossTime
        ) {

            enhancedProdLossTime.textContent =
                formatDuration(prodLoss);

        }


        if (
            enhancedTrainingTime
        ) {

            enhancedTrainingTime.textContent =
                formatDuration(training);

        }


        if (
            enhancedProductivityRate
        ) {

            enhancedProductivityRate.textContent =
                `${productivityRate.toFixed(1)}%`;

        }


        if (
            enhancedNonProdRate
        ) {

            enhancedNonProdRate.textContent =
                `${nonProdRate.toFixed(1)}%`;

        }


        if (
            enhancedProdLossRate
        ) {

            enhancedProdLossRate.textContent =
                `${prodLossRate.toFixed(1)}%`;

        }


        if (
            enhancedActivityCount
        ) {

            enhancedActivityCount.textContent =
                (
                    workRecords || []
                )
                    .length
                    .toLocaleString();

        }


        if (
            enhancedAvgProdPerAnalyst
        ) {

            const analysts =
                new Set(
                    [
                        ...(profilingRecords || [])
                            .map(
                                record =>
                                    record.analystName ||
                                    record.analyst_id
                            ),

                        ...(workRecords || [])
                            .map(
                                record =>
                                    record.analystName ||
                                    record.analyst_id
                            )
                    ]
                    .filter(Boolean)
                    .map(
                        value =>
                            String(value)
                    )
                );


            const average =
                analysts.size > 0
                    ? Math.round(
                        prod /
                        analysts.size
                    )
                    : 0;


            enhancedAvgProdPerAnalyst.textContent =
                formatDuration(
                    average
                );

        }

    }


    // ---------------------------------------------------------
    // ENHANCE EXISTING RENDER
    // ---------------------------------------------------------

    const originalRenderReports =
        renderReports;


    renderReports =
        function (
            records
        ) {

            // Run the original Reports rendering first.
            originalRenderReports(
                records
            );


            // Get currently filtered work activities.
            let filteredWork =
                [];


            try {

                if (
                    typeof getFilteredWorkActivityRecords ===
                    "function"
                ) {

                    filteredWork =
                        getFilteredWorkActivityRecords() ||
                        [];

                } else {

                    filteredWork =
                        workActivityReportRecords ||
                        [];

                }

            } catch (error) {

                console.warn(
                    "Unable to get filtered work activities:",
                    error
                );

                filteredWork =
                    workActivityReportRecords ||
                    [];

            }


            const filteredProfiling =
                records ||
                [];


            // Update enhanced components.
            updateEnhancedKPIs(
                filteredProfiling,
                filteredWork
            );


            renderEnhancedInsights(
                filteredProfiling,
                filteredWork
            );


            renderEnhancedCategoryChart(
                filteredProfiling,
                filteredWork
            );

        };


    // ---------------------------------------------------------
    // ADD COLORS TO EXISTING ANALYST COMPOSITION
    // ---------------------------------------------------------

    const originalAnalystChart =
        renderAnalystChart;


    renderAnalystChart =
        function (
            profilingRecords,
            workRecords = []
        ) {

            originalAnalystChart(
                profilingRecords,
                workRecords
            );


            if (
                !analystChart
            ) {
                return;
            }


            // Apply visual colors to the existing
            // segment classes.

            const segmentColors = {

                "profiling-chart-segment":
                    "#159A70",

                "prod-chart-segment":
                    "#159A70",

                "nonprod-chart-segment":
                    "#E59A28",

                "other-work-chart-segment":
                    "#7567D8"

            };


            Object.entries(
                segmentColors
            ).forEach(
                (
                    [
                        className,
                        color
                    ]
                ) => {

                    analystChart
                        .querySelectorAll(
                            "." +
                            className
                        )
                        .forEach(
                            element => {

                                element.style.background =
                                    color;

                            }
                        );

                }
            );


            // Add a legend to the Analyst Time
            // Composition chart if it doesn't already
            // exist.

            if (
                !analystChart.querySelector(
                    ".analyst-composition-legend"
                )
            ) {

                const legend =
                    document.createElement(
                        "div"
                    );


                legend.className =
                    "analyst-composition-legend";


                legend.style.cssText = `
                    display:flex;
                    flex-wrap:wrap;
                    gap:14px;
                    margin-top:14px;
                    padding-top:10px;
                    border-top:1px solid rgba(20,150,110,.20);
                    font-size:10px;
                    color:var(--text-secondary);
                `;


                const legendItems = [

                    {
                        label: "Profiling",
                        color: "#159A70"
                    },

                    {
                        label: "PROD",
                        color: "#159A70"
                    },

                    {
                        label: "NON-PROD",
                        color: "#E59A28"
                    },

                    {
                        label: "Other",
                        color: "#7567D8"
                    }

                ];


                legend.innerHTML =
                    legendItems
                        .map(
                            item => `
                                <span
                                    style="
                                        display:flex;
                                        align-items:center;
                                        gap:5px;
                                    "
                                >

                                    <span
                                        style="
                                            width:9px;
                                            height:9px;
                                            border-radius:2px;
                                            background:${item.color};
                                            display:inline-block;
                                        "
                                    ></span>

                                    ${item.label}

                                </span>
                            `
                        )
                        .join("");


                analystChart.appendChild(
                    legend
                );

            }

        };


    // ---------------------------------------------------------
    // MAKE SURE CATEGORY FILTER HAS ALL OPTIONS
    // ---------------------------------------------------------

    const categoryFilter =
        document.getElementById(
            "workActivityCategoryFilter"
        );


    if (
        categoryFilter
    ) {

        const options = [
            {
                value: "",
                text: "All Categories"
            },

            {
                value: "PROD",
                text: "Production (PROD)"
            },

            {
                value: "NON-PROD",
                text: "Non-Production (NON-PROD)"
            },

            {
                value: "PROD LOSS",
                text: "Production Loss (PROD LOSS)"
            },

            {
                value: "TRAINING",
                text: "Training"
            }
        ];


        const currentValue =
            categoryFilter.value;


        categoryFilter.innerHTML =
            options
                .map(
                    option => `
                        <option
                            value="${option.value}"
                        >
                            ${option.text}
                        </option>
                    `
                )
                .join("");


        categoryFilter.value =
            options.some(
                option =>
                    option.value ===
                    currentValue
            )
                ? currentValue
                : "";

    }


    // ---------------------------------------------------------
    // START REPORTS
    // ---------------------------------------------------------

    initializeReports();

})();

})();