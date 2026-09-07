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


    // -----------------------------------------------------
    // NO DATA
    // -----------------------------------------------------

    if (
        !jobs ||
        jobs.length === 0
    ) {

        reportRecords = [];

        filteredRecords = [];

        populateAnalystFilter(
            []
        );

        populateTeamFilter(
            []
        );

        renderReports(
            []
        );

        return;
    }


    // -----------------------------------------------------
    // GET JOB IDs
    // -----------------------------------------------------

    const jobIds =
        jobs.map(
            job =>
                job.id
        );


    // -----------------------------------------------------
    // GET TIMER SESSIONS
    // -----------------------------------------------------

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


    console.log(
        "Timer sessions:",
        sessions
    );


    // -----------------------------------------------------
    // GET TIMER EVENTS
    // Used to attribute profiling time to the actual
    // calendar day(s) on which it was performed.
    // -----------------------------------------------------

    const sessionIds =
        (sessions || [])
            .map(session => session.id)
            .filter(Boolean);

    let timerEvents = [];

    if (sessionIds.length > 0) {

        const {
            data: eventRows,
            error: eventsError
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
                    sessionIds
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

        timerEvents =
            eventRows || [];

    }


    // -----------------------------------------------------
    // GET ANALYST PROFILES
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


    if (
        analystIds.length >
        0
    ) {

        const {
            data: profileRows,
            error: profilesError
        } =
            await supabase
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
            profileRows ||
            [];

    }


    // -----------------------------------------------------
    // ATTRIBUTE SESSION TIME TO LOCAL CALENDAR DAYS
    // -----------------------------------------------------

    function buildDailySessionBreakdown(sessionList) {

        const breakdown = {};

        const eventsBySession = new Map();

        (timerEvents || []).forEach(event => {

            if (!eventsBySession.has(String(event.session_id))) {
                eventsBySession.set(String(event.session_id), []);
            }

            eventsBySession.get(String(event.session_id)).push(event);

        });


        function addInterval(start, end) {

            if (!start || !end || end <= start) {
                return;
            }

            let cursor = new Date(start);

            while (cursor < end) {

                const dayStart = new Date(cursor);
                dayStart.setHours(0, 0, 0, 0);

                const nextDay = new Date(dayStart);
                nextDay.setDate(nextDay.getDate() + 1);

                const segmentEnd =
                    end < nextDay
                        ? end
                        : nextDay;

                const seconds =
                    Math.max(
                        0,
                        Math.floor(
                            (segmentEnd - cursor) / 1000
                        )
                    );

                if (seconds > 0) {

                    const dateKey =
                        [
                            cursor.getFullYear(),
                            String(cursor.getMonth() + 1).padStart(2, "0"),
                            String(cursor.getDate()).padStart(2, "0")
                        ].join("-");

                    breakdown[dateKey] =
                        (breakdown[dateKey] || 0) +
                        seconds;

                }

                cursor = segmentEnd;

            }

        }


        (sessionList || []).forEach(session => {

            const events =
                eventsBySession.get(String(session.id)) || [];

            let activeStart = null;

            events.forEach(event => {

                const time = new Date(event.event_time);

                if (Number.isNaN(time.getTime())) {
                    return;
                }

                if (
                    event.event_type === "START" ||
                    event.event_type === "RESUME"
                ) {
                    activeStart = time;
                }

                if (event.event_type === "PAUSE") {

                    if (activeStart) {
                        addInterval(activeStart, time);
                    }

                    activeStart = null;
                }

                if (event.event_type === "STOP") {

                    if (activeStart) {
                        addInterval(activeStart, time);
                    }

                    activeStart = null;
                }

            });


            // For legacy rows with no events, fall back to the
            // stored total and the session's start/stop timestamps.
            if (
                events.length === 0 &&
                session.started_at &&
                session.stopped_at
            ) {

                const start = new Date(session.started_at);
                const end = new Date(session.stopped_at);

                if (
                    !Number.isNaN(start.getTime()) &&
                    !Number.isNaN(end.getTime())
                ) {
                    addInterval(start, end);
                }

            }

        });

        return breakdown;

    }


    // -----------------------------------------------------
    // BUILD REPORT RECORDS
    // -----------------------------------------------------

    reportRecords =
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
                            String(
                                job.id
                            )
                    );


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

                    dailyBreakdown:
                        dailyBreakdown

                };

            }
        );


    // -----------------------------------------------------
    // POPULATE FILTERS
    // -----------------------------------------------------

    populateAnalystFilter(
        reportRecords
    );




    // -----------------------------------------------------
    // INITIAL RENDER
    // -----------------------------------------------------

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


    // -----------------------------------------------------
    // NO RECORDS
    // -----------------------------------------------------

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


        updatePagination(
            0
        );

        return;

    }


    // -----------------------------------------------------
    // CALCULATE PAGE DETAILS
    // -----------------------------------------------------

    const totalPages =
        Math.ceil(
            totalRecords /
            recordsPerPage
        );


    // Prevent an invalid page number

    if (
        currentPage >
        totalPages
    ) {

        currentPage =
            totalPages;

    }


    if (
        currentPage <
        1
    ) {

        currentPage =
            1;

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


    // -----------------------------------------------------
    // RENDER CURRENT PAGE ONLY
    // -----------------------------------------------------

    reportsTableBody.innerHTML =
        pageRecords
            .map(
                record =>
                    `
                    <tr>

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


    // -----------------------------------------------------
    // UPDATE PAGINATION
    // -----------------------------------------------------

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
        "A12:H12",
        "A17:H17",
        "A24:H24"
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
        "A9:B10",
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
        "D9:E10",
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
        "A13:C13",
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
        "A14:C15",
        {

            border:
                thinBorder,

            alignment: {
                vertical: "center"
            }

        }
    );


    // TEAMS ROW

    summarySheet["A14"].s = {

        ...summarySheet["A14"].s,

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


    summarySheet["B14"].s = {

        ...summarySheet["B14"].s,

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


    summarySheet["C14"].s = {

        ...summarySheet["C14"].s,

        font: {
            bold: true
        },

        alignment: {
            horizontal: "center",
            vertical: "center"
        }

    };


    // MEMBERS ROW

    summarySheet["A15"].s = {

        ...summarySheet["A15"].s,

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


    summarySheet["B15"].s = {

        ...summarySheet["B15"].s,

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


    summarySheet["C15"].s = {

        ...summarySheet["C15"].s,

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
        "A18:C18",
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
        "A25:B29",
        {

            border:
                thinBorder,

            alignment: {
                vertical: "center"
            }

        }
    );


    for (
        let row = 25;
        row <= 29;
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
            `A1:H${productivityRows.length}`

    };


    styleTable(
        productivitySheet,
        productivityRows.length,
        "H"
    );


    productivitySheet["!cols"] = [

        { wch: 24 },
        { wch: 38 },
        { wch: 12 },
        { wch: 12 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
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
            `G${row}`
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
// START
// =========================================================

initializeReports();