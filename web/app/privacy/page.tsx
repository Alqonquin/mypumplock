import Link from "next/link";
import { PumpLockLogo } from "@/components/pumplock-logo";

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-1">PUMPLOCK, INC. PRIVACY POLICY</h1>
        <p className="text-sm text-gray-400 mb-8">Last Updated: March 19, 2026</p>

        <div className="prose prose-gray prose-sm max-w-none space-y-6 text-gray-700 leading-relaxed">
          <p>
            PumpLock, Inc. (&quot;PumpLock,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you use the PumpLock platform and membership services.
          </p>
          <p>
            By creating an account or purchasing a membership, you consent to the practices described in this policy.
          </p>

          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">1. INFORMATION WE COLLECT</h2>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">1.1 Information You Provide</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account information:</strong> name, email address, and password (stored only as a cryptographic hash; PumpLock never stores plaintext passwords).</li>
              <li><strong>Location data:</strong> primary fueling Zip Code, city, and state, used to determine your local fuel market index.</li>
              <li><strong>Vehicle information:</strong> year, make, model, and fuel type, used to estimate your monthly fuel consumption.</li>
              <li><strong>Membership details:</strong> selected Protection Price, coverage term, gallon tier, and payment information.</li>
            </ul>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">1.2 Information from Third-Party Authentication</h3>
            <p>
              If you sign in using Google or another third-party provider, we receive your name and email address from that provider. We do not access your contacts, calendar, files, or any other data from your third-party account.
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">1.3 Automatically Collected Information</h3>
            <p>
              When you use the PumpLock platform, we may automatically collect device type, browser type, IP address, and general usage data (pages visited, features used). This information is used solely to maintain and improve the service.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">2. HOW WE USE YOUR INFORMATION</h2>
            <p>PumpLock, Inc. uses the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Provide, administer, and manage your membership and price-shielding benefits.</li>
              <li>Calculate personalized membership pricing based on your location, vehicle, and market conditions.</li>
              <li>Process membership payments and issue benefit credits when the market index exceeds your Protection Price.</li>
              <li>Send transactional communications including membership confirmations, benefit notifications, and expiration reminders.</li>
              <li>Comply with legal obligations, resolve disputes, and enforce our <Link href="/terms" className="text-emerald-600 hover:text-emerald-700">Membership Agreement</Link>.</li>
              <li>Improve the PumpLock platform, develop new features, and conduct internal analytics.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">3. INFORMATION SHARING AND DISCLOSURE</h2>
            <p>
              PumpLock, Inc. does not sell, rent, or trade your personal information. We disclose data only in the following circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Payment processors:</strong> to process membership fees and issue benefit credits to your designated payment method.</li>
              <li><strong>Service providers:</strong> hosting, cloud infrastructure, email delivery, and analytics services that operate under contractual obligations to protect your data.</li>
              <li><strong>Legal compliance:</strong> when required by law, subpoena, court order, or governmental regulation, or when we believe disclosure is necessary to protect the rights, property, or safety of PumpLock, Inc., our members, or the public.</li>
              <li><strong>Corporate transactions:</strong> in connection with a merger, acquisition, or sale of assets, in which case your information would be transferred subject to this Privacy Policy.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">4. DATA SECURITY</h2>
            <p>
              PumpLock, Inc. employs industry-standard security measures to protect your information, including:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Encrypted connections (TLS/SSL) for all data in transit.</li>
              <li>Cryptographic password hashing (bcrypt) — we never store or have access to your plaintext password.</li>
              <li>Role-based access controls limiting employee access to member data.</li>
              <li>Secure cloud infrastructure with regular security audits.</li>
            </ul>
            <p className="mt-2">
              No method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">5. COOKIES AND TRACKING</h2>
            <p>
              PumpLock uses essential cookies solely to maintain your authenticated session. We do not use third-party advertising cookies, tracking pixels, or behavioral profiling technologies.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">6. DATA RETENTION</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide services. If you request account deletion, we will remove your personal data within 30 days, except where retention is required for legal, accounting, or regulatory purposes. Anonymized and aggregated data (which cannot identify you) may be retained indefinitely for analytics.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">7. YOUR RIGHTS</h2>
            <p>
              Depending on your jurisdiction, you may have the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Access</strong> the personal information we hold about you.</li>
              <li><strong>Correct</strong> inaccurate or incomplete information.</li>
              <li><strong>Delete</strong> your account and associated personal data.</li>
              <li><strong>Opt out</strong> of non-essential communications.</li>
              <li><strong>Data portability</strong> — receive a copy of your data in a machine-readable format.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, please <Link href="/contact" className="text-emerald-600 hover:text-emerald-700">contact us</Link>. We will respond within 30 days.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">8. CALIFORNIA RESIDENTS</h2>
            <p>
              If you are a California resident, the California Consumer Privacy Act (CCPA) provides you with additional rights regarding your personal information, including the right to know what data we collect, the right to delete, and the right to opt out of the sale of personal information. PumpLock does not sell personal information. To exercise your CCPA rights, please <Link href="/contact" className="text-emerald-600 hover:text-emerald-700">contact us</Link>.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">9. CHILDREN&apos;S PRIVACY</h2>
            <p>
              PumpLock is not intended for individuals under 18 years of age. We do not knowingly collect personal information from minors. If we learn that we have collected information from a child under 18, we will delete it promptly.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">10. CHANGES TO THIS POLICY</h2>
            <p>
              PumpLock, Inc. may update this Privacy Policy from time to time. We will notify you of material changes via email to the address associated with your account or by posting a prominent notice on the platform. Your continued use of PumpLock after such changes constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">11. GOVERNING LAW</h2>
            <p>
              This Privacy Policy is governed by the laws of the State of Delaware, consistent with the <Link href="/terms" className="text-emerald-600 hover:text-emerald-700">PumpLock, Inc. Membership Agreement</Link>.
            </p>
          </section>

          <section className="border-t border-gray-200 pt-6 mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">12. CONTACT</h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your data rights, please <Link href="/contact" className="text-emerald-600 hover:text-emerald-700">contact us</Link>.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mt-3 text-sm text-gray-600">
              <strong>PumpLock, Inc.</strong><br />
              Attn: Privacy<br />
              Miami, Florida<br />
              <Link href="/contact" className="text-emerald-600 hover:text-emerald-700">pumplock.com/contact</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
