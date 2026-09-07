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

document.addEventListener(
    "DOMContentLoaded",
    initializeAccountMenu
);

function getInitials(name) {
    return String(name || "User")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || "")
        .join("") || "U";
}

function createAvatarImage(url) {
    const image = document.createElement("img");
    image.src = url;
    image.alt = "Profile picture";
    image.className = "global-user-avatar-image";
    return image;
}

async function initializeAccountMenu() {
    const profileElement = document.querySelector(
        ".user-section, .user-profile"
    );

    if (!profileElement || profileElement.dataset.accountMenuInitialized === "true") {
        return;
    }

    profileElement.dataset.accountMenuInitialized = "true";

    const avatar = profileElement.querySelector("#userAvatar");
    if (!avatar) return;

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return;

    const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

    const fullName = profileData?.full_name || "User";
    const role = profileData?.role || "USER";
    const initials = getInitials(fullName);

    const { data: publicData } = supabase
        .storage
        .from("Avatars")
        .getPublicUrl(`${user.id}`);

    const profileImage = publicData?.publicUrl
        ? `${publicData.publicUrl}?t=${Date.now()}`
        : null;

    // Remove any old/static hover cards so every page uses one safe card.
    document.getElementById("userHoverCard")?.remove();
    document.querySelectorAll(".global-account-card").forEach(card => card.remove());

    const card = createHoverCard(fullName, role, initials, profileElement);

    function setAvatar(target, imageUrl) {
        target.replaceChildren();

        if (!imageUrl) {
            target.textContent = initials;
            return;
        }

        const image = createAvatarImage(imageUrl);
        image.onerror = () => {
            target.replaceChildren(document.createTextNode(initials));
        };
        target.appendChild(image);
    }

    // Use the same image source for the top avatar and hover card.
    if (profileImage) {
        setAvatar(avatar, profileImage);
        setAvatar(card.avatar, profileImage);
    } else {
        setAvatar(avatar, null);
        setAvatar(card.avatar, null);
    }

    profileElement.style.cursor = "pointer";
    profileElement.setAttribute("title", "Account Management");

    profileElement.addEventListener("click", () => {
        window.location.href = new URL(
            "account.html",
            window.location.href
        ).href;
    });

    let hideTimer;

    function showCard() {
        clearTimeout(hideTimer);
        positionCard();
        card.element.classList.add("visible");
    }

    function hideCardSoon() {
        hideTimer = setTimeout(() => {
            card.element.classList.remove("visible");
        }, 150);
    }

    function positionCard() {
        const rect = profileElement.getBoundingClientRect();
        const cardWidth = card.element.offsetWidth || 280;
        const left = Math.max(
            12,
            Math.min(rect.right - cardWidth, window.innerWidth - cardWidth - 12)
        );

        card.element.style.top = `${rect.bottom + 8}px`;
        card.element.style.left = `${left}px`;
    }

    profileElement.addEventListener("mouseenter", showCard);
    profileElement.addEventListener("mouseleave", hideCardSoon);
    profileElement.addEventListener("focusin", showCard);
    profileElement.addEventListener("focusout", hideCardSoon);

    card.element.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    card.element.addEventListener("mouseleave", hideCardSoon);
    window.addEventListener("resize", positionCard);
}

function createHoverCard(fullName, role, initials, profileElement) {
    const card = document.createElement("div");
    card.className = "global-account-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Account summary");

    const header = document.createElement("div");
    header.className = "global-account-header";

    const avatar = document.createElement("div");
    avatar.className = "global-account-avatar";
    avatar.textContent = initials;

    const info = document.createElement("div");
    info.className = "global-account-info";

    const name = document.createElement("div");
    name.className = "global-account-name";
    name.textContent = fullName;

    const roleElement = document.createElement("div");
    roleElement.className = "global-account-role";
    roleElement.textContent = role;

    info.append(name, roleElement);
    header.append(avatar, info);

    const divider = document.createElement("div");
    divider.className = "global-account-divider";

    const manage = document.createElement("a");
    manage.className = "global-account-manage";
    manage.href = new URL("account.html", window.location.href).href;
    manage.textContent = "Manage Account →";

    // Intentionally no account ID, UUID, email, token, or other sensitive value.
    card.append(header, divider, manage);
    document.body.appendChild(card);

    return { element: card, avatar, profileElement };
}
