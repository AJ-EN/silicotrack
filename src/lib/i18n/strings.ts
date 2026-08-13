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

  // --- Escalation reasons ---
  'esc.PRIOR_TB': { hi: 'पहले टीबी हुई थी', en: 'Prior TB' },
  'esc.PEAK_INTENSITY': { hi: 'बहुत अधिक धूल वाला काम', en: 'High peak exposure' },
  'esc.LATENCY': { hi: 'पहले जोखिम को 15+ वर्ष', en: '15+ years since first exposure' },
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
