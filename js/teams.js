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
    document.getElementById("userName");

const userRole =
    document.getElementById("userRole");

const userAvatar =
    document.getElementById("userAvatar");

const logoutButton =
    document.getElementById("logoutButton");

const reportsNavItem =
    document.getElementById("reportsNavItem");

const teamsTableBody =
    document.getElementById("teamsTableBody");

const teamCount =
    document.getElementById("teamCount");

const teamSearch =
    document.getElementById("teamSearch");

const teamsError =
    document.getElementById("teamsError");




// =========================================================
// TEAM MODAL
// =========================================================

const teamModal =
    document.getElementById("teamModal");

const teamModalTitle =
    document.getElementById("teamModalTitle");

const addTeamButton =
    document.getElementById("addTeamButton");

const closeTeamModal =
    document.getElementById("closeTeamModal");

const cancelTeamButton =
    document.getElementById("cancelTeamButton");

const teamForm =
    document.getElementById("teamForm");

const modalTeamId =
    document.getElementById("modalTeamId");

const modalTeamName =
    document.getElementById("modalTeamName");

const modalMemberCount =
    document.getElementById("modalMemberCount");


// =========================================================
// IMPORT EXCEL MODAL
// =========================================================

const importExcelButton =
    document.getElementById("importExcelButton");

const importModal =
    document.getElementById("importModal");

const closeImportModal =
    document.getElementById("closeImportModal");

const cancelImportButton =
    document.getElementById("cancelImportButton");

const confirmImportButton =
    document.getElementById("confirmImportButton");

const excelFileInput =
    document.getElementById("excelFileInput");

const importError =
    document.getElementById("importError");

// =========================================================
// BULK DELETE
// =========================================================

const selectAllTeams =
    document.getElementById(
        "selectAllTeams"
    );

const bulkDeleteContainer =
    document.getElementById(
        "bulkDeleteContainer"
    );

const bulkDeleteButton =
    document.getElementById(
        "bulkDeleteButton"
    );

const selectedTeamCount =
    document.getElementById(
        "selectedTeamCount"
    );

// =========================================================
// DELETE CONFIRMATION MODAL
// =========================================================

const deleteConfirmModal =
    document.getElementById(
        "deleteConfirmModal"
    );

const deleteConfirmTitle =
    document.getElementById(
        "deleteConfirmTitle"
    );

const deleteConfirmMessage =
    document.getElementById(
        "deleteConfirmMessage"
    );

const cancelDeleteConfirm =
    document.getElementById(
        "cancelDeleteConfirm"
    );

const confirmDeleteButton =
    document.getElementById(
        "confirmDeleteButton"
    );


// =========================================================
// STATE
// =========================================================

let currentUser = null;

let teams = [];

let editingTeamId = null;

let selectedTeamIds =
    new Set();

let pendingDeleteIds = [];


// =========================================================
// INITIALIZE
// =========================================================

async function initializeTeams() {

    // =====================================================
    // CONNECT UI FIRST
    // This guarantees buttons work even if database loading
    // later fails.
    // =====================================================

    addTeamButton?.addEventListener(
        "click",
        openAddTeamModal
    );

    closeTeamModal?.addEventListener(
        "click",
        closeTeamModalFunction
    );

    cancelTeamButton?.addEventListener(
        "click",
        closeTeamModalFunction
    );

    teamForm?.addEventListener(
        "submit",
        saveTeam
    );

    teamSearch?.addEventListener(
        "input",
        filterTeams
    );

    logoutButton?.addEventListener(
        "click",
        logout
    );

    importExcelButton?.addEventListener(
        "click",
        openImportModal
    );

    closeImportModal?.addEventListener(
        "click",
        closeImportModalFunction
    );

    cancelImportButton?.addEventListener(
        "click",
        closeImportModalFunction
    );

    confirmImportButton?.addEventListener(
        "click",
        importExcelTeams
    );


    // =====================================================
    // CLOSE MODALS WHEN CLICKING BACKGROUND
    // =====================================================

    teamModal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target === teamModal
            ) {

                closeTeamModalFunction();

            }

        }
    );


    importModal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target === importModal
            ) {

                closeImportModalFunction();

            }

        }
    );


    // =====================================================
    // LOAD USER AND DATABASE
    // =====================================================

    try {

        clearError();


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


        currentUser =
            user;


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


        if (
            String(
                profile.status || ""
            )
                .trim()
                .toUpperCase() !==
            "ACTIVE"
        ) {

            await supabase.auth.signOut();

            window.location.href =
                "../index.html";

            return;

        }


        // =================================================
        // DISPLAY USER
        // =================================================

        const fullName =
            profile.full_name ||
            "User";


        if (userName) {

            userName.textContent =
                fullName;

        }


        if (userRole) {

            userRole.textContent =
                profile.role ||
                "USER";

        }


        if (userAvatar) {

            userAvatar.textContent =
                getInitials(
                    fullName
                );

        }


        // =================================================
        // REPORTS NAVIGATION
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
        // LOAD TEAMS LAST
        // =================================================

        await loadTeams();


        console.log(
            "Teams initialized successfully."
        );


    } catch (error) {

        console.error(
            "Teams initialization error:",
            error
        );


        showError(
            error.message ||
            "Unable to load Teams."
        );

    }

            selectAllTeams.addEventListener(
            "change",
            () => {

                document
                    .querySelectorAll(
                        ".team-select-checkbox"
                    )
                    .forEach(
                        (checkbox) => {

                            const teamId =
                                String(
                                    checkbox.dataset.id
                                );


                            checkbox.checked =
                                selectAllTeams.checked;


                            if (
                                selectAllTeams.checked
                            ) {

                                selectedTeamIds.add(
                                    teamId
                                );

                            } else {

                                selectedTeamIds.delete(
                                    teamId
                                );

                            }

                        }
                    );


                updateBulkDeleteUI();

            }
        );

                bulkDeleteButton.addEventListener(
            "click",
            deleteSelectedTeams
        );


        cancelDeleteConfirm.addEventListener(
    "click",
    closeDeleteConfirmation
);


        confirmDeleteButton.addEventListener(
            "click",
            async () => {

                if (
                    pendingDeleteIds.length === 0
                ) {
                    return;
                }


                try {

                    confirmDeleteButton.disabled =
                        true;


                    confirmDeleteButton.textContent =
                        "Deleting...";


                    const idsToDelete =
                        [...pendingDeleteIds];


                    const {
                        error
                    } =
                        await supabase
                            .from("teams")
                            .delete()
                            .in(
                                "id",
                                idsToDelete
                            );


                    if (error) {
                        throw error;
                    }


                                        idsToDelete.forEach(
                        (id) => {
                            selectedTeamIds.delete(
                                String(id)
                            );

                            selectedTeamIds.delete(
                                id
                            );
                        }
                    );


                    updateBulkDeleteUI();

                    updateSelectAllState();


                    closeDeleteConfirmation();


                    await loadTeams();


                } catch (error) {

                    console.error(
                        "Bulk delete error:",
                        error
                    );


                    showError(
                        error.message ||
                        "Unable to delete selected teams."
                    );

                } finally {

                    confirmDeleteButton.disabled =
                        false;

                }

            }
        );

} //End of initalizeTeams function


// =========================================================
// LOAD TEAMS
// =========================================================

async function loadTeams() {

    teamsTableBody.innerHTML =
        `
        <tr>
            <td
                colspan="4"
                class="empty-table"
            >
                Loading teams...
            </td>
        </tr>
        `;


    const {
        data,
        error
    } =
        await supabase
            .from("teams")
            .select(`
                id,
                team_id,
                team_name,
                no_of_members,
                created_at,
                status
            `)
            .eq(
                "status",
                "PENDING"
            )


    if (error) {

        throw error;

    }


    teams =
        data || [];


    filterTeams();

}


// =========================================================
// RENDER TEAMS
// =========================================================

function renderTeams(
    teamsToRender
) {

    teamCount.textContent =
        `${teamsToRender.length} ${
            teamsToRender.length === 1
                ? "Team"
                : "Teams"
        }`;


    if (
        teamsToRender.length === 0
    ) {

        teamsTableBody.innerHTML =
            `
            <tr>
                <td
                    colspan="5"
                    class="empty-table"
                >
                    No teams found.
                </td>
            </tr>
            `;


        updateBulkDeleteUI();

        return;

    }


    teamsTableBody.innerHTML =
        teamsToRender
            .map(
                (team) =>
                    `
                    <tr>

                        <td
                            class="select-column"
                        >
                            <input
                                type="checkbox"
                                class="team-select-checkbox"
                                data-id="${team.id}"
                                ${
                                    selectedTeamIds.has(
                                        String(team.id)
                                    )
                                        ? "checked"
                                        : ""
                                }
                            >
                        </td>


                        <td>
                            ${escapeHtml(
                                team.team_id
                            )}
                        </td>


                        <td>
                            ${escapeHtml(
                                team.team_name
                            )}
                        </td>


                        <td>
                            ${team.no_of_members}
                        </td>


                        <td
                            class="team-actions"
                        >

                            <button
                                type="button"
                                class="btn btn-secondary edit-team-btn"
                                data-id="${team.id}"
                            >
                                Edit
                            </button>


                            <button
                                type="button"
                                class="btn btn-danger delete-team-btn"
                                data-id="${team.id}"
                            >
                                Delete
                            </button>

                        </td>

                    </tr>
                    `
            )
            .join("");


    // =====================================================
    // CHECKBOX EVENTS
    // =====================================================

    document
        .querySelectorAll(
            ".team-select-checkbox"
        )
        .forEach(
            (checkbox) => {

                checkbox.addEventListener(
                    "change",
                    () => {

                        const teamId =
                            String(
                                checkbox.dataset.id
                            );


                        if (
                            checkbox.checked
                        ) {

                            selectedTeamIds.add(
                                teamId
                            );

                        } else {

                            selectedTeamIds.delete(
                                teamId
                            );

                        }


                        updateSelectAllState();

                        updateBulkDeleteUI();

                    }
                );

            }
        );


    // =====================================================
    // EDIT EVENTS
    // =====================================================

    document
        .querySelectorAll(
            ".edit-team-btn"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openEditTeamModal(
                            button.dataset.id
                        );

                    }
                );

            }
        );


    // =====================================================
    // DELETE EVENTS
    // =====================================================

    document
        .querySelectorAll(
            ".delete-team-btn"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteTeam(
                            button.dataset.id
                        );

                    }
                );

            }
        );


    updateSelectAllState();

    updateBulkDeleteUI();

}


// =========================================================
// SEARCH
// =========================================================

function filterTeams() {

    const searchValue =
        teamSearch.value
            .trim()
            .toLowerCase();


    const filteredTeams =
        teams.filter(
            (team) => {

                const teamId =
                    String(
                        team.team_id || ""
                    )
                        .toLowerCase();


                const teamName =
                    String(
                        team.team_name || ""
                    )
                        .toLowerCase();


                return (
                    teamId.includes(
                        searchValue
                    ) ||
                    teamName.includes(
                        searchValue
                    )
                );

            }
        );


    renderTeams(
        filteredTeams
    );

}


// =========================================================
// ADD TEAM MODAL
// =========================================================

function openAddTeamModal() {

    editingTeamId =
        null;


    teamModalTitle.textContent =
        "Add Team";


    teamForm.reset();


    teamModal.classList.add(
        "active"
    );

}


// =========================================================
// EDIT TEAM MODAL
// =========================================================

function openEditTeamModal(teamDatabaseId) {

    console.log(
        "EDIT CLICKED:",
        teamDatabaseId
    );

    const team =
        teams.find(
            (item) =>
                String(item.id) ===
                String(teamDatabaseId)
        );


    if (!team) {

        console.error(
            "Team not found:",
            teamDatabaseId,
            teams
        );

        alert(
            "Unable to find this team."
        );

        return;

    }


    editingTeamId =
        team.id;


    teamModalTitle.textContent =
        "Edit Team";


    modalTeamId.value =
        team.team_id ?? "";


    modalTeamName.value =
        team.team_name ?? "";


    modalMemberCount.value =
        team.no_of_members ?? "";


    // IMPORTANT: your CSS uses .active
    teamModal.classList.add(
        "active"
    );


    console.log(
        "EDIT MODAL OPENED"
    );

}


// =========================================================
// CLOSE TEAM MODAL
// =========================================================

function closeTeamModalFunction() {

    teamModal.classList.remove(
        "active"
    );


    teamForm.reset();


    editingTeamId =
        null;

}


// =========================================================
// SAVE TEAM
// =========================================================

async function saveTeam(
    event
) {

    event.preventDefault();


    try {

        clearError();


        const teamId =
            modalTeamId.value
                .trim();


        const teamName =
            modalTeamName.value
                .trim();


        const memberCount =
            Number(
                modalMemberCount.value
            );


        if (
            !teamId ||
            !teamName ||
            !Number.isInteger(
                memberCount
            ) ||
            memberCount < 1
        ) {

            throw new Error(
                "Please enter a valid Team ID, Team Name, and Number of Members."
            );

        }


        // -------------------------------------------------
        // CHECK DUPLICATE TEAM ID
        // -------------------------------------------------

        const duplicateTeam =
            teams.find(
                (team) => {

                    return (
                        String(
                            team.team_id
                        ).trim() === teamId &&
                        team.id !== editingTeamId
                    );

                }
            );


        if (duplicateTeam) {

            throw new Error(
                `Team ID "${teamId}" already exists.`
            );

        }


        // -------------------------------------------------
        // EDIT EXISTING TEAM
        // -------------------------------------------------

        if (editingTeamId) {

            const {
                error
            } =
                await supabase
                    .from("teams")
                    .update({
                        team_id:
                            teamId,

                        team_name:
                            teamName,

                        no_of_members:
                            memberCount,

                        updated_at:
                            new Date()
                                .toISOString()
                    })
                    .eq(
                        "id",
                        editingTeamId
                    );


            if (error) {

                throw error;

            }

        }


        // -------------------------------------------------
        // ADD NEW TEAM
        // -------------------------------------------------

        else {

            const {
                error
            } =
                await supabase
                    .from("teams")
                    .insert({
                        created_by:
                            currentUser.id,

                        team_id:
                            teamId,

                        team_name:
                            teamName,

                        no_of_members:
                            memberCount,

                        status:
                            "PENDING"
                    });


            if (error) {

                throw error;

            }

        }


        closeTeamModalFunction();


        await loadTeams();


    } catch (error) {

        console.error(
            "Save team error:",
            error
        );


        showError(
            error.message ||
            "Unable to save team."
        );

    }

}


// =========================================================
// DELETE TEAM
// =========================================================

function deleteTeam(
    teamDatabaseId
) {

    showDeleteConfirmation(
        [teamDatabaseId],
        false
    );

}

function deleteSelectedTeams() {

    if (
        selectedTeamIds.size === 0
    ) {
        return;
    }


    showDeleteConfirmation(
        Array.from(
            selectedTeamIds
        ),
        true
    );

}

// =========================================================
// BULK DELETE UI
// =========================================================

function updateBulkDeleteUI() {

    const count =
        selectedTeamIds.size;


    selectedTeamCount.textContent =
        `(${count})`;


    if (count > 0) {

        bulkDeleteContainer.classList.add(
            "show"
        );

    } else {

        bulkDeleteContainer.classList.remove(
            "show"
        );

    }

}

function showDeleteConfirmation(
    ids,
    isBulkDelete = false
) {

    pendingDeleteIds =
        [...ids];


    const count =
        pendingDeleteIds.length;


    deleteConfirmTitle.textContent =
        isBulkDelete
            ? `Delete ${count} Selected Team${count > 1 ? "s" : ""}?`
            : "Delete Team?";


    deleteConfirmMessage.textContent =
        isBulkDelete
            ? `Are you sure you want to permanently delete ${count} selected team${count > 1 ? "s" : ""}? This action cannot be undone.`
            : "Are you sure you want to permanently delete this team? This action cannot be undone.";


    confirmDeleteButton.textContent =
        isBulkDelete
            ? `Delete Selected (${count})`
            : "Delete Team";


    deleteConfirmModal.classList.add(
        "show"
    );

}


function closeDeleteConfirmation() {

    deleteConfirmModal.classList.remove(
        "show"
    );


    pendingDeleteIds = [];

}


// =========================================================
// SELECT ALL STATE
// =========================================================

function updateSelectAllState() {

    const checkboxes =
        document.querySelectorAll(
            ".team-select-checkbox"
        );


    if (
        checkboxes.length === 0
    ) {

        selectAllTeams.checked =
            false;

        selectAllTeams.indeterminate =
            false;

        return;

    }


    const checkedCount =
        document.querySelectorAll(
            ".team-select-checkbox:checked"
        ).length;


    selectAllTeams.checked =
        checkedCount === checkboxes.length;


    selectAllTeams.indeterminate =
        checkedCount > 0 &&
        checkedCount < checkboxes.length;

}


// =========================================================
// OPEN IMPORT MODAL
// =========================================================

function openImportModal() {

    clearImportError();

    excelFileInput.value = "";

    importModal.classList.add(
        "active"
    );

}


// =========================================================
// CLOSE IMPORT MODAL
// =========================================================

function closeImportModalFunction() {

    importModal.classList.remove(
        "active"
    );

    excelFileInput.value = "";

    clearImportError();

}


// =========================================================
// IMPORT EXCEL
// =========================================================

async function importExcelTeams() {

    try {

        clearImportError();


        const file =
            excelFileInput.files[0];


        if (!file) {

            throw new Error(
                "Please select an Excel file first."
            );

        }


        if (
            typeof XLSX ===
            "undefined"
        ) {

            throw new Error(
                "Excel reader failed to load. Refresh the page and try again."
            );

        }


        confirmImportButton.disabled =
            true;


        confirmImportButton.textContent =
            "Importing...";


        // -------------------------------------------------
        // READ FILE
        // -------------------------------------------------

        const fileBuffer =
            await file.arrayBuffer();


        const workbook =
            XLSX.read(
                fileBuffer,
                {
                    type: "array"
                }
            );


        const firstSheetName =
            workbook.SheetNames[0];


        if (!firstSheetName) {

            throw new Error(
                "The Excel file does not contain a worksheet."
            );

        }


        const worksheet =
            workbook.Sheets[
                firstSheetName
            ];


        const rows =
            XLSX.utils.sheet_to_json(
                worksheet,
                {
                    defval: ""
                }
            );


        if (
            rows.length === 0
        ) {

            throw new Error(
                "The Excel file does not contain any team data."
            );

        }


        // -------------------------------------------------
        // NORMALIZE HEADERS
        // -------------------------------------------------

        const normalizedRows =
            rows.map(
                (row) => {

                    const normalizedRow =
                        {};

                    Object.keys(
                        row
                    ).forEach(
                        (key) => {

                            const normalizedKey =
                                String(key)
                                    .trim()
                                    .toUpperCase()
                                    .replace(
                                        /\s+/g,
                                        "_"
                                    );

                            normalizedRow[
                                normalizedKey
                            ] =
                                row[key];

                        }
                    );


                    return normalizedRow;

                }
            );


        // -------------------------------------------------
        // VALIDATE REQUIRED COLUMNS
        // -------------------------------------------------

        const firstRow =
            normalizedRows[0];


        const requiredColumns =
            [
                "TEAM_ID",
                "TEAM_NAME",
                "NO_OF_MEMBERS"
            ];


        const missingColumns =
            requiredColumns.filter(
                (column) =>
                    !Object.prototype.hasOwnProperty.call(
                        firstRow,
                        column
                    )
            );


        if (
            missingColumns.length > 0
        ) {

            throw new Error(
                `Missing required Excel column(s): ${missingColumns.join(", ")}`
            );

        }


        // -------------------------------------------------
        // VALIDATE ROWS
        // -------------------------------------------------

        const validTeams =
            [];


        const invalidRows =
            [];


        const fileTeamIds =
            new Set();


        normalizedRows.forEach(
            (
                row,
                index
            ) => {

                const rowNumber =
                    index + 2;


                const teamId =
                    String(
                        row.TEAM_ID ?? ""
                    )
                        .trim();


                const teamName =
                    String(
                        row.TEAM_NAME ?? ""
                    )
                        .trim();


                const memberCount =
                    Number(
                        row.NO_OF_MEMBERS
                    );


                if (
                    !teamId ||
                    !teamName ||
                    !Number.isInteger(
                        memberCount
                    ) ||
                    memberCount < 1
                ) {

                    invalidRows.push(
                        rowNumber
                    );

                    return;

                }


                if (
                    fileTeamIds.has(
                        teamId
                    )
                ) {

                    invalidRows.push(
                        `${rowNumber} (duplicate Team ID)`
                    );

                    return;

                }


                fileTeamIds.add(
                    teamId
                );


                validTeams.push({
                    team_id:
                        teamId,

                    team_name:
                        teamName,

                    no_of_members:
                        memberCount
                });

            }
        );


        if (
            invalidRows.length > 0
        ) {

            throw new Error(
                `Invalid or duplicate data found in Excel row(s): ${invalidRows.join(", ")}`
            );

        }


        if (
            validTeams.length === 0
        ) {

            throw new Error(
                "No valid teams were found in the Excel file."
            );

        }


        // -------------------------------------------------
        // CHECK EXISTING TEAM IDs
        // -------------------------------------------------

        const existingTeamIds =
            new Set(
                teams.map(
                    (team) =>
                        String(
                            team.team_id
                        ).trim()
                )
            );


        const newTeams =
            validTeams.filter(
                (team) =>
                    !existingTeamIds.has(
                        team.team_id
                    )
            );


        const duplicateTeams =
            validTeams.filter(
                (team) =>
                    existingTeamIds.has(
                        team.team_id
                    )
            );


        if (
            newTeams.length === 0
        ) {

            throw new Error(
                "All Team IDs in this Excel file already exist."
            );

        }


        // -------------------------------------------------
        // PREPARE INSERT DATA
        // -------------------------------------------------

        const teamsToInsert =
            newTeams.map(
                (team) => ({
                    created_by:
                        currentUser.id,

                    team_id:
                        team.team_id,

                    team_name:
                        team.team_name,

                    no_of_members:
                        team.no_of_members
                })
            );


        // -------------------------------------------------
        // INSERT INTO SUPABASE
        // -------------------------------------------------

        const {
            error
        } =
            await supabase
                .from("teams")
                .insert(
                    teamsToInsert
                );


        if (error) {

            throw error;

        }


        // -------------------------------------------------
        // REFRESH TABLE
        // -------------------------------------------------

        await loadTeams();


        closeImportModalFunction();


            let successMessage =
            `${newTeams.length} team${
                newTeams.length === 1 ? "" : "s"
            } imported successfully.`;

        if (duplicateTeams.length > 0) {
            successMessage +=
                ` ${duplicateTeams.length} duplicate Team ID${
                    duplicateTeams.length === 1
                        ? " was"
                        : "s were"
                } skipped.`;
        }

        showTeamsSuccessModal(
            "Import Complete",
            successMessage
        );


    } catch (error) {

        console.error(
            "Excel import error:",
            error
        );


        showImportError(
            error.message ||
            "Unable to import the Excel file."
        );

    } finally {

        confirmImportButton.disabled =
            false;


        confirmImportButton.textContent =
            "Import Teams";

    }

}


// =========================================================
// IMPORT ERROR
// =========================================================

function showImportError(
    message
) {

    if (!importError) {

        return;

    }


    importError.textContent =
        message;


    importError.classList.add(
        "active"
    );

}


function clearImportError() {

    if (!importError) {

        return;

    }


    importError.textContent =
        "";


    importError.classList.remove(
        "active"
    );

}


// =========================================================
// LOGOUT
// =========================================================

async function logout(
    event
) {

    event.preventDefault();


    const {
        error
    } =
        await supabase
            .auth
            .signOut();


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


// =========================================================
// INITIALS
// =========================================================

function getInitials(
    name
) {

    const parts =
        String(name || "")
            .trim()
            .split(
                /\s+/
            )
            .filter(
                Boolean
            );


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
    )
        .toUpperCase();

}


// =========================================================
// PAGE ERROR
// =========================================================

function showError(
    message
) {

    if (!teamsError) {

        return;

    }


    teamsError.textContent =
        message;


    teamsError.classList.add(
        "active"
    );

}


function clearError() {

    if (!teamsError) {

        return;

    }


    teamsError.textContent =
        "";


    teamsError.classList.remove(
        "active"
    );

}


// =========================================================
// SECURITY
// =========================================================

function escapeHtml(
    value
) {

    const element =
        document.createElement(
            "div"
        );


    element.textContent =
        value ??
        "";


    return element.innerHTML;

}

// =========================================================
// CONNECT UI IMMEDIATELY
// =========================================================

function connectUI() {

    console.log(
        "Connecting Teams UI..."
    );


    addTeamButton?.addEventListener(
        "click",
        () => {

            console.log(
                "Add Team clicked"
            );

            openAddTeamModal();

        }
    );


    importExcelButton?.addEventListener(
        "click",
        () => {

            console.log(
                "Import Excel clicked"
            );

            openImportModal();

        }
    );


    closeTeamModal?.addEventListener(
        "click",
        closeTeamModalFunction
    );


    cancelTeamButton?.addEventListener(
        "click",
        closeTeamModalFunction
    );


    closeImportModal?.addEventListener(
        "click",
        closeImportModalFunction
    );


    cancelImportButton?.addEventListener(
        "click",
        closeImportModalFunction
    );


    teamForm?.addEventListener(
        "submit",
        saveTeam
    );


    teamSearch?.addEventListener(
        "input",
        filterTeams
    );


    confirmImportButton?.addEventListener(
        "click",
        importExcelTeams
    );


    logoutButton?.addEventListener(
        "click",
        logout
    );


    teamModal?.addEventListener(
        "click",
        event => {

            if (
                event.target === teamModal
            ) {

                closeTeamModalFunction();

            }

        }
    );


    importModal?.addEventListener(
        "click",
        event => {

            if (
                event.target === importModal
            ) {

                closeImportModalFunction();

            }

        }
    );

}

function showTeamsSuccessModal(
    title,
    message
) {
    const modal =
        document.getElementById(
            "teamsSuccessModal"
        );

    const titleElement =
        document.getElementById(
            "teamsSuccessTitle"
        );

    const messageElement =
        document.getElementById(
            "teamsSuccessMessage"
        );

    if (
        !modal ||
        !titleElement ||
        !messageElement
    ) {
        console.error(
            "Success modal elements not found."
        );
        return;
    }

    titleElement.textContent = title;
    messageElement.textContent = message;

    modal.classList.add("active");
}

document.addEventListener("DOMContentLoaded", () => {

    const successDoneBtn = document.getElementById("successDoneBtn");
    const successModal = document.getElementById("successModal");

    if (successDoneBtn && successModal) {
        successDoneBtn.addEventListener("click", () => {
            successModal.classList.remove("show");
        });
    }

});


// =========================================================
// START
// =========================================================

connectUI();

initializeTeams();