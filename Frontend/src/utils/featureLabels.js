import { formatCurrency } from "./format.js";

/**
 * Map of raw model feature names (including one-hot encoded variants)
 * to friendly human-readable labels.
 */
export const FEATURE_LABELS = {
  amount: "Transaction amount",
  transaction_type: "Transaction type",
  hour_of_day: "Hour of day",
  old_balance_origin: "Origin balance before",
  new_balance_origin: "Origin balance after",
  old_balance_dest: "Destination balance before",
  new_balance_dest: "Destination balance after",
  // One-hot encoded transaction_type variants
  transaction_type_TRANSFER: "Type: Transfer",
  transaction_type_CASH_OUT: "Type: Cash Out",
  transaction_type_PAYMENT: "Type: Payment",
  transaction_type_CASH_IN: "Type: Cash In",
  transaction_type_DEBIT: "Type: Debit",
};

/**
 * Format a currency value cleanly in Rs. (omitting .00 for whole amounts, e.g. "Rs. 2,000").
 *
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatDisplayCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return "-";
  }
  if (Number.isInteger(num)) {
    return formatCurrency(num, { decimals: 0 });
  }
  return formatCurrency(num);
}

/**
 * Strip sklearn transformer prefixes (e.g. "num__amount" -> "amount").
 *
 * @param {string} rawFeature
 * @returns {string}
 */
export function normalizeFeatureKey(rawFeature) {
  if (!rawFeature) return "";
  const trimmed = String(rawFeature).trim();
  return trimmed.includes("__") ? trimmed.split("__").pop() : trimmed;
}

/**
 * Convert a raw feature identifier (including sklearn pipeline prefixes or
 * one-hot suffixes) into a clean human-readable label.
 *
 * @param {string} rawFeature
 * @returns {string}
 */
export function getFeatureLabel(rawFeature) {
  if (!rawFeature) return "Unknown feature";

  const trimmed = String(rawFeature).trim();
  if (FEATURE_LABELS[trimmed]) {
    return FEATURE_LABELS[trimmed];
  }

  const withoutPrefix = normalizeFeatureKey(trimmed);

  if (FEATURE_LABELS[withoutPrefix]) {
    return FEATURE_LABELS[withoutPrefix];
  }

  if (withoutPrefix.startsWith("transaction_type_")) {
    const rawType = withoutPrefix
      .replace("transaction_type_", "")
      .replace(/_/g, " ")
      .toLowerCase();
    const formattedType = rawType.replace(/\b\w/g, (c) => c.toUpperCase());
    return `Type: ${formattedType}`;
  }

  const humanized = withoutPrefix.replace(/_/g, " ");
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

/**
 * Build a friendly feature label that includes the actual transaction value when available,
 * e.g. "Origin balance before: Rs. 2,000" or "Hour of day: 14:00".
 *
 * @param {string} rawFeature
 * @param {Object} [inputValues={}]
 * @returns {string}
 */
export function getFeatureLabelWithValue(rawFeature, inputValues = {}) {
  const key = normalizeFeatureKey(rawFeature);
  const baseLabel = getFeatureLabel(key);

  if (!inputValues || typeof inputValues !== "object") {
    return baseLabel;
  }

  switch (key) {
    case "amount":
      return inputValues.amount !== undefined && inputValues.amount !== ""
        ? `Transaction amount: ${formatDisplayCurrency(inputValues.amount)}`
        : baseLabel;
    case "old_balance_origin":
      return inputValues.old_balance_origin !== undefined &&
        inputValues.old_balance_origin !== ""
        ? `Origin balance before: ${formatDisplayCurrency(inputValues.old_balance_origin)}`
        : baseLabel;
    case "new_balance_origin":
      return inputValues.new_balance_origin !== undefined &&
        inputValues.new_balance_origin !== ""
        ? `Origin balance after: ${formatDisplayCurrency(inputValues.new_balance_origin)}`
        : baseLabel;
    case "old_balance_dest":
      return inputValues.old_balance_dest !== undefined &&
        inputValues.old_balance_dest !== ""
        ? `Dest. balance before: ${formatDisplayCurrency(inputValues.old_balance_dest)}`
        : baseLabel;
    case "new_balance_dest":
      return inputValues.new_balance_dest !== undefined &&
        inputValues.new_balance_dest !== ""
        ? `Dest. balance after: ${formatDisplayCurrency(inputValues.new_balance_dest)}`
        : baseLabel;
    case "transaction_type":
    case "transaction_type_TRANSFER":
    case "transaction_type_CASH_OUT":
    case "transaction_type_PAYMENT":
    case "transaction_type_CASH_IN":
    case "transaction_type_DEBIT": {
      const tVal =
        inputValues.transaction_type ||
        (key.startsWith("transaction_type_")
          ? key.replace("transaction_type_", "")
          : "");
      return tVal ? `Transaction type: ${tVal}` : baseLabel;
    }
    case "hour_of_day":
      return inputValues.hour_of_day !== undefined &&
        inputValues.hour_of_day !== ""
        ? `Hour of day: ${Number(inputValues.hour_of_day)}:00`
        : baseLabel;
    default:
      return baseLabel;
  }
}

export default FEATURE_LABELS;
