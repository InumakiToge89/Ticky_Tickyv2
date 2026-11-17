TICKY TICKY — Philippine Time & Duration Formatting Bug Fix

Fixed issues reported in the browser console:
1. js/account-menu.js: Restored the complete notification detail modal and account-menu script from the immediately preceding validated project build. Reapplied only the narrow Philippine-time timestamp and human-readable duration formatter changes. This fixes the truncated file / Unexpected end of input error.
2. js/analyst-edits.js: Renamed the inner duration remainder variable to remainderSeconds to avoid redeclaring the function parameter `seconds`.

Validation:
- node --check passed for all 18 JavaScript files.
- ZIP integrity checked after packaging.

The Permissions-Policy messages for browsing-topics, run-ad-auction, and join-ad-interest-group are browser warnings and are unrelated to these JavaScript syntax errors.

No database records or SQL schema were changed.
