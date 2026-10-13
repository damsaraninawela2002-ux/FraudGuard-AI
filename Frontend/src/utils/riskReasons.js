import {
  formatDisplayCurrency,
  getFeatureLabelWithValue,
  normalizeFeatureKey,
} from "./featureLabels.js";
import { CURRENCY_SYMBOL } from "./format.js";
import { getRiskLevel, getRiskRecommendation } from "./risk.js";

/**
 * Format hour integer (0-23) as 12-hour AM/PM clock for natural one-sentence summaries,
 * e.g. 3 -> "3:00 AM", 14 -> "2:00 PM".
 *
 * @param {number} hour
 * @returns {string}
 */
function formatHourAmPm(hour) {
  const h = Number(hour);
  if (Number.isNaN(h) || h < 0 || h > 23) return "";
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${suffix}`;
}

/**
 * Build the one-sentence summary from the risk level and top 2-3 true facts.
 *
 * @param {"Low"|"Medium"|"High"} resolvedLevel
 * @param {Object} facts
 * @returns {string}
 */
function buildOneSentenceSummary(resolvedLevel, facts) {
  const {
    type,
    amount,
    hasAmount,
    hour,
    hasHour,
    isVeryLargeAmount,
    isLargeAmount,
    isSmallAmount,
    isNightHour,
    isDaytimeHour,
    isAccountEmptied,
    isAlmostEntireBalanceMoved,
    isDestUnchanged,
    keptHealthyBalance,
  } = facts;

  const typeLabel = type || "transaction";
  const amountPrefix = isVeryLargeAmount
    ? "a very large "
    : isLargeAmount
      ? "a large "
      : isSmallAmount
        ? "a small "
        : `a ${hasAmount ? `${formatDisplayCurrency(amount)} ` : ""}`;

  if (resolvedLevel === "High") {
    const clauses = [];
    if (isNightHour && hasHour) {
      clauses.push(`at ${formatHourAmPm(hour)}`);
    }
    if (isAccountEmptied) {
      clauses.push("emptied the sender's account");
    } else if (isAlmostEntireBalanceMoved) {
      clauses.push("moved almost the entire sender balance");
    } else if (isDestUnchanged) {
      clauses.push("left the receiving account balance unchanged");
    }

    const tail = clauses.length > 0 ? ` ${clauses.join(" ")}` : " triggered multiple fraud indicators";
    return `High risk: ${amountPrefix}${typeLabel}${tail}.`;
  }

  if (resolvedLevel === "Medium") {
    const clauses = [];
    if (isNightHour && hasHour) {
      clauses.push(`at ${formatHourAmPm(hour)}`);
    } else if (isDaytimeHour) {
      clauses.push("during the daytime");
    }
    if (isAccountEmptied) {
      clauses.push("emptied the sender's account");
    } else if (isDestUnchanged) {
      clauses.push("showed an unchanged destination balance");
    }

    const tail = clauses.length > 0 ? ` ${clauses.join(" and ")}` : " warrants manual analyst review";
    return `Medium risk: ${amountPrefix}${typeLabel}${tail}.`;
  }

  // Low risk summary
  if (isSmallAmount && isDaytimeHour) {
    return `Low risk: a small ${typeLabel} during the daytime.`;
  }
  if (isDaytimeHour && keptHealthyBalance) {
    return `Low risk: ${amountPrefix}${typeLabel} during the daytime with most of the sender's balance intact.`;
  }
  if (isDaytimeHour && isAccountEmptied) {
    return `Low risk: a daytime ${typeLabel} of ${formatDisplayCurrency(amount)} scored below the fraud threshold despite emptying a small balance.`;
  }
  if (isDaytimeHour) {
    return `Low risk: ${amountPrefix}${typeLabel} during the daytime.`;
  }
  return `Low risk: ${amountPrefix}${typeLabel} scored within normal parameters.`;
}

/**
 * Determine whether the top SHAP feature disagrees with the rule-based expectations
 * and return a neutral one-line "Model note" when applicable.
 *
 * @param {Array<{ feature: string, shap_value: number, direction: string }>} shapValues
 * @param {Object} inputs
 * @param {Object} facts
 * @returns {string|null}
 */
function buildModelNote(shapValues, inputs, facts) {
  if (!Array.isArray(shapValues) || shapValues.length === 0) {
    return null;
  }

  const {
    isVeryLargeAmount,
    isLargeAmount,
    isRiskyType,
    isSafeType,
    isNightHour,
    isDaytimeHour,
    isAccountEmptied,
    keptHealthyBalance,
    isDestUnchanged,
  } = facts;

  // Check top 3 SHAP features for any rule/SHAP direction disagreement
  const notes = [];
  for (const item of shapValues.slice(0, 3)) {
    const key = normalizeFeatureKey(item.feature);
    const shapVal = Number(item.shap_value) || 0;
    const increases = item.direction === "increases_risk" || shapVal > 0;
    const sign = increases ? "+" : "-";
    const labelWithVal = getFeatureLabelWithValue(key, inputs);

    let disagrees = false;

    if (key === "amount") {
      // Disagrees if a normal/small amount (< 50k) pushed toward fraud (+),
      // or if a large/very large amount (>= 50k) pushed toward legitimate (-)
      if (increases && !isLargeAmount && !isVeryLargeAmount) {
        disagrees = true;
      } else if (!increases && (isLargeAmount || isVeryLargeAmount)) {
        disagrees = true;
      }
    } else if (key === "old_balance_origin") {
      // Disagrees if account was emptied on a risky transfer yet small starting balance pushed score down (-)
      if (!increases && isAccountEmptied) {
        disagrees = true;
      }
    } else if (key === "new_balance_origin") {
      if (increases && keptHealthyBalance) {
        disagrees = true;
      } else if (!increases && isAccountEmptied) {
        disagrees = true;
      }
    } else if (key === "new_balance_dest") {
      if (!increases && isDestUnchanged) {
        disagrees = true;
      }
    } else if (key.startsWith("transaction_type")) {
      if (increases && isSafeType) {
        disagrees = true;
      } else if (!increases && isRiskyType) {
        disagrees = true;
      }
    } else if (key === "hour_of_day") {
      if (increases && isDaytimeHour) {
        disagrees = true;
      } else if (!increases && isNightHour) {
        disagrees = true;
      }
    }

    if (disagrees) {
      notes.push(`${labelWithVal} (${sign})`);
      if (notes.length >= 2) break;
    }
  }

  return notes.length > 0
    ? `The model also weighed: ${notes.join(", ")}`
    : null;
}

/**
 * Reasons Engine: Build plain-English risk reasons, safe reasons, one-sentence summary,
 * consistent recommendation, and optional model note from transaction facts.
 *
 * @param {Object} transactionInputs - { amount, transaction_type, hour_of_day, old_balance_origin, new_balance_origin, old_balance_dest, new_balance_dest }
 * @param {number} score - Fraud probability (0 to 1)
 * @param {string} [riskLevel] - "Low" | "Medium" | "High"
 * @param {Array<{ feature: string, shap_value: number, direction: string }>} [shapValues=[]]
 * @returns {{
 *   summary: string,
 *   recommendation: string,
 *   riskReasons: string[],
 *   safeReasons: string[],
 *   modelNote: string | null,
 *   resolvedRiskLevel: "Low" | "Medium" | "High"
 * }}
 */
export function buildRiskReasons(
  transactionInputs = {},
  score = 0,
  riskLevel = undefined,
  shapValues = []
) {
  const inputs = transactionInputs || {};
  const resolvedRiskLevel = riskLevel
    ? getRiskLevel(riskLevel)
    : getRiskLevel(Number(score) || 0);
  const recommendation = getRiskRecommendation(resolvedRiskLevel);

  const hasAmount =
    inputs.amount !== undefined &&
    inputs.amount !== null &&
    inputs.amount !== "" &&
    !Number.isNaN(Number(inputs.amount));
  const amount = hasAmount ? Number(inputs.amount) : 0;

  const type = String(inputs.transaction_type || "")
    .trim()
    .toUpperCase();

  const hasHour =
    inputs.hour_of_day !== undefined &&
    inputs.hour_of_day !== null &&
    inputs.hour_of_day !== "" &&
    !Number.isNaN(Number(inputs.hour_of_day));
  const hour = hasHour ? Number(inputs.hour_of_day) : -1;

  const hasOldOrig =
    inputs.old_balance_origin !== undefined &&
    inputs.old_balance_origin !== null &&
    inputs.old_balance_origin !== "" &&
    !Number.isNaN(Number(inputs.old_balance_origin));
  const oldBalanceOrigin = hasOldOrig ? Number(inputs.old_balance_origin) : 0;

  const hasNewOrig =
    inputs.new_balance_origin !== undefined &&
    inputs.new_balance_origin !== null &&
    inputs.new_balance_origin !== "" &&
    !Number.isNaN(Number(inputs.new_balance_origin));
  const newBalanceOrigin = hasNewOrig ? Number(inputs.new_balance_origin) : 0;

  const hasOldDest =
    inputs.old_balance_dest !== undefined &&
    inputs.old_balance_dest !== null &&
    inputs.old_balance_dest !== "" &&
    !Number.isNaN(Number(inputs.old_balance_dest));
  const oldBalanceDest = hasOldDest ? Number(inputs.old_balance_dest) : 0;

  const hasNewDest =
    inputs.new_balance_dest !== undefined &&
    inputs.new_balance_dest !== null &&
    inputs.new_balance_dest !== "" &&
    !Number.isNaN(Number(inputs.new_balance_dest));
  const newBalanceDest = hasNewDest ? Number(inputs.new_balance_dest) : 0;

  // Derived boolean facts
  const isAccountEmptied =
    hasOldOrig && hasNewOrig && newBalanceOrigin === 0 && oldBalanceOrigin > 0;
  const isAlmostEntireBalanceMoved =
    hasAmount &&
    hasOldOrig &&
    oldBalanceOrigin > 0 &&
    amount >= 0.9 * oldBalanceOrigin;
  const isRiskyType = type === "TRANSFER" || type === "CASH_OUT";
  const isSafeType =
    type === "PAYMENT" || type === "CASH_IN" || type === "DEBIT";
  const isVeryLargeAmount = hasAmount && amount > 500000;
  const isLargeAmount = hasAmount && amount >= 50000 && amount <= 500000;
  const isSmallAmount = hasAmount && amount > 0 && amount < 1000;
  const isNightHour = hasHour && hour >= 0 && hour <= 5;
  const isDaytimeHour = hasHour && hour >= 7 && hour <= 21;
  const isDestUnchanged =
    hasOldDest &&
    hasNewDest &&
    oldBalanceDest === newBalanceDest &&
    amount > 0 &&
    isRiskyType;

  // Balance consistency check (for CASH_IN, deposit adds to origin balance; for others, subtracts)
  const expectedNewOrigin =
    type === "CASH_IN"
      ? oldBalanceOrigin + amount
      : oldBalanceOrigin - amount;
  const isOriginMathMismatch =
    hasAmount &&
    hasOldOrig &&
    hasNewOrig &&
    Math.abs(expectedNewOrigin - newBalanceOrigin) > 1;

  const keptHealthyBalance =
    hasOldOrig &&
    hasNewOrig &&
    oldBalanceOrigin > 0 &&
    newBalanceOrigin >= 0.5 * oldBalanceOrigin;

  const isDestIncreasedNormally =
    hasOldDest &&
    hasNewDest &&
    hasAmount &&
    amount > 0 &&
    Math.abs(newBalanceDest - oldBalanceDest - amount) <= 1;

  // 1. Collect RISK reasons (only when condition is true, max 5)
  const riskReasons = [];

  if (isAccountEmptied) {
    riskReasons.push(
      `The sender's account was completely emptied (from ${formatDisplayCurrency(oldBalanceOrigin)} to ${CURRENCY_SYMBOL} 0).`
    );
  }

  if (isRiskyType) {
    riskReasons.push(
      "TRANSFER and CASH_OUT are the only transaction types where fraud occurs in the training data."
    );
  }

  if (isVeryLargeAmount) {
    riskReasons.push(`Very large amount (${formatDisplayCurrency(amount)}).`);
  } else if (isLargeAmount) {
    riskReasons.push(`Large amount (${formatDisplayCurrency(amount)}).`);
  }

  if (isNightHour) {
    riskReasons.push(
      `Made at night (${hour}:00), when fraud is more common.`
    );
  }

  if (isDestUnchanged) {
    riskReasons.push(
      "The receiving account's balance did not change, a pattern seen in fraud cases."
    );
  }

  if (isAlmostEntireBalanceMoved) {
    riskReasons.push(
      "Almost the entire balance was moved in a single transaction."
    );
  }

  if (isOriginMathMismatch) {
    riskReasons.push("The balances do not add up for this transaction.");
  }

  // 2. Collect SAFE reasons (only when condition is true, max 5)
  const safeReasons = [];

  if (isSafeType) {
    safeReasons.push(
      `${type} transactions are rarely fraudulent in the training data.`
    );
  }

  if (isSmallAmount) {
    safeReasons.push(`Small amount (${formatDisplayCurrency(amount)}).`);
  }

  if (isDaytimeHour) {
    safeReasons.push("Made during normal daytime hours.");
  }

  if (keptHealthyBalance) {
    safeReasons.push("The sender still has most of their balance.");
  }

  if (isDestIncreasedNormally) {
    safeReasons.push("The receiving account balance increased normally.");
  }

  const facts = {
    type,
    amount,
    hasAmount,
    hour,
    hasHour,
    isVeryLargeAmount,
    isLargeAmount,
    isSmallAmount,
    isNightHour,
    isDaytimeHour,
    isRiskyType,
    isSafeType,
    isAccountEmptied,
    isAlmostEntireBalanceMoved,
    isDestUnchanged,
    keptHealthyBalance,
  };

  const summary = buildOneSentenceSummary(resolvedRiskLevel, facts);
  const modelNote = buildModelNote(shapValues, inputs, facts);

  return {
    summary,
    recommendation,
    riskReasons: riskReasons.slice(0, 5),
    safeReasons: safeReasons.slice(0, 5),
    modelNote,
    resolvedRiskLevel,
  };
}

export default buildRiskReasons;
