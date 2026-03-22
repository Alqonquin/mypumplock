import Link from "next/link";
import { PumpLockLogo } from "@/components/pumplock-logo";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-black text-gray-900">
            <PumpLockLogo className="w-7 h-7" />
            PumpLock
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">PUMPLOCK, INC. MEMBERSHIP AGREEMENT</h1>
        <p className="text-sm text-gray-400 mb-8">Last Updated: March 19, 2026</p>

        <div className="prose prose-gray prose-sm max-w-none space-y-6 text-gray-700 leading-relaxed">

          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">1. THE SERVICE AND ELIGIBILITY</h2>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">1.1 Nature of Service</h3>
            <p>
              PumpLock, Inc. (&quot;PumpLock&quot;) provides a proprietary digital membership service providing fuel market analytics and price-shielding benefits.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">1.2 Not Insurance</h3>
            <p>
              You acknowledge that PumpLock is not an insurer. This membership is a service contract based on independent market indices and does not indemnify against actual physical loss, nor does it require proof of purchase of any physical commodity.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">1.3 Eligibility</h3>
            <p>
              You must be at least 18 years of age and a resident of the United States to enroll.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">2. REGISTRATION AND ACCOUNT SECURITY</h2>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">2.1 Accuracy</h3>
            <p>
              You agree to provide accurate, current, and complete information during the registration process, specifically regarding your primary fueling Zip Code.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">2.2 Account Responsibility</h3>
            <p>
              You are solely responsible for maintaining the confidentiality of your account credentials. All actions taken under your account are your responsibility.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">3. THE MEMBERSHIP BENEFIT &amp; CALCULATIONS</h2>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">3.1 Protection Price (The &quot;Lock&quot;)</h3>
            <p>
              Upon enrollment, you select a &quot;Protection Price.&quot; This price is a fixed threshold and is not subject to change during the active membership term.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">3.2 The Market Index</h3>
            <p>
              PumpLock utilizes third-party retail fuel price data (the &quot;Index&quot;). You agree that this Index is the sole and final authority for all benefit calculations. PumpLock does not guarantee that the Index will reflect the price at any specific gas station.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">3.3 Benefit Trigger</h3>
            <p>
              A Membership Benefit is earned ONLY if the Actual Monthly Average of the Index in your registered Zip Code exceeds your Protection Price.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">3.4 Formula</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 my-3 font-mono text-sm text-gray-800">
              (Monthly Average Index &minus; Protection Price) &times; Gallon Tier = Membership Benefit
            </div>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">3.5 Maximum Benefit</h3>
            <p>
              To ensure the stability of the PumpLock platform, the maximum benefit payable per gallon is capped at <strong>$2.50</strong>, regardless of market volatility.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">4. PAYMENTS AND NON-REFUNDABILITY</h2>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">4.1 Fees</h3>
            <p>
              Membership fees are determined dynamically based on market volatility and the &quot;spread&quot; of your chosen Protection Price.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">4.2 Final Sale</h3>
            <p className="font-semibold">
              ALL MEMBERSHIP FEES ARE NON-REFUNDABLE. Because PumpLock immediately allocates capital to secure market positions to fulfill potential benefits, memberships cannot be canceled, reversed, or refunded once the transaction is processed.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">4.3 Payment Authorization</h3>
            <p>
              By providing a payment method, you authorize PumpLock to charge the total membership fee upfront and to use the same method for any automated benefit credits.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">5. INTELLECTUAL PROPERTY</h2>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">5.1 Ownership</h3>
            <p>
              All content, software, logos, and &quot;Price Shield&quot; technology are the exclusive property of PumpLock, Inc.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">5.2 License</h3>
            <p>
              You are granted a limited, non-exclusive, non-transferable license to access the PumpLock platform for personal use only.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">6. TERMINATION AND MODIFICATION</h2>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">6.1 Corporate Discretion</h3>
            <p>
              PumpLock reserves the right to modify or discontinue the service at any time.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">6.2 Sole Remedy</h3>
            <p>
              If PumpLock terminates your membership for reasons other than your breach of these terms, your sole and exclusive remedy is a pro-rata refund of the unearned portion of your membership fee.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">7. DISCLAIMER OF WARRANTIES</h2>
            <p className="font-semibold uppercase">
              THE SERVICE IS PROVIDED &quot;AS IS.&quot; PUMPLOCK DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">8. LIMITATION OF LIABILITY</h2>
            <p className="font-semibold uppercase">
              TO THE MAXIMUM EXTENT PERMITTED BY DELAWARE LAW, PUMPLOCK, INC. AND ITS DIRECTORS SHALL NOT BE LIABLE FOR ANY CONSEQUENTIAL, INDIRECT, OR SPECIAL DAMAGES. OUR AGGREGATE LIABILITY SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">9. DISPUTE RESOLUTION (ARBITRATION)</h2>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">9.1 Binding Arbitration</h3>
            <p>
              Any dispute shall be resolved via binding arbitration in Miami, Florida, under the rules of the American Arbitration Association.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">9.2 Class Action Waiver</h3>
            <p className="font-semibold">
              YOU AGREE TO BRING CLAIMS ONLY IN YOUR INDIVIDUAL CAPACITY AND WAIVE THE RIGHT TO A CLASS ACTION.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">10. GOVERNING LAW</h2>
            <p>
              This Agreement is governed by the laws of the State of Delaware.
            </p>
          </section>

          <section className="border-t border-gray-200 pt-6 mt-8">
            <p className="text-sm text-gray-500">
              Questions about this agreement? <Link href="/contact" className="text-emerald-600 hover:text-emerald-700">Contact us</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
