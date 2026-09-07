document.addEventListener("DOMContentLoaded", function () {

    const sidebar = document.querySelector(".sidebar");
    const topbar = document.querySelector(".topbar");

    if (!sidebar || !topbar) {
        return;
    }


    /* =====================================================
       CREATE MOBILE MENU BUTTON
       ===================================================== */

    let menuButton = document.querySelector(".mobile-menu-toggle");

    if (!menuButton) {

        menuButton = document.createElement("button");

        menuButton.type = "button";

        menuButton.className = "mobile-menu-toggle";

        menuButton.setAttribute(
            "aria-label",
            "Open navigation menu"
        );

        menuButton.setAttribute(
            "aria-expanded",
            "false"
        );

        menuButton.innerHTML = "☰";

        topbar.insertBefore(
            menuButton,
            topbar.firstChild
        );
    }


    /* =====================================================
       CREATE OVERLAY
       ===================================================== */

    let overlay = document.querySelector(
        ".sidebar-mobile-overlay"
    );

    if (!overlay) {

        overlay = document.createElement("div");

        overlay.className =
            "sidebar-mobile-overlay";

        document.body.appendChild(overlay);
    }


    /* =====================================================
       OPEN MENU
       ===================================================== */

    function openMenu() {

        if (window.innerWidth > 768) {
            return;
        }

        sidebar.classList.add(
            "mobile-open"
        );

        overlay.classList.add(
            "active"
        );

        document.body.classList.add(
            "mobile-menu-open"
        );

        menuButton.innerHTML = "✕";

        menuButton.setAttribute(
            "aria-label",
            "Close navigation menu"
        );

        menuButton.setAttribute(
            "aria-expanded",
            "true"
        );
    }


    /* =====================================================
       CLOSE MENU
       ===================================================== */

    function closeMenu() {

        sidebar.classList.remove(
            "mobile-open"
        );

        overlay.classList.remove(
            "active"
        );

        document.body.classList.remove(
            "mobile-menu-open"
        );

        menuButton.innerHTML = "☰";

        menuButton.setAttribute(
            "aria-label",
            "Open navigation menu"
        );

        menuButton.setAttribute(
            "aria-expanded",
            "false"
        );
    }


    /* =====================================================
       TOGGLE MENU
       ===================================================== */

    menuButton.addEventListener(
        "click",
        function () {

            if (
                sidebar.classList.contains(
                    "mobile-open"
                )
            ) {
                closeMenu();
            } else {
                openMenu();
            }

        }
    );


    /* =====================================================
       CLICK OVERLAY = CLOSE MENU
       ===================================================== */

    overlay.addEventListener(
        "click",
        closeMenu
    );


    /* =====================================================
       CLOSE AFTER NAVIGATION
       ===================================================== */

    sidebar
        .querySelectorAll(
            ".nav-item"
        )
        .forEach(function (item) {

            item.addEventListener(
                "click",
                function () {

                    if (
                        window.innerWidth <= 768
                    ) {
                        closeMenu();
                    }

                }
            );

        });


    /* =====================================================
       ESCAPE KEY
       ===================================================== */

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape"
            ) {
                closeMenu();
            }

        }
    );


    /* =====================================================
       RESET WHEN RETURNING TO DESKTOP
       ===================================================== */

    window.addEventListener(
        "resize",
        function () {

            if (
                window.innerWidth > 768
            ) {
                closeMenu();
            }

        }
    );

});