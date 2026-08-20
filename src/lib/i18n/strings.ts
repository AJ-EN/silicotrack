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
  'lang.marwariPlanned': {
    hi: 'मारवाड़ी (शीघ्र आ रहा है)',
    en: 'Marwari extension planned',
  },
  'data.syntheticNotice': {
    hi: 'कृत्रिम विकास डेटा — केवल प्रणाली प्रदर्शन के लिए',
    en: 'SYNTHETIC DEVELOPMENT DATA — FOR SYSTEM DEMONSTRATION ONLY',
  },

  // --- Roles behind each screen. The demo has no auth (CLAUDE.md §10); this
  // switcher stands in for one, and naming the role is the point of it.
  'role.field': { hi: 'आशा / एएनएम / सीएचओ', en: 'ASHA / ANM / CHO' },
  'role.camp': { hi: 'जिला टीबी अधिकारी', en: 'District TB Officer' },
  'role.referral': { hi: 'डीपीबी समन्वयक', en: 'DPB coordinator' },
  'role.dashboard': { hi: 'डीएसएपी / डीओआईटी&सी', en: 'DSAP / DoIT&C' },

  // --- Landing page ---
  'home.lede': {
    hi: 'सिलिकोसिस की जाँच किसे पहले मिले, यह तय करने के लिए जोखिम-आधारित प्रणाली — राजस्थान के बलुआ पत्थर क्षेत्र के लिए।',
    en: "An exposure-based system for deciding who gets screened for silicosis first, built for Rajasthan's sandstone belt.",
  },
  'home.thesisTitle': { hi: 'समस्या', en: 'The problem' },
  'home.thesis1': {
    hi: '21,871 आवेदनों में से 11,288 (57.6%) CHC स्तर पर इसलिए अस्वीकृत हुए कि कोई लक्षण नहीं थे — जबकि शुरुआती सिलिकोसिस में लक्षण होते ही नहीं।',
    en: '11,288 of 21,871 applications (57.6%) were rejected at CHC level for having no symptoms — in a disease that is asymptomatic in exactly the stage worth catching.',
  },
  'home.thesis2': {
    hi: 'छाती का एक्स-रे शुरुआती सिलिकोसिस के लिए HRCT की तुलना में केवल ~48% संवेदनशील है। यह भौतिकी की सीमा है; कोई सॉफ़्टवेयर इसे नहीं बदल सकता।',
    en: 'Chest X-ray is only ~48% sensitive for early silicosis against HRCT. That is photon physics; no software changes it.',
  },
  'home.thesis3': {
    hi: 'जब जाँच की सटीकता तय है, तो बचा हुआ एकमात्र लीवर यह है कि जाँच किसकी हो। संचयी सिलिका जोखिम ही वह एकमात्र भविष्यवक्ता है जो रोग बनने से पहले उपलब्ध है।',
    en: 'When test accuracy is fixed, the only remaining lever is who gets tested. Cumulative silica exposure is the only predictor available before pathology exists.',
  },
  'home.screensTitle': { hi: 'चार स्क्रीन', en: 'Four screens' },
  'home.open': { hi: 'खोलें', en: 'Open' },
  'home.statusTitle': { hi: 'ईमानदार स्थिति', en: 'Honest status' },
  'home.statusValidation': {
    hi: 'कोई नैदानिक सत्यापन नहीं। किसी वास्तविक रोगी की जाँच नहीं हुई।',
    en: 'No clinical validation. No real patient has been screened.',
  },
  'home.statusData': {
    hi: 'सारा डेटा कृत्रिम है — 500 उत्पन्न श्रमिक, ऐसा ही चिह्नित।',
    en: 'All data is synthetic — 500 generated workers, labelled as such.',
  },
  'home.statusJem': {
    hi: 'जोखिम गुणांक अनंतिम हैं। राजस्थान बलुआ पत्थर के लिए प्रमाणित JEM प्रकाशित रूप में मौजूद नहीं है।',
    en: 'Exposure coefficients are provisional. A validated Rajasthan sandstone JEM does not exist in published form.',
  },
  'home.statusNotDevice': {
    hi: 'यह चिकित्सा उपकरण नहीं है और निदान नहीं करता।',
    en: 'This is not a medical device and does not diagnose.',
  },
  'home.docs': { hi: 'दस्तावेज़', en: 'Documentation' },
  'home.docsModel': {
    hi: 'जोखिम मॉडल विनिर्देश',
    en: 'Risk model specification',
  },
  'home.docsJem': {
    hi: 'JEM स्रोत एवं प्रामाणिकता',
    en: 'JEM sources and provenance',
  },

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
  'worker.tokenLabel': {
    hi: 'अस्थायी कार्यकर्ता टोकन / पंजीकरण संख्या',
    en: 'Temporary Worker Token / Registration ID',
  },
  'worker.tokenHint': {
    hi: 'रिकॉर्ड सहेजते समय प्रणाली एक अस्थायी टोकन अपने आप बनाएगी। सरकारी पहचान संख्या दर्ज न करें।',
    en: 'A temporary token will be issued automatically when the record is saved. Do not enter a government identity number.',
  },
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
    hi: 'हर काम अलग जोड़ें — काम एक ही समय पर हुआ हो या एक के बाद एक। सबसे पुराना पहले।',
    en: 'Add every job separately, whether jobs overlapped or followed one another. Oldest first.',
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
  'segment.durationCertainty': {
    hi: 'काम की अवधि कितनी पक्की है?',
    en: 'How certain is the duration?',
  },
  'segment.duration.exact': { hi: 'पक्की', en: 'Exact' },
  'segment.duration.approximate': { hi: 'लगभग', en: 'Approximate' },
  'segment.duration.notSure': { hi: 'अनिश्चित', en: 'Not sure' },
  'segment.frequencyPattern': { hi: 'काम की आवृत्ति', en: 'Work frequency' },
  'segment.frequency.regular': { hi: 'नियमित', en: 'Regular' },
  'segment.frequency.seasonal': {
    hi: 'मौसमी / प्रवासी',
    en: 'Seasonal / Migrant',
  },
  'segment.frequency.approximate': { hi: 'लगभग', en: 'Approximate' },
  'segment.frequency.notSure': { hi: 'अनिश्चित', en: 'Not sure' },
  'segment.siteName': { hi: 'खदान का नाम', en: 'Site name' },
  'segment.siteNameUnknown': { hi: 'पता नहीं', en: 'Unknown' },

  // --- Field: result ---
  'result.tier': { hi: 'श्रेणी', en: 'Tier' },
  'result.tier1': { hi: 'कम', en: 'Low' },
  'result.tier2': { hi: 'मध्यम', en: 'Moderate' },
  'result.tier3': { hi: 'उच्च', en: 'High' },
  'result.tier4': { hi: 'प्राथमिकता', en: 'Priority' },
  'result.cumulative': {
    hi: 'संचयी सिलिका जोखिम',
    en: 'Cumulative silica exposure',
  },
  'result.rescreen': { hi: 'अगली जाँच', en: 'Next screening' },
  'result.months': { hi: 'महीने में', en: 'months' },
  'result.why': { hi: 'यह श्रेणी क्यों?', en: 'Why this tier?' },
  'result.contributors': { hi: 'मुख्य कारण', en: 'Main contributors' },
  'result.escalations': {
    hi: 'श्रेणी बढ़ाने के कारण',
    en: 'Escalation reasons',
  },
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
  'camp.selectedMean': {
    hi: 'इस सूची का औसत जोखिम',
    en: 'This list, mean exposure',
  },
  'camp.poolMean': {
    hi: 'बिना चुने औसत जोखिम',
    en: 'Unselected, mean exposure',
  },
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
  'camp.incompleteFlag': {
    hi: 'साक्षात्कार अधूरा',
    en: 'Interview incomplete',
  },

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
  'ref.awaitingPayment': {
    hi: 'प्रमाणित, भुगतान बाकी',
    en: 'certified, awaiting payment',
  },
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
  'ref.stalledNone': {
    hi: 'कोई रेफरल अटका नहीं है।',
    en: 'No referrals are stalled.',
  },
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
    en: "Rejection for absent symptoms is the state's largest loss — 11,288 of 21,871 applications (57.6%). Early silicosis has no symptoms at all.",
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

  // --- Dashboard ---
  'dash.title': { hi: 'ज़िला निगरानी', en: 'District surveillance' },
  'dash.subtitle': {
    hi: 'जोखिम वितरण, पहचान श्रृंखला और पोर्टल चरण',
    en: 'Exposure distribution, detection cascade, and portal stages',
  },
  'dash.registered': { hi: 'पंजीकृत', en: 'Registered' },
  'dash.assessed': { hi: 'मूल्यांकित', en: 'Assessed' },
  'dash.incomplete': { hi: 'अधूरे साक्षात्कार', en: 'Incomplete interviews' },
  'dash.invited': { hi: 'आमंत्रित', en: 'Invited' },
  'dash.attended': { hi: 'उपस्थित', en: 'Attended' },
  'dash.abnormal': {
    hi: 'रेडियोग्राफ़ में निष्कर्ष',
    en: 'Radiographic findings',
  },
  'dash.flagged': { hi: 'आगे की समीक्षा के लिए', en: 'Flagged for review' },
  'dash.referred': { hi: 'रेफर किए गए', en: 'Referred' },
  'dash.certifiedCount': { hi: 'प्रमाणित', en: 'Certified' },
  'dash.tierDistribution': {
    hi: 'जोखिम श्रेणी वितरण',
    en: 'Exposure tier distribution',
  },
  'dash.cascade': { hi: 'पहचान श्रृंखला', en: 'Detection cascade' },
  'dash.byDistrict': { hi: 'ज़िलेवार', en: 'By district' },
  'dash.district': { hi: 'ज़िला', en: 'District' },
  'dash.workers': { hi: 'श्रमिक', en: 'Workers' },
  'dash.priority': { hi: 'श्रेणी 4', en: 'Tier 4' },

  // The headline metric.
  'dash.symptomGate': {
    hi: 'लक्षण-आधारित छँटनी का असर',
    en: 'What the symptom gate costs',
  },
  'dash.abnormalFindings': {
    hi: 'ILO श्रेणी 1+ रेडियोग्राफ़',
    en: 'Radiographs at ILO category 1+',
  },
  'dash.discarded': {
    hi: 'इनमें से लक्षण न होने पर अस्वीकृत',
    en: 'Of those, rejected for having no symptoms',
  },
  'dash.discardRate': { hi: 'अस्वीकृति दर', en: 'Discard rate' },
  'dash.discardedHighTier': {
    hi: 'इनमें से श्रेणी 3+ जोखिम वाले',
    en: 'Of those, already at exposure tier 3+',
  },
  'dash.stateComparator': {
    hi: 'राज्य का प्रकाशित आँकड़ा: 21,871 आवेदनों में से 11,288 (57.6%) CHC स्तर पर लक्षण न होने के कारण अस्वीकृत।',
    en: "State's published figure: 11,288 of 21,871 applications (57.6%) rejected at CHC level for absent symptoms.",
  },
  'dash.symptomGateNote': {
    hi: 'यह प्रणाली लक्षण नहीं पूछती। "लक्षण नहीं" का निर्धारण राज्य ने स्वयं CHC पर किया — यह उनके ही आकलन पर उनकी ही कसौटी की जाँच है।',
    en: 'This system does not ask about symptoms. The "no symptoms" determination is the state\'s own, recorded at CHC — this measures their criterion against their own assessment.',
  },
  'dash.iloCaveat': {
    hi: 'ILO श्रेणी 0 का अर्थ रोग-मुक्त नहीं है। HRCT पर श्रेणी 0 वाले 18% श्रमिकों में सिलिकोसिस पाया गया (Hoy et al. 2024)।',
    en: 'ILO category 0 does not mean disease-free. 18% of workers read as category 0 had silicosis on HRCT (Hoy et al. 2024).',
  },
  'dash.portalFunnel': { hi: 'पोर्टल चरण', en: 'Portal stages' },
  'dash.of': { hi: 'में से', en: 'of' },

  // --- JEM admin ---
  'jem.title': {
    hi: 'जोखिम गुणांक — समीक्षा',
    en: 'Exposure coefficients — review',
  },
  'jem.subtitle': {
    hi: 'मान बदलें और पूरे समूह पर प्रभाव तुरंत देखें। कुछ भी सहेजा नहीं जाता।',
    en: 'Change a value and see the effect on the whole cohort immediately. Nothing is saved.',
  },
  'jem.sandboxNotice': {
    hi: 'यह केवल संवेदनशीलता विश्लेषण है। यहाँ किए बदलाव सहेजे नहीं जाते और किसी श्रमिक की श्रेणी नहीं बदलते। प्रस्तावित मान निर्यात करें और समीक्षा के बाद ही मॉडल में शामिल करें।',
    en: "Sensitivity analysis only. Changes here are not saved and do not alter any worker's tier. Export a proposal and let it go through review before it enters the model.",
  },
  'jem.validationNotice': {
    hi: 'आधार मान प्रकाशित भारतीय बलुआ पत्थर साहित्य (प्रजापति एवं अन्य) के आधार पर 0.12 mg/m³ पर अंशांकित है। कार्य गुणांक अनंतिम अनुमान हैं, जिन्हें पायलट की शुरुआत में स्थानीय धूल नमूनाकरण से अंशांकित किया जाएगा।',
    en: 'Baseline anchor calibrated at 0.12 mg/m³ based on published Indian sandstone literature (Prajapati et al.). Task coefficients are provisional estimates to be calibrated via local dust sampling during pilot inception.',
  },
  'jem.task': { hi: 'कार्य', en: 'Task' },
  'jem.committed': { hi: 'वर्तमान मान', en: 'Committed' },
  'jem.proposed': { hi: 'प्रस्तावित मान', en: 'Proposed' },
  'jem.range': { hi: 'प्रकाशित परिसर', en: 'Published range' },
  'jem.confidence': { hi: 'विश्वसनीयता', en: 'Confidence' },
  'jem.source': { hi: 'स्रोत', en: 'Source' },
  'jem.reset': { hi: 'सब रीसेट करें', en: 'Reset all' },
  'jem.export': { hi: 'प्रस्ताव निर्यात करें', en: 'Export proposal' },
  'jem.copied': { hi: 'कॉपी हो गया', en: 'Copied' },
  'jem.changed': { hi: 'बदले गए गुणांक', en: 'Coefficients changed' },
  'jem.outOfRange': {
    hi: 'प्रकाशित परिसर से बाहर',
    en: 'outside the published range',
  },

  // Anchor constraint
  'jem.anchor': { hi: 'लंगर जाँच', en: 'Anchor check' },
  'jem.anchorExplain': {
    hi: 'खदान कार्य-मिश्रण पर भारित औसत मापे गए भारतीय बलुआ पत्थर मान के निकट रहना चाहिए। मैट्रिक्स इस एक मापे गए आँकड़े को विभाजित करता है, नया जोखिम स्तर नहीं गढ़ता।',
    en: 'The weighted mean across the mine task mix must stay near the one measured Indian sandstone value. The matrix disaggregates that measurement; it does not invent an exposure level.',
  },
  'jem.anchorMean': { hi: 'भारित औसत', en: 'Weighted mean' },
  'jem.anchorTarget': { hi: 'लक्ष्य', en: 'Target' },
  'jem.anchorOk': { hi: 'लंगर के भीतर', en: 'Within anchor' },
  'jem.anchorBreached': { hi: 'लंगर टूटा', en: 'Anchor breached' },

  // Cohort effect
  'jem.cohortEffect': { hi: 'समूह पर प्रभाव', en: 'Effect on the cohort' },
  'jem.tierNow': { hi: 'वर्तमान', en: 'Committed' },
  'jem.tierProposed': { hi: 'प्रस्तावित', en: 'Proposed' },
  'jem.movedUp': { hi: 'श्रेणी बढ़ी', en: 'moved up a tier' },
  'jem.movedDown': { hi: 'श्रेणी घटी', en: 'moved down a tier' },
  'jem.unchanged': { hi: 'कोई बदलाव नहीं', en: 'No worker changes tier' },
  'jem.workers': { hi: 'श्रमिक', en: 'workers' },

  // Landing page entry
  'home.adminTitle': { hi: 'मॉडल समीक्षा', en: 'Model review' },
  'home.adminBlurb': {
    hi: 'जोखिम गुणांक अनंतिम हैं। यह स्क्रीन उन्हें निरीक्षण योग्य बनाती है — मान बदलें और पूरे समूह पर असर देखें।',
    en: 'The exposure coefficients are provisional. This screen makes them inspectable — change one and watch the whole cohort re-tier.',
  },
  'role.admin': {
    hi: 'व्यावसायिक स्वच्छता विशेषज्ञ',
    en: 'Occupational hygienist',
  },
  'nav.admin': { hi: 'गुणांक', en: 'Coefficients' },

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
  'error.ageRange': {
    hi: 'उम्र 15 से 100 के बीच होनी चाहिए',
    en: 'Age must be 15–100',
  },
  'error.phone': {
    hi: '10 अंकों का नंबर दर्ज करें',
    en: 'Enter a 10-digit number',
  },
  'error.yearRange': { hi: 'साल सही नहीं है', en: 'Year is out of range' },
  'error.endBeforeStart': {
    hi: 'आख़िरी साल शुरू के साल से पहले नहीं हो सकता',
    en: 'End year cannot precede start year',
  },
  'error.startFuture': {
    hi: 'शुरू का साल भविष्य में नहीं हो सकता',
    en: 'Start year cannot be in the future',
  },
  'error.noSegments': {
    hi: 'कम से कम एक काम जोड़ें',
    en: 'Add at least one job',
  },
  'error.saveFailed': { hi: 'सहेजने में दिक्कत हुई', en: 'Could not save' },
} as const satisfies Record<string, Translation>;

export type StringKey = keyof typeof STRINGS;
