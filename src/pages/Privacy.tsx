import { Link } from "react-router-dom";
import { LegalLayout } from "../components/marketing/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Privacy Policy"
      updated="12 September 2026"
      intro={
        <>
          This policy explains what Ohshi (<strong>ohshi.space</strong>) collects, why, where it goes and how long it
          stays. The short version: we keep the minimum needed to run the Service, we encrypt provider tokens and
          pasted keys, we don&apos;t run ads or sell data, and prompts for a connected provider go to that provider
          under your own account. It sits alongside our{" "}
          <Link to="/terms" className="text-accent underline underline-offset-4">
            Terms and Conditions
          </Link>
          .
        </>
      }
    >
      <h2 id="collect">1. What we collect</h2>
      <h3>Account</h3>
      <ul>
        <li>Your email address and, when you sign in with a password, a password hash (Argon2id, we never store the password itself).</li>
        <li>When sign-in is through Clerk, Clerk&apos;s user id and the email and name Clerk sends us.</li>
        <li>An optional display name.</li>
        <li>The date you accepted the Terms, and which version.</li>
      </ul>
      <h3>Connected accounts and pasted keys</h3>
      <ul>
        <li>The email address and identifier of each Google, ChatGPT or DeepSeek chat account you connect.</li>
        <li>
          OAuth access and refresh tokens, session tokens, and pasted Gemini or DeepSeek API keys,{" "}
          <strong>encrypted at rest</strong> with a key that is not stored alongside the database. For a DeepSeek chat
          account we also keep the password encrypted so a dropped session can sign in again.
        </li>
        <li>Health information about each connection or key: when it last worked, the last error, latency.</li>
      </ul>
      <h3>Content</h3>
      <ul>
        <li>Chats you create in the workspace: your messages and the model's replies, including any reasoning trace.</li>
        <li>
          For API requests (<code>/v1</code>) we store <strong>metadata only</strong>: model, token counts, timing,
          status and any error. We do <strong>not</strong> store the prompts or responses themselves.
        </li>
      </ul>
      <h3>Keys and sessions</h3>
      <ul>
        <li>API keys are stored as SHA-256 hashes plus a short display prefix; the full key is shown to you once.</li>
        <li>For sign in sessions: a random session token (hashed), the IP address and browser user agent, and timestamps.</li>
      </ul>
      <h3>Cookies and local storage</h3>
      <ul>
        <li>
          One strictly necessary session cookie (<code>ohshi_session</code>) that keeps you signed in. No advertising or
          analytics cookies.
        </li>
        <li>Your theme, sidebar and last-used-model preferences are kept in your browser's local storage only.</li>
      </ul>

      <h2 id="use">2. How we use it</h2>
      <ul>
        <li>To operate the Service: sign you in, call models on your behalf, show your chats and quota.</li>
        <li>To keep it safe: rate limiting, abuse detection, debugging failures.</li>
        <li>To show you your own usage in the dashboard.</li>
        <li>To contact you about the Service, such as material changes to these policies or security issues.</li>
      </ul>
      <p>We do not use your content to train models, we do not profile you for advertising, and we do not sell data.</p>

      <h2 id="sharing">3. Where your data goes</h2>
      <p>
        <strong>Polar</strong> (Polar Software Inc.) sells paid plans as merchant of record and
        processes the payment. Your card details go to Polar, never to Ohshi; when you start a
        checkout we pass Polar your account id and email address so the purchase can be matched
        to your account and so it can send you invoices. On our side we store only your plan,
        Polar&apos;s customer and subscription identifiers, and the signed billing events Polar
        sends us. Where PayPal is offered instead, the same applies to PayPal. Each processor&apos;s
        handling of your data is governed by its own privacy policy.
      </p>
      <ul>
        <li>
          <strong>Model providers.</strong> Prompts, chat history sent as context, and model settings for a connected
          source are transmitted to that provider (Google, DeepSeek, OpenAI, or Ohshi&apos;s own host for OHS3).
          Each provider&apos;s handling of that data is governed by its own privacy policy. Ohshi is not a party to
          that relationship.
        </li>
        <li>
          <strong>Hosting.</strong> The Service runs on Railway (railway.com) infrastructure. Data is stored on
          Railway-managed volumes or databases in the region of our deployment.
        </li>
        <li>
          <strong>Clerk.</strong> When this deployment signs in through Clerk, your email and sign-in events are
          processed by Clerk under its own policy.
        </li>
        <li>
          <strong>Legal.</strong> We may disclose data if required by law or to protect the rights and safety of users
          or the Service.
        </li>
      </ul>
      <p>We do not share data with anyone else.</p>

      <h2 id="retention">4. How long we keep it</h2>
      <ul>
        <li>Sign-in sessions: 30 days of inactivity, then deleted.</li>
        <li>Pending Google sign in state: 15 minutes.</li>
        <li>API usage metadata: 90 days, then pruned automatically.</li>
        <li>Chats: until you delete them.</li>
        <li>Provider tokens and pasted keys: until you disconnect or revoke them, delete your account, or the provider invalidates them.</li>
        <li>Your account: until you ask us to delete it.</li>
      </ul>

      <h2 id="security">5. Security</h2>
      <p>
        Provider tokens and pasted keys are encrypted at rest; passwords are hashed with Argon2id; traffic is encrypted
        in transit with TLS; ohs_ keys are stored hashed; sessions are HttpOnly cookies protected against cross-site
        requests. No system is perfectly secure. If we learn of a breach affecting you, we will tell you without undue
        delay.
      </p>

      <h2 id="rights">6. Your choices and rights</h2>
      <ul>
        <li>Disconnect a connected account or revoke a pasted key at any time from the accounts page; this deletes the credentials we hold.</li>
        <li>
          To revoke Ohshi on Google's side too, remove it under your Google account's third party access settings.
        </li>
        <li>Delete individual chats from the sidebar. Revoke API keys from the keys page.</li>
        <li>
          To export or delete your account and everything attached to it, email us from the address on the account.
        </li>
        <li>
          Depending on where you live you may have further rights (access, correction, portability, objection,
          complaint to a supervisory authority). We honour them regardless of location. Just ask.
        </li>
      </ul>

      <h2 id="children">7. Children</h2>
      <p>The Service is not directed at anyone under 18, and we do not knowingly collect their data.</p>

      <h2 id="transfers">8. International transfers</h2>
      <p>
        Our hosting provider and Google may process data outside your country. Where required, we rely on standard
        contractual safeguards offered by those providers.
      </p>

      <h2 id="changes">9. Changes to this policy</h2>
      <p>
        We will post updates here and change the date above. For material changes we will also notify you in the app
        or by email before they take effect.
      </p>

      <h2 id="contact">10. Contact</h2>
      <p>
        Privacy questions or requests: <a href="mailto:support@ohshi.space">support@ohshi.space</a>.
      </p>
    </LegalLayout>
  );
}
