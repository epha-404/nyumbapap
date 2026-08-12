import { InformationPage } from "@/components/information-page";

export default function HelpPage() {
  return <InformationPage eyebrow="Help and safety" title="Get help and stay safe">
    <h2>Before you pay or visit</h2><ul><li>Never pay a deposit before viewing the home and confirming who controls it.</li><li>Check the rent, deposit, utilities, and any agent fee in writing.</li><li>Do not share OTPs, M-Pesa PINs, passwords, or identity-document copies in messages.</li><li>Meet during daylight where possible and tell someone where you are going.</li></ul>
    <h2>Payments</h2><p>An STK prompt should show the expected amount and recipient context. Cancel an unexpected prompt. Contact access is released only after NyumbaPap receives a verified M-Pesa callback. If your phone shows a charge but the application remains pending, keep the M-Pesa receipt and do not pay twice.</p>
    <h2>Report a listing</h2><p>Signed-in home seekers can report fraud, safety concerns, misleading details, duplicates, or properties that are no longer available from the listing workflow. Reports are reviewed; confirmed issues may result in immediate takedown.</p>
    <h2>Account or privacy help</h2><p>Use your signed-in dashboard support flow for account access, payment reconciliation, privacy requests, or complaints. Production launch must publish monitored emergency escalation and Data Protection Officer contact details here.</p>
    <h2>Emergencies</h2><p>NyumbaPap is not an emergency service. If someone is in immediate danger, contact the appropriate local emergency or law-enforcement service.</p>
  </InformationPage>;
}
