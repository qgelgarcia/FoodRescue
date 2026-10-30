import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileText, HelpCircle, Info, MessageCircle, Shield } from 'lucide-react';
import './profile-help.css';

const questions = [
  ['How do I reserve food?', 'Open a listing, choose your portions and submit a claim. Your portions are reserved while the donor reviews it. Wait for acceptance before heading to pickup.'],
  ['How is pickup confirmed?', 'Show your accepted claim’s QR or manual code from My Claims. The listing’s donor verifies it when handing over the full reserved quantity. You cannot confirm your own pickup.'],
  ['Can I cancel a claim?', 'Open My Claims and request cancellation with an explanation. Your portions stay reserved until the donor approves. If the donor denies the request, your previous claim status stays in place.'],
  ['What happens at the deadline?', 'New claims and pickup confirmation stop at the pickup deadline. Uncollected accepted claims expire and remain in your history. Only donor-confirmed pickups count toward rescued portions.'],
  ['Do I have to share my location?', 'No. You can view the pickup pin without GPS. On my way sends a departure notice; sharing your location requires separate consent. You can stop sharing without cancelling the claim.'],
  ['Where do I report a concern?', 'Use My Reports for a concern about a listing or member. Explain what happened, then track the report as open, reviewed or resolved. The admin’s resolution explanation appears with your report.'],
];

const topics = [
  { id: 'faq', title: 'FAQ', description: 'Common questions about rescues', Icon: HelpCircle,
    content: <dl className="profile-help-questions">{questions.map(([question, answer]) => <div key={question}><dt>{question}</dt><dd>{answer}</dd></div>)}</dl> },
  { id: 'about', title: 'About Us', description: 'Our campus sustainability mission', Icon: Info,
    content: <>
      <p>FoodRescue connects campus members who have surplus food with members who can collect it. The aim is to make available portions easier to find and keep useful food from going to waste.</p>
      <p>Donors publish food details, portions, a pickup pin and a deadline. Claimants reserve portions, wait for approval and meet the donor for verified pickup. Campus admins review reports and moderate listings and accounts.</p>
      <p>Your profile totals come from verified pickups. A reservation or departure notice does not count as food collected.</p>
      <Link to="/app/home-feed">Browse available food</Link>
    </> },
  { id: 'terms', title: 'Terms of Service', description: 'Rules and usage guidelines', Icon: FileText,
    content: <>
      <h4>Community use guidelines</h4>
      <p>Use FoodRescue to arrange honest, respectful sharing within the campus community.</p>
      <ul>
        <li>Keep your profile and listing details accurate. Describe the food, known ingredients or allergens, portions and pickup arrangements clearly.</li>
        <li>Request only portions you intend to collect. Wait for donor approval and arrive before the pickup deadline.</li>
        <li>If plans change, use the cancellation workflow and explain why. Do not assume a request is cancelled until the donor approves.</li>
        <li>Confirm pickup only when the full reserved quantity is handed over. Do not share your pickup code with unrelated people.</li>
        <li>Do not post misleading content, harass other members or misuse reports. Admins may suspend accounts or remove listings with explanations.</li>
      </ul>
      <p>The pickup deadline controls availability; it is not a guarantee of food condition. If the food or arrangements differ from the listing, raise the concern with the donor and use reporting when appropriate.</p>
    </> },
  { id: 'privacy', title: 'Privacy Policy', description: 'How we protect your data', Icon: Shield,
    content: <>
      <h4>Information used by the app</h4>
      <p>FoodRescue uses your sign-in account, profile name, optional phone number, listings, claims and notifications to coordinate sharing. Reports and moderation records support admin review. Supabase provides the app’s authentication, database and photo storage.</p>
      <h4>Listings and photos</h4>
      <p>Listing details and pickup pins are shown to people browsing food. Uploaded food photos use public image URLs. Avoid including private documents, contact information or other people’s details in photos and descriptions.</p>
      <h4>Optional journey location</h4>
      <p>Location sharing requires your consent. Only the donor for that claim can read the latest shared coordinates. The app stores a current point rather than a route history. Foreground updates pause when you leave the sharing view or hide the app.</p>
      <p>Stopping sharing deletes that point. Pickup, effective cancellation, post removal and expiration also end sharing. Deadline access stops immediately; scheduled cleanup removes expired location records.</p>
      <h4>History and concerns</h4>
      <p>Claims, reports and moderation records remain available as history; cancelling an arrangement does not erase those records. Reporters can view their own reports, and authorized admins review them. Map views request tiles from OpenStreetMap’s tile service.</p>
      <p>For questions about your account or stored information, email <a href="mailto:FoodRescue@gmail.com">FoodRescue@gmail.com</a>. Never include your password or pickup code in a report.</p>
    </> },
  { id: 'support', title: 'Contact Support', description: 'Get help with your account', Icon: MessageCircle,
    content: <>
      <h4>Listing or member concerns</h4>
      <p>Open Reports &amp; Support, select the listing or member, and explain what happened. You can check your own report status and resolution there. Submitting a report does not cancel an existing pickup.</p>
      <Link to="/app/reports">Open Reports &amp; Support</Link>
      <h4>Account access or technical problems</h4>
      <p>Email <a href="mailto:FoodRescue@gmail.com">FoodRescue@gmail.com</a>. Include the page, approximate time, steps to reproduce the issue and a screenshot if available. In-app reports require a listing or member target.</p>
      <p>Never send passwords, sign-in codes or pickup tokens. This screen does not provide live chat or emergency assistance.</p>
    </> },
];

export default function ProfileHelp() {
  return <div className="profile-help">
    {topics.map(({ id, title, description, Icon, content }) => <details key={id} id={`help-${id}`}>
      <summary>
        <span className="profile-help-icon"><Icon size={18} aria-hidden="true" /></span>
        <span className="profile-help-label"><strong>{title}</strong><span>{description}</span></span>
        <ChevronRight className="profile-help-chevron" size={18} aria-hidden="true" />
      </summary>
      <div className="profile-help-content">{content}</div>
    </details>)}
  </div>;
}
