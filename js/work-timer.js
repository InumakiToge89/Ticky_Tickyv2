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
            duration_seconds
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
    isRunning = running || paused;
    isPaused = paused;
    pausedAt = pausedAtTime;

    if (selectedTaskName) {
        selectedTaskName.textContent = selectedTask || "No task selected";
    }

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
                    0

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
                    elapsedSeconds

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
            elapsedSeconds;


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
            `${completedTaskName} saved successfully at ${formatTime(completedDuration)}.`
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

function showToast(message) {

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
// INITIALIZE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeWorkTimer();

    }
);