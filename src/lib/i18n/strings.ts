/**
 * Every user-facing string in the application.
 *
 * Hindi is not a translation layer bolted on later — it is the primary
 * language of the people using the field app, and CLAUDE.md §9 requires both
 * from day one. A string that exists only in English is a bug.
 *
 * Keys are dot-namespaced by screen. Adding a key without its `hi` value will
 * not compile.
 */

export const LOCALES = ['hi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Hindi first: this app is used by ASHA workers in Rajasthan, not by us. */
export const DEFAULT_LOCALE: Locale = 'hi';

export interface Translation {
  hi: string;
  en: string;
}

export const STRINGS = {
  // --- App shell ---
  'app.name': { hi: 'सिलिकोट्रैक', en: 'SilicoTrack' },
  'app.tagline': {
    hi: 'जोखिम-आधारित स्क्रीनिंग प्राथमिकता',
    en: 'Exposure-based screening priority',
  },
  'app.unvalidated': {
    hi: 'अप्रमाणित प्रोटोटाइप — कृत्रिम डेटा',
    en: 'Unvalidated prototype — synthetic data',
  },
  'nav.field': { hi: 'पंजीकरण', en: 'Field registry' },
  'nav.camp': { hi: 'शिविर', en: 'Camps' },
  'nav.referral': { hi: 'रेफरल', en: 'Referrals' },
  'nav.dashboard': { hi: 'डैशबोर्ड', en: 'Dashboard' },
  'lang.toggle': { hi: 'English', en: 'हिन्दी' },

  // --- Connectivity ---
  'net.online': { hi: 'ऑनलाइन', en: 'Online' },
  'net.offline': { hi: 'ऑफ़लाइन', en: 'Offline' },
  'net.pending': { hi: 'भेजना बाकी', en: 'Pending sync' },
  'net.syncing': { hi: 'भेजा जा रहा है', en: 'Syncing' },
  'net.synced': { hi: 'सब भेजा जा चुका', en: 'All synced' },
  'net.offlineNotice': {
    hi: 'नेटवर्क नहीं है। रिकॉर्ड इसी फ़ोन में सुरक्षित है और नेटवर्क आते ही अपने आप भेज दिया जाएगा।',
    en: 'No network. The record is saved on this phone and will send itself when the network returns.',
  },
  'net.syncNow': { hi: 'अभी भेजें', en: 'Sync now' },

  // --- Field: steps ---
  'field.title': { hi: 'श्रमिक पंजीकरण', en: 'Worker registration' },
  'field.step': { hi: 'चरण', en: 'Step' },
  'field.of': { hi: 'में से', en: 'of' },
  'field.step1': { hi: 'श्रमिक का विवरण', en: 'Worker details' },
  'field.step2': { hi: 'काम का इतिहास', en: 'Work history' },
  'field.step3': { hi: 'स्वास्थ्य', en: 'Health' },
  'field.step4': { hi: 'जाँच परिणाम', en: 'Result' },
  'field.next': { hi: 'आगे', en: 'Next' },
  'field.back': { hi: 'पीछे', en: 'Back' },
  'field.save': { hi: 'सहेजें', en: 'Save record' },
  'field.newWorker': { hi: 'नया श्रमिक', en: 'New worker' },

  // --- Field: worker details ---
  'worker.name': { hi: 'नाम', en: 'Name' },
  'worker.namePlaceholder': { hi: 'पूरा नाम', en: 'Full name' },
  'worker.age': { hi: 'उम्र', en: 'Age' },
  'worker.years': { hi: 'वर्ष', en: 'years' },
  'worker.sex': { hi: 'लिंग', en: 'Sex' },
  'worker.sex.male': { hi: 'पुरुष', en: 'Male' },
  'worker.sex.female': { hi: 'महिला', en: 'Female' },
  'worker.sex.other': { hi: 'अन्य', en: 'Other' },
  'worker.district': { hi: 'ज़िला', en: 'District' },
  'worker.block': { hi: 'ब्लॉक', en: 'Block' },
  'worker.village': { hi: 'गाँव', en: 'Village' },
  'worker.phone': { hi: 'मोबाइल नंबर', en: 'Mobile number' },
  'worker.phoneOptional': { hi: 'वैकल्पिक', en: 'optional' },
  'worker.noAadhaar': {
    hi: 'आधार नंबर न पूछें और न दर्ज करें।',
    en: 'Do not ask for or record an Aadhaar number.',
  },

  // Districts in the sandstone belt covered by the prototype.
  'district.Karauli': { hi: 'करौली', en: 'Karauli' },
  'district.Jodhpur': { hi: 'जोधपुर', en: 'Jodhpur' },
  'district.Dausa': { hi: 'दौसा', en: 'Dausa' },
  'district.Bhilwara': { hi: 'भीलवाड़ा', en: 'Bhilwara' },

  // --- Field: health ---
  'health.smoking': { hi: 'धूम्रपान', en: 'Smoking' },
  'health.smoking.never': { hi: 'कभी नहीं', en: 'Never' },
  'health.smoking.former': { hi: 'पहले करते थे', en: 'Former' },
  'health.smoking.current': { hi: 'अभी करते हैं', en: 'Current' },
  'health.priorTB': { hi: 'पहले कभी टीबी हुई?', en: 'Prior TB?' },
  'health.yes': { hi: 'हाँ', en: 'Yes' },
  'health.no': { hi: 'नहीं', en: 'No' },
  'health.noSymptomQuestion': {
    hi: 'लक्षण नहीं पूछे जाते। शुरुआती सिलिकोसिस में लक्षण नहीं होते — इसीलिए यह प्रणाली जोखिम से चलती है, लक्षण से नहीं।',
    en: 'Symptoms are not asked. Early silicosis has none — which is why this system runs on exposure, not symptoms.',
  },

  // --- Field: exposure segments ---
  'segment.title': { hi: 'काम का इतिहास', en: 'Work history' },
  'segment.intro': {
    hi: 'हर उस काम को जोड़ें जो इस व्यक्ति ने किया है। सबसे पुराना पहले।',
    en: 'Add every job this person has done. Oldest first.',
  },
  'segment.add': { hi: 'काम जोड़ें', en: 'Add job' },
  'segment.remove': { hi: 'हटाएँ', en: 'Remove' },
  'segment.empty': {
    hi: 'अभी कोई काम दर्ज नहीं। कम से कम एक जोड़ें।',
    en: 'No jobs recorded yet. Add at least one.',
  },
  'segment.number': { hi: 'काम', en: 'Job' },
  'segment.task': { hi: 'क्या काम करते थे?', en: 'What was the job?' },
  'segment.material': { hi: 'पत्थर', en: 'Material' },
  'segment.material.sandstone': { hi: 'बलुआ पत्थर', en: 'Sandstone' },
  'segment.material.quartzite': { hi: 'क्वार्टज़ाइट', en: 'Quartzite' },
  'segment.material.granite': { hi: 'ग्रेनाइट', en: 'Granite' },
  'segment.material.other': { hi: 'अन्य', en: 'Other' },
  'segment.method': { hi: 'पानी का इस्तेमाल', en: 'Water use' },
  'segment.method.wet': { hi: 'गीला', en: 'Wet' },
  'segment.method.dry': { hi: 'सूखा', en: 'Dry' },
  'segment.enclosure': { hi: 'जगह', en: 'Workspace' },
  'segment.enclosure.open': { hi: 'खुली', en: 'Open air' },
  'segment.enclosure.enclosed': { hi: 'बंद', en: 'Enclosed' },
  'segment.ppe': { hi: 'मास्क का इस्तेमाल', en: 'Mask use' },
  'segment.ppe.none': { hi: 'कभी नहीं', en: 'Never' },
  'segment.ppe.intermittent': { hi: 'कभी-कभी', en: 'Sometimes' },
  'segment.ppe.consistent': { hi: 'हमेशा', en: 'Always' },
  'segment.siteType': { hi: 'खदान', en: 'Site' },
  'segment.siteType.surface': { hi: 'ऊपरी', en: 'Surface' },
  'segment.siteType.underground': { hi: 'भूमिगत', en: 'Underground' },
  'segment.startYear': { hi: 'शुरू का साल', en: 'Start year' },
  'segment.endYear': { hi: 'आख़िरी साल', en: 'End year' },
  'segment.ongoing': { hi: 'अभी भी कर रहे हैं', en: 'Still doing this' },
  'segment.monthsPerYear': { hi: 'साल में कितने महीने', en: 'Months per year' },
  'segment.hoursPerDay': { hi: 'दिन में कितने घंटे', en: 'Hours per day' },
  'segment.months': { hi: 'महीने', en: 'months' },
  'segment.hours': { hi: 'घंटे', en: 'hours' },
  'segment.siteName': { hi: 'खदान का नाम', en: 'Site name' },
  'segment.siteNameUnknown': { hi: 'पता नहीं', en: 'Unknown' },

  // --- Field: result ---
  'result.tier': { hi: 'श्रेणी', en: 'Tier' },
  'result.tier1': { hi: 'कम', en: 'Low' },
  'result.tier2': { hi: 'मध्यम', en: 'Moderate' },
  'result.tier3': { hi: 'उच्च', en: 'High' },
  'result.tier4': { hi: 'प्राथमिकता', en: 'Priority' },
  'result.cumulative': { hi: 'संचयी सिलिका जोखिम', en: 'Cumulative silica exposure' },
  'result.rescreen': { hi: 'अगली जाँच', en: 'Next screening' },
  'result.months': { hi: 'महीने में', en: 'months' },
  'result.why': { hi: 'यह श्रेणी क्यों?', en: 'Why this tier?' },
  'result.contributors': { hi: 'मुख्य कारण', en: 'Main contributors' },
  'result.escalations': { hi: 'श्रेणी बढ़ाने के कारण', en: 'Escalation reasons' },
  'result.tsfe': { hi: 'पहले जोखिम को हुए', en: 'Years since first exposure' },
  'result.incomplete': { hi: 'साक्षात्कार अधूरा', en: 'Interview incomplete' },
  'result.savedOffline': {
    hi: 'रिकॉर्ड इस फ़ोन में सहेजा गया।',
    en: 'Record saved on this phone.',
  },
  'result.savedSynced': { hi: 'रिकॉर्ड भेज दिया गया।', en: 'Record sent.' },

  // --- Camp planning ---
  'camp.title': { hi: 'शिविर की सूची', en: 'Camp call list' },
  'camp.subtitle': {
    hi: 'जोखिम के अनुसार प्राथमिकता, गाँव के अनुसार समूहित',
    en: 'Prioritised by exposure, clustered by village',
  },
  'camp.district': { hi: 'ज़िला', en: 'District' },
  'camp.block': { hi: 'ब्लॉक', en: 'Block' },
  'camp.allBlocks': { hi: 'सभी ब्लॉक', en: 'All blocks' },
  'camp.capacity': { hi: 'क्षमता', en: 'Capacity' },
  'camp.seats': { hi: 'सीटें', en: 'seats' },
  'camp.clustering': { hi: 'गाँव के अनुसार समूहन', en: 'Village clustering' },
  'camp.clusterOn': { hi: 'चालू', en: 'On' },
  'camp.clusterOff': { hi: 'बंद', en: 'Off — pure risk order' },
  'camp.eligible': { hi: 'पात्र श्रमिक', en: 'Eligible workers' },
  'camp.excluded': { hi: 'प्रमाणित — बाहर रखे गए', en: 'Certified — excluded' },
  'camp.excludedWhy': {
    hi: 'पहले से प्रमाणित श्रमिकों को शिविर सूची से बाहर रखा जाता है। उनकी सीट किसी अनदेखे व्यक्ति को मिलनी चाहिए।',
    en: 'Already-certified workers are excluded. Their seat belongs to someone still undetected.',
  },
  'camp.villagesToVisit': { hi: 'गाँव जाने हैं', en: 'Villages to visit' },
  'camp.onList': { hi: 'सूची में', en: 'On list' },
  'camp.ofEligible': { hi: 'में से', en: 'of' },

  // --- The targeting argument ---
  'camp.enrichment': { hi: 'लक्ष्यीकरण का असर', en: 'Effect of targeting' },
  'camp.selectedMean': { hi: 'इस सूची का औसत जोखिम', en: 'This list, mean exposure' },
  'camp.poolMean': { hi: 'बिना चुने औसत जोखिम', en: 'Unselected, mean exposure' },
  'camp.ratio': { hi: 'गुना अधिक जोखिम', en: 'times the exposure' },
  'camp.highTierShare': { hi: 'श्रेणी 3+ का हिस्सा', en: 'Share at tier 3+' },
  'camp.notCases': {
    hi: 'यह जोखिम की तुलना है, रोगियों की संख्या का अनुमान नहीं। यह प्रणाली रोग की संभावना नहीं बताती।',
    en: 'This compares EXPOSURE, not cases found. The system does not estimate probability of disease.',
  },

  // --- Call list ---
  'camp.rank': { hi: 'क्रम', en: '#' },
  'camp.worker': { hi: 'श्रमिक', en: 'Worker' },
  'camp.village': { hi: 'गाँव', en: 'Village' },
  'camp.exposure': { hi: 'संचयी जोखिम', en: 'Cumulative exposure' },
  'camp.age': { hi: 'उम्र', en: 'Age' },
  'camp.emptyList': {
    hi: 'इस ब्लॉक में कोई पात्र श्रमिक नहीं मिला।',
    en: 'No eligible workers found in this block.',
  },
  'camp.incompleteFlag': { hi: 'साक्षात्कार अधूरा', en: 'Interview incomplete' },

  // --- Referral tracker ---
  'ref.title': { hi: 'रेफरल ट्रैकर', en: 'Referral tracker' },
  'ref.subtitle': {
    hi: 'राज सिलिकोसिस पोर्टल के चरणों के अनुसार',
    en: 'Mapped to the Raj Silicosis portal stages',
  },
  'ref.total': { hi: 'कुल रेफरल', en: 'Total referrals' },
  'ref.inProgress': { hi: 'प्रक्रिया में', en: 'In progress' },
  'ref.certified': { hi: 'प्रमाणित', en: 'Certified' },
  'ref.stalled': { hi: '14 दिन से अटके', en: 'Stalled >14 days' },
  'ref.funnel': { hi: 'चरणवार गिरावट', en: 'Stage-by-stage drop-off' },
  'ref.reached': { hi: 'यहाँ तक पहुँचे', en: 'reached' },
  'ref.lostHere': { hi: 'यहाँ से आगे नहीं बढ़े', en: 'did not go further' },
  'ref.awaitingPayment': { hi: 'प्रमाणित, भुगतान बाकी', en: 'certified, awaiting payment' },
  'ref.awaitingPaymentNote': {
    hi: 'ये श्रमिक मिल चुके हैं — यह पहचान की नहीं, भुगतान की देरी है। इसे गिरावट में नहीं गिना जाता।',
    en: 'These workers were found. This is a payment delay, not a detection failure, and is not counted as drop-off.',
  },
  'ref.medianDays': { hi: 'औसत दिन', en: 'median days' },
  'ref.currentlyHere': { hi: 'अभी यहाँ', en: 'here now' },
  'ref.biggestLoss': { hi: 'सबसे बड़ी गिरावट', en: 'Largest single drop-off' },
  'ref.outcomes': { hi: 'बाहर निकलने के कारण', en: 'Exits from the pipeline' },
  'ref.lostFrom': { hi: 'किस चरण से', en: 'lost from' },
  'ref.stalledList': { hi: 'अटके हुए रेफरल', en: 'Stalled referrals' },
  'ref.stalledNone': { hi: 'कोई रेफरल अटका नहीं है।', en: 'No referrals are stalled.' },
  'ref.stalledWhy': {
    hi: 'ये रेफरल एक ही चरण में 14 दिन से अधिक रुके हैं। समाप्त हो चुके रेफरल यहाँ नहीं दिखते।',
    en: 'These have sat in one stage for more than 14 days. Finished referrals are not listed.',
  },
  'ref.days': { hi: 'दिन', en: 'days' },
  'ref.stage': { hi: 'चरण', en: 'Stage' },
  'ref.worker': { hi: 'श्रमिक', en: 'Worker' },
  'ref.board': { hi: 'बोर्ड', en: 'Board' },
  'ref.noSymptomsNote': {
    hi: 'लक्षण न होने पर अस्वीकृति राज्य की सबसे बड़ी हानि है — 21,871 आवेदनों में से 11,288 (57.6%)। शुरुआती सिलिकोसिस में लक्षण होते ही नहीं।',
    en: 'Rejection for absent symptoms is the state\'s largest loss — 11,288 of 21,871 applications (57.6%). Early silicosis has no symptoms at all.',
  },

  // --- Pipeline stage names ---
  'stage.REGISTERED': { hi: 'पंजीकृत', en: 'Registered' },
  'stage.PRIMARY_CHECKUP': { hi: 'प्राथमिक जाँच', en: 'Primary checkup' },
  'stage.RADIOGRAPHER': { hi: 'रेडियोग्राफर', en: 'Radiographer' },
  'stage.RADIOLOGIST': { hi: 'रेडियोलॉजिस्ट', en: 'Radiologist' },
  'stage.MO_APPROVAL': { hi: 'चिकित्सा अधिकारी स्वीकृति', en: 'MO approval' },
  'stage.BOARD': { hi: 'बोर्ड', en: 'Board' },
  'stage.CERTIFIED': { hi: 'प्रमाणित', en: 'Certified' },
  'stage.DISBURSED': { hi: 'भुगतान', en: 'Disbursed' },
  'stage.REJECTED_NO_SYMPTOMS': {
    hi: 'अस्वीकृत — कोई लक्षण नहीं',
    en: 'Rejected — no symptoms',
  },
  'stage.REJECTED_POST_XRAY': {
    hi: 'अस्वीकृत — एक्स-रे के बाद',
    en: 'Rejected — after X-ray',
  },
  'stage.LOST_TO_FOLLOWUP': { hi: 'संपर्क टूट गया', en: 'Lost to follow-up' },

  // --- Escalation reasons ---
  'esc.PRIOR_TB': { hi: 'पहले टीबी हुई थी', en: 'Prior TB' },
  'esc.LATENCY': {
    hi: 'धूल का काम छोड़ चुके, शुरुआत को 15+ वर्ष',
    en: 'Left dusty work, 15+ years since it began',
  },
  'esc.CURRENT_SMOKER': { hi: 'अभी धूम्रपान करते हैं', en: 'Current smoker' },

  // --- The disclaimers. Never render a score without these. ---
  'disclaimer.notDiagnosis': {
    hi: 'यह निदान नहीं है। यह केवल बताता है कि जाँच पहले किसकी होनी चाहिए।',
    en: 'This is not a diagnosis. It only indicates who should be screened first.',
  },
  'disclaimer.provisional': {
    hi: 'जोखिम गुणांक अनंतिम हैं और क्षेत्रीय सत्यापन की प्रतीक्षा में हैं।',
    en: 'Exposure coefficients are provisional and pending field validation.',
  },
  'disclaimer.authority': {
    hi: 'प्रमाणन का अधिकार केवल जिला न्यूमोकोनियोसिस बोर्ड को है।',
    en: 'Certification authority rests solely with the District Pneumoconiosis Board.',
  },

  // --- Validation ---
  'error.required': { hi: 'यह ज़रूरी है', en: 'Required' },
  'error.nameShort': { hi: 'नाम बहुत छोटा है', en: 'Name is too short' },
  'error.ageRange': { hi: 'उम्र 15 से 100 के बीच होनी चाहिए', en: 'Age must be 15–100' },
  'error.phone': { hi: '10 अंकों का नंबर दर्ज करें', en: 'Enter a 10-digit number' },
  'error.yearRange': { hi: 'साल सही नहीं है', en: 'Year is out of range' },
  'error.endBeforeStart': {
    hi: 'आख़िरी साल शुरू के साल से पहले नहीं हो सकता',
    en: 'End year cannot precede start year',
  },
  'error.startFuture': { hi: 'शुरू का साल भविष्य में नहीं हो सकता', en: 'Start year cannot be in the future' },
  'error.noSegments': { hi: 'कम से कम एक काम जोड़ें', en: 'Add at least one job' },
  'error.saveFailed': { hi: 'सहेजने में दिक्कत हुई', en: 'Could not save' },
} as const satisfies Record<string, Translation>;

export type StringKey = keyof typeof STRINGS;
