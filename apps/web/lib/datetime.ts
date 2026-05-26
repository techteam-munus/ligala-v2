// Single source of truth for date/time display.
//
// Every Intl.DateTimeFormat in the web app must go through here so the
// timezone is pinned to Asia/Manila. Without an explicit `timeZone`, the
// formatter uses the *runtime's* zone — UTC during SSR (Lambda), the user's
// local zone during client hydration — which produces a text hydration
// mismatch (React error #418). Pinning the zone makes formatting identical on
// both passes and renders PH-local time, which is the correct display for a
// Philippine legal product.
const MANILA_TZ = "Asia/Manila";

export function phDateFormat(
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-PH", { timeZone: MANILA_TZ, ...options });
}
