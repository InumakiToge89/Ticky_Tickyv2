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

const profilingForm =
    document.getElementById("profilingForm");

const teamNameInput =
    document.getElementById("teamName");


const teamIdInput =
    document.getElementById("teamId");

const memberCountInput =
    document.getElementById("memberCount");

const continueButton =
    document.getElementById("continueButton");

const formError =
    document.getElementById("formError");

const userName =
    document.getElementById("userName");

const userRoleElement =
    document.getElementById("userRole");

const userAvatar =
    document.getElementById("userAvatar");

const logoutButton =
    document.getElementById("logoutButton");

const teamSelect =
    document.getElementById(
        "teamSelect"
    );

let savedTeams = [];


// =========================================================
// INITIALIZE PROFILING PAGE
// =========================================================

async function initializeProfiling() {

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


        // -------------------------------------------------
        // Get user's profile
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
            .eq("id", user.id)
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
        // Check account status
        // -------------------------------------------------

        if (profile.status !== "ACTIVE") {

            await supabase.auth.signOut();

            window.location.href =
                "../index.html";

            return;
        }


        // -------------------------------------------------
        // Display user
        // -------------------------------------------------

        userName.textContent =
            profile.full_name;

        userRoleElement.textContent =
            profile.role ||
            "ANALYST";

        userAvatar.textContent =
            getInitials(
                profile.full_name
            );


        // =================================================
        // PROFILING JOB STATE
        // =================================================
        // IN_PROGRESS = currently active job
        // PAUSED      = saved for later
        // COMPLETED   = finished job
        //
        // Only a job with a RUNNING timer session is considered active.
        // PAUSED jobs are displayed in the Pending Profiling list.

        currentUserIdForPending = user.id;

        const {
            data: inProgressJobs,
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
                finished_at
            `)
            .eq("analyst_id", user.id)
            .in("status", ["IN_PROGRESS", "PAUSED"])
            .order("started_at", { ascending: false });

        if (jobsError) {
            throw jobsError;
        }

        const jobIds = (inProgressJobs || []).map(job => job.id);

        let allSessions = [];

        if (jobIds.length > 0) {
            const {
                data: sessionRows,
                error: allSessionsError
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
                .in("profiling_job_id", jobIds)
                .order("id", { ascending: true });

            if (allSessionsError) {
                throw allSessionsError;
            }

            allSessions = sessionRows || [];
        }

        const sessionsByJob = new Map();

        allSessions.forEach(session => {
            if (!sessionsByJob.has(session.profiling_job_id)) {
                sessionsByJob.set(session.profiling_job_id, []);
            }
            sessionsByJob.get(session.profiling_job_id).push(session);
        });

        // A job is "active" only when one of its timer sessions is RUNNING.
        // PAUSED/NOT_STARTED jobs are pending and can be resumed later.
        const activeJob = (inProgressJobs || []).find(job => {
            const sessions = sessionsByJob.get(job.id) || [];
            return sessions.some(session => session.status === "RUNNING");
        }) || null;

        const pendingJobs = (inProgressJobs || []).filter(job => {
            const sessions = sessionsByJob.get(job.id) || [];
            const hasRunning = sessions.some(session => session.status === "RUNNING");
            const hasIncomplete = sessions.some(session => session.status !== "COMPLETED");
            return !hasRunning && hasIncomplete;
        });

        renderPendingProfilingJobs(pendingJobs);

        // -------------------------------------------------
        // No active profiling
        // -------------------------------------------------

        if (!activeJob) {

            console.log(
                "No active profiling job found."
            );

            return;
        }


        // -------------------------------------------------
        // Find available timer sessions
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
                started_at,
                stopped_at,
                total_seconds
            `)
            .eq(
                "profiling_job_id",
                activeJob.id
            )
            .order(
                "id",
                {
                    ascending: true
                }
            );


        if (sessionsError) {
            throw sessionsError;
        }


        if (
            !sessions
            ||
            sessions.length === 0
        ) {

            console.warn(
                "Active profiling job has no timer sessions."
            );

            return;
        }


        // -------------------------------------------------
        // Determine which timer should be resumed
        // -------------------------------------------------

        let resumeType = null;


        // First priority:
        // A timer that is currently RUNNING.

        const runningSession =
            sessions.find(
                session =>
                    session.status ===
                    "RUNNING"
            );


        if (runningSession) {

            resumeType =
                runningSession.session_type;

        }


        // Second priority:
        // A timer that is PAUSED.

        if (!resumeType) {

            const pausedSession =
                sessions.find(
                    session =>
                        session.status ===
                        "PAUSED"
                );


            if (pausedSession) {

                resumeType =
                    pausedSession.session_type;

            }

        }


        // Third priority:
        // A timer that has not started yet.

        if (!resumeType) {

            const notStartedSession =
                sessions.find(
                    session =>
                        session.status ===
                        "NOT_STARTED"
                );


            if (notStartedSession) {

                resumeType =
                    notStartedSession.session_type;

            }

        }


        // -------------------------------------------------
        // If we found a session, remember it locally
        // as a convenience.
        // -------------------------------------------------

        if (resumeType) {

            sessionStorage.setItem(
                "activeProfilingJobId",
                String(activeJob.id)
            );


            sessionStorage.setItem(
                "activeProfilingType",
                resumeType
            );


            console.log(
                "Active profiling recovered:",
                activeJob.id,
                resumeType
            );


            // -------------------------------------------------
            // Return to timer
            // -------------------------------------------------

            window.location.href =
                "timer.html";

            return;
        }


        // -------------------------------------------------
        // All sessions completed
        // -------------------------------------------------

        const allCompleted =
            sessions.every(
                session =>
                    session.status ===
                    "COMPLETED"
            );


        if (allCompleted) {

            console.log(
                "All timer sessions are completed."
            );

            // We will handle final JOB completion
            // in the FINISHED workflow.

            return;
        }


    } catch (error) {

        console.error(
            "Profiling initialization error:",
            error
        );


        showError(
            error.message ||
            "Unable to load your profile."
        );

    }

}

// =========================================================
// PENDING PROFILING JOBS
// =========================================================

function renderPendingProfilingJobs(jobs) {

    const card = document.getElementById("pendingProfilingCard");
    const list = document.getElementById("pendingProfilingList");

    if (!card || !list) return;

    if (!jobs || jobs.length === 0) {
        card.style.display = "none";
        list.innerHTML = "";
        return;
    }

    card.style.display = "block";

    list.innerHTML = jobs.map(job => `
        <div class="pending-profiling-item">
            <div class="pending-profiling-info">
                <div class="pending-profiling-name">
                    ${escapeHtml(job.team_name || "Unnamed Team")}
                </div>
                <div class="pending-profiling-meta">
                    Team ID: ${escapeHtml(String(job.team_id || "--"))}
                    &nbsp;•&nbsp; Members: ${Number(job.member_count || 0)}
                </div>
            </div>
            <button
                type="button"
                class="btn btn-primary resume-pending-profiling"
                data-job-id="${job.id}"
            >
                Resume
            </button>
        </div>
    `).join("");

    list.querySelectorAll(".resume-pending-profiling").forEach(button => {
        button.addEventListener("click", async () => {
            const jobId = button.dataset.jobId;
            button.disabled = true;
            button.textContent = "Resuming...";

            try {
                // The profiling job remains IN_PROGRESS while its timer session
                // is paused by "Finish Later". Do NOT update the profiling job here.
                // Updating it and using .single() can cause a 406 error when no
                // row is returned by Supabase.

                const { data: job, error: jobError } = await supabase
                    .from("profiling_jobs")
                    .select("id, analyst_id, status")
                    .eq("id", jobId)
                    .eq("analyst_id", currentUserIdForPending)
                    .maybeSingle();

                if (jobError) throw jobError;

                if (!job) {
                    throw new Error("The pending profiling job could not be found.");
                }

                const { data: sessions, error: sessionsError } = await supabase
                    .from("timer_sessions")
                    .select(
                        "id, session_type, status, started_at, stopped_at, total_seconds"
                    )
                    .eq("profiling_job_id", job.id)
                    .order("id", { ascending: true });

                if (sessionsError) throw sessionsError;

                const selectedSession =
                    sessions?.find(session => session.status === "RUNNING") ||
                    sessions?.find(session => session.status === "PAUSED") ||
                    sessions?.find(session => session.status === "NOT_STARTED");

                if (!selectedSession) {
                    throw new Error(
                        "No timer session is available for this pending profiling job."
                    );
                }

                sessionStorage.setItem(
                    "activeProfilingJobId",
                    String(job.id)
                );

                sessionStorage.setItem(
                    "activeProfilingType",
                    selectedSession.session_type
                );

                console.log(
                    "Resuming pending profiling:",
                    job.id,
                    selectedSession.session_type,
                    selectedSession.status
                );

                window.location.href = "timer.html";

            } catch (error) {
                console.error("Resume pending profiling error:", error);
                showError(error.message || "Unable to resume profiling.");
                button.disabled = false;
                button.textContent = "Resume";
            }
        });
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

let currentUserIdForPending = null;


// =========================================================
// LOAD SAVED TEAMS
// =========================================================

async function loadSavedTeams() {

    try {

        // =====================================================
        // GET CURRENT ANALYST
        // =====================================================

        const {
            data: {
                user
            },
            error: userError
        } =
            await supabase
                .auth
                .getUser();


        if (userError) {

            throw userError;

        }


        if (!user) {

            return;

        }


        // =====================================================
        // LOAD ONLY THIS ANALYST'S TEAMS
        // =====================================================

        const {
            data: allTeams,
            error: teamsError
        } =
            await supabase
                .from("teams")
                .select(`
                    id,
                    team_id,
                    team_name,
                    no_of_members
                `)
                .eq(
                    "created_by",
                    user.id
                )
                .order(
                    "team_name",
                    {
                        ascending: true
                    }
                );


        if (teamsError) {

            throw teamsError;

        }


        // =====================================================
        // GET TEAMS THAT ALREADY HAVE A PROFILING JOB
        // FOR THIS ANALYST ONLY
        //
        // COMPLETED = already finished, so do not profile again.
        // IN_PROGRESS = currently being profiled, so do not show it
        // in the new-team dropdown.
        // PAUSED = saved for later, so it must ONLY appear in the
        // Pending Profiling section and not in the new-team dropdown.
        // =====================================================

        const {
            data: existingJobs,
            error: jobsError
        } =
            await supabase
                .from("profiling_jobs")
                .select(`
                    team_id,
                    status
                `)
                .eq(
                    "analyst_id",
                    user.id
                )
                .in(
                    "status",
                    [
                        "COMPLETED",
                        "IN_PROGRESS",
                        "PAUSED"
                    ]
                );


        if (jobsError) {

            throw jobsError;

        }


        // =====================================================
        // BUILD LIST OF UNAVAILABLE TEAM IDs
        // =====================================================

        // A team with ANY existing profiling job for this analyst
        // is unavailable for a brand-new profiling job.
        const unavailableTeamIds =
            new Set(
                (
                    existingJobs ||
                    []
                ).map(
                    job =>
                        String(
                            job.team_id
                        ).trim()
                )
            );


        // =====================================================
        // REMOVE COMPLETED, ACTIVE, AND PENDING TEAMS
        // FROM THE NEW PROFILING DROPDOWN
        // =====================================================

        savedTeams =
            (
                allTeams ||
                []
            ).filter(
                team =>
                    !unavailableTeamIds.has(
                        String(
                            team.team_id
                        ).trim()
                    )
            );


        // =====================================================
        // RESET DROPDOWN
        // =====================================================

        teamSelect.innerHTML =
            `
            <option value="">
                -- Select a Team --
            </option>
            `;


        // =====================================================
        // ADD AVAILABLE TEAMS
        // =====================================================

        savedTeams.forEach(
            team => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    team.id;


                option.textContent =
                    `${team.team_name} (${team.team_id})`;


                teamSelect.appendChild(
                    option
                );

            }
        );


        console.log(
            "Available teams:",
            savedTeams
        );


    } catch (error) {

        console.error(
            "Load saved teams error:",
            error
        );

    }

}

// =========================================================
// TEAM SELECTION
// =========================================================

teamSelect.addEventListener(
    "change",
    () => {

        const selectedTeam =
            savedTeams.find(
                team =>
                    String(team.id) ===
                    teamSelect.value
            );


        if (!selectedTeam) {

            teamNameInput.value = "";
            teamIdInput.value = "";
            memberCountInput.value = "";

            return;

        }


        teamNameInput.value =
            selectedTeam.team_name;

        teamIdInput.value =
            selectedTeam.team_id;

        memberCountInput.value =
            selectedTeam.no_of_members;

    }
);


// =========================================================
// FORM SUBMIT
// =========================================================

profilingForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        hideError();


        // -------------------------------------------------
        // Get values
        // -------------------------------------------------

        const teamName =
            teamNameInput.value.trim();

        const teamId =
            teamIdInput.value.trim();

        const memberCount =
            Number(
                memberCountInput.value
            );


        const selectedType =
            document.querySelector(
                'input[name="profilingType"]:checked'
            );


        // -------------------------------------------------
        // Validate Team Name
        // -------------------------------------------------

        if (!teamName) {

            showError(
                "Please enter the team name."
            );

            teamNameInput.focus();

            return;
        }


        // -------------------------------------------------
        // Validate Team ID
        // -------------------------------------------------

        if (!teamId) {

            showError(
                "Please enter the team ID."
            );

            teamIdInput.focus();

            return;
        }


        // -------------------------------------------------
        // Validate Member Count
        // -------------------------------------------------

        if (
            !Number.isInteger(memberCount)
            ||
            memberCount <= 0
        ) {

            showError(
                "Please enter a valid number of members."
            );

            memberCountInput.focus();

            return;
        }


        // -------------------------------------------------
        // Validate Profiling Type
        // -------------------------------------------------

        if (!selectedType) {

            showError(
                "Please select Teams or Members."
            );

            return;
        }


        const profilingType =
            selectedType.value;


        // -------------------------------------------------
        // Disable button
        // -------------------------------------------------

        continueButton.disabled =
            true;

        continueButton.textContent =
            "Creating...";


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


            // -------------------------------------------------
            // Keep the master team record synchronized with the
            // member count entered by the analyst.
            // -------------------------------------------------

            const selectedSavedTeam = savedTeams.find(
                team => String(team.id) === String(teamSelect.value)
            );

            if (selectedSavedTeam) {
                const { error: teamUpdateError } = await supabase
                    .from("teams")
                    .update({
                        team_name: teamName,
                        team_id: teamId,
                        no_of_members: memberCount,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", selectedSavedTeam.id)
                    .eq("created_by", user.id);

                if (teamUpdateError) {
                    throw teamUpdateError;
                }

                selectedSavedTeam.team_name = teamName;
                selectedSavedTeam.team_id = teamId;
                selectedSavedTeam.no_of_members = memberCount;
            }


            // -------------------------------------------------
            // Create Profiling Job
            // -------------------------------------------------

            const {
                data: job,
                error: jobError
            } = await supabase
                .from("profiling_jobs")
                .insert({

                    analyst_id:
                        user.id,

                    team_name:
                        teamName,

                    team_id:
                        teamId,

                    member_count:
                        memberCount,

                    status:
                        "IN_PROGRESS",

                    started_at:
                        new Date().toISOString()

                })
                .select()
                .single();


            if (jobError) {
                throw jobError;
            }


            // -------------------------------------------------
            // Create TEAM and MEMBERS sessions
            // -------------------------------------------------

            const sessions = [

                {
                    profiling_job_id:
                        job.id,

                    session_type:
                        "TEAM",

                    status:
                        "NOT_STARTED"
                },

                {
                    profiling_job_id:
                        job.id,

                    session_type:
                        "MEMBERS",

                    status:
                        "NOT_STARTED"
                }

            ];


            const {
                error: sessionError
            } = await supabase
                .from("timer_sessions")
                .insert(
                    sessions
                );


            if (sessionError) {
                throw sessionError;
            }


            // -------------------------------------------------
            // Save active profiling job
            // -------------------------------------------------

            sessionStorage.setItem(
                "activeProfilingJobId",
                String(job.id)
            );


            sessionStorage.setItem(
                "activeProfilingType",
                profilingType
            );


            // -------------------------------------------------
            // Redirect to timer
            // -------------------------------------------------

            window.location.href =
                "timer.html";


        } catch (error) {

            console.error(
                "Profiling creation error:",
                error
            );


            showError(
                error.message ||
                "Unable to create the profiling session."
            );


        } finally {

            continueButton.disabled =
                false;

            continueButton.textContent =
                "Continue";

        }

    }
);


// =========================================================
// ERROR DISPLAY
// =========================================================

function showError(message) {

    formError.textContent =
        message;

    formError.classList.add(
        "visible"
    );

}


function hideError() {

    formError.textContent =
        "";

    formError.classList.remove(
        "visible"
    );

}


// =========================================================
// GET INITIALS
// =========================================================

function getInitials(name) {

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
// LOGOUT
// =========================================================

logoutButton.addEventListener(
    "click",
    async (event) => {

        event.preventDefault();


        const {
            error
        } = await supabase.auth.signOut();


        if (error) {

            console.error(
                "Logout error:",
                error
            );

            return;
        }


        window.location.href =
            "../index.html";

    }
);


// =========================================================
// START
// =========================================================

initializeProfiling();
loadSavedTeams();