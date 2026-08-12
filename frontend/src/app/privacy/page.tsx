import { InformationPage } from "@/components/information-page";

export default function PrivacyPage() {
  return <InformationPage eyebrow="Privacy" title="How NyumbaPap handles your information">
    <p className="notice">This notice explains the product's current data practices. It must receive qualified Kenyan legal review before production launch.</p>
    <h2>Information we collect</h2><p>We collect account details such as your name and phone number, professional verification records, listing information, enquiries, viewing requests, reports, payment references, security logs, and consent choices. Exact addresses, contact details, identity records, and coordinates are treated as restricted information.</p>
    <h2>Why we use it</h2><p>We use information to operate accounts, verify landlords and listings, process M-Pesa payments, release protected contact details after payment, coordinate viewings, investigate reports, prevent fraud, comply with law, and improve the service when analytics consent has been given.</p>
    <h2>Payments and sharing</h2><p>M-Pesa transactions are processed through Safaricom Daraja. We send the minimum transaction data required for the payment. We may use vetted hosting, storage, messaging, monitoring, and verification providers acting under appropriate safeguards. We do not sell personal information.</p>
    <h2>Analytics choices</h2><p>Optional product analytics is disabled until you choose "Allow analytics." You can clear the site's local storage to reset that choice. Essential security, session, and fraud-prevention processing does not depend on analytics consent.</p>
    <h2>Retention and security</h2><p>Restricted fields are encrypted, access to protected contact information is audited, and public listing responses exclude exact location and contact data. Retention periods must follow operational, legal, tax, dispute, and fraud-prevention requirements; records are deleted or anonymised when no longer required.</p>
    <h2>Your rights</h2><p>Subject to applicable Kenyan law, you may ask to access, correct, object to processing of, or delete eligible personal information. You may also raise a privacy complaint. Use the authenticated support route described on the Help page so we can verify your identity before acting.</p>
    <h2>International processing and changes</h2><p>Some service providers may process data outside Kenya. Production deployment must document locations and safeguards. Material changes to this notice will be dated and communicated in the application.</p>
  </InformationPage>;
}
