export { POLICY_EFFECTIVE_DATE } from "@/src/modules/marketplace/policies/constants";

export type PolicyKind = "delivery" | "privacy" | "returns" | "terms";

export type PolicySection = {
  bullets?: readonly string[];
  id: string;
  note?: string;
  paragraphs: readonly string[];
  title: string;
};

export type PolicyDocument = {
  description: string;
  eyebrow: string;
  kind: PolicyKind;
  sections: readonly PolicySection[];
  shortTitle: string;
  title: string;
};

export const policyLinks = [
  {
    description: "How we collect, use, protect, and share personal information.",
    href: "/privacy-policy",
    kind: "privacy",
    label: "Privacy Policy",
  },
  {
    description: "The rules that apply when you use our store or place an order.",
    href: "/terms-and-conditions",
    kind: "terms",
    label: "Terms & Conditions",
  },
  {
    description: "Your options when an order is cancelled, damaged, or unsuitable.",
    href: "/returns-and-refunds",
    kind: "returns",
    label: "Returns & Refunds",
  },
  {
    description: "How delivery quotes, timing, handover, and exchanges work.",
    href: "/delivery-information",
    kind: "delivery",
    label: "Delivery Information",
  },
] as const;

export const privacyPolicy: PolicyDocument = {
  description:
    "This policy explains what personal information Jurgens Energy handles, why we use it, who may receive it, and the choices available to you.",
  eyebrow: "Your information",
  kind: "privacy",
  shortTitle: "Privacy Policy",
  title: "Privacy Policy",
  sections: [
    {
      id: "scope",
      title: "1. Who this policy applies to",
      paragraphs: [
        "Jurgens Energy operates this online store and is the responsible party for personal information processed through the website, customer accounts, checkout, order support, and our direct communications with you.",
        "This policy applies when you browse the store, create an account, place or discuss an order, request a cylinder exchange, contact support, or communicate with us through WhatsApp, email, telephone, or another channel. A third-party website or service linked from our store has its own privacy practices.",
      ],
    },
    {
      id: "information-we-collect",
      title: "2. Information we collect",
      paragraphs: [
        "We collect only information that is reasonably needed to run the store, fulfil orders, support customers, keep the service secure, and meet our legal obligations.",
      ],
      bullets: [
        "Contact and identity details, such as your name, email address, telephone number, and account identifiers.",
        "Order and fulfilment details, including products, quantities, delivery address, delivery instructions, order history, and cylinder-exchange information.",
        "Payment-related records, such as the payment method type, payment status, and transaction reference. Payment providers process card or bank credentials under their own security and privacy terms; we do not need your card PIN or online-banking password.",
        "Messages and support records, including WhatsApp conversations, emails, call notes, requests, complaints, and return or refund information.",
        "Device and usage information, such as IP address, browser and device type, pages viewed, referring links, approximate location derived from an IP address, and security or diagnostic logs.",
        "Preferences you choose, including language, currency, theme, cookie choices, and communication preferences.",
      ],
    },
    {
      id: "collection-sources",
      title: "3. How we receive information",
      paragraphs: [
        "Most information comes directly from you when you use the store or contact us. We may also receive limited information automatically from your browser, or from service providers involved in authentication, payments, delivery, analytics, fraud prevention, or communications.",
        "If another person places an order for you or gives us your details as a recipient, that person must be authorised to do so and must make you aware that your details will be used for delivery and order support.",
      ],
    },
    {
      id: "how-we-use-information",
      title: "4. Why we use information",
      paragraphs: [
        "We process personal information in accordance with the Protection of Personal Information Act, 2013 (POPIA) and other applicable South African law. Depending on the situation, processing may be necessary to perform an order, comply with law, pursue a legitimate operational interest, protect a lawful interest, or act with your consent.",
      ],
      bullets: [
        "Create and manage accounts, carts, orders, payments, deliveries, collections, exchanges, returns, and refunds.",
        "Confirm availability, delivery details, safety requirements, and the status of an order.",
        "Respond to questions, investigate problems, prevent fraud or abuse, and secure the website and our records.",
        "Keep accounting, tax, audit, transaction, and compliance records.",
        "Measure and improve the store, products, communications, and customer experience.",
        "Send marketing only where we have consent or another lawful basis, and honour opt-out requests.",
      ],
    },
    {
      id: "sharing",
      title: "5. When information is shared",
      paragraphs: [
        "We do not sell or rent personal information. We may share the minimum information needed with trusted operators and other recipients who help us provide the service or meet a legal obligation.",
      ],
      bullets: [
        "Hosting, database, authentication, security, analytics, customer-support, and other technology providers.",
        "Payment processors, banks, and fraud-prevention providers involved in a transaction.",
        "Couriers, delivery partners, suppliers, or collection teams that need order and contact details to fulfil an order.",
        "Communications providers, including WhatsApp or Meta where you choose to communicate through WhatsApp, and email or messaging providers where used.",
        "Professional advisers, insurers, auditors, regulators, law-enforcement bodies, or courts where disclosure is lawful and necessary.",
        "A successor or purchaser in a genuine restructuring or sale, subject to appropriate confidentiality and legal safeguards.",
      ],
    },
    {
      id: "cookies-and-analytics",
      title: "6. Cookies, local storage, and analytics",
      paragraphs: [
        "The website uses cookies or similar browser storage for essential functions such as security, sign-in, cart contents, currency, theme, marketplace access, and remembering your privacy choices. Essential storage is required for those functions and is not used to create an advertising profile.",
        "Where configured, Google Analytics and Google Ads may measure page visits, product interactions, enquiries, completed purchases, and which campaign led to an order. These optional tools start with analytics and advertising storage denied. They receive the choice made through the cookie controls, and the advertising-attribution record is stored only after advertising consent. A captured campaign record may include UTM campaign values or a Google click identifier and is retained for up to 90 days so that an order can be attributed to the campaign that led to it.",
        "You can change or withdraw optional consent at any time through Cookie settings. Withdrawal updates Google Consent Mode, removes applicable first-party measurement cookies that are accessible to the website, and clears our campaign-attribution cookie. You can also limit or delete browser storage through your browser settings. Blocking essential storage may prevent sign-in, checkout, saved preferences, or other parts of the store from working correctly.",
      ],
    },
    {
      id: "whatsapp",
      title: "7. WhatsApp and electronic communications",
      paragraphs: [
        "When you contact us on WhatsApp, we use the conversation and your number to answer questions, support an order, and keep a record of the interaction. Automated replies may assist first, and a team member may take over a conversation. WhatsApp and Meta also process information under their own terms.",
        "Service messages about an enquiry or order are different from marketing. We send electronic marketing only as permitted by law and provide a practical way to opt out. You may reply STOP or ask us through any listed contact channel to stop marketing. Opting out of marketing does not prevent essential order, safety, or account messages.",
      ],
    },
    {
      id: "cross-border",
      title: "8. Processing outside South Africa",
      paragraphs: [
        "Some technology, communications, payment, or support providers may process information outside South Africa. Where that occurs, we take reasonable steps to use providers and arrangements that support protection consistent with POPIA, including contractual safeguards or another lawful basis for the transfer.",
      ],
    },
    {
      id: "security-and-retention",
      title: "9. Security and retention",
      paragraphs: [
        "We use reasonable technical and organisational safeguards appropriate to the information and the risks involved. No online service can promise absolute security, so please protect your account credentials and tell us promptly if you suspect unauthorised activity.",
        "We keep information only for as long as it is reasonably needed for the purposes described here, including fulfilment, customer support, fraud prevention, accounting, tax, dispute, warranty, and legal requirements. When information is no longer required, we delete, destroy, or de-identify it in line with our operational and backup processes.",
      ],
    },
    {
      id: "your-rights",
      title: "10. Your privacy rights",
      paragraphs: [
        "Subject to POPIA and appropriate identity verification, you may ask whether we hold personal information about you, request access to it, ask us to correct or delete inaccurate or unlawfully held information, object to certain processing, or withdraw consent where consent is the basis for processing.",
        "You may also lodge a complaint with South Africa’s Information Regulator. We encourage you to contact us first so that we can understand and address the concern promptly. Some records cannot be deleted immediately where retention is required by law or needed for a lawful claim or transaction record.",
      ],
    },
    {
      id: "children-and-changes",
      title: "11. Children and policy changes",
      paragraphs: [
        "The store is intended for adults who can lawfully place orders and handle LPG-related purchases. We do not knowingly invite children to create customer accounts or place orders without an authorised adult.",
        "We may update this policy when our services, providers, or legal duties change. The effective date at the top identifies the current version. Material changes will be communicated through the website or another appropriate channel.",
      ],
    },
    {
      id: "contact",
      title: "12. Contact us",
      paragraphs: [
        "Use the contact details in the footer to make a privacy request, withdraw marketing consent, report a security concern, or ask a question about this policy. Please describe the request clearly and include enough information for us to locate the relevant account or order. We may ask for proof of identity before disclosing or changing personal information.",
      ],
    },
  ],
};

export const termsAndConditions: PolicyDocument = {
  description:
    "These terms set out how the Jurgens Energy online store, orders, payments, deliveries, cylinder exchanges, and customer responsibilities work.",
  eyebrow: "Using our store",
  kind: "terms",
  shortTitle: "Terms & Conditions",
  title: "Terms & Conditions",
  sections: [
    {
      id: "agreement",
      title: "1. Agreement and eligibility",
      paragraphs: [
        "These terms apply when you browse or use the Jurgens Energy online store, create an account, place an order, or order through a connected channel such as WhatsApp. By completing an order, you agree to these terms and the policies linked from this page.",
        "You must be at least 18 years old, have legal capacity to transact, and provide accurate information. If you order for a business or another person, you confirm that you are authorised to bind or act for them.",
      ],
    },
    {
      id: "products",
      title: "2. Product information and availability",
      paragraphs: [
        "We aim to describe products, sizes, brands, exchange options, compatibility, images, and stock accurately. Screen colours and product packaging may vary, and a manufacturer may make non-material changes. Please check dimensions, connections, appliance requirements, and intended use before ordering an accessory or LPG product.",
        "Stock indicators are not a reservation. Products, exchange options, delivery areas, and quantities remain subject to availability and any lawful safety or supply restrictions. We will contact you if an ordered item cannot be supplied as described.",
      ],
    },
    {
      id: "pricing",
      title: "3. Prices, VAT, and promotions",
      paragraphs: [
        "Product prices displayed by the store are VAT-inclusive unless a product clearly states otherwise. Delivery, handling, deposit, exchange, or other applicable charges are shown separately before you confirm the order where they apply.",
        "A non-ZAR currency selection is a display convenience based on an exchange rate available to the store. The checkout total and payment-provider confirmation govern the amount charged. Promotions apply only for their stated period and conditions and may not be combined unless expressly allowed.",
        "If a price, description, discount, or calculation contains an obvious error, we may correct it before accepting the order. We will ask whether you want to proceed at the corrected amount or cancel, and will refund any amount already paid for an order we cannot accept.",
      ],
    },
    {
      id: "orders",
      title: "4. Placing and accepting an order",
      paragraphs: [
        "Adding an item to a cart, submitting a checkout, or sending an order request through WhatsApp does not by itself guarantee acceptance. An order is accepted when we confirm that it has been accepted for fulfilment, dispatch, delivery, or collection.",
        "We may reasonably refuse or cancel an order before fulfilment because of unavailable stock, an unsupported delivery address, a failed or reversed payment, suspected fraud, an obvious catalogue error, a safety concern, or a legal restriction. If we cancel after receiving cleared payment, we will arrange the appropriate refund.",
      ],
    },
    {
      id: "payment",
      title: "5. Payment",
      paragraphs: [
        "Available payment methods are shown at checkout or confirmed during an assisted order. A payment may be processed by an independent payment provider and remains subject to that provider’s verification and security checks.",
        "You authorise the disclosed order total when submitting payment. We do not ask for your card PIN, one-time password, or online-banking password in a support message. Tell us immediately if a payment confirmation or request appears suspicious.",
      ],
    },
    {
      id: "delivery",
      title: "6. Delivery and collection",
      paragraphs: [
        "Delivery availability, fees, and estimated timing depend on the address, products, stock, vehicle or courier capacity, and LPG handling requirements. A time shown before acceptance is an estimate unless we expressly agree to a fixed time.",
        "You must provide a complete, accessible address and a working telephone number, and ensure that an authorised adult can receive the order. Products remain at our risk until accepted at the agreed delivery point, subject to applicable law. Additional delivery attempts or address changes may carry a disclosed reasonable charge where the failed delivery was caused by incorrect information or unavailable access.",
      ],
    },
    {
      id: "lpg-and-exchanges",
      title: "7. LPG safety and cylinder exchanges",
      paragraphs: [
        "LPG is hazardous if stored, transported, installed, or used incorrectly. Follow the product instructions and applicable safety rules, keep cylinders upright in a well-ventilated place away from ignition sources, and use a suitably qualified registered gas installer where installation is required.",
        "For an exchange order, you must make the correct empty cylinder available at handover. The cylinder must be of an eligible size and type and must be safe to handle. Exchange eligibility may depend on the applicable brand, ownership, condition, and supplier rules shown with the product or confirmed before fulfilment.",
        "We or a fulfilment partner may refuse to collect or exchange a cylinder that appears unsafe, damaged, modified, illegally filled, leaking, or otherwise ineligible. Never refill, tamper with, vent, or repair a cylinder yourself. If you smell gas or suspect a leak, move away from ignition sources, follow emergency safety guidance, and contact the appropriate emergency or qualified gas service rather than using ordinary customer-support messaging as an emergency service.",
      ],
    },
    {
      id: "cancellations-and-returns",
      title: "8. Cancellations, returns, and refunds",
      paragraphs: [
        "Cancellation and return requests are handled under our Returns & Refunds Policy and applicable consumer law. Contact us as soon as possible with the order number. Do not send a filled cylinder, LPG, or another hazardous item through an ordinary parcel service; we will first confirm a safe return or collection method.",
        "Nothing in these terms removes a right or remedy that cannot lawfully be excluded under the Consumer Protection Act, the Electronic Communications and Transactions Act, or another applicable law.",
      ],
    },
    {
      id: "quality-and-warranties",
      title: "9. Quality, defects, and warranties",
      paragraphs: [
        "Customers receive the statutory rights and implied warranty of quality that apply to the transaction. A manufacturer warranty, if offered, is additional and may have its own fair conditions. Misuse, unauthorised alteration, incorrect installation, accidental damage, and ordinary wear are assessed separately from a product defect, subject always to applicable law.",
        "Report a suspected unsafe or defective product promptly and stop using it where continued use could create a risk. We may request photographs, serial or batch information, or an inspection so that the appropriate repair, replacement, refund, or safety response can be arranged.",
      ],
    },
    {
      id: "accounts-and-website",
      title: "10. Accounts and acceptable use",
      paragraphs: [
        "You are responsible for keeping account credentials confidential and for activity performed through your account unless you promptly report unauthorised access. Do not misuse the website, attempt to bypass security, interfere with its operation, upload malicious material, scrape it in a way that harms the service, or use it for unlawful or fraudulent activity.",
        "We may suspend access where reasonably necessary to secure the service, investigate misuse, comply with law, or protect customers. We will restore access when the reason for suspension has been resolved where reasonably possible.",
      ],
    },
    {
      id: "intellectual-property",
      title: "11. Website content and intellectual property",
      paragraphs: [
        "The website design, Jurgens Energy branding, original text, graphics, and software are protected by applicable intellectual-property law. Product names, marks, and images belonging to manufacturers or other rights holders remain their property. You may use the store for normal personal or business purchasing, but may not reproduce or commercially exploit protected content without permission.",
      ],
    },
    {
      id: "responsibility",
      title: "12. Responsibility and service availability",
      paragraphs: [
        "We take reasonable care in operating the store and fulfilling accepted orders, but the website may occasionally be unavailable for maintenance, security, connectivity, or events outside reasonable control. We will communicate material fulfilment problems and work with you on a lawful, practical resolution.",
        "To the extent permitted by law, neither party is responsible for indirect loss that was not reasonably foreseeable from the transaction. This clause does not exclude liability or consumer rights that may not lawfully be excluded, including liability arising from gross negligence where the law prohibits that exclusion.",
      ],
    },
    {
      id: "privacy-and-messages",
      title: "13. Privacy and communications",
      paragraphs: [
        "Our Privacy Policy explains how personal information is handled. By placing an order, you agree that we may send the service messages reasonably needed to confirm payment, delivery, collection, exchange, safety, return, or support information. Marketing communications follow separate consent and opt-out rules.",
      ],
    },
    {
      id: "law-and-disputes",
      title: "14. Changes, law, and disputes",
      paragraphs: [
        "We may update these terms for future use of the store. The version in effect when an order is accepted continues to govern that order unless a change is required by law or agreed with you. South African law applies.",
        "Please contact us first if a concern arises so that we can investigate and try to resolve it promptly. This does not prevent you from using an applicable ombud, regulator, consumer commission, court, or another remedy available by law.",
      ],
    },
    {
      id: "contact",
      title: "15. Contact details",
      paragraphs: [
        "The store is operated under the Jurgens Energy name. Our current customer-service email address, telephone numbers, and physical or service address, where configured, appear in the footer. Use those details for order notices, cancellations, complaints, or formal questions about these terms.",
      ],
    },
  ],
};

export const returnsAndRefundsPolicy: PolicyDocument = {
  description:
    "Our South African returns policy for new and unused goods, defects, exchanges, by-arrangement handovers, return costs, and refunds.",
  eyebrow: "Order resolutions",
  kind: "returns",
  shortTitle: "Returns & Refunds",
  title: "Returns & Refunds",
  sections: [
    {
      id: "start-a-request",
      title: "1. Start with a return request",
      paragraphs: [
        "This policy applies to orders delivered in South Africa. Contact us before returning any item and include your order number, the affected product, the reason for the request, and photographs where an item is damaged, incorrect, or defective. We will confirm the next step, return reference, collection method, or inspection arrangements.",
        "Do not send LPG, a filled cylinder, or another hazardous item through an ordinary parcel or postal service. Keep the item in a safe, ventilated location and wait for a pre-authorized collection or return-handover plan.",
      ],
    },
    {
      id: "cancelling-before-fulfilment",
      title: "2. Cancelling before fulfilment",
      paragraphs: [
        "Ask us to cancel as soon as possible. If the order has not been accepted, prepared, dispatched, or handed to a delivery partner, we will normally be able to stop it and reverse or refund payment.",
        "If fulfilment has already started, the request may need to be handled as a return. We will explain any direct cost that may lawfully apply before proceeding. A cancellation is not complete until we confirm it.",
      ],
    },
    {
      id: "online-cooling-off",
      title: "3. Seven-day returns for new and unused goods",
      paragraphs: [
        "Where lawful and applicable, we accept a request to return or exchange a non-defective product that remains new and unused when the request is made within seven calendar days after the customer receives it. This includes eligible online cooling-off cancellations under section 44 of the Electronic Communications and Transactions Act.",
        "For a non-defective return or exchange, keep the product unused, undamaged, complete, safely stored, and in its original resaleable packaging where reasonably applicable. Statutory exclusions and product-safety rules may affect the available return method, but they do not remove rights relating to an incorrect, unsafe, or defective product.",
        "Contact us within the seven-day period so that we can authorize the return handover or collection. A customer exercising an eligible cooling-off right may be responsible only for the direct return cost permitted by law. This policy does not limit a longer or additional right provided by applicable law.",
      ],
    },
    {
      id: "unwanted-products",
      title: "4. Requests outside the seven-day window",
      paragraphs: [
        "Outside the seven-day return window or another statutory return right, we may consider a request to return or exchange an unwanted product that is still new, unused, undamaged, complete, and in its original resaleable packaging. Any discretionary acceptance must be confirmed before the item is handed over.",
        "We ordinarily cannot accept a discretionary change-of-mind return for gas that has been used or released, an item that has been installed or altered, a product missing parts, or an item that cannot safely or lawfully be restocked. Your rights for an incorrect, unsafe, or defective product remain unaffected.",
      ],
    },
    {
      id: "wrong-damaged-or-incomplete",
      title: "5. Incorrect, damaged, or incomplete orders",
      paragraphs: [
        "Check the order at handover where reasonably possible. If an item is visibly unsafe, leaking, seriously damaged, or not what you ordered, do not use it and tell the delivery representative or contact us immediately.",
        "Report concealed damage, missing parts, or an incorrect item as soon as reasonably possible after delivery. Once verified, we will arrange the remedy and return transport required by applicable law, which may include correction, replacement, repair, or refund.",
      ],
    },
    {
      id: "defective-or-unsafe",
      title: "6. Defective or unsafe products",
      paragraphs: [
        "Under the Consumer Protection Act, qualifying goods that fail the applicable quality standards may be returned within six months after delivery, without penalty and at the supplier’s risk and expense. The consumer may direct the supplier to repair or replace the goods, or refund the price paid, subject to the Act.",
        "The statutory remedy does not treat ordinary wear, misuse, abuse, incorrect installation, or unauthorised alteration as a product defect. A manufacturer warranty may provide additional cover and does not replace your statutory rights.",
      ],
      note: "Stop using any product that may be unsafe. For a suspected LPG leak, move away from ignition sources and obtain emergency or qualified gas assistance; do not rely on an online return request as an emergency response.",
    },
    {
      id: "cylinder-exchanges",
      title: "7. Cylinder-exchange orders",
      paragraphs: [
        "An exchange price assumes that an eligible empty cylinder is available for collection at the same handover. Size, type, brand or ownership rules, and cylinder condition may affect eligibility. A driver or fulfilment partner may refuse a leaking, modified, severely damaged, illegally filled, or otherwise unsafe cylinder.",
        "If the requested exchange cannot be completed, we will explain the available options, which may include correcting the order, paying the disclosed difference for another eligible option, rescheduling, or cancelling the affected item. If the delivered cylinder appears unsafe or incorrect, do not use it and contact us promptly for an inspection and appropriate remedy.",
      ],
    },
    {
      id: "return-condition",
      title: '8. By-arrangement return handover ("in store")',
      paragraphs: [
        'The return method recorded as "in store" means a return handover or collection that Jurgens Energy has approved and arranged in advance. It is not an unrestricted walk-in return service. Wait for confirmation of the location, date, and safe handover method before travelling to an address or sending an item.',
        "LPG, filled cylinders, and other hazardous items are accepted only through a pre-authorized collection or handover that follows the applicable safety rules; they must never be sent through ordinary mail. For an approved non-hazardous return, package the item securely and display the return reference we provide.",
        "Return all parts, manuals, accessories, promotional items, and original packaging reasonably available. Do not remove serial labels or attempt repairs before assessment. We may inspect the product to confirm identity, condition, use, completeness, and the reported problem. An inspection does not remove a statutory right.",
      ],
    },
    {
      id: "costs",
      title: "9. Return and collection costs",
      paragraphs: [
        "We cover return risk and expense where the law requires it, including qualifying unsafe, failed, or defective goods and verified incorrect deliveries. For an eligible ECTA cooling-off cancellation, the consumer may be responsible for the direct cost of returning the goods.",
        "We do not charge a restocking fee for an approved return or exchange. For a discretionary change-of-mind return, the customer is normally responsible only for the agreed direct return or collection cost where permitted by law. We will disclose any proposed cost before arranging the return and will not charge an amount prohibited by law.",
      ],
    },
    {
      id: "refunds",
      title: "10. Refund timing and method",
      paragraphs: [
        "Once a refund is approved, we initiate it using the original payment method where reasonably possible. Allow up to 30 days after approval for the refund to be processed and reflected by the payment provider, unless applicable law requires an earlier deadline or calculates the period from an earlier event such as cancellation. We may request verified bank details if the original method cannot receive the refund.",
        "The refunded amount includes product and delivery charges where required by law. For other approved returns, original delivery or completed service charges may be excluded where lawful and disclosed. We will provide a clear calculation if a deduction is permitted.",
      ],
    },
    {
      id: "contact-and-escalation",
      title: "11. Questions and unresolved complaints",
      paragraphs: [
        "Use the contact details in the footer and provide the order number so that we can investigate. If we cannot resolve a consumer complaint directly, you remain entitled to approach an applicable industry ombud, the National Consumer Commission, a provincial consumer authority, or a court as permitted by law.",
      ],
    },
  ],
};

export const deliveryInformation: PolicyDocument = {
  description:
    "How we confirm delivery coverage, calculate charges, estimate timing, complete LPG handovers, and resolve delivery problems.",
  eyebrow: "Getting your order",
  kind: "delivery",
  shortTitle: "Delivery Information",
  title: "Delivery Information",
  sections: [
    {
      id: "coverage",
      title: "1. Delivery coverage",
      paragraphs: [
        "Jurgens Energy local delivery is available only to addresses whose postal codes fall within a currently supported local delivery zone. It is not offered to every address in South Africa. Courier availability for eligible non-local products is checked separately.",
        "Delivery availability also depends on the products, stock location, order value, route conditions, and whether an approved service can safely transport the order. Enter the complete delivery address and postal code at checkout, or provide them during an assisted order, so the available option can be confirmed.",
        "A product being available online does not mean that every address is serviceable. Checkout is the final confirmation of availability and cost before payment. If we cannot safely or reasonably serve the address, we will contact you about an alternative, collection where available, or cancellation and refund of the affected order.",
      ],
    },
    {
      id: "fees",
      title: "2. Delivery fees and quotes",
      paragraphs: [
        "The delivery charge is calculated or confirmed from the supported destination postal code, parcel or LPG handling requirements, product quantity, order value, and available fulfilment method. The applicable option and charge are shown at checkout before payment, or communicated for approval during an assisted order.",
        "A quote may change if the address, products, quantities, access requirements, or fulfilment method changes. We will ask you to approve a material change before proceeding.",
      ],
    },
    {
      id: "timing",
      title: "3. Delivery timing",
      paragraphs: [
        "Delivery dates and time windows are estimates unless we expressly confirm a fixed appointment. Timing depends on payment confirmation, stock, order preparation, route capacity, courier availability, weather, traffic, access, and LPG safety requirements.",
        "We will communicate a material delay and provide the available next step. If an accepted order cannot be fulfilled within an agreed or legally required period, you may have a right to cancel and receive the applicable refund.",
      ],
    },
    {
      id: "before-arrival",
      title: "4. Before the delivery arrives",
      paragraphs: [
        "Please make sure the delivery address and telephone number are correct and keep your phone available for reasonable delivery communication. The location must be safely accessible to the vehicle and delivery team.",
      ],
      bullets: [
        "An authorised adult must be available to receive and inspect the order.",
        "Secure pets and clear a safe path to the handover point.",
        "Tell us before dispatch about access controls, estates, stairs, restricted roads, loading rules, or other material access conditions.",
        "For an exchange, disconnect the eligible empty cylinder safely and have it upright and ready in a ventilated place accessible to the delivery team.",
        "Do not present a leaking, modified, illegally filled, or unsafe cylinder for exchange.",
      ],
    },
    {
      id: "lpg-delivery",
      title: "5. LPG and cylinder handover",
      paragraphs: [
        "LPG orders require safe handling. Cylinders must remain upright, secured, and away from ignition sources. A delivery representative may pause or refuse a handover where access, storage, the receiving environment, or an exchange cylinder creates a material safety risk.",
        "A cylinder exchange is completed only when the correct eligible empty cylinder is handed over. Exchange rules may consider size, type, brand or ownership, and condition. If the empty cylinder is not eligible, we will explain the available correction, price difference, reschedule, or cancellation options.",
        "Delivery does not include appliance installation or connection unless that service is expressly listed and confirmed. Work that legally requires a registered gas installer must be performed by a suitably qualified registered person.",
      ],
    },
    {
      id: "handover-and-inspection",
      title: "6. Handover and inspection",
      paragraphs: [
        "Where reasonably possible, check the product count, size, visible condition, seals, and accessories before accepting delivery. The recipient may be asked to confirm handover electronically or in writing.",
        "Do not accept or use a cylinder that appears to leak, is seriously damaged, or does not match the order. Report missing, incorrect, or concealed damage as soon as reasonably possible and keep packaging or photographs that can help us investigate.",
      ],
    },
    {
      id: "missed-delivery",
      title: "7. Missed or unsuccessful delivery",
      paragraphs: [
        "A delivery may be unsuccessful if nobody is available, the address or contact details are incorrect, access is unsafe or blocked, required authorisation is missing, or an exchange cylinder is unavailable or ineligible.",
        "We will contact you about redelivery, collection, order correction, or cancellation. A reasonable additional attempt or route charge may apply where the failure was caused by incorrect customer information or unavailable access, but it will be disclosed before the next attempt and applied only where lawful.",
      ],
    },
    {
      id: "risk-and-authority",
      title: "8. Risk and authorised recipients",
      paragraphs: [
        "The goods remain at the supplier’s risk until accepted at the agreed delivery point, subject to applicable law. A person at the address who appears authorised to receive the order may be treated as the recipient unless you gave us different instructions that we accepted before delivery.",
        "If you ask us to leave a non-hazardous parcel without attendance, that request must be accepted by us or the delivery provider first and may affect risk after the agreed safe-place handover. LPG cylinders will not be left unattended where doing so would be unsafe or contrary to the fulfilment provider’s rules.",
      ],
    },
    {
      id: "delays-and-unavailability",
      title: "9. Delays, shortages, and events outside control",
      paragraphs: [
        "Fuel or LPG shortages, road closures, severe weather, vehicle breakdowns, supplier disruption, public emergencies, or other events can affect a route. We will take reasonable steps to communicate and rebook rather than leave an order unresolved.",
        "If products become unavailable after payment, we will offer a lawful practical option such as a revised delivery date, an agreed substitute, cancellation of the affected item, or a refund. We will not substitute a materially different product without your agreement.",
      ],
    },
    {
      id: "contact",
      title: "10. Delivery support",
      paragraphs: [
        "Use the contact details in the footer for address corrections, access information, delays, missed delivery, or a handover problem. Include the order number and contact us before the order is dispatched where possible; an address or route cannot always be changed after dispatch.",
      ],
    },
  ],
};
