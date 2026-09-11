// Dictionnaire FR / AR pour l'app chauffeur (PWA `/chauffeur/<token>`).
// Retour DG : « fais la chose la plus simple et aidante » → bilingue, arabe par défaut,
// bouton de bascule, RTL complet en arabe.

export type Lang = 'ar' | 'fr';

export interface DriverStrings {
  dir: 'ltr' | 'rtl';
  hello: string;
  driver: string;
  invalidLink: string;
  loading: string;
  weekHours: string;
  vehicle: string;
  langBtn: string;

  tabMissions: string;
  tabInterventions: string;
  tabPlanning: string;
  tabKm: string;

  weekPlan: string;
  noPlan: string;
  days: string[];
  act: Record<string, string>;

  ivIntro: string;
  ivNone: string;
  ivValidate: string;
  tireTransfer: string;
  tireMount: string;
  tirePos: string;
  tireFrom: string;
  tireValidate: string;

  toValidateTitle: string;
  toValidateSub: string;
  iValidate: string;
  noMission: string;
  validatedByYou: string;
  start: string;
  finish: string;
  declare: string;
  km: string;
  status: Record<string, string>;
  ordreBtn: string;
  ordreTitle: string;
  ordreRoute: string;
  ordreDates: string;
  ordreDuration: string;
  ordreDriver: string;
  ordreVehicle: string;
  ordreDistance: string;
  ordreFrais: string;
  ordreScan: string;
  ordreNotYet: string;
  close: string;

  declTitle: string;
  breakdown: string;
  anomaly: string;
  declDescribe: string;
  voiceMemo: string;
  stopRec: string;
  photo: string;
  cancel: string;
  sendOt: string;
  sending: string;

  kmRequestTitle: string;
  kmRequestSub: string;
  kmNone: string;
  kmMonthLabel: string;
  kmLastKnown: string;
  kmLastKnownHours: string;
  kmCurrentReading: string;
  kmCurrentHours: string;
  kmPhotoOpt: string;
  kmSend: string;
  kmSent: string;
  kmMustIncrease: string;
  kmRequired: string;
  kmReleveDebut: string;
  kmReleveFin: string;
  kmReservoir: string;
  kmDejaFait: string;
  engin: string;
}

export const DRIVER_DICT: Record<Lang, DriverStrings> = {
  fr: {
    dir: 'ltr',
    hello: 'Bonjour',
    driver: 'chauffeur',
    invalidLink: 'Lien invalide',
    loading: 'Chargement…',
    weekHours: 'h / {max} h cette semaine',
    vehicle: 'véhicule',
    langBtn: 'ع',

    tabMissions: 'Missions',
    tabInterventions: 'Interventions',
    tabPlanning: 'Planning',
    tabKm: 'Relevé km',

    weekPlan: 'Planning de la semaine',
    noPlan: 'Aucun planning renseigné.',
    days: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    act: { MIS: 'Mission', MNT: 'Maintenance', FRM: 'Formation', TRP: 'Transport perso.', REP: 'Repos', DIS: 'Disponible' },

    ivIntro: 'Chaque intervention sur ton véhicule doit être validée par toi (détenteur).',
    ivNone: 'Aucune intervention en attente de ta validation.',
    ivValidate: 'Je valide l’intervention',
    tireTransfer: 'Transfert de pneu',
    tireMount: 'Montage de pneu',
    tirePos: 'Position {p} sur {v}',
    tireFrom: ' (depuis {f})',
    tireValidate: 'Je valide le changement',

    toValidateTitle: 'Missions à valider',
    toValidateSub: 'Confirme que tu as bien pris connaissance de ces missions.',
    iValidate: 'Je valide',
    noMission: 'Aucune mission.',
    validatedByYou: '✓ validée par vous',
    start: 'Démarrer',
    finish: 'Terminer',
    declare: 'Déclarer panne / anomalie',
    km: 'km',
    status: { PLANIFIEE: 'Planifiée', EN_COURS: 'En cours', TERMINEE: 'Terminée', CLOTUREE: 'Clôturée', ANNULEE: 'Annulée' },
    ordreBtn: 'Ordre de mission',
    ordreTitle: 'Ordre de mission',
    ordreRoute: 'Itinéraire',
    ordreDates: 'Départ → retour',
    ordreDuration: 'Durée estimée',
    ordreDriver: 'Chauffeur',
    ordreVehicle: 'Véhicule',
    ordreDistance: 'Distance',
    ordreFrais: 'Frais de mission',
    ordreScan: 'Scanner pour vérifier l’authenticité',
    ordreNotYet: 'L’ordre de mission sera disponible dès le démarrage.',
    close: 'Fermer',

    declTitle: 'Déclaration',
    breakdown: 'panne',
    anomaly: 'anomalie',
    declDescribe: 'Décrire (optionnel — vous pouvez juste enregistrer un mémo vocal)',
    voiceMemo: 'Mémo vocal',
    stopRec: 'Arrêter',
    photo: 'Photo',
    cancel: 'Annuler',
    sendOt: 'Envoyer (crée un OT)',
    sending: 'Envoi…',

    kmRequestTitle: 'Relevés compteur + réservoir demandés',
    kmRequestSub: 'Le bureau a besoin de 2 relevés par mois : un en début de mois, un en fin de mois — compteur (km ou heures) ET niveau de réservoir. Sans ça, le suivi carburant et les entretiens ne peuvent pas être calculés.',
    kmNone: 'Aucun relevé demandé pour le moment.',
    kmMonthLabel: 'Mois',
    kmLastKnown: 'Dernier km connu',
    kmLastKnownHours: 'Dernières heures connues',
    kmCurrentReading: 'Compteur actuel (km)',
    kmCurrentHours: 'Compteur horaire actuel (h)',
    kmPhotoOpt: 'Photo du compteur (optionnel)',
    kmSend: 'Envoyer le relevé',
    kmSent: 'Relevé envoyé — merci !',
    kmMustIncrease: 'Le compteur doit être supérieur au dernier relevé ({v}).',
    kmRequired: 'Saisis le compteur et le niveau de réservoir.',
    kmReleveDebut: 'Relevé de DÉBUT de mois',
    kmReleveFin: 'Relevé de FIN de mois',
    kmReservoir: 'Niveau de réservoir (litres)',
    kmDejaFait: '✓ déjà transmis',
    engin: 'engin',
  },

  ar: {
    dir: 'rtl',
    hello: 'مرحبا',
    driver: 'السائق',
    invalidLink: 'رابط غير صالح',
    loading: 'جارٍ التحميل…',
    weekHours: 'س / {max} س هذا الأسبوع',
    vehicle: 'المركبة',
    langBtn: 'FR',

    tabMissions: 'المهام',
    tabInterventions: 'التدخلات',
    tabPlanning: 'البرنامج',
    tabKm: 'قراءة العداد',

    weekPlan: 'برنامج الأسبوع',
    noPlan: 'لا يوجد برنامج.',
    days: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    act: { MIS: 'مهمة', MNT: 'صيانة', FRM: 'تكوين', TRP: 'نقل شخصي', REP: 'راحة', DIS: 'متاح' },

    ivIntro: 'كل تدخل على مركبتك يجب أن تُصادق عليه أنت (الحائز).',
    ivNone: 'لا يوجد تدخل في انتظار مصادقتك.',
    ivValidate: 'أُصادق على التدخل',
    tireTransfer: 'تحويل إطار',
    tireMount: 'تركيب إطار',
    tirePos: 'الموضع {p} على {v}',
    tireFrom: ' (من {f})',
    tireValidate: 'أُصادق على التغيير',

    toValidateTitle: 'مهام في انتظار المصادقة',
    toValidateSub: 'أكّد أنك اطّلعت على هذه المهام.',
    iValidate: 'أُصادق',
    noMission: 'لا توجد مهام.',
    validatedByYou: '✓ صادقت عليها',
    start: 'بدء',
    finish: 'إنهاء',
    declare: 'التبليغ عن عطب / خلل',
    km: 'كلم',
    status: { PLANIFIEE: 'مُبرمجة', EN_COURS: 'جارية', TERMINEE: 'منتهية', CLOTUREE: 'مُقفلة', ANNULEE: 'مُلغاة' },
    ordreBtn: 'أمر المهمة',
    ordreTitle: 'أمر المهمة',
    ordreRoute: 'المسار',
    ordreDates: 'الانطلاق ← العودة',
    ordreDuration: 'المدة المقدّرة',
    ordreDriver: 'السائق',
    ordreVehicle: 'المركبة',
    ordreDistance: 'المسافة',
    ordreFrais: 'مصاريف المهمة',
    ordreScan: 'امسح للتحقق من الصحّة',
    ordreNotYet: 'سيتوفّر أمر المهمة عند الانطلاق.',
    close: 'إغلاق',

    declTitle: 'تبليغ',
    breakdown: 'عطب',
    anomaly: 'خلل',
    declDescribe: 'وصف (اختياري — يمكنك فقط تسجيل رسالة صوتية)',
    voiceMemo: 'رسالة صوتية',
    stopRec: 'إيقاف',
    photo: 'صورة',
    cancel: 'إلغاء',
    sendOt: 'إرسال (ينشئ أمر تدخل)',
    sending: 'جارٍ الإرسال…',

    kmRequestTitle: 'مطلوب قراءة العداد + الخزان',
    kmRequestSub: 'يحتاج المكتب إلى قراءتين شهريا: واحدة في بداية الشهر وأخرى في نهايته — العداد (كلم أو ساعات) ومستوى الخزان. بدونها لا يمكن حساب متابعة الوقود والصيانة.',
    kmNone: 'لا توجد قراءة مطلوبة حاليا.',
    kmMonthLabel: 'الشهر',
    kmLastKnown: 'آخر كلم معروف',
    kmLastKnownHours: 'آخر ساعات معروفة',
    kmCurrentReading: 'قراءة العداد الحالية (كلم)',
    kmCurrentHours: 'قراءة عداد الساعات الحالية (س)',
    kmPhotoOpt: 'صورة العداد (اختياري)',
    kmSend: 'إرسال القراءة',
    kmSent: 'تم إرسال القراءة — شكرا!',
    kmMustIncrease: 'يجب أن تكون القراءة أكبر من آخر قراءة ({v}).',
    kmRequired: 'أدخل قراءة العداد ومستوى الخزان.',
    kmReleveDebut: 'قراءة بداية الشهر',
    kmReleveFin: 'قراءة نهاية الشهر',
    kmReservoir: 'مستوى الخزان (لتر)',
    kmDejaFait: '✓ تم الإرسال',
    engin: 'آلة',
  },
};

export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
