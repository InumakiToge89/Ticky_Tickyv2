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
   EMERALD VIDEO BACKGROUND
   ========================================================= */

function updateEmeraldVideoBackground(theme) {

    const existingVideo =
        document.getElementById("emerald-video-bg");

    /* Remove video when leaving Emerald */
    if (theme !== "emerald") {

        if (existingVideo) {
            existingVideo.remove();
        }

        return;
    }

    /* Don't create duplicate video */
    if (existingVideo) {
        return;
    }

    const video =
        document.createElement("video");

    video.id =
        "emerald-video-bg";

    video.autoplay =
        true;

    video.muted =
        true;

    video.loop =
        true;

    video.playsInline =
        true;

    video.setAttribute(
        "aria-hidden",
        "true"
    );

    video.innerHTML = `
        <source
            src="${getAssetPrefix()}assets/branding/emerald/frogbg.mp4"
            type="video/mp4"
        >
    `;

    document.body.prepend(video);

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


    localStorage.setItem(
        THEME_KEY,
        theme
    );


    updateTickyBrand(
        theme
    );


    updateEmeraldVideoBackground(
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


    document.body.appendChild(
        switcher
    );


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