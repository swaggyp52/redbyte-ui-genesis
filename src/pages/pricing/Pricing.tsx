import React from "react";

export default function Pricing() {
  return (
    <div className="text-white px-6 py-20 text-center">
      <h1 className="text-4xl font-black mb-4">Pricing</h1>
      <p className="text-neutral-400 mb-10">Simple. Transparent. For every team.</p>

      <div className="grid sm:grid-cols-3 gap-6">
        <Plan price="Free" features="Basic UI, No Auth" />
        <Plan price="$9/mo" features="AI Access, Dashboard" highlight />
        <Plan price="$49/mo" features="Full Enterprise Suite" />
      </div>
    </div>
  );
}

function Plan({ price, features, highlight }) {
  return (
    <div className={
      "p-6 rounded-2xl border " +
      (highlight ? "border-red-500 bg-neutral-900" : "border-neutral-800 bg-neutral-900")
    }>
      <h2 className="text-3xl font-black mb-2">{price}</h2>
      <p className="text-neutral-400">{features}</p>
    </div>
  );
}
