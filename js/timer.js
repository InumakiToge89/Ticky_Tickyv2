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
// DOM ELEMENTS
// =========================================================

const teamNameElement =
    document.getElementById("teamName");

const teamIdElement =
    document.getElementById("teamId");

const profilingTypeBadge =
    document.getElementById(
        "profilingTypeBadge"
    );

const finishModal =
    document.getElementById(
        "finishModal"
    );

const cancelFinishButton =
    document.getElementById(
        "cancelFinishButton"
    );

const confirmFinishButton =
    document.getElementById(
        "confirmFinishButton"
    );

const timerStatus =
    document.getElementById("timerStatus");

const timerDisplay =
    document.getElementById("timerDisplay");

const timerSubtext =
    document.getElementById("timerSubtext");

const startButton =
    document.getElementById("startButton");

const pauseButton =
    document.getElementById("pauseButton");

const resumeButton =
    document.getElementById("resumeButton");

const stopButton =
    document.getElementById("stopButton");

const finishedButton =
    document.getElementById("finishedButton");

const saveForLaterButton =
    document.getElementById("saveForLaterButton");

const timerError =
    document.getElementById("timerError");

const sessionTypeElement =
    document.getElementById("sessionType");

const memberCountElement =
    document.getElementById("memberCount");

const startedAtElement =
    document.getElementById("startedAt");

const userName =
    document.getElementById("userName");

const userRole =
    document.getElementById("userRole");

const userAvatar =
    document.getElementById("userAvatar");

const logoutButton =
    document.getElementById("logoutButton");


// =========================================================
// STATE
// =========================================================

let currentUser = null;

let currentProfile = null;

let currentJob = null;

let currentSession = null;

let timerInterval = null;


// =========================================================
// INITIALIZE TIMER
// =========================================================

async function initializeTimer() {

    try {

        // -------------------------------------------------
        // Get authenticated user
        // -------------------------------------------------

        const {
            data: {
                user
            },
            error: userError
        } = await supabase.auth.getUser();


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
        } = await supabase
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


        if (
            profile.status !==
            "ACTIVE"
        ) {

            await supabase.auth.signOut();

            window.location.href =
                "../index.html";

            return;
        }


        currentProfile =
            profile;


        userName.textContent =
            profile.full_name;

        userRole.textContent =
            profile.role;

        userAvatar.textContent =
            getInitials(
                profile.full_name
            );


        // =================================================
        // FIND ACTIVE JOB FROM DATABASE
        // =================================================

        // =================================================
        // FIND THE PROFILING JOB TO OPEN
        // =================================================
        //
        // When Resume is clicked from the Profiling page,
        // the exact job ID is stored in sessionStorage.
        //
        // A saved-for-later job may still have status PAUSED,
        // so we must allow BOTH IN_PROGRESS and PAUSED here.

        const savedJobId =
            sessionStorage.getItem(
                "activeProfilingJobId"
            );

        let activeJob = null;
        let activeJobError = null;


        // -------------------------------------------------
        // FIRST: Try the exact job selected by Resume
        // -------------------------------------------------

        if (savedJobId) {

            const result =
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
                        finished_at
                    `)
                    .eq(
                        "id",
                        savedJobId
                    )
                    .eq(
                        "analyst_id",
                        user.id
                    )
                    .in(
                        "status",
                        [
                            "IN_PROGRESS",
                            "PAUSED"
                        ]
                    )
                    .maybeSingle();

            activeJob =
                result.data;

            activeJobError =
                result.error;
        }


        // -------------------------------------------------
        // SECOND: If no saved job ID, find an active job
        // -------------------------------------------------

        if (
            !activeJob &&
            !activeJobError
        ) {

            const result =
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
                        finished_at
                    `)
                    .eq(
                        "analyst_id",
                        user.id
                    )
                    .eq(
                        "status",
                        "IN_PROGRESS"
                    )
                    .order(
                        "started_at",
                        {
                            ascending: false
                        }
                    )
                    .limit(1)
                    .maybeSingle();

            activeJob =
                result.data;

            activeJobError =
                result.error;
        }


        if (activeJobError) {
            throw activeJobError;
        }


        // -------------------------------------------------
        // No profiling job found
        // -------------------------------------------------

        if (!activeJob) {

            showError(
                "There is no active profiling session."
            );

            disableAllButtons();

            return;
        }


        if (activeJobError) {
            throw activeJobError;
        }


        // -------------------------------------------------
        // No active job
        // -------------------------------------------------

        if (!activeJob) {

            showError(
                "There is no active profiling session."
            );

            disableAllButtons();

            return;
        }


        currentJob =
            activeJob;


        // -------------------------------------------------
        // Display job
        // -------------------------------------------------

        teamNameElement.textContent =
            activeJob.team_name;


        teamIdElement.textContent =
            `Team ID: ${activeJob.team_id}`;


        memberCountElement.textContent =
            activeJob.member_count;


        // =================================================
        // DETERMINE SESSION TYPE
        // =================================================

        let selectedType =
            sessionStorage.getItem(
                "activeProfilingType"
            );


        // -------------------------------------------------
        // If local storage doesn't know the type,
        // recover it from the database.
        // -------------------------------------------------

        const {
            data: sessions,
            error: sessionsError
        } = await supabase
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
            .eq(
                "profiling_job_id",
                activeJob.id
            );


        if (sessionsError) {
            throw sessionsError;
        }


        if (
            !sessions
            ||
            sessions.length === 0
        ) {

            throw new Error(
                "No timer sessions were found for this profiling job."
            );
        }


        // -------------------------------------------------
        // Prefer currently running session
        // -------------------------------------------------

        const runningSession =
            sessions.find(
                session =>
                    session.status ===
                    "RUNNING"
            );


        if (runningSession) {

            selectedType =
                runningSession.session_type;

        }


        // -------------------------------------------------
        // Otherwise use paused session
        // -------------------------------------------------

        if (!selectedType) {

            const pausedSession =
                sessions.find(
                    session =>
                        session.status ===
                        "PAUSED"
                );


            if (pausedSession) {

                selectedType =
                    pausedSession.session_type;

            }

        }


        // -------------------------------------------------
        // Otherwise use sessionStorage if valid
        // -------------------------------------------------

        if (
            selectedType
            &&
            !sessions.some(
                session =>
                    session.session_type ===
                    selectedType
            )
        ) {

            selectedType =
                null;

        }


        // -------------------------------------------------
        // Otherwise use a not-started session
        // -------------------------------------------------

        if (!selectedType) {

            const notStartedSession =
                sessions.find(
                    session =>
                        session.status ===
                        "NOT_STARTED"
                );


            if (notStartedSession) {

                selectedType =
                    notStartedSession.session_type;

            }

        }


        // -------------------------------------------------
        // No session available
        // -------------------------------------------------

        if (!selectedType) {

            throw new Error(
                "Unable to determine which timer session to open."
            );
        }


        // -------------------------------------------------
        // Find selected session
        // -------------------------------------------------

        currentSession =
            sessions.find(
                session =>
                    session.session_type ===
                    selectedType
            );


        if (!currentSession) {

            throw new Error(
                "The selected timer session could not be found."
            );
        }


        // -------------------------------------------------
        // Store as convenience only
        // -------------------------------------------------

        sessionStorage.setItem(
            "activeProfilingJobId",
            String(activeJob.id)
        );


        sessionStorage.setItem(
            "activeProfilingType",
            selectedType
        );


        // -------------------------------------------------
        // Display session
        // -------------------------------------------------

        profilingTypeBadge.textContent =
            selectedType;


        sessionTypeElement.textContent =
            selectedType;


        if (
            currentSession.started_at
        ) {

            startedAtElement.textContent =
                formatDateTime(
                    currentSession.started_at
                );

        } else {

            startedAtElement.textContent =
                "--";

        }


        // -------------------------------------------------
        // Restore timer state
        // -------------------------------------------------

        await restoreTimerState();


    } catch (error) {

        console.error(
            "Timer initialization error:",
            error
        );


        showError(
            error.message ||
            "Unable to load the timer."
        );

    }

}


// =========================================================
// RESTORE TIMER STATE
// =========================================================

async function restoreTimerState() {

    if (!currentSession) {
        resetBrowserTabTitle();
        return;
    }


    const status =
        currentSession.status;


    switch (status) {

        case "NOT_STARTED":

            setTimerState(
                "NOT_STARTED"
            );

            timerDisplay.textContent =
                formatDuration(0);

            break;


        case "RUNNING":

            setTimerState(
                "RUNNING"
            );

            await updateTimerDisplay();

            startTimerDisplay();

            break;


        case "PAUSED":

            setTimerState(
                "PAUSED"
            );

            await updateTimerDisplay();

            break;


        case "COMPLETED":

            setTimerState(
                "COMPLETED"
            );

            timerDisplay.textContent =
                formatDuration(
                    currentSession.total_seconds
                );

            break;


        default:

            showError(
                "Unknown timer status."
            );

    }

}


// =========================================================
// START
// =========================================================

startButton.addEventListener(
    "click",
    async () => {

        try {

            disableButtonsWhileProcessing();


            if (
                !currentSession
                ||
                currentSession.status !==
                    "NOT_STARTED"
            ) {

                return;
            }


            const timestamp =
                new Date().toISOString();


            // -------------------------------------------------
            // Record START event
            // -------------------------------------------------

            const {
                error: eventError
            } = await supabase
                .from("timer_events")
                .insert({
                    session_id:
                        currentSession.id,

                    event_type:
                        "START",

                    event_time:
                        timestamp
                });


            if (eventError) {
                throw eventError;
            }


            // -------------------------------------------------
            // Update session
            // -------------------------------------------------

            const {
                data: updatedSession,
                error: sessionError
            } = await supabase
                .from("timer_sessions")
                .update({
                    status:
                        "RUNNING",

                    started_at:
                        timestamp
                })
                .eq(
                    "id",
                    currentSession.id
                )
                .select()
                .single();


            if (sessionError) {
                throw sessionError;
            }


            currentSession =
                updatedSession;


            startedAtElement.textContent =
                formatDateTime(
                    timestamp
                );


            setTimerState(
                "RUNNING"
            );


            startTimerDisplay();


        } catch (error) {

            console.error(
                "Start error:",
                error
            );

            showError(
                error.message ||
                "Unable to start timer."
            );


        } finally {

            updateButtonStates();

        }

    }
);


// =========================================================
// PAUSE
// =========================================================

pauseButton.addEventListener(
    "click",
    async () => {

        try {

            disableButtonsWhileProcessing();


            if (
                !currentSession
                ||
                currentSession.status !==
                    "RUNNING"
            ) {

                return;
            }


            const timestamp =
                new Date().toISOString();


            // -------------------------------------------------
            // Record PAUSE
            // -------------------------------------------------

            const {
                error: eventError
            } = await supabase
                .from("timer_events")
                .insert({
                    session_id:
                        currentSession.id,

                    event_type:
                        "PAUSE",

                    event_time:
                        timestamp
                });


            if (eventError) {
                throw eventError;
            }


            // -------------------------------------------------
            // Calculate current active time
            // -------------------------------------------------

            const totalSeconds =
                await calculateActiveSeconds(
                    timestamp
                );


            // -------------------------------------------------
            // Update session
            // -------------------------------------------------

            const {
                data: updatedSession,
                error: sessionError
            } = await supabase
                .from("timer_sessions")
                .update({
                    status:
                        "PAUSED",

                    total_seconds:
                        totalSeconds
                })
                .eq(
                    "id",
                    currentSession.id
                )
                .select()
                .single();


            if (sessionError) {
                throw sessionError;
            }


            currentSession =
                updatedSession;


            stopTimerDisplay();


            await updateTimerDisplay();


            setTimerState(
                "PAUSED"
            );


        } catch (error) {

            console.error(
                "Pause error:",
                error
            );

            showError(
                error.message ||
                "Unable to pause timer."
            );


        } finally {

            updateButtonStates();

        }

    }
);


// =========================================================
// RESUME
// =========================================================

resumeButton.addEventListener(
    "click",
    async () => {

        try {

            disableButtonsWhileProcessing();


            if (
                !currentSession
                ||
                currentSession.status !==
                    "PAUSED"
            ) {

                return;
            }


            const timestamp =
                new Date().toISOString();


            // -------------------------------------------------
            // Record RESUME
            // -------------------------------------------------

            const {
                error: eventError
            } = await supabase
                .from("timer_events")
                .insert({
                    session_id:
                        currentSession.id,

                    event_type:
                        "RESUME",

                    event_time:
                        timestamp
                });


            if (eventError) {
                throw eventError;
            }


            // -------------------------------------------------
            // Update session
            // -------------------------------------------------

            const {
                data: updatedSession,
                error: sessionError
            } = await supabase
                .from("timer_sessions")
                .update({
                    status:
                        "RUNNING"
                })
                .eq(
                    "id",
                    currentSession.id
                )
                .select()
                .single();


            if (sessionError) {
                throw sessionError;
            }


            currentSession =
                updatedSession;


            setTimerState(
                "RUNNING"
            );


            startTimerDisplay();


        } catch (error) {

            console.error(
                "Resume error:",
                error
            );

            showError(
                error.message ||
                "Unable to resume timer."
            );


        } finally {

            updateButtonStates();

        }

    }
);


// =========================================================
// STOP
// =========================================================

stopButton.addEventListener(
    "click",
    async () => {

                    const confirmed =
                await showStopModal();


            if (!confirmed) {
                return;
            }


        try {

            disableButtonsWhileProcessing();


            if (
                !currentSession
                ||
                (
                    currentSession.status !==
                        "RUNNING"
                    &&
                    currentSession.status !==
                        "PAUSED"
                )
            ) {

                return;
            }


            const timestamp =
                new Date().toISOString();


            // -------------------------------------------------
            // Record STOP event
            // -------------------------------------------------

            const {
                error: eventError
            } = await supabase
                .from("timer_events")
                .insert({

                    session_id:
                        currentSession.id,

                    event_type:
                        "STOP",

                    event_time:
                        timestamp

                });


            if (eventError) {
                throw eventError;
            }


            // -------------------------------------------------
            // Calculate final active time
            // -------------------------------------------------

            const totalSeconds =
                await calculateActiveSeconds(
                    timestamp
                );


            // -------------------------------------------------
            // Complete current timer
            // -------------------------------------------------

            const {
                data: updatedSession,
                error: sessionError
            } = await supabase
                .from("timer_sessions")
                .update({

                    status:
                        "COMPLETED",

                    stopped_at:
                        timestamp,

                    total_seconds:
                        totalSeconds

                })
                .eq(
                    "id",
                    currentSession.id
                )
                .select()
                .single();


            if (sessionError) {
                throw sessionError;
            }


            currentSession =
                updatedSession;


            // -------------------------------------------------
            // Stop browser timer
            // -------------------------------------------------

            stopTimerDisplay();


            // -------------------------------------------------
            // Display final time
            // -------------------------------------------------

            timerDisplay.textContent =
                formatDuration(
                    totalSeconds
                );


            // -------------------------------------------------
            // Find the OTHER timer session
            // -------------------------------------------------

            const {
                data: otherSessions,
                error: otherSessionError
            } = await supabase
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
                .eq(
                    "profiling_job_id",
                    currentJob.id
                )
                .neq(
                    "id",
                    currentSession.id
                );


            if (otherSessionError) {
                throw otherSessionError;
            }


            // -------------------------------------------------
            // Check if another timer is available
            // -------------------------------------------------

            const otherSession =
                otherSessions &&
                otherSessions.length > 0
                    ? otherSessions[0]
                    : null;


            // -------------------------------------------------
            // OTHER TIMER STILL NEEDS TO BE DONE
            // -------------------------------------------------

            if (
                otherSession
                &&
                otherSession.status !==
                    "COMPLETED"
            ) {

                const currentType =
                    currentSession.session_type;


                const nextType =
                    otherSession.session_type;


                // Save next timer as navigation hint

                sessionStorage.setItem(
                    "activeProfilingJobId",
                    String(
                        currentJob.id
                    )
                );


                sessionStorage.setItem(
                    "activeProfilingType",
                    nextType
                );


                // -------------------------------------------------
                // Change current page to next session
                // -------------------------------------------------

                timerStatus.textContent =
                    "COMPLETED";


                timerStatus.className =
                    "timer-status completed";


                timerSubtext.textContent =
                    `${formatSessionType(currentType)} profiling completed. ` +
                    `${formatSessionType(nextType)} profiling is ready.`;


                // Change buttons

                startButton.textContent =
                    `Start ${formatSessionType(nextType)}`;


                startButton.disabled =
                    false;


                pauseButton.disabled =
                    true;


                resumeButton.disabled =
                    true;


                stopButton.disabled =
                    true;


                // Give analyst a moment to see completion

                setTimeout(
                    () => {

                        window.location.reload();

                    },
                    1000
                );


                return;
            }


            // -------------------------------------------------
            // BOTH TIMERS COMPLETED
            // -------------------------------------------------

            timerStatus.textContent =
                "BOTH SESSIONS COMPLETED";


            timerStatus.className =
                "timer-status completed";


            timerSubtext.textContent =
                "Teams and Members profiling are complete. " +
                "You can now finish this profiling job.";


            // -------------------------------------------------
            // Disable timer controls
            // -------------------------------------------------

            startButton.disabled =
                true;

            pauseButton.disabled =
                true;

            resumeButton.disabled =
                true;

            stopButton.disabled =
                true;


            // -------------------------------------------------
            // Show FINISHED button
            // -------------------------------------------------

            showFinishedButton();


        } catch (error) {

            console.error(
                "Stop error:",
                error
            );


            showError(
                error.message ||
                "Unable to stop timer."
            );


        } finally {

            updateButtonStates();

        }

    }
);


// =========================================================
// CALCULATE ACTIVE SECONDS
// =========================================================

async function calculateActiveSeconds(
    endingTimestamp
) {

    const {
        data: events,
        error
    } = await supabase
        .from("timer_events")
        .select(`
            event_type,
            event_time
        `)
        .eq(
            "session_id",
            currentSession.id
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


    let totalMilliseconds = 0;

    let activeStart = null;


    for (const event of events) {

        const eventTime =
            new Date(
                event.event_time
            );


        switch (event.event_type) {

            case "START":

                activeStart =
                    eventTime;

                break;


            case "RESUME":

                activeStart =
                    eventTime;

                break;


            case "PAUSE":

                if (activeStart) {

                    totalMilliseconds +=
                        eventTime -
                        activeStart;

                    activeStart =
                        null;
                }

                break;


            case "STOP":

                if (activeStart) {

                    totalMilliseconds +=
                        eventTime -
                        activeStart;

                    activeStart =
                        null;
                }

                break;

        }

    }


    // -------------------------------------------------
    // If still running, include time until now.
    // -------------------------------------------------

    if (activeStart) {

        const endingTime =
            new Date(
                endingTimestamp
            );


        totalMilliseconds +=
            endingTime -
            activeStart;
    }


    return Math.max(
        0,
        Math.floor(
            totalMilliseconds / 1000
        )
    );

}


// =========================================================
// BROWSER TAB TIMER
// =========================================================

const DEFAULT_PAGE_TITLE = "Ticky Ticky | Timer";

function updateBrowserTabTitle(seconds, status) {
    if (!Number.isFinite(seconds)) return;

    const time = formatDuration(seconds);
    const label = status === "RUNNING"
        ? "Focusing"
        : status === "PAUSED"
            ? "Paused"
            : status === "COMPLETED"
                ? "Completed"
                : "Timer";

    document.title = `${time} - ${label}`;
}

function resetBrowserTabTitle() {
    document.title = DEFAULT_PAGE_TITLE;
}


// =========================================================
// LIVE TIMER DISPLAY
// =========================================================

function startTimerDisplay() {

    stopTimerDisplay();


    updateTimerDisplay();


    timerInterval =
        setInterval(
            updateTimerDisplay,
            1000
        );

}


function stopTimerDisplay() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );

        timerInterval =
            null;
    }

}


async function updateTimerDisplay() {

    if (!currentSession) {
        return;
    }


    if (
        currentSession.status ===
        "COMPLETED"
    ) {

        timerDisplay.textContent =
            formatDuration(
                currentSession.total_seconds
            );

        updateBrowserTabTitle(
            Number(currentSession.total_seconds) || 0,
            "COMPLETED"
        );

        return;
    }


    const now =
        new Date().toISOString();


    try {

        const totalSeconds =
            await calculateActiveSeconds(
                now
            );


        timerDisplay.textContent =
            formatDuration(
                totalSeconds
            );

        updateBrowserTabTitle(
            totalSeconds,
            currentSession.status
        );


    } catch (error) {

        console.error(
            "Timer display error:",
            error
        );

    }

}


// =========================================================
// TIMER STATE UI
// =========================================================

function setTimerState(
    state
) {

    timerStatus.textContent =
        state.replace(
            "_",
            " "
        );


    timerStatus.className =
        "timer-status";


    if (state === "RUNNING") {

        timerStatus.classList.add(
            "running"
        );

        timerSubtext.textContent =
            "Timer is currently running.";

    }


    else if (state === "PAUSED") {

        timerStatus.classList.add(
            "paused"
        );

        timerSubtext.textContent =
            "Timer is paused. Your active time is preserved.";

    }


    else if (state === "COMPLETED") {

        timerStatus.classList.add(
            "completed"
        );

        timerSubtext.textContent =
            "Timer completed.";

    }


    else {

        timerSubtext.textContent =
            "Ready to begin profiling.";

    }


    updateButtonStates();

}


// =========================================================
// BUTTON STATES
// =========================================================

function updateButtonStates() {

    if (!currentSession) {

        disableAllButtons();

        if (saveForLaterButton) {
            saveForLaterButton.disabled = true;
        }

        return;
    }


    const state =
        currentSession.status;

    if (saveForLaterButton) {
        saveForLaterButton.disabled =
            state === "COMPLETED";
    }


    // -------------------------------------------------
    // NOT STARTED
    // -------------------------------------------------

    if (
        state ===
        "NOT_STARTED"
    ) {

        startButton.disabled =
            false;

        pauseButton.disabled =
            true;

        resumeButton.disabled =
            true;

        stopButton.disabled =
            true;

        return;
    }


    // -------------------------------------------------
    // RUNNING
    // -------------------------------------------------

    if (
        state ===
        "RUNNING"
    ) {

        startButton.disabled =
            true;

        pauseButton.disabled =
            false;

        resumeButton.disabled =
            true;

        stopButton.disabled =
            false;

        return;
    }


    // -------------------------------------------------
    // PAUSED
    // -------------------------------------------------

    if (
        state ===
        "PAUSED"
    ) {

        startButton.disabled =
            true;

        pauseButton.disabled =
            true;

        resumeButton.disabled =
            false;

        stopButton.disabled =
            false;

        return;
    }


    // -------------------------------------------------
    // COMPLETED
    // -------------------------------------------------

    if (
        state ===
        "COMPLETED"
    ) {

        startButton.disabled =
            true;

        pauseButton.disabled =
            true;

        resumeButton.disabled =
            true;

        stopButton.disabled =
            true;

        return;
    }


    // -------------------------------------------------
    // Unknown state
    // -------------------------------------------------

    disableAllButtons();

}


function disableButtonsWhileProcessing() {

    startButton.disabled =
        true;

    pauseButton.disabled =
        true;

    resumeButton.disabled =
        true;

    stopButton.disabled =
        true;

}


function disableAllButtons() {

    startButton.disabled =
        true;

    pauseButton.disabled =
        true;

    resumeButton.disabled =
        true;

    stopButton.disabled =
        true;

}


// =========================================================
// FORMATTING
// =========================================================

function formatSessionType(
    sessionType
) {

    if (
        sessionType ===
        "TEAM"
    ) {

        return "Teams";

    }


    if (
        sessionType ===
        "MEMBERS"
    ) {

        return "Members";

    }


    return sessionType;

}

function formatDuration(
    totalSeconds
) {

    const hours =
        Math.floor(
            totalSeconds / 3600
        );


    const minutes =
        Math.floor(
            (totalSeconds % 3600) / 60
        );


    const seconds =
        totalSeconds % 60;


    return [
        hours,
        minutes,
        seconds
    ]
        .map(
            value =>
                String(value)
                    .padStart(2, "0")
        )
        .join(":");

}


function formatDateTime(
    timestamp
) {

    return new Date(
        timestamp
    ).toLocaleString();

}


function getInitials(
    name
) {

    const parts =
        name
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (parts.length === 1) {

        return parts[0]
            .substring(0, 2)
            .toUpperCase();

    }


    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();

}

// =========================================================
// PAUSE TIMER FOR LOGOUT
// =========================================================

async function pauseTimerForLogout() {

    // -----------------------------------------------------
    // Nothing to pause
    // -----------------------------------------------------

    if (!currentSession) {
        return;
    }


    // -----------------------------------------------------
    // Only RUNNING sessions need to be paused.
    //
    // If already PAUSED, COMPLETED, or NOT_STARTED,
    // we leave the session as it is.
    // -----------------------------------------------------

    if (
        currentSession.status !==
        "RUNNING"
    ) {

        return;
    }


    const timestamp =
        new Date().toISOString();


    // -----------------------------------------------------
    // Record PAUSE event
    // -----------------------------------------------------

    const {
        error: eventError
    } = await supabase
        .from("timer_events")
        .insert({
            session_id:
                currentSession.id,

            event_type:
                "PAUSE",

            event_time:
                timestamp
        });


    if (eventError) {
        throw eventError;
    }


    // -----------------------------------------------------
    // Calculate exact productive time
    // -----------------------------------------------------

    const totalSeconds =
        await calculateActiveSeconds(
            timestamp
        );


    // -----------------------------------------------------
    // Update timer session
    // -----------------------------------------------------

    const {
        data: updatedSession,
        error: sessionError
    } = await supabase
        .from("timer_sessions")
        .update({

            status:
                "PAUSED",

            total_seconds:
                totalSeconds

        })
        .eq(
            "id",
            currentSession.id
        )
        .select()
        .single();


    if (sessionError) {
        throw sessionError;
    }


    // -----------------------------------------------------
    // Update local timer state
    // -----------------------------------------------------

    currentSession =
        updatedSession;


    // -----------------------------------------------------
    // Stop browser timer display
    // -----------------------------------------------------

    stopTimerDisplay();


    // -----------------------------------------------------
    // Update display before leaving
    // -----------------------------------------------------

    timerDisplay.textContent =
        formatDuration(
            totalSeconds
        );


    setTimerState(
        "PAUSED"
    );


    console.log(
        "Timer automatically paused before logout.",
        {
            sessionId:
                currentSession.id,

            totalSeconds:
                totalSeconds
        }
    );

}

// =========================================================
// SHOW FINISHED BUTTON
// =========================================================

function showFinishedButton() {

    if (!finishedButton) {
        return;
    }


    finishedButton.style.display =
        "inline-flex";


    finishedButton.disabled =
        false;

}

// =========================================================
// SAVE PROFILING JOB FOR LATER
// =========================================================

if (saveForLaterButton) {
    saveForLaterButton.addEventListener("click", async () => {
        try {
            disableButtonsWhileProcessing();

            if (!currentJob || !currentSession) {
                return;
            }

            // If currently running, record a real PAUSE first so no time is lost.
            if (currentSession.status === "RUNNING") {
                const timestamp = new Date().toISOString();

                const { error: eventError } = await supabase
                    .from("timer_events")
                    .insert({
                        session_id: currentSession.id,
                        event_type: "PAUSE",
                        event_time: timestamp
                    });

                if (eventError) throw eventError;

                const totalSeconds = await calculateActiveSeconds(timestamp);

                const { data: pausedSession, error: pauseError } = await supabase
                    .from("timer_sessions")
                    .update({
                        status: "PAUSED",
                        total_seconds: totalSeconds
                    })
                    .eq("id", currentSession.id)
                    .select()
                    .single();

                if (pauseError) throw pauseError;

                currentSession = pausedSession;
                stopTimerDisplay();
            }

            // Persist the profiling job itself as PAUSED.
            // This releases the analyst's single active-job slot while
            // keeping the job available in the Pending Profiling list.
            const { error: jobError } = await supabase
                .from("profiling_jobs")
                .update({ status: "PAUSED" })
                .eq("id", currentJob.id)
                .eq("analyst_id", currentUser.id)
                .in("status", ["IN_PROGRESS", "PAUSED"]);

            if (jobError) throw jobError;

            sessionStorage.removeItem("activeProfilingJobId");
            sessionStorage.removeItem("activeProfilingType");

            window.location.href = "profiling.html";

        } catch (error) {
            console.error("Save for later error:", error);
            showError(error.message || "Unable to save this profiling job for later.");
            updateButtonStates();
        }
    });
}


// =========================================================
// FINISHED
// =========================================================

finishedButton.addEventListener(
    "click",
    async () => {

        try {

             const confirmed =
                await showFinishModal();


            if (!confirmed) {
                return;
            }

            finishedButton.disabled =
                true;

            finishedButton.textContent =
                "Finishing...";


            // -------------------------------------------------
            // Get both sessions
            // -------------------------------------------------

            const {
                data: sessions,
                error: sessionsError
            } = await supabase
                .from("timer_sessions")
                .select(`
                    id,
                    session_type,
                    status,
                    total_seconds
                `)
                .eq(
                    "profiling_job_id",
                    currentJob.id
                );


            if (sessionsError) {
                throw sessionsError;
            }


            // -------------------------------------------------
            // Make sure BOTH sessions are completed
            // -------------------------------------------------

            const teamSession =
                sessions.find(
                    session =>
                        session.session_type ===
                        "TEAM"
                );


            const membersSession =
                sessions.find(
                    session =>
                        session.session_type ===
                        "MEMBERS"
                );


            if (
                !teamSession
                ||
                !membersSession
            ) {

                throw new Error(
                    "Both timer sessions must exist before finishing."
                );
            }


            if (
                teamSession.status !==
                    "COMPLETED"
                ||
                membersSession.status !==
                    "COMPLETED"
            ) {

                throw new Error(
                    "Both Teams and Members timers must be completed first."
                );
            }


            // -------------------------------------------------
            // Calculate totals
            // -------------------------------------------------

            const teamSeconds =
                Number(
                    teamSession.total_seconds
                    || 0
                );


            const memberSeconds =
                Number(
                    membersSession.total_seconds
                    || 0
                );


            const totalSeconds =
                teamSeconds +
                memberSeconds;


            // -------------------------------------------------
            // Complete profiling job
            // -------------------------------------------------

            const {
                error: jobError
            } = await supabase
                .from("profiling_jobs")
                .update({

                    status:
                        "COMPLETED",

                    finished_at:
                        new Date().toISOString(),

                    total_seconds:
                        totalSeconds

                })
                .eq(
                    "id",
                    currentJob.id
                );


            if (jobError) {
                throw jobError;
            }

            // -------------------------------------------------
            // Mark the completed team as COMPLETED
            // -------------------------------------------------

            const {
                error: teamError
            } = await supabase
                .from("teams")
                .update({
                    status: "COMPLETED"
                })
                .eq(
                    "team_id",
                    currentJob.team_id
                );


            if (teamError) {
                throw teamError;
            }


            // -------------------------------------------------
            // Clear local active session
            // -------------------------------------------------

            sessionStorage.removeItem(
                "activeProfilingJobId"
            );


            sessionStorage.removeItem(
                "activeProfilingType"
            );


            // -------------------------------------------------
            // Go to completion page
            // -------------------------------------------------

            window.location.href =
                "profiling-complete.html";


        } catch (error) {

            console.error(
                "Finish error:",
                error
            );


            finishedButton.disabled =
                false;


            finishedButton.textContent =
                "Finished";


            showError(
                error.message ||
                "Unable to finish profiling."
            );

        }

    }
);

function showFinishModal() {

    return new Promise(
        resolve => {

            finishModal.classList.add(
                "show"
            );


            const cleanup = () => {

                finishModal.classList.remove(
                    "show"
                );

            };


            const handleConfirm = () => {

                cleanup();

                resolve(
                    true
                );

            };


            const handleCancel = () => {

                cleanup();

                resolve(
                    false
                );

            };


            confirmFinishButton.onclick =
                handleConfirm;


            cancelFinishButton.onclick =
                handleCancel;

        }
    );

}

// =========================================================
// STOP CONFIRMATION MODAL
// =========================================================

function showStopModal() {

    return new Promise(
        resolve => {

            const stopModal =
                document.getElementById(
                    "stopModal"
                );

            const cancelStopButton =
                document.getElementById(
                    "cancelStopButton"
                );

            const confirmStopButton =
                document.getElementById(
                    "confirmStopButton"
                );


            // Safety check

            if (
                !stopModal ||
                !cancelStopButton ||
                !confirmStopButton
            ) {

                console.error(
                    "Stop modal elements were not found."
                );

                resolve(false);

                return;

            }


            // Show modal

            stopModal.classList.add(
                "show"
            );


            // Close modal

            const cleanup = () => {

                stopModal.classList.remove(
                    "show"
                );

            };


            // Confirm stop

            confirmStopButton.onclick =
                () => {

                    cleanup();

                    resolve(true);

                };


            // Cancel stop

            cancelStopButton.onclick =
                () => {

                    cleanup();

                    resolve(false);

                };

        }
    );

}

// =========================================================
// LOGOUT
// =========================================================

logoutButton.addEventListener(
    "click",
    async (event) => {

        event.preventDefault();


        // -------------------------------------------------
        // Prevent repeated logout clicks
        // -------------------------------------------------

        logoutButton.style.pointerEvents =
            "none";

        logoutButton.style.opacity =
            "0.6";


        try {

            // -------------------------------------------------
            // IMPORTANT:
            //
            // If the timer is RUNNING, pause it first.
            //
            // This happens BEFORE signOut().
            // -------------------------------------------------

            await pauseTimerForLogout();


            // -------------------------------------------------
            // Clear convenience navigation values
            //
            // IMPORTANT:
            // We only remove these local values.
            //
            // The actual profiling job remains in Supabase.
            // -------------------------------------------------

            sessionStorage.removeItem(
                "activeProfilingJobId"
            );

            sessionStorage.removeItem(
                "activeProfilingType"
            );


            // -------------------------------------------------
            // Sign out ONLY this browser session
            // -------------------------------------------------

            const {
                error
            } = await supabase.auth.signOut({
                scope: "local"
            });


            if (error) {
                throw error;
            }


            // -------------------------------------------------
            // Return to login
            // -------------------------------------------------

            window.location.href =
                "../index.html";


        } catch (error) {

            console.error(
                "Logout error:",
                error
            );


            // -------------------------------------------------
            // Restore logout button if something failed
            // -------------------------------------------------

            logoutButton.style.pointerEvents =
                "";

            logoutButton.style.opacity =
                "";


            showError(
                error.message ||
                "Unable to safely log out."
            );

        }

    }
);


// =========================================================
// ERROR
// =========================================================

function showError(
    message
) {

    timerError.textContent =
        message;

    timerError.classList.add(
        "visible"
    );

}


// =========================================================
// START
// =========================================================

initializeTimer();