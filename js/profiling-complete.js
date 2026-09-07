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
// DOM ELEMENTS
// =========================================================

const loading =
    document.getElementById(
        "loading"
    );

const completionContent =
    document.getElementById(
        "completionContent"
    );

const errorContainer =
    document.getElementById(
        "errorContainer"
    );

const errorMessage =
    document.getElementById(
        "errorMessage"
    );

const teamNameElement =
    document.getElementById(
        "teamName"
    );

const teamIdElement =
    document.getElementById(
        "teamId"
    );

const teamTimeElement =
    document.getElementById(
        "teamTime"
    );

const membersTimeElement =
    document.getElementById(
        "membersTime"
    );

const totalTimeElement =
    document.getElementById(
        "totalTime"
    );


// =========================================================
// LOAD COMPLETION SUMMARY
// =========================================================

async function loadCompletionSummary() {

    try {

        // -------------------------------------------------
        // Get logged-in user
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
        // Find most recently completed job
        // -------------------------------------------------

        const {
            data: job,
            error: jobError
        } = await supabase
            .from("profiling_jobs")
            .select(`
                id,
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
                user.id
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
            )
            .limit(1)
            .maybeSingle();


        if (jobError) {
            throw jobError;
        }


        if (!job) {

            throw new Error(
                "No completed profiling record was found."
            );
        }


        // -------------------------------------------------
        // Get timer sessions
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
                job.id
            );


        if (sessionsError) {
            throw sessionsError;
        }


        // -------------------------------------------------
        // Find TEAM session
        // -------------------------------------------------

        const teamSession =
            sessions.find(
                session =>
                    session.session_type ===
                    "TEAM"
            );


        // -------------------------------------------------
        // Find MEMBERS session
        // -------------------------------------------------

        const membersSession =
            sessions.find(
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


        // -------------------------------------------------
        // Use stored job total if available
        // Otherwise calculate it.
        // -------------------------------------------------

        const totalSeconds =
            Number(
                job.total_seconds ??
                (
                    teamSeconds +
                    membersSeconds
                )
            );


        // -------------------------------------------------
        // Display information
        // -------------------------------------------------

        teamNameElement.textContent =
            job.team_name;


        teamIdElement.textContent =
            `Team ID: ${job.team_id}`;


        teamTimeElement.textContent =
            formatDuration(
                teamSeconds
            );


        membersTimeElement.textContent =
            formatDuration(
                membersSeconds
            );


        totalTimeElement.textContent =
            formatDuration(
                totalSeconds
            );


        // -------------------------------------------------
        // Show page
        // -------------------------------------------------

        loading.style.display =
            "none";


        completionContent.style.display =
            "block";


    } catch (error) {

        console.error(
            "Completion page error:",
            error
        );


        loading.style.display =
            "none";


        errorMessage.textContent =
            error.message ||
            "Unable to load the completion summary.";


        errorContainer.style.display =
            "block";

    }

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
                ) || 0
            )
        );


    const hours =
        Math.floor(
            totalSeconds / 3600
        );


    const minutes =
        Math.floor(
            (
                totalSeconds % 3600
            ) / 60
        );


    const seconds =
        totalSeconds % 60;


    return [

        String(hours)
            .padStart(2, "0"),

        String(minutes)
            .padStart(2, "0"),

        String(seconds)
            .padStart(2, "0")

    ].join(":");

}


// =========================================================
// START
// =========================================================

loadCompletionSummary();