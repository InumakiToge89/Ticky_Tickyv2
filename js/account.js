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


// =====================================================
// ACCOUNT MANAGEMENT
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeAccount
);


// =====================================================
// INITIALIZE ACCOUNT
// =====================================================

async function initializeAccount() {

    try {

        // -------------------------------------------------
        // GET CURRENT AUTHENTICATED USER
        // -------------------------------------------------

        const {
            data: {
                user
            },
            error: userError
        } =
            await supabase.auth.getUser();


        if (
            userError
        ) {

            throw userError;

        }


        // -------------------------------------------------
        // NOT LOGGED IN
        // -------------------------------------------------

        if (
            !user
        ) {

            window.location.href =
                "../index.html";

            return;

        }


        console.log(
            "CURRENT AUTH USER:",
            user.id,
            user.email
        );


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


        if (
            profileError
        ) {

            throw profileError;

        }


        console.log(
            "ACCOUNT PROFILE:",
            profile
        );


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
        // ACCOUNT DATA
        // -------------------------------------------------

        const fullName =
            profile.full_name ||
            "User";


        const email =
            user.email ||
            "";


        const role =
            profile.role ||
            "";


        // -------------------------------------------------
        // POPULATE FORM
        // -------------------------------------------------

        const fullNameInput =
            document.getElementById(
                "fullName"
            );

        const emailInput =
            document.getElementById(
                "email"
            );

        const roleInput =
            document.getElementById(
                "role"
            );


        if (
            fullNameInput
        ) {

            fullNameInput.value =
                fullName;

        }


        if (
            emailInput
        ) {

            emailInput.value =
                email;

        }


        if (
            roleInput
        ) {

            roleInput.value =
                role;

        }


        // -------------------------------------------------
        // PROFILE HEADER
        // -------------------------------------------------

        const displayName =
            document.getElementById(
                "accountDisplayName"
            );

        const displayRole =
            document.getElementById(
                "accountDisplayRole"
            );

        const avatar =
            document.getElementById(
                "accountAvatar"
            );


        if (
            displayName
        ) {

            displayName.textContent =
                fullName;

        }


        if (
            displayRole
        ) {

            displayRole.textContent =
                role;

        }


        if (
            avatar
        ) {

            avatar.textContent =
                getInitials(
                    fullName
                );

        }


        // -------------------------------------------------
        // LOAD PROFILE PICTURE
        // -------------------------------------------------

        await loadProfilePicture(
            user.id,
            fullName
        );


        // -------------------------------------------------
        // PROFILE PICTURE INPUT
        // -------------------------------------------------

        const profilePictureInput =
            document.getElementById(
                "profilePictureInput"
            );


        if (
            profilePictureInput
        ) {

            profilePictureInput.addEventListener(
                "change",
                async () => {

                    const file =
                        profilePictureInput.files?.[0];


                    if (
                        !file
                    ) {

                        return;

                    }


                    await uploadProfilePicture(
                        user.id,
                        file,
                        fullName
                    );

                }
            );

        }


        // -------------------------------------------------
        // ACCOUNT FORM
        // -------------------------------------------------

        const accountForm =
            document.getElementById(
                "accountForm"
            );


        if (
            accountForm
        ) {

            accountForm.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();


                    await saveAccountChanges(
                        user.id,
                        user.email || ""
                    );

                }
            );

        }


        console.log(
            "Account page loaded:",
            {
                fullName,
                email,
                role,
                employeeCode:
                    profile.employee_code || ""
            }
        );

    }

    catch (
        error
    ) {

        console.error(
            "Account initialization error:",
            error
        );


        showMessage(
            error?.message ||
            "Unable to load your account information.",
            "error"
        );

    }

}


// =====================================================
// LOAD PROFILE PICTURE
// =====================================================

async function loadProfilePicture(
    userId,
    fullName
) {

    const accountAvatar =
        document.getElementById(
            "accountAvatar"
        );

    const accountAvatarImage =
        document.getElementById(
            "accountAvatarImage"
        );


    if (
        !userId ||
        !accountAvatarImage
    ) {

        return;

    }


    /*
     * We use the user's UUID as the storage
     * object name.
     *
     * No .jpg/.png extension is required.
     * This avoids extension mismatch problems.
     */

    const avatarPath =
        `${userId}`;


    const {
        data
    } =
        supabase
            .storage
            .from("Avatars")
            .getPublicUrl(
                avatarPath
            );


    if (
        !data?.publicUrl
    ) {

        return;

    }


    const imageUrl =
        `${data.publicUrl}?t=${Date.now()}`;


    accountAvatarImage.onload =
        () => {

            accountAvatarImage.style.display =
                "block";


            if (
                accountAvatar
            ) {

                accountAvatar.style.display =
                    "none";

            }

        };


    accountAvatarImage.onerror =
        () => {

            accountAvatarImage.style.display =
                "none";


            if (
                accountAvatar
            ) {

                accountAvatar.style.display =
                    "flex";

                accountAvatar.textContent =
                    getInitials(
                        fullName
                    );

            }

        };


    accountAvatarImage.src =
        imageUrl;

}


// =====================================================
// UPLOAD PROFILE PICTURE
// =====================================================

async function uploadProfilePicture(
    userId,
    file,
    fullName
) {

    try {

        // -------------------------------------------------
        // VALIDATE TYPE
        // -------------------------------------------------

        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            showMessage(
                "Please select a valid image file.",
                "error"
            );

            return;

        }


        // -------------------------------------------------
        // VALIDATE SIZE
        // -------------------------------------------------

        if (
            file.size >
            5 * 1024 * 1024
        ) {

            showMessage(
                "Profile picture must be 5 MB or smaller.",
                "error"
            );

            return;

        }


        showMessage(
            "Uploading profile picture...",
            "success"
        );


        // -------------------------------------------------
        // CONFIRM AUTH USER
        // -------------------------------------------------

        const {
            data: {
                user: currentUser
            },
            error: authError
        } =
            await supabase.auth.getUser();


        console.log(
            "CURRENT AUTH USER:",
            currentUser?.id,
            currentUser?.email
        );


        console.log(
            "AUTH ERROR:",
            authError
        );


        if (
            authError
        ) {

            throw authError;

        }


        if (
            !currentUser
        ) {

            throw new Error(
                "You are not authenticated."
            );

        }


        // -------------------------------------------------
        // STORAGE PATH
        // -------------------------------------------------

        const avatarPath =
            `${userId}`;


        // -------------------------------------------------
        // UPLOAD
        // -------------------------------------------------

        const {
            data: uploadData,
            error: uploadError
        } =
            await supabase
                .storage
                .from("Avatars")
                .upload(
                    avatarPath,
                    file,
                    {
                        cacheControl:
                            "3600",

                        contentType:
                            file.type,

                        upsert:
                            true
                    }
                );


        console.log(
            "AVATAR UPLOAD RESULT:",
            uploadData
        );


        console.log(
            "AVATAR UPLOAD ERROR:",
            uploadError
        );


        if (
            uploadError
        ) {

            throw uploadError;

        }


        // -------------------------------------------------
        // REFRESH IMAGE
        // -------------------------------------------------

        await loadProfilePicture(
            userId,
            fullName
        );


        showMessage(
            "Profile picture updated successfully.",
            "success"
        );


        // -------------------------------------------------
        // RESET INPUT
        // -------------------------------------------------

        const profilePictureInput =
            document.getElementById(
                "profilePictureInput"
            );


        if (
            profilePictureInput
        ) {

            profilePictureInput.value =
                "";

        }

    }

    catch (
        err
    ) {

        console.error(
            "Avatar upload error:",
            err
        );


        showMessage(
            err?.message ||
            "Failed to upload profile picture.",
            "error"
        );

    }

}


// =====================================================
// SAVE ACCOUNT CHANGES
// =====================================================

async function saveAccountChanges(
    userId,
    currentEmail
) {

    const saveButton =
        document.querySelector(
            ".save-button"
        );


    const fullNameInput =
        document.getElementById(
            "fullName"
        );


    const emailInput =
        document.getElementById(
            "email"
        );


    const newPasswordInput =
        document.getElementById(
            "newPassword"
        );


    const confirmPasswordInput =
        document.getElementById(
            "confirmPassword"
        );


    const fullName =
        fullNameInput?.value.trim() ||
        "";


    const email =
        emailInput?.value.trim() ||
        "";


    const newPassword =
        newPasswordInput?.value ||
        "";


    const confirmPassword =
        confirmPasswordInput?.value ||
        "";


    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (
        !fullName
    ) {

        showMessage(
            "Full Name is required.",
            "error"
        );

        return;

    }


    if (
        !email
    ) {

        showMessage(
            "Email is required.",
            "error"
        );

        return;

    }


    if (
        newPassword &&
        newPassword !==
        confirmPassword
    ) {

        showMessage(
            "Passwords do not match.",
            "error"
        );

        return;

    }


    if (
        newPassword &&
        newPassword.length < 6
    ) {

        showMessage(
            "Password must be at least 6 characters.",
            "error"
        );

        return;

    }


    try {

        // -------------------------------------------------
        // DISABLE BUTTON
        // -------------------------------------------------

        if (
            saveButton
        ) {

            saveButton.disabled =
                true;

            saveButton.textContent =
                "Saving...";

        }


        // =================================================
        // UPDATE PROFILE
        // =================================================
        //
        // IMPORTANT:
        // We ONLY update full_name.
        //
        // role is NOT updated.
        // status is NOT updated.
        // employee_code is NOT updated.
        // =================================================

        const {
            error: profileUpdateError
        } =
            await supabase
                .from("profiles")
                .update(
                    {
                        full_name:
                            fullName
                    }
                )
                .eq(
                    "id",
                    userId
                );


        if (
            profileUpdateError
        ) {

            throw profileUpdateError;

        }


        // =================================================
        // UPDATE EMAIL
        // =================================================

        if (
            email !==
            currentEmail
        ) {

            const {
                error: emailError
            } =
                await supabase.auth.updateUser(
                    {
                        email:
                            email
                    }
                );


            if (
                emailError
            ) {

                throw emailError;

            }

        }


        // =================================================
        // UPDATE PASSWORD
        // =================================================

        if (
            newPassword
        ) {

            const {
                error: passwordError
            } =
                await supabase.auth.updateUser(
                    {
                        password:
                            newPassword
                    }
                );


            if (
                passwordError
            ) {

                throw passwordError;

            }

        }


        // =================================================
        // UPDATE PAGE
        // =================================================

        const displayName =
            document.getElementById(
                "accountDisplayName"
            );


        const avatar =
            document.getElementById(
                "accountAvatar"
            );


        const accountAvatarImage =
            document.getElementById(
                "accountAvatarImage"
            );


        if (
            displayName
        ) {

            displayName.textContent =
                fullName;

        }


        if (
            avatar
        ) {

            avatar.textContent =
                getInitials(
                    fullName
                );

        }


        if (
            accountAvatarImage
        ) {

            accountAvatarImage.style.display =
                accountAvatarImage.src
                    ? "block"
                    : "none";

        }


        // =================================================
        // CLEAR PASSWORD FIELDS
        // =================================================

        if (
            newPasswordInput
        ) {

            newPasswordInput.value =
                "";

        }


        if (
            confirmPasswordInput
        ) {

            confirmPasswordInput.value =
                "";

        }


        // =================================================
        // SUCCESS
        // =================================================

        showMessage(
            "Your account information has been updated successfully.",
            "success"
        );


        console.log(
            "Account updated successfully."
        );

    }

    catch (
        error
    ) {

        console.error(
            "Account update error:",
            error
        );


        showMessage(
            error?.message ||
            "Failed to update your account.",
            "error"
        );

    }

    finally {

        if (
            saveButton
        ) {

            saveButton.disabled =
                false;

            saveButton.textContent =
                "Save Changes";

        }

    }

}


// =====================================================
// GET INITIALS
// =====================================================

function getInitials(
    name
) {

    return String(
        name || ""
    )
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(
            0,
            2
        )
        .map(
            part =>
                part
                    .charAt(0)
                    .toUpperCase()
        )
        .join("") ||
        "U";

}


// =====================================================
// SHOW MESSAGE
// =====================================================

function showMessage(
    message,
    type
) {

    const messageBox =
        document.getElementById(
            "accountMessage"
        );


    if (
        !messageBox
    ) {

        return;

    }


    messageBox.textContent =
        message;


    messageBox.style.color =
        type === "error"
            ? "#b42318"
            : "#237a4b";

}