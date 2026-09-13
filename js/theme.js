/* =========================================================
   TICKY TICKY
   THEME SYSTEM
   ========================================================= */


/* =========================================================
   THEME CONFIGURATION
   ========================================================= */

const THEME_KEY = "ticky-ticky-theme";


const THEMES = {

    emerald: {

        label: "Emerald",
        icon: "🌿",

        mascot:
            "emerald/ticky-ticky-emerald-mascot.png",

        favicon:
            "emerald/ticky-ticky-favicon-emerald.png"

    },


    dark: {

        label: "Dark Emerald",
        icon: "🌙",

        mascot:
            "dark/ticky-ticky-dark-mascot.png",

        favicon:
            "dark/ticky-ticky-favicon-dark.png"

    },


    pink: {

        label: "Pink",
        icon: "🌸",

        mascot:
            "pink/ticky-ticky-pink-mascot.png",

        favicon:
            "pink/ticky-ticky-favicon-pink.png"

    },


    rainbow: {

        label: "Rainbow",
        icon: "🌈",

        mascot:
            "rainbow/mascot.png",

        favicon:
            "rainbow/favicon.png"

    },


    blue: {

        label: "Blue",
        icon: "💙",

        // Add these PNGs later under: assets/branding/blue/
        mascot:
            "blue/ticky-ticky-blue-mascot.png",

        favicon:
            "blue/ticky-ticky-favicon-blue.png"

    }

};


/* =========================================================
   GET VALID THEME NAMES
   ========================================================= */

const VALID_THEMES =
    Object.keys(THEMES);


/* =========================================================
   DETECT CURRENT PAGE LOCATION
   ========================================================= */

function getAssetPrefix() {

    const inPagesFolder =
        window.location.pathname
            .includes("/pages/");

    return inPagesFolder
        ? "../"
        : "";

}


/* =========================================================
   GET SAVED THEME
   ========================================================= */

function getSavedTheme() {

    const savedTheme =
        localStorage.getItem(
            THEME_KEY
        );


    if (
        VALID_THEMES.includes(
            savedTheme
        )
    ) {

        return savedTheme;

    }


    return "emerald";

}


/* =========================================================
   UPDATE TICKY BRANDING
   ========================================================= */

function updateTickyBrand(theme) {

    const config =
        THEMES[theme];


    if (!config) {

        return;

    }


    const assetPrefix =
        getAssetPrefix();


    /* -----------------------------------------------------
       MASCOT
       ----------------------------------------------------- */

    const mascot =
        document.getElementById(
            "tickyMascot"
        );


    if (mascot) {

        mascot.src =
            `${assetPrefix}assets/branding/${config.mascot}`;

        mascot.alt =
            `Ticky Ticky - ${config.label}`;

    }


    /* -----------------------------------------------------
       NAVBAR MASCOT
       ----------------------------------------------------- */

    const navMascot =
        document.getElementById(
            "tickyNavMascot"
        );


    if (navMascot) {

        navMascot.src =
            `${assetPrefix}assets/branding/${config.mascot}`;

        navMascot.alt =
            `Ticky Ticky - ${config.label}`;

    }


    /* -----------------------------------------------------
       FAVICON
       ----------------------------------------------------- */

    const favicon =
        document.getElementById(
            "siteFavicon"
        );


    if (favicon) {

        favicon.href =
            `${assetPrefix}assets/branding/${config.favicon}`;

    }

}

/* =========================================================
   BLUE THEME STYLESHEET
   ---------------------------------------------------------
   Blue is loaded dynamically so we only need to modify this
   JS file plus css/themes/blue.css — no need to edit every
   page HTML file.
   ========================================================= */

function loadBlueThemeStylesheet(theme) {

    const existing =
        document.getElementById("blueThemeStylesheet");

    if (existing) {
        existing.remove();
    }

    if (theme !== "blue") {
        return;
    }

    const link =
        document.createElement("link");

    link.id = "blueThemeStylesheet";
    link.rel = "stylesheet";

    link.href =
        `${getAssetPrefix()}css/themes/blue.css`;

    document.head.appendChild(link);

}


/* =========================================================
   APPLY THEME
   ========================================================= */

function applyTheme(theme) {

    if (
        !VALID_THEMES.includes(
            theme
        )
    ) {

        theme =
            "emerald";

    }


    document.documentElement
        .setAttribute(
            "data-theme",
            theme
        );


    loadBlueThemeStylesheet(
        theme
    );


    localStorage.setItem(
        THEME_KEY,
        theme
    );


    updateTickyBrand(
        theme
    );



    updateThemeButtons(
        theme
    );

}


/* =========================================================
   UPDATE SWITCHER BUTTONS
   ========================================================= */

function updateThemeButtons(
    activeTheme
) {

    document
        .querySelectorAll(
            ".color-mode-button"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.theme
                        === activeTheme
                );

            }
        );

}


/* =========================================================
   CREATE THEME SWITCHER
   ========================================================= */

function createColorModeSwitcher() {

    /* Don't create duplicates */

    if (
        document.querySelector(
            ".color-mode-switcher"
        )
    ) {

        return;

    }


    const switcher =
        document.createElement(
            "div"
        );


    switcher.className =
        "color-mode-switcher";


    switcher.setAttribute(
        "aria-label",
        "Color theme"
    );


    /* -----------------------------------------------------
       CREATE BUTTONS FROM THEME CONFIG
       ----------------------------------------------------- */

    Object.entries(
        THEMES
    ).forEach(
        ([themeName, config]) => {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "color-mode-button";


            button.dataset.theme =
                themeName;


            button.title =
                config.label;


            button.setAttribute(
                "aria-label",
                `${config.label} theme`
            );


            button.textContent =
                config.icon;


            button.addEventListener(
                "click",
                () => {

                    applyTheme(
                        themeName
                    );

                }
            );


            switcher.appendChild(
                button
            );

        }
    );


    const sidebarBottom =
        document.querySelector(".sidebar-bottom");

    if (sidebarBottom) {
        const logoutButton =
            sidebarBottom.querySelector("#logoutButton");

        if (logoutButton) {
            sidebarBottom.insertBefore(
                switcher,
                logoutButton
            );
        } else {
            sidebarBottom.appendChild(
                switcher
            );
        }
    } else {
        document.body.appendChild(
            switcher
        );
    }


    updateThemeButtons(
        getSavedTheme()
    );

}


/* =========================================================
   INITIALIZE
   ========================================================= */

(function initializeTheme() {

    const savedTheme =
        getSavedTheme();


    /* Apply immediately */

    document.documentElement
        .setAttribute(
            "data-theme",
            savedTheme
        );


    document.addEventListener(
        "DOMContentLoaded",
        () => {

            createColorModeSwitcher();

            applyTheme(
                savedTheme
            );

        }
    );

})();