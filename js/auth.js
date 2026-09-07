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

const loginForm =
    document.getElementById("loginForm");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const loginButton =
    document.getElementById("loginButton");

const loginMessage =
    document.getElementById("loginMessage");


// =========================================================
// MESSAGE
// =========================================================

function showMessage(message, type = "error") {

    loginMessage.textContent = message;

    loginMessage.className =
        `login-message ${type}`;
}


// =========================================================
// LOGIN
// =========================================================

loginForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const email =
            emailInput.value.trim();

        const password =
            passwordInput.value;


        if (!email || !password) {

            showMessage(
                "Please enter your email and password."
            );

            return;
        }


        loginButton.disabled = true;

        loginButton.textContent =
            "Signing in...";

        loginMessage.className =
            "login-message";


        try {

            const {
                data,
                error
            } = await supabase.auth.signInWithPassword({
                email,
                password
            });


            if (error) {
                throw error;
            }


            if (!data.user) {

                throw new Error(
                    "Login succeeded but no user was returned."
                );
            }


            showMessage(
                "Login successful. Redirecting...",
                "success"
            );


            /*
             * We will replace this with our
             * role-based routing after we
             * build the dashboard.
             */

            setTimeout(() => {

                window.location.href =
                    "pages/dashboard.html";

            }, 700);


        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            showMessage(
                error.message ||
                "Unable to sign in. Please check your credentials."
            );

        } finally {

            loginButton.disabled = false;

            loginButton.textContent =
                "Login";
        }

    }
);