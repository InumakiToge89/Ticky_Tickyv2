/*
 * Ticky Ticky — Clock-style Time Picker
 * Replaces native input[type="time"] controls with an accessible,
 * responsive analog clock dialog while preserving HH:mm input values.
 */
(() => {
    "use strict";

    if (window.__tickyClockPickerInitialized) return;
    window.__tickyClockPickerInitialized = true;

    const pad = value => String(value).padStart(2, "0");
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function parseTime(value) {
        const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ""));
        if (!match) return { hour24: 9, minute: 0 };
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (hour > 23 || minute > 59) return { hour24: 9, minute: 0 };
        return { hour24: hour, minute };
    }

    function to12Hour(hour24) {
        return { hour: hour24 % 12 || 12, period: hour24 >= 12 ? "PM" : "AM" };
    }

    function to24Hour(hour, period) {
        return (hour % 12) + (period === "PM" ? 12 : 0);
    }

    function createDialog() {
        const overlay = document.createElement("div");
        overlay.className = "ticky-time-overlay";
        overlay.innerHTML = `
            <section class="ticky-time-dialog" role="dialog" aria-modal="true"
                aria-labelledby="tickyTimeTitle" aria-describedby="tickyTimeHint">
                <div class="ticky-time-kicker" id="tickyTimeTitle">SELECT TIME</div>
                <p class="ticky-time-hint" id="tickyTimeHint">Choose an hour, then a minute</p>
                <div class="ticky-time-digital">
                    <button type="button" class="ticky-time-digit is-active" data-part="hour" aria-label="Choose hour">09</button>
                    <span class="ticky-time-colon">:</span>
                    <button type="button" class="ticky-time-digit" data-part="minute" aria-label="Choose minute">00</button>
                    <div class="ticky-time-period" role="group" aria-label="AM or PM">
                        <button type="button" data-period="AM">AM</button>
                        <button type="button" data-period="PM">PM</button>
                    </div>
                </div>
                <div class="ticky-time-clock-wrap">
                    <div class="ticky-time-clock" role="group" aria-label="Analog time selector">
                        <div class="ticky-time-hand"></div>
                        <div class="ticky-time-center"></div>
                        <div class="ticky-time-numbers"></div>
                    </div>
                </div>
                <div class="ticky-time-footer">
                    <button type="button" class="ticky-time-cancel">CANCEL</button>
                    <button type="button" class="ticky-time-ok">OK</button>
                </div>
            </section>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    let overlay;
    let activeInput = null;
    let selectedHour = 9;
    let selectedMinute = 0;
    let selectedPeriod = "AM";
    let selectionPart = "hour";
    let previousFocus = null;

    function currentHour24() {
        return to24Hour(selectedHour, selectedPeriod);
    }

    function updateHand() {
        if (!overlay) return;
        const clock = overlay.querySelector(".ticky-time-clock");
        const hand = overlay.querySelector(".ticky-time-hand");
        // CSS 0deg points right; clock 12 o'clock is -90deg.
        // Keep the hand ending near the number ring and aligned with selection.
        const clockAngle = selectionPart === "hour"
            ? (selectedHour % 12) * 30
            : selectedMinute * 6;
        const cssAngle = clockAngle - 90;
        hand.style.width = "42%";
        hand.style.transform = `rotate(${cssAngle}deg)`;
        hand.style.setProperty("--hand-angle", `${cssAngle}deg`);
        clock.dataset.selection = selectionPart;
    }

    function renderClock() {
        const restoreDialogFocus = overlay.contains(document.activeElement);
        const numbers = overlay.querySelector(".ticky-time-numbers");
        const hourButton = overlay.querySelector('[data-part="hour"]');
        const minuteButton = overlay.querySelector('[data-part="minute"]');
        const hint = overlay.querySelector(".ticky-time-hint");

        hourButton.textContent = pad(selectedHour);
        minuteButton.textContent = pad(selectedMinute);
        hourButton.classList.toggle("is-active", selectionPart === "hour");
        minuteButton.classList.toggle("is-active", selectionPart === "minute");

        overlay.querySelectorAll("[data-period]").forEach(button => {
            button.classList.toggle("is-active", button.dataset.period === selectedPeriod);
        });

        hint.textContent = selectionPart === "hour"
            ? "Choose an hour"
            : "Choose a minute";

        const values = selectionPart === "hour"
            ? Array.from({ length: 12 }, (_, i) => i + 1)
            : Array.from({ length: 12 }, (_, i) => i * 5);

        numbers.innerHTML = values.map((value, index) => {
            // Hour labels must be positioned by their clock value, not array index.
            // This puts 12 at the top, 1 at upper-right, and 11 at upper-left,
            // matching the hand angle used by updateHand().
            const dialStep = selectionPart === "hour"
                ? (value % 12)
                : index;
            const angle = (dialStep * 30 - 90) * Math.PI / 180;
            const radius = 42;
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);
            const active = selectionPart === "hour"
                ? value === selectedHour
                : value === Math.round(selectedMinute / 5) * 5 % 60;
            const label = selectionPart === "hour" ? pad(value) : pad(value);
            return `<button type="button" class="ticky-time-number${active ? " is-selected" : ""}"
                style="left:${x}%;top:${y}%;" data-clock-value="${value}"
                aria-label="${selectionPart === "hour" ? `Hour ${value}` : `Minute ${value}`}">${label}</button>`;
        }).join("");

        updateHand();

        if (restoreDialogFocus) {
            overlay.querySelector(`[data-part="${selectionPart}"]`)?.focus({ preventScroll: true });
        }
    }

    function updateLiveSelection() {
        const hourButton = overlay.querySelector('[data-part="hour"]');
        const minuteButton = overlay.querySelector('[data-part="minute"]');
        hourButton.textContent = pad(selectedHour);
        minuteButton.textContent = pad(selectedMinute);
        overlay.querySelectorAll(".ticky-time-number").forEach(button => {
            const value = Number(button.dataset.clockValue);
            const active = selectionPart === "hour"
                ? value === selectedHour
                : value === Math.round(selectedMinute / 5) * 5 % 60;
            button.classList.toggle("is-selected", active);
        });
        updateHand();
    }

    function open(input) {
        activeInput = input;
        previousFocus = document.activeElement;
        const parsed = parseTime(input.value);
        const converted = to12Hour(parsed.hour24);
        selectedHour = converted.hour;
        selectedMinute = parsed.minute;
        selectedPeriod = converted.period;
        selectionPart = "hour";

        if (!overlay) overlay = createDialog();
        renderClock();
        overlay.classList.add("is-open");
        document.body.classList.add("ticky-time-open");
        overlay.querySelector('[data-part="hour"]').focus();
    }

    function close(shouldCommit) {
        if (!overlay || !activeInput) return;
        if (shouldCommit) {
            activeInput.value = `${pad(currentHour24())}:${pad(selectedMinute)}`;
            activeInput.dispatchEvent(new Event("input", { bubbles: true }));
            activeInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const inputToRestore = activeInput;
        activeInput = null;
        overlay.classList.remove("is-open");
        document.body.classList.remove("ticky-time-open");
        if (previousFocus && typeof previousFocus.focus === "function") {
            previousFocus.focus();
        } else if (inputToRestore) {
            inputToRestore.focus();
        }
    }

    function selectClockValue(value) {
        if (selectionPart === "hour") {
            selectedHour = clamp(Number(value), 1, 12);
            selectionPart = "minute";
        } else {
            selectedMinute = clamp(Number(value), 0, 59);
        }
        renderClock();
    }

    function applyClockPointer(event) {
        const clock = overlay.querySelector(".ticky-time-clock");
        const rect = clock.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;

        if (selectionPart === "hour") {
            const hour = Math.round(angle / 30) % 12;
            selectedHour = hour || 12;
            selectionPart = "minute";
            renderClock();
        } else {
            selectedMinute = Math.round(angle / 6) % 60;
            updateLiveSelection();
        }
    }

    function bindDialog() {
        const clock = overlay.querySelector(".ticky-time-clock");
        let dragging = false;
        let activePointerId = null;

        clock.addEventListener("pointerdown", event => {
            if (event.target.closest("[data-clock-value]")) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            dragging = true;
            activePointerId = event.pointerId;
            clock.setPointerCapture?.(event.pointerId);
            applyClockPointer(event);
            event.preventDefault();
        });

        clock.addEventListener("pointermove", event => {
            if (!dragging || event.pointerId !== activePointerId) return;
            if (selectionPart === "minute") applyClockPointer(event);
        });

        const finishPointer = event => {
            if (!dragging || event.pointerId !== activePointerId) return;
            if (selectionPart === "minute") applyClockPointer(event);
            dragging = false;
            activePointerId = null;
            if (clock.hasPointerCapture?.(event.pointerId)) {
                clock.releasePointerCapture(event.pointerId);
            }
        };

        clock.addEventListener("pointerup", finishPointer);
        clock.addEventListener("pointercancel", finishPointer);

        overlay.addEventListener("click", event => {
            if (event.target === overlay) {
                close(false);
                return;
            }

            const part = event.target.closest("[data-part]");
            if (part) {
                selectionPart = part.dataset.part;
                renderClock();
                return;
            }

            const period = event.target.closest("[data-period]");
            if (period) {
                selectedPeriod = period.dataset.period;
                renderClock();
                return;
            }

            const number = event.target.closest("[data-clock-value]");
            if (number) {
                selectClockValue(number.dataset.clockValue);
                return;
            }

            if (event.target.closest(".ticky-time-cancel")) {
                close(false);
                return;
            }

            if (event.target.closest(".ticky-time-ok")) {
                close(true);
            }
        });

        document.addEventListener("keydown", event => {
            if (!overlay?.classList.contains("is-open")) return;

            if (event.key === "Escape") {
                event.preventDefault();
                close(false);
                return;
            }

            if (event.key === "Tab") {
                const focusable = [...overlay.querySelectorAll(
                    'button:not(:disabled), [tabindex]:not([tabindex="-1"])'
                )];
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
                return;
            }

            if (event.key === "Enter" && event.target.closest(".ticky-time-dialog")) {
                if (event.target.matches(".ticky-time-cancel, .ticky-time-ok, [data-part], [data-period], [data-clock-value]")) {
                    return;
                }
                event.preventDefault();
                close(true);
            }
        });
    }

    function enhance(input) {
        if (input.dataset.tickyClockPicker === "1") return;
        input.dataset.tickyClockPicker = "1";
        input.dataset.nativeTimeType = "time";
        input.type = "text";
        input.readOnly = true;
        input.inputMode = "none";
        input.autocomplete = "off";
        input.placeholder = input.placeholder || "Select time";
        input.classList.add("ticky-time-input");
        input.setAttribute("aria-haspopup", "dialog");
        input.setAttribute("aria-label", input.getAttribute("aria-label") || input.closest("label")?.innerText || "Select time");
        input.title = "Open clock-style time picker";
        input.addEventListener("click", () => open(input));
        input.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open(input);
            }
        });
    }


    const originalEnhance = enhance;
    function run() {
        document.querySelectorAll('input[type="time"], input[data-time-picker="clock"]').forEach(originalEnhance);
        if (document.querySelector('[data-ticky-clock-picker="1"]') && !overlay) {
            overlay = createDialog();
            bindDialog();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
        run();
    }
})();
