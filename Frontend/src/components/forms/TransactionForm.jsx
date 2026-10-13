import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ScanSearch,
  ShieldAlert,
} from "lucide-react";
import { CURRENCY_SYMBOL } from "../../utils/format";

const TRANSACTION_TYPES = [
  { value: "PAYMENT", label: "PAYMENT — Merchant / Bill Payment" },
  { value: "TRANSFER", label: "TRANSFER — Account-to-Account Transfer" },
  { value: "CASH_OUT", label: "CASH_OUT — Cash Withdrawal" },
  { value: "CASH_IN", label: "CASH_IN — Cash Deposit" },
  { value: "DEBIT", label: "DEBIT — Direct Bank Debit" },
];

const INITIAL_VALUES = {
  amount: "",
  transaction_type: "PAYMENT",
  hour_of_day: "14",
  old_balance_origin: "",
  new_balance_origin: "",
  old_balance_dest: "",
  new_balance_dest: "",
};

const FRAUD_EXAMPLE = {
  transaction_type: "TRANSFER",
  amount: "900000",
  hour_of_day: "3",
  old_balance_origin: "900000",
  new_balance_origin: "0",
  old_balance_dest: "0",
  new_balance_dest: "0",
};

const LEGIT_EXAMPLE = {
  transaction_type: "PAYMENT",
  amount: "250",
  hour_of_day: "14",
  old_balance_origin: "5000",
  new_balance_origin: "4750",
  old_balance_dest: "0",
  new_balance_dest: "0",
};

export default function TransactionForm({ onSubmit, loading = false }) {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleLoadFraudExample = () => {
    setValues(FRAUD_EXAMPLE);
    setErrors({});
  };

  const handleLoadLegitExample = () => {
    setValues(LEGIT_EXAMPLE);
    setErrors({});
  };

  const handleReset = () => {
    setValues(INITIAL_VALUES);
    setErrors({});
  };

  const validate = () => {
    const nextErrors = {};

    // 1. amount (required, > 0)
    if (values.amount === "" || values.amount === null) {
      nextErrors.amount = "Transaction amount is required.";
    } else {
      const amt = Number(values.amount);
      if (Number.isNaN(amt) || amt <= 0) {
        nextErrors.amount = "Amount must be greater than 0.";
      }
    }

    // 2. transaction_type
    if (!values.transaction_type) {
      nextErrors.transaction_type = "Please select a transaction type.";
    }

    // 3. hour_of_day (required, integer 0-23)
    if (values.hour_of_day === "" || values.hour_of_day === null) {
      nextErrors.hour_of_day = "Hour of day is required (0–23).";
    } else {
      const hr = Number(values.hour_of_day);
      if (Number.isNaN(hr) || !Number.isInteger(hr) || hr < 0 || hr > 23) {
        nextErrors.hour_of_day = "Hour must be a whole number between 0 and 23.";
      }
    }

    // 4. Balances (required, >= 0)
    const balanceFields = [
      { key: "old_balance_origin", label: "Origin balance before" },
      { key: "new_balance_origin", label: "Origin balance after" },
      { key: "old_balance_dest", label: "Destination balance before" },
      { key: "new_balance_dest", label: "Destination balance after" },
    ];

    balanceFields.forEach(({ key, label }) => {
      if (values[key] === "" || values[key] === null) {
        nextErrors[key] = `${label} is required.`;
      } else {
        const num = Number(values[key]);
        if (Number.isNaN(num) || num < 0) {
          nextErrors[key] = `${label} cannot be negative.`;
        }
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      amount: Number(values.amount),
      transaction_type: String(values.transaction_type).trim().toUpperCase(),
      hour_of_day: parseInt(values.hour_of_day, 10),
      old_balance_origin: Number(values.old_balance_origin),
      new_balance_origin: Number(values.new_balance_origin),
      old_balance_dest: Number(values.old_balance_dest),
      new_balance_dest: Number(values.new_balance_dest),
    };

    onSubmit(payload);
  };

  const fieldInputClass = (fieldName) =>
    `input tabular-nums ${errors[fieldName] ? "input-error" : ""}`;

  return (
    <div className="card space-y-5">
      <div>
        <h2 className="section-title">
          Transaction Parameters
        </h2>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
          Populate transaction fields manually or load a preset test scenario.
        </p>

        {/* Quick-Fill Preset Buttons */}
        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleLoadFraudExample}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-risk-high/30 bg-risk-high/5 px-3 py-2 text-xs font-semibold text-risk-high hover:bg-risk-high/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-risk-high/30 disabled:opacity-60 transition cursor-pointer"
          >
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span>Load fraud-like example</span>
          </button>

          <button
            type="button"
            onClick={handleLoadLegitExample}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-risk-low/30 bg-risk-low/5 px-3 py-2 text-xs font-semibold text-risk-low hover:bg-risk-low/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-risk-low/30 disabled:opacity-60 transition cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Load legit-like example</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Amount & Transaction Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="amount"
              className="label"
            >
              Amount ({CURRENCY_SYMBOL}) <span className="text-risk-high">*</span>
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="0.01"
              step="any"
              required
              disabled={loading}
              value={values.amount}
              onChange={handleChange}
              placeholder="e.g. 185000.00"
              className={fieldInputClass("amount")}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Monetary value transferred (&gt; {CURRENCY_SYMBOL} 0)
            </p>
            {errors.amount && (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-risk-high">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.amount}</span>
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="transaction_type"
              className="label"
            >
              Transaction Type <span className="text-risk-high">*</span>
            </label>
            <select
              id="transaction_type"
              name="transaction_type"
              disabled={loading}
              value={values.transaction_type}
              onChange={handleChange}
              className={`input ${errors.transaction_type ? "input-error" : ""}`}
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Payment channel category
            </p>
            {errors.transaction_type && (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-risk-high">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.transaction_type}</span>
              </p>
            )}
          </div>
        </div>

        {/* Hour of Day */}
        <div>
          <label
            htmlFor="hour_of_day"
            className="label"
          >
            Hour of Day (0–23) <span className="text-risk-high">*</span>
          </label>
          <input
            id="hour_of_day"
            name="hour_of_day"
            type="number"
            min="0"
            max="23"
            step="1"
            required
            disabled={loading}
            value={values.hour_of_day}
            onChange={handleChange}
            placeholder="0 to 23 (24-hour clock)"
            className={fieldInputClass("hour_of_day")}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Hour when transaction occurred (0 = midnight, 14 = 2:00 PM)
          </p>
          {errors.hour_of_day && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-risk-high">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errors.hour_of_day}</span>
            </p>
          )}
        </div>

        {/* Origin Account Balances */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
            Origin Account Balances
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="old_balance_origin"
                className="label"
              >
                Origin Balance Before <span className="text-risk-high">*</span>
              </label>
              <input
                id="old_balance_origin"
                name="old_balance_origin"
                type="number"
                min="0"
                step="any"
                required
                disabled={loading}
                value={values.old_balance_origin}
                onChange={handleChange}
                placeholder="e.g. 5000.00"
                className={fieldInputClass("old_balance_origin")}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Sender balance before transfer
              </p>
              {errors.old_balance_origin && (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-risk-high">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errors.old_balance_origin}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="new_balance_origin"
                className="label"
              >
                Origin Balance After <span className="text-risk-high">*</span>
              </label>
              <input
                id="new_balance_origin"
                name="new_balance_origin"
                type="number"
                min="0"
                step="any"
                required
                disabled={loading}
                value={values.new_balance_origin}
                onChange={handleChange}
                placeholder="e.g. 4750.00"
                className={fieldInputClass("new_balance_origin")}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Sender balance after transfer
              </p>
              {errors.new_balance_origin && (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-risk-high">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errors.new_balance_origin}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Destination Account Balances */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
            Destination Account Balances
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="old_balance_dest"
                className="label"
              >
                Destination Balance Before{" "}
                <span className="text-risk-high">*</span>
              </label>
              <input
                id="old_balance_dest"
                name="old_balance_dest"
                type="number"
                min="0"
                step="any"
                required
                disabled={loading}
                value={values.old_balance_dest}
                onChange={handleChange}
                placeholder="e.g. 0.00"
                className={fieldInputClass("old_balance_dest")}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Recipient balance before transfer
              </p>
              {errors.old_balance_dest && (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-risk-high">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errors.old_balance_dest}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="new_balance_dest"
                className="label"
              >
                Destination Balance After{" "}
                <span className="text-risk-high">*</span>
              </label>
              <input
                id="new_balance_dest"
                name="new_balance_dest"
                type="number"
                min="0"
                step="any"
                required
                disabled={loading}
                value={values.new_balance_dest}
                onChange={handleChange}
                placeholder="e.g. 0.00"
                className={fieldInputClass("new_balance_dest")}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Recipient balance after transfer
              </p>
              {errors.new_balance_dest && (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-risk-high">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errors.new_balance_dest}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <ScanSearch className="h-4 w-4" />
                <span>Analyze Transaction</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            aria-label="Reset transaction form"
            className="btn-secondary"
          >
            <RotateCcw className="h-4 w-4 text-slate-500" />
            <span>Reset</span>
          </button>
        </div>
      </form>
    </div>
  );
}
