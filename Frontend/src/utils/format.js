/**
 * Formatting helpers for currency, numbers, percentages, timestamps, and IDs.
 */

export const CURRENCY_SYMBOL = "Rs.";

const twoDecimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Format a numeric amount in Sri Lankan Rupees (e.g. "Rs. 900,000.00").
 * Pass `{ decimals: 0 }` for chart axis ticks or integer-only labels (e.g. "Rs. 900,000").
 * Returns "-" safely for null, undefined, empty string, or NaN values.
 *
 * @param {number|string|null|undefined} amount
 * @param {Object} [options]
 * @param {number} [options.decimals=2]
 * @returns {string}
 */
export function formatCurrency(amount, options = {}) {
  if (amount === null || amount === undefined || amount === "") {
    return "-";
  }
  const num = Number(amount);
  if (Number.isNaN(num)) {
    return "-";
  }

  const { decimals = 2 } = options;
  if (decimals === 0) {
    return `${CURRENCY_SYMBOL} ${numberFormatter.format(num)}`;
  }
  if (decimals !== 2) {
    const customFormatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${CURRENCY_SYMBOL} ${customFormatter.format(num)}`;
  }

  return `${CURRENCY_SYMBOL} ${twoDecimalFormatter.format(num)}`;
}

/**
 * Format a numeric amount in compact Sri Lankan Rupees for chart axes and cards
 * (e.g. "Rs. 1.2M", "Rs. 450K", "Rs. 2,400").
 * Returns "-" safely for null, undefined, empty string, or NaN values.
 *
 * @param {number|string|null|undefined} amount
 * @returns {string}
 */
export function formatCurrencyCompact(amount) {
  if (amount === null || amount === undefined || amount === "") {
    return "-";
  }
  const num = Number(amount);
  if (Number.isNaN(num)) {
    return "-";
  }

  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const formatted = Number.isInteger(millions)
      ? String(millions)
      : millions.toFixed(1).replace(/\.0$/, "");
    return `${sign}${CURRENCY_SYMBOL} ${formatted}M`;
  }

  if (abs >= 10_000) {
    const thousands = abs / 1_000;
    const formatted = Number.isInteger(thousands)
      ? String(thousands)
      : thousands.toFixed(1).replace(/\.0$/, "");
    return `${sign}${CURRENCY_SYMBOL} ${formatted}K`;
  }

  return `${sign}${CURRENCY_SYMBOL} ${numberFormatter.format(abs)}`;
}

/**
 * Format a number with thousand separators (e.g. "1,245").
 *
 * @param {number|string|null|undefined} n
 * @returns {string}
 */
export function formatNumber(n) {
  const num = Number(n);
  if (n === null || n === undefined || Number.isNaN(num)) {
    return "0";
  }
  return numberFormatter.format(num);
}

/**
 * Format a numeric percentage value with a "%" suffix (e.g. "12.4%").
 * Accepts a percentage value (0 - 100).
 *
 * @param {number|string|null|undefined} n - Percentage value (e.g. 12.4 for 12.4%).
 * @param {number} [decimals=1] - Number of decimal places.
 * @returns {string}
 */
export function formatPercent(n, decimals = 1) {
  const num = Number(n);
  if (n === null || n === undefined || Number.isNaN(num)) {
    return `${(0).toFixed(decimals)}%`;
  }
  return `${num.toFixed(decimals)}%`;
}

/**
 * Format a numeric value to a fixed number of decimal places (e.g. "0.9963").
 *
 * @param {number|string|null|undefined} n
 * @param {number} [decimals=4]
 * @returns {string}
 */
export function formatDecimal(n, decimals = 4) {
  const num = Number(n);
  if (n === null || n === undefined || Number.isNaN(num)) {
    return (0).toFixed(decimals);
  }
  return num.toFixed(decimals);
}

/**
 * Format an ISO 8601 date string into a readable date and time (e.g. "Oct 12, 2026, 10:15 PM").
 *
 * @param {string|Date|null|undefined} iso
 * @returns {string}
 */
export function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    let dateInput = iso;
    if (
      typeof iso === "string" &&
      !iso.endsWith("Z") &&
      !/[+-]\d{2}:\d{2}$/.test(iso)
    ) {
      dateInput = `${iso}Z`;
    }
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) {
      return String(iso);
    }
    return dateTimeFormatter.format(date);
  } catch {
    return String(iso);
  }
}

/**
 * Shorten a transaction ID or MongoDB ObjectId for compact table display.
 *
 * @param {string|null|undefined} id
 * @returns {string}
 */
export function shortId(id) {
  if (!id) return "—";
  const str = String(id).trim();
  if (str.length <= 12) {
    return str;
  }
  return `${str.slice(0, 6)}…${str.slice(-4)}`;
}
