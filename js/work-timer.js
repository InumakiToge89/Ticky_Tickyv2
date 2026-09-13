// =====================================================
// SUPABASE
// =====================================================

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


// =====================================================
// WORK TIMER
// =====================================================


// =====================================================
// TASK DATA
// =====================================================

const TASKS = {

    "PROD": [

        "Self QA",
        "QA (Peer Review)",
        "Floor Support"

    ],

    "NON-PROD": [

        "Ad Hoc Tasks",
        "Clinic / Health Issues",
        "Feedback",
        "Meeting: 1:1",
        "Meeting: Discovery Time Out",
        "Meeting: Organizational Activities",
        "Meeting: Team / Huddles",
        "Projects"

    ],

    "PROD LOSS": [

        "Intermittent Connection",
        "Logistics / Workstation Issues",
        "System Issues"

    ],

    "TRAINING": [

        "New Hire",
        "New Process / Refresher",
        "Braavos"

    ]

};


// =====================================================
// DOM ELEMENTS
// =====================================================

const categoryTabs =
    document.querySelectorAll(".category-tab");

const taskList =
    document.getElementById("taskList");

const categoryTitle =
    document.getElementById("categoryTitle");

const selectedTaskName =
    document.getElementById("selectedTaskName");

const workTimerDisplay =
    document.getElementById("workTimerDisplay");

const startTaskButton =
    document.getElementById("startTaskButton");

const stopTaskButton =
    document.getElementById("stopTaskButton");

const pauseTaskButton =
    document.getElementById(
        "pauseTaskButton"
    );


const resumeTaskButton =
    document.getElementById(
        "resumeTaskButton"
    );

const nonProdDetailsSection =
    document.getElementById(
        "nonProdDetailsSection"
    );

const manualDateInput =
    document.getElementById(
        "manualDateInput"
    );

const manualStartTimeInput =
    document.getElementById(
        "manualStartTimeInput"
    );

const manualEndTimeInput =
    document.getElementById(
        "manualEndTimeInput"
    );

const manualApproverSelect =
    document.getElementById(
        "manualApproverSelect"
    );

const manualComputedDuration =
    document.getElementById(
        "manualComputedDuration"
    );

const manualSubmitButton =
    document.getElementById(
        "manualSubmitButton"
    );

const justificationInput =
    document.getElementById(
        "justificationInput"
    );

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


// =====================================================
// MODAL ELEMENTS
// =====================================================

const workConfirmModal =
    document.getElementById("workConfirmModal");

const workModalTitle =
    document.getElementById("workModalTitle");

const workModalMessage =
    document.getElementById("workModalMessage");

const workModalCancel =
    document.getElementById("workModalCancel");

const workModalConfirm =
    document.getElementById("workModalConfirm");


// =====================================================
// TOAST
// =====================================================

const workToast =
    document.getElementById("workToast");

const workToastMessage =
    document.getElementById("workToastMessage");


// =====================================================
// STATE
// =====================================================

let currentCategory = "PROD";

let selectedTask = null;

let timerInterval = null;

let startTime = null;

let elapsedSeconds = 0;

let isRunning = false;

let isPaused = false;

let pausedAt = null;

let totalPausedMilliseconds = 0;

let currentTaskLogId = null;

let currentUser = null;

let manualDurationSeconds = null;

let durationSource = "LIVE_TIMER";

let justification = "";

let manualApproversLoaded = false;


// =====================================================
// INITIALIZE PAGE
// =====================================================

async function initializeWorkTimer() {

    try {

        const {
            data: {
                user
            },
            error
        } = await supabase.auth.getUser();


        if (error) {

            throw error;

        }


        if (!user) {

            window.location.href =
                "../index.html";

            return;

        }


        currentUser =
            user;


        // =====================================================
        // LOAD USER PROFILE
        // =====================================================

        await loadUserProfile();
        await loadManualApprovers();


        // =====================================================
        // RECOVER ANY ACTIVE TASK FROM DATABASE
        // This makes the work timer survive page navigation.
        // =====================================================

        await restoreActiveTask();


        // =====================================================
        // LOAD TASKS
        // =====================================================

        renderTasks();


    } catch (error) {

        console.error(
            "Work timer initialization error:",
            error
        );


        // Prevent the page from being stuck on Loading...
        setUserFallback();


        showToast(
            "Unable to fully load your work activity."
        );

    }

}

// =====================================================
// RESTORE ACTIVE TASK
// =====================================================

async function restoreActiveTask() {

    if (!currentUser) {
        return;
    }

    const { data: activeLog, error: logError } = await supabase
        .from("task_logs")
        .select(`
            id,
            analyst_id,
            category,
            task_name,
            started_at,
            ended_at,
            duration_seconds,
            manual_duration_seconds,
            live_duration_seconds,
            duration_source,
            justification
        `)
        .eq("analyst_id", currentUser.id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (logError) {
        throw logError;
    }

    if (!activeLog) {
        return;
    }

    const { data: events, error: eventsError } = await supabase
        .from("task_activity_events")
        .select(`event_type, event_time`)
        .eq("task_log_id", activeLog.id)
        .order("event_time", { ascending: true });

    if (eventsError) {
        throw eventsError;
    }

    let running = false;
    let paused = false;
    let pausedAtTime = null;
    let totalPausedMs = 0;
    let activeStart = null;
    let accumulatedActiveMs = 0;

    for (const event of (events || [])) {
        const eventTime = new Date(event.event_time);

        if (Number.isNaN(eventTime.getTime())) {
            continue;
        }

        if (event.event_type === "START" || event.event_type === "RESUME") {
            if (event.event_type === "RESUME" && pausedAtTime) {
                totalPausedMs += eventTime.getTime() - pausedAtTime;
                pausedAtTime = null;
            }
            activeStart = eventTime.getTime();
            running = true;
            paused = false;
        }

        if (event.event_type === "PAUSE") {
            if (activeStart !== null) {
                accumulatedActiveMs += eventTime.getTime() - activeStart;
                activeStart = null;
            }
            pausedAtTime = eventTime.getTime();
            running = false;
            paused = true;
        }
    }

    if (activeStart !== null) {
        accumulatedActiveMs += Date.now() - activeStart;
    }

    const recoveredElapsed = Math.max(
        0,
        Math.floor(accumulatedActiveMs / 1000)
    );

    currentTaskLogId = activeLog.id;
    currentCategory = activeLog.category || "PROD";
    selectedTask = activeLog.task_name || null;
    startTime = new Date(activeLog.started_at).getTime();
    totalPausedMilliseconds = totalPausedMs;
    elapsedSeconds = recoveredElapsed;
    manualDurationSeconds =
        Number.isFinite(Number(activeLog.manual_duration_seconds))
            ? Number(activeLog.manual_duration_seconds)
            : null;
    durationSource =
        activeLog.duration_source === "MANUAL"
            ? "MANUAL"
            : "LIVE_TIMER";
    justification =
        activeLog.justification || "";
    isRunning = running || paused;
    isPaused = paused;
    pausedAt = pausedAtTime;

    if (selectedTaskName) {
        selectedTaskName.textContent = selectedTask || "No task selected";
    }

    syncNonProdDetailsUI();

    if (workTimerDisplay) {
        workTimerDisplay.textContent = formatTime(elapsedSeconds);
    }

    if (isPaused) {
        startTaskButton.disabled = true;
        pauseTaskButton.disabled = true;
        resumeTaskButton.disabled = false;
        stopTaskButton.disabled = false;
    } else if (isRunning) {
        startTaskButton.disabled = true;
        pauseTaskButton.disabled = false;
        resumeTaskButton.disabled = true;
        stopTaskButton.disabled = false;
        timerInterval = setInterval(updateTimer, 1000);
    }

    updateWorkBrowserTabTitle(
        elapsedSeconds,
        isPaused ? "PAUSED" : isRunning ? "RUNNING" : "IDLE"
    );

    console.log("Recovered active work task:", activeLog.id, activeLog.task_name, activeLog.category, activeLog.duration_seconds);
}


// =====================================================
// LOAD USER PROFILE
// =====================================================

async function loadUserProfile() {

    if (!currentUser) {

        return;

    }


    try {

        const {
            data: profile,
            error
        } = await supabase
            .from("profiles")
            .select(
                `
                    full_name,
                    role
                `
            )
            .eq(
                "id",
                currentUser.id
            )
            .maybeSingle();


        if (error) {

            throw error;

        }


        const fallbackName =
            currentUser.user_metadata?.full_name ||
            currentUser.user_metadata?.name ||
            currentUser.email ||
            "User";


        const displayName =
            profile?.full_name ||
            fallbackName;


        const displayRole =
            profile?.role ||
            currentUser.user_metadata?.role ||
            "ANALYST";

            // =====================================================
            // ROLE-BASED NAVIGATION
            // =====================================================

            const reportsNavItem =
                document.getElementById(
                    "reportsNavItem"
                );


            if (
                reportsNavItem &&
                String(displayRole)
                    .toUpperCase() ===
                    "ANALYST"
            ) {

                reportsNavItem.style.display =
                    "none";

            }


        if (userName) {

            userName.textContent =
                displayName;

        }


        if (userRole) {

            userRole.textContent =
                String(
                    displayRole
                ).toUpperCase();

        }


        if (userAvatar) {

            userAvatar.textContent =
                getInitials(
                    displayName
                );

        }


    } catch (error) {

        console.error(
            "User profile load error:",
            error
        );


        setUserFallback();

    }

}



// =====================================================
// USER FALLBACK
// =====================================================

function setUserFallback() {

    if (!currentUser) {

        return;

    }


    const fallbackName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        currentUser.email ||
        "User";


    if (userName) {

        userName.textContent =
            fallbackName;

    }


    if (userRole) {

        userRole.textContent =
            "ANALYST";

    }


    if (userAvatar) {

        userAvatar.textContent =
            getInitials(
                fallbackName
            );

    }

}



// =====================================================
// GET INITIALS
// =====================================================

function getInitials(name) {

    const initials =
        String(
            name || ""
        )
            .trim()
            .split(/\s+/)
            .filter(
                Boolean
            )
            .slice(
                0,
                2
            )
            .map(
                (part) =>
                    part.charAt(0)
                        .toUpperCase()
            )
            .join("");


    return initials ||
        "U";

}


// =====================================================
// RENDER TASKS
// =====================================================

function renderTasks() {

    taskList.innerHTML = "";

    categoryTitle.textContent =
        `${currentCategory} Tasks`;

    syncNonProdDetailsUI();


    const tasks =
        TASKS[currentCategory] || [];


    tasks.forEach((task) => {

        const button =
            document.createElement("button");


        button.type =
            "button";


        button.className =
            "task-button";


        button.innerHTML = `
            <span class="dots-border"></span>

            <span class="task-sparkle"></span>

            <span class="task-button-text">
                ${task}
            </span>
        `;


        if (
            selectedTask ===
            task
        ) {

            button.classList.add(
                "active"
            );

        }


        button.addEventListener(
            "click",
            () => {

                if (isRunning) {

                    showToast(
                        "Stop the current task before selecting another activity."
                    );

                    return;

                }


                selectedTask =
                    task;


                selectedTaskName.textContent =
                    task;


                renderTasks();

            }
        );


        taskList.appendChild(
            button
        );

    });

}


// =====================================================
// CATEGORY TABS
// =====================================================

categoryTabs.forEach((tab) => {

    tab.addEventListener(
        "click",
        () => {

            if (isRunning) {

                showToast(
                    "Stop the current task before changing categories."
                );

                return;

            }


            currentCategory =
                tab.dataset.category;


            selectedTask =
                null;


            selectedTaskName.textContent =
                "No task selected";


            categoryTabs.forEach(
                (item) => {

                    item.classList.remove(
                        "active"
                    );

                }
            );


            tab.classList.add(
                "active"
            );


            renderTasks();

        }
    );

});


// =====================================================
// START BUTTON
// =====================================================

startTaskButton.addEventListener(
    "click",
    () => {

        if (!selectedTask) {

            showToast(
                "Please select an activity first."
            );

            return;

        }


        showConfirmModal({

            title:
                "Start Activity",

            message:
                `Start tracking time for "${selectedTask}"?`,

            confirmText:
                "Start",

            onConfirm:
                startTimer

        });

    }
);


// =====================================================
// PAUSE BUTTON
// =====================================================

pauseTaskButton.addEventListener(
    "click",
    () => {

        if (
            !isRunning ||
            isPaused
        ) {

            return;

        }


        showConfirmModal({

            title:
                "Pause Activity",

            message:
                `Pause tracking time for "${selectedTask}"?`,

            confirmText:
                "Pause",

            onConfirm:
                pauseTimer

        });

    }
);

// =====================================================
// RESUME BUTTON
// =====================================================

resumeTaskButton.addEventListener(
    "click",
    () => {

        if (
            !isRunning ||
            !isPaused
        ) {

            return;

        }


        showConfirmModal({

            title:
                "Resume Activity",

            message:
                `Resume tracking time for "${selectedTask}"?`,

            confirmText:
                "Resume",

            onConfirm:
                resumeTimer

        });

    }
);



// =====================================================
// STOP BUTTON
// =====================================================

stopTaskButton.addEventListener(
    "click",
    () => {

        if (!isRunning) {

            return;

        }


        showConfirmModal({

            title:
                "Stop Activity",

            message:
                `Stop tracking time for "${selectedTask}"?`,

            confirmText:
                "Stop",

            onConfirm:
                stopTimer

        });

    }
);


// =====================================================
// START TIMER
// =====================================================

async function startTimer() {

    if (isRunning) {

        return;

    }

    if (!currentUser) {

        showToast(
            "User session not found."
        );

        return;

    }


    try {

        const startedAt =
            new Date();


        const {
            data: taskLog,
            error: taskLogError
        } = await supabase
            .from("task_logs")
            .insert({

                analyst_id:
                    currentUser.id,

                category:
                    currentCategory,

                task_name:
                    selectedTask,

                started_at:
                    startedAt.toISOString(),

                ended_at:
                    null,

                duration_seconds:
                    0,

                manual_duration_seconds:
                    null,

                live_duration_seconds:
                    0,

                duration_source:
                    "LIVE_TIMER",

                justification:
                    null

            })
            .select("id")
            .single();


        if (taskLogError) {

            throw taskLogError;

        }


        currentTaskLogId =
            taskLog.id;


        const {
            error: eventError
        } = await supabase
            .from("task_activity_events")
            .insert({

                task_log_id:
                    currentTaskLogId,

                analyst_id:
                    currentUser.id,

                event_type:
                    "START",

                event_time:
                    startedAt.toISOString()

            });


        if (eventError) {

            throw eventError;

        }


        isRunning =
            true;

        isPaused =
            false;

        pausedAt =
            null;

        totalPausedMilliseconds =
            0;

        startTime =
            startedAt.getTime();

        elapsedSeconds =
            0;

        manualDurationSeconds = null;
        durationSource = "LIVE_TIMER";
        justification = "";

        if (manualDateInput) manualDateInput.value = "";
        if (manualStartTimeInput) manualStartTimeInput.value = "";
        if (manualEndTimeInput) manualEndTimeInput.value = "";
        updateManualComputedDuration();
        if (justificationInput) {
            justificationInput.value = "";
        }
        syncNonProdDetailsUI();


        workTimerDisplay.textContent =
            "00:00:00";


        startTaskButton.disabled =
            true;

        pauseTaskButton.disabled =
            false;

        resumeTaskButton.disabled =
            true;

        stopTaskButton.disabled =
            false;


        timerInterval =
            setInterval(
                updateTimer,
                1000
            );


        showToast(
            `${selectedTask} started.`
       ,
            "success",
            "Work Activity Saved"
        );


    } catch (error) {

        console.error(
            "Task start error:",
            error,
            error?.message,
            error?.details,
            error?.hint,
            error?.code
        );


        currentTaskLogId =
            null;


        showToast(
            error.message ||
            "Unable to start activity."
        );

    }

}

// =====================================================
// PAUSE TIMER
// =====================================================

async function pauseTimer() {

    if (
        !isRunning ||
        isPaused ||
        !currentTaskLogId
    ) {

        return;

    }


    try {

        updateTimer();


        const pauseTime =
            new Date();


        const {
            error
        } = await supabase
            .from("task_activity_events")
            .insert({

                task_log_id:
                    currentTaskLogId,

                analyst_id:
                    currentUser.id,

                event_type:
                    "PAUSE",

                event_time:
                    pauseTime.toISOString()

            });


        if (error) {

            throw error;

        }


        clearInterval(
            timerInterval
        );


        timerInterval =
            null;


        isPaused =
            true;


        pausedAt =
            pauseTime.getTime();


        pauseTaskButton.disabled =
            true;


        resumeTaskButton.disabled =
            false;


        showToast(
            `${selectedTask} paused.`
       ,
            "success",
            "Work Activity Saved"
        );


    } catch (error) {

        console.error(
            "Task pause error:",
            error
        );


        showToast(
            error.message ||
            "Unable to pause activity."
        );

    }

}

// =====================================================
// RESUME TIMER
// =====================================================

async function resumeTimer() {

    if (
        !isRunning ||
        !isPaused ||
        !currentTaskLogId
    ) {

        return;

    }


    try {

        const resumeTime =
            new Date();


        const {
            error
        } = await supabase
            .from("task_activity_events")
            .insert({

                task_log_id:
                    currentTaskLogId,

                analyst_id:
                    currentUser.id,

                event_type:
                    "RESUME",

                event_time:
                    resumeTime.toISOString()

            });


        if (error) {

            throw error;

        }


        totalPausedMilliseconds +=
            resumeTime.getTime() -
            pausedAt;


        pausedAt =
            null;


        isPaused =
            false;


        pauseTaskButton.disabled =
            false;


        resumeTaskButton.disabled =
            true;


        timerInterval =
            setInterval(
                updateTimer,
                1000
            );


        showToast(
            `${selectedTask} resumed.`
       ,
            "success",
            "Work Activity Saved"
        );


    } catch (error) {

        console.error(
            "Task resume error:",
            error
        );


        showToast(
            error.message ||
            "Unable to resume activity."
        );

    }

}


// =====================================================
// BROWSER TAB TIMER
// =====================================================

const DEFAULT_WORK_PAGE_TITLE = "Ticky Ticky | Work Activity";

function updateWorkBrowserTabTitle(seconds, status) {
    if (!Number.isFinite(seconds)) return;

    const time = formatTime(seconds);
    const label = status === "RUNNING"
        ? "Focusing"
        : status === "PAUSED"
            ? "Paused"
            : status === "COMPLETED"
                ? "Completed"
                : "Work Activity";

    document.title = `${time} - ${label}`;
}

function resetWorkBrowserTabTitle() {
    document.title = DEFAULT_WORK_PAGE_TITLE;
}


// =====================================================
// UPDATE TIMER
// =====================================================

function updateTimer() {

    if (!startTime) {

        return;

    }


    const currentTime =
        isPaused && pausedAt
            ? pausedAt
            : Date.now();


    elapsedSeconds =
        Math.floor(
            (
                currentTime -
                startTime -
                totalPausedMilliseconds
            ) / 1000
        );


    workTimerDisplay.textContent =
        formatTime(
            elapsedSeconds
        );

    updateWorkBrowserTabTitle(
        elapsedSeconds,
        isPaused ? "PAUSED" : isRunning ? "RUNNING" : "IDLE"
    );

}


// =====================================================
// STOP TIMER
// =====================================================

async function stopTimer() {

    if (
        !isRunning ||
        !currentTaskLogId
    ) {

        return;

    }


    if (currentCategory === "NON-PROD") {

        const justificationValue =
            String(justificationInput?.value || "").trim();

        if (!justificationValue) {
            showToast("Please provide a justification for this Non-Prod activity.");
            return;
        }

        durationSource = "LIVE_TIMER";
        manualDurationSeconds = null;
        justification = justificationValue;

    } else {

        durationSource = "LIVE_TIMER";
        manualDurationSeconds = null;
        justification = "";

    }


    if (
        isPaused &&
        pausedAt
    ) {

        totalPausedMilliseconds +=
            Date.now() -
            pausedAt;


        pausedAt =
            null;

    }


    isPaused =
        false;


    updateTimer();


    const endedAt =
        new Date();


    clearInterval(
        timerInterval
    );


    timerInterval =
        null;


    startTaskButton.disabled =
        true;

    pauseTaskButton.disabled =
        true;

    resumeTaskButton.disabled =
        true;

    stopTaskButton.disabled =
        true;


    try {

        const {
            error: stopEventError
        } = await supabase
            .from("task_activity_events")
            .insert({

                task_log_id:
                    currentTaskLogId,

                analyst_id:
                    currentUser.id,

                event_type:
                    "STOP",

                event_time:
                    endedAt.toISOString()

            });


        if (stopEventError) {

            throw stopEventError;

        }


        const {
            error: taskLogError
        } = await supabase
            .from("task_logs")
            .update({

                ended_at:
                    endedAt.toISOString(),

                duration_seconds:
                    getReportedDurationSeconds(),

                manual_duration_seconds:
                    durationSource === "MANUAL"
                        ? manualDurationSeconds
                        : null,

                live_duration_seconds:
                    elapsedSeconds,

                duration_source:
                    durationSource,

                justification:
                    currentCategory === "NON-PROD"
                        ? justification.trim()
                        : null

            })
            .eq(
                "id",
                currentTaskLogId
            )
            .eq(
                "analyst_id",
                currentUser.id
            );


        if (taskLogError) {

            throw taskLogError;

        }


        const completedTaskName =
            selectedTask;


        const completedDuration =
            getReportedDurationSeconds();


        isRunning =
            false;

        isPaused =
            false;

        pausedAt =
            null;

        totalPausedMilliseconds =
            0;

        startTime =
            null;

        currentTaskLogId =
            null;

        elapsedSeconds =
            0;

        manualDurationSeconds = null;
        durationSource = "LIVE_TIMER";
        justification = "";

        if (manualDateInput) manualDateInput.value = "";
        if (manualStartTimeInput) manualStartTimeInput.value = "";
        if (manualEndTimeInput) manualEndTimeInput.value = "";
        updateManualComputedDuration();
        if (justificationInput) {
            justificationInput.value = "";
        }


        workTimerDisplay.textContent =
            "00:00:00";


        selectedTask =
            null;


        selectedTaskName.textContent =
            "No task selected";


        startTaskButton.disabled =
            false;

        pauseTaskButton.disabled =
            true;

        resumeTaskButton.disabled =
            true;

        stopTaskButton.disabled =
            true;

        resetWorkBrowserTabTitle();

        renderTasks();


        showToast(
            `${completedTaskName} submitted for admin approval (${formatTime(completedDuration)}).`
       ,
            "success",
            "Work Activity Saved"
        );


    } catch (error) {

        console.error(
            "Task stop error:",
            error
        );


        // Keep the task active if STOP was not saved
        isRunning =
            true;


        isPaused =
            false;


        startTaskButton.disabled =
            true;


        pauseTaskButton.disabled =
            false;


        resumeTaskButton.disabled =
            true;


        stopTaskButton.disabled =
            false;


        timerInterval =
            setInterval(
                updateTimer,
                1000
            );


        showToast(
            error.message ||
            "Unable to stop activity. Timer resumed."
        );

    }

}


// =====================================================
// LOAD ACTIVE ADMIN APPROVERS
// =====================================================

async function loadManualApprovers() {

    if (!manualApproverSelect || manualApproversLoaded) {
        return;
    }

    const { data, error } = await supabase
        .rpc("get_active_admins");

    if (error) {
        console.error("Unable to load manual time approvers:", error);
        manualApproverSelect.innerHTML = `
            <option value="">Unable to load admins</option>
        `;
        return;
    }

    const admins = Array.isArray(data) ? data : [];

    manualApproverSelect.innerHTML = `
        <option value="">Select an admin to review this entry</option>
        ${admins.map(admin => `
            <option value="${String(admin.id)}">
                ${String(admin.full_name || "Administrator")}
            </option>
        `).join("")}
    `;

    manualApproversLoaded = true;
}


// =====================================================
// NON-PROD MANUAL TIME + JUSTIFICATION
// =====================================================

function syncNonProdDetailsUI() {

    if (!nonProdDetailsSection) return;

    const isNonProd =
        currentCategory === "NON-PROD";

    nonProdDetailsSection.hidden = !isNonProd;

    if (!isNonProd) return;

    if (manualDateInput && !manualDateInput.value) {
        const now = new Date();
        const localYear = now.getFullYear();
        const localMonth = String(now.getMonth() + 1).padStart(2, "0");
        const localDay = String(now.getDate()).padStart(2, "0");
        manualDateInput.value = `${localYear}-${localMonth}-${localDay}`;
    }

    const locked = isRunning;

    if (manualDateInput) {
        manualDateInput.disabled = locked;
        manualDateInput.required = !locked;
    }

    if (manualStartTimeInput) {
        manualStartTimeInput.disabled = locked;
        manualStartTimeInput.required = !locked;
    }

    if (manualEndTimeInput) {
        manualEndTimeInput.disabled = locked;
        manualEndTimeInput.required = !locked;
    }

    if (manualApproverSelect) {
        manualApproverSelect.disabled = locked;
        manualApproverSelect.required = !locked;
    }

    if (justificationInput) {
        // Justification is also required for a live Non-Prod timer when it is stopped.
        justificationInput.disabled = false;
        justificationInput.required = true;
    }

    if (manualSubmitButton) {
        manualSubmitButton.disabled = locked || !selectedTask;
    }

    updateManualComputedDuration();
}

function buildLocalDateTime(dateValue, timeValue) {

    if (!dateValue || !timeValue) return null;

    const [year, month, day] = dateValue.split("-").map(Number);
    const [hours, minutes] = timeValue.split(":").map(Number);

    const date = new Date(
        year,
        month - 1,
        day,
        hours,
        minutes,
        0,
        0
    );

    if (Number.isNaN(date.getTime())) return null;

    return date;
}

function getManualTimeSpan() {

    const start = buildLocalDateTime(
        manualDateInput?.value,
        manualStartTimeInput?.value
    );

    const end = buildLocalDateTime(
        manualDateInput?.value,
        manualEndTimeInput?.value
    );

    if (!start || !end) {
        return {
            start: null,
            end: null,
            seconds: null
        };
    }

    const seconds = Math.floor(
        (end.getTime() - start.getTime()) / 1000
    );

    return {
        start,
        end,
        seconds: seconds > 0 ? seconds : null
    };
}

function updateManualComputedDuration() {

    if (!manualComputedDuration) return;

    const span = getManualTimeSpan();

    if (span.seconds === null) {
        manualComputedDuration.textContent = "--:--:--";
        manualComputedDuration.classList.remove("valid");
        return;
    }

    manualComputedDuration.textContent =
        formatTime(span.seconds);

    manualComputedDuration.classList.add("valid");
}

function getNonProdDetails() {

    const span = getManualTimeSpan();

    const justificationValue =
        String(justificationInput?.value || "").trim();

    return {
        start: span.start,
        end: span.end,
        manualSeconds: span.seconds,
        justification: justificationValue
    };
}

async function submitManualNonProd() {

    if (currentCategory !== "NON-PROD") {
        showToast("Manual time is available only for Non-Prod activities.");
        return;
    }

    if (!selectedTask) {
        showToast("Please select an activity first.");
        return;
    }

    if (isRunning) {
        showToast("Stop the live timer before submitting manual time.");
        return;
    }

    if (!currentUser) {
        showToast("User session not found.");
        return;
    }

    const details = getNonProdDetails();

    if (!manualDateInput?.value) {
        showToast("Please select the activity date.");
        return;
    }

    if (!manualStartTimeInput?.value || !manualEndTimeInput?.value) {
        showToast("Please select both a start and end time.");
        return;
    }

    if (details.manualSeconds === null) {
        showToast("End time must be later than start time.");
        return;
    }

    if (!details.justification) {
        showToast("Please provide a justification for this Non-Prod activity.");
        justificationInput?.focus();
        return;
    }

    if (details.justification.length > 1000) {
        showToast("The justification must be 1000 characters or fewer.");
        return;
    }

    manualSubmitButton.disabled = true;

    try {

        const startIso = details.start.toISOString();
        const endIso = details.end.toISOString();

        const approverId = String(manualApproverSelect?.value || "").trim();

        if (!approverId) {
            showToast("Please select the admin who should review this manual time.");
            manualApproverSelect?.focus();
            return;
        }

        const {
            data: requestId,
            error: requestError
        } = await supabase.rpc(
            "submit_manual_time_request",
            {
                p_admin_id: approverId,
                p_task_name: selectedTask,
                p_started_at: startIso,
                p_ended_at: endIso,
                p_justification: details.justification
            }
        );

        if (requestError) throw requestError;

        const completedTaskName = selectedTask;
        const completedDuration = details.manualSeconds;

        selectedTask = null;
        selectedTaskName.textContent = "No task selected";
        manualDateInput.value = "";
        manualStartTimeInput.value = "";
        manualEndTimeInput.value = "";
        justificationInput.value = "";
        if (manualApproverSelect) manualApproverSelect.value = "";
        manualDurationSeconds = null;
        durationSource = "LIVE_TIMER";
        justification = "";
        updateManualComputedDuration();
        renderTasks();

        showToast(
            `${completedTaskName} submitted for admin approval (${formatTime(completedDuration)}).`,
            "success",
            "Manual Time Submitted"
        );

    } catch (error) {

        console.error("Manual Non-Prod submission error:", error);

        showToast(
            error.message ||
            "Unable to submit manual Non-Prod activity."
        );

    } finally {

        syncNonProdDetailsUI();

    }
}

function getReportedDurationSeconds() {

    if (
        currentCategory === "NON-PROD" &&
        durationSource === "MANUAL" &&
        Number.isFinite(manualDurationSeconds)
    ) {
        return manualDurationSeconds;
    }

    return Math.max(0, Number(elapsedSeconds) || 0);
}

// =====================================================
// FORMAT TIME
// =====================================================

function formatTime(totalSeconds) {

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

        String(hours).padStart(
            2,
            "0"
        ),

        String(minutes).padStart(
            2,
            "0"
        ),

        String(seconds).padStart(
            2,
            "0"
        )

    ].join(":");

}


// =====================================================
// CONFIRMATION MODAL
// =====================================================

function showConfirmModal({

    title,

    message,

    confirmText,

    onConfirm

}) {

    workModalTitle.textContent =
        title;


    workModalMessage.textContent =
        message;


    workModalConfirm.textContent =
        confirmText;


    workConfirmModal.classList.add(
        "show"
    );


    const confirmHandler =
        () => {

            hideConfirmModal();

            cleanupModalHandlers();

            onConfirm();

        };


    const cancelHandler =
        () => {

            hideConfirmModal();

            cleanupModalHandlers();

        };


    function cleanupModalHandlers() {

        workModalConfirm.removeEventListener(
            "click",
            confirmHandler
        );


        workModalCancel.removeEventListener(
            "click",
            cancelHandler
        );

    }


    workModalConfirm.addEventListener(
        "click",
        confirmHandler
    );


    workModalCancel.addEventListener(
        "click",
        cancelHandler
    );

}


// =====================================================
// HIDE MODAL
// =====================================================

function hideConfirmModal() {

    workConfirmModal.classList.remove(
        "show"
    );

}


// =====================================================
// TOAST
// =====================================================

function showToast(message, type = "error", title = "Work Activity") {

    if (typeof window.showAppNotice === "function") {
        window.showAppNotice(
            type,
            title,
            message
        );
        return;
    }

    workToastMessage.textContent =
        message;

    workToast.classList.add(
        "show"
    );

    setTimeout(
        () => {
            workToast.classList.remove(
                "show"
            );
        },
        3000
    );

}


// =====================================================
// NON-PROD DETAILS EVENTS
// =====================================================

[
    manualDateInput,
    manualStartTimeInput,
    manualEndTimeInput
].forEach((input) => {
    input?.addEventListener("change", updateManualComputedDuration);
    input?.addEventListener("input", updateManualComputedDuration);
});

manualSubmitButton?.addEventListener(
    "click",
    submitManualNonProd
);

// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeWorkTimer();

    }
);