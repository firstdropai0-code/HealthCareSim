/**
 * The trainee's progress page and the chart components the mentor's trainee
 * view shares with it: the skill tree, the cohort comparison, the trend line,
 * the radar and the histogram.
 */
export const en = {
  "progress.intro":
    "Built from your scored cases. Practice runs that could not be scored are listed but do not move these numbers.",
  "progress.lastActive": "Last active",
  "progress.focus": "Focus",
  "progress.notSaved": "You are not in a group yet, so your cases are not being saved.",
  "progress.enterCode": "Enter a join code",
  "progress.firstStarts": "Your first scored case starts the skill tree.",
  "progress.startCase": "Start a case",
  "progress.overTime": "Over time",
  "progress.scoreTrend": "Score trend",
  "progress.profile": "Profile",
  "progress.treeIntro": "Your mentor's cases, grouped by track and level.",
  "progress.notScored": "Not scored",

  "average.noneTitle": "No scored cases yet",
  "average.label": "Average across cases",

  "cohort.label": "Your group",
  "cohort.notOpen": "Comparison not open yet",
  "cohort.notOpenBody":
    "Group comparison opens once {trainees} trainees have completed {runs} cases at this level. Comparing across a smaller group would say more about who happened to practise than about how anyone is doing.",
  "cohort.trainees": "Trainees",
  "cohort.casesCompleted": "Cases completed",
  "cohort.comparedOn": "Compared on {bucket}",
  "cohort.bucket.case": "this case",
  "cohort.bucket.track": "{track} at {level} level",
  "cohort.bucket.level": "{level} cases",
  "cohort.summary.one":
    "Group average {mean} across {count} case from {trainees} trainees. Names are never shown, in either direction.",
  "cohort.summary.other":
    "Group average {mean} across {count} cases from {trainees} trainees. Names are never shown, in either direction.",
  "cohort.lower": "Lower quarter",
  "cohort.middle": "Middle",
  "cohort.upper": "Upper quarter",
  "cohort.yourLatest": "Your latest score on this is {score}.",
  "cohort.yourLatestAbove":
    "Your latest score on this is {score}, above {pct}% of the group's runs at this level.",
  "cohort.completeOne": "Complete a case at this level to see where you sit.",

  "trend.needTwo": "Two scored cases will start your trend line.",
  "trend.aria": "Scores over {n} cases, oldest first: {scores}",
  "trend.oldest": "Oldest",
  "trend.latest": "Latest · {score}/10",

  "histogram.empty": "No scored cases in this group yet.",
  "histogram.barAria": "{count} at {score} out of 10",
  "histogram.caption.one": "Overall score, 1–10. {count} scored case.",
  "histogram.caption.other": "Overall score, 1–10. {count} scored cases.",

  "radar.empty": "Complete a scored case to see your skill profile.",
  "radar.aria": "{skill} {value} out of 10",
  "radar.arrows": "Arrows compare your last 3 cases with the 3 before them.",
  "radar.arrowsLater": "Movement arrows appear once you have 6 scored cases.",

  "tree.status.cleared": "Cleared",
  "tree.status.tried": "In progress",
  "tree.status.open": "Ready to start",
  "tree.status.none": "No case yet",
  "tree.detail.cleared": "Best score {score}/10.",
  "tree.detail.tried": "Best so far {score}/10. Score {target} or more to clear it.",
  "tree.detail.open": "Score {target} or more to clear it.",
  "tree.detail.none": "Your mentor has not set a case at this level.",
  "tree.suggested": "Suggested next",
  "tree.suggestedLegend": "the easiest level in a track you have not cleared yet",
  "tree.start": "Start",
  "tree.tryAgain": "Try again",
  "tree.practiseAgain": "Practise again",
  "tree.overall": "You have cleared {done} of {total} levels.",
  "tree.rule":
    "Each track goes from foundational to advanced. Score {score} or more on a level to clear it. You can start any case your mentor has set, in any order.",
  "tree.legend": "What each status means",
  "tree.trackProgress": "{done} of {total} cleared",
  "tree.emptyTitle": "Your mentor has not set any cases yet.",
  "tree.emptyBody": "Tracks appear here as cases are published to your group.",
  "tree.dormant": "Not in your programme yet: {tracks}.",
} as const;

export const hi: Record<keyof typeof en, string> = {
  "progress.intro":
    "आपके स्कोर वाले केसों से बना। जिन अभ्यास रन का स्कोर नहीं बन सका, वे सूची में दिखते हैं लेकिन इन आँकड़ों को नहीं बदलते।",
  "progress.lastActive": "पिछली बार सक्रिय",
  "progress.focus": "ध्यान दें",
  "progress.notSaved": "आप अभी किसी ग्रुप में नहीं हैं, इसलिए आपके केस सहेजे नहीं जा रहे हैं।",
  "progress.enterCode": "जॉइन कोड डालें",
  "progress.firstStarts": "आपका पहला स्कोर वाला केस कौशल वृक्ष की शुरुआत करेगा।",
  "progress.startCase": "केस शुरू करें",
  "progress.overTime": "समय के साथ",
  "progress.scoreTrend": "स्कोर का रुझान",
  "progress.profile": "प्रोफ़ाइल",
  "progress.treeIntro": "आपके मेंटर के केस, ट्रैक और स्तर के अनुसार।",
  "progress.notScored": "स्कोर नहीं बना",

  "average.noneTitle": "अभी कोई स्कोर वाला केस नहीं",
  "average.label": "सभी केसों का औसत",

  "cohort.label": "आपका ग्रुप",
  "cohort.notOpen": "तुलना अभी खुली नहीं है",
  "cohort.notOpenBody":
    "ग्रुप से तुलना तब खुलेगी जब {trainees} ट्रेनी इस स्तर पर {runs} केस पूरे कर लेंगे। छोटे ग्रुप में तुलना से यह ज़्यादा पता चलता है कि किसने अभ्यास किया, न कि कौन कैसा कर रहा है।",
  "cohort.trainees": "ट्रेनी",
  "cohort.casesCompleted": "पूरे किए गए केस",
  "cohort.comparedOn": "तुलना: {bucket}",
  "cohort.bucket.case": "यही केस",
  "cohort.bucket.track": "{level} स्तर पर {track}",
  "cohort.bucket.level": "{level} स्तर के केस",
  "cohort.summary.one":
    "{trainees} ट्रेनी के {count} केस में ग्रुप का औसत {mean} है। नाम कभी नहीं दिखाए जाते, किसी भी तरफ़ से।",
  "cohort.summary.other":
    "{trainees} ट्रेनी के {count} केसों में ग्रुप का औसत {mean} है। नाम कभी नहीं दिखाए जाते, किसी भी तरफ़ से।",
  "cohort.lower": "निचला चौथाई",
  "cohort.middle": "बीच",
  "cohort.upper": "ऊपरी चौथाई",
  "cohort.yourLatest": "इस पर आपका पिछला स्कोर {score} है।",
  "cohort.yourLatestAbove":
    "इस पर आपका पिछला स्कोर {score} है, जो इस स्तर पर ग्रुप के {pct}% रन से ऊपर है।",
  "cohort.completeOne": "आप कहाँ हैं यह देखने के लिए इस स्तर पर एक केस पूरा करें।",

  "trend.needTwo": "दो स्कोर वाले केसों के बाद आपकी रुझान रेखा शुरू होगी।",
  "trend.aria": "{n} केसों के स्कोर, सबसे पुराना पहले: {scores}",
  "trend.oldest": "सबसे पुराना",
  "trend.latest": "सबसे नया · {score}/10",

  "histogram.empty": "इस ग्रुप में अभी कोई स्कोर वाला केस नहीं।",
  "histogram.barAria": "10 में से {score} पर {count}",
  "histogram.caption.one": "कुल स्कोर, 1–10। {count} स्कोर वाला केस।",
  "histogram.caption.other": "कुल स्कोर, 1–10। {count} स्कोर वाले केस।",

  "radar.empty": "अपनी कौशल प्रोफ़ाइल देखने के लिए एक स्कोर वाला केस पूरा करें।",
  "radar.aria": "{skill} 10 में से {value}",
  "radar.arrows": "तीर आपके पिछले 3 केसों की तुलना उनसे पहले के 3 केसों से करते हैं।",
  "radar.arrowsLater": "6 स्कोर वाले केस पूरे होने पर बदलाव के तीर दिखेंगे।",

  "tree.status.cleared": "पार किया",
  "tree.status.tried": "जारी है",
  "tree.status.open": "शुरू करने के लिए तैयार",
  "tree.status.none": "अभी कोई केस नहीं",
  "tree.detail.cleared": "सबसे अच्छा स्कोर {score}/10।",
  "tree.detail.tried": "अब तक सबसे अच्छा {score}/10। पार करने के लिए {target} या उससे ज़्यादा स्कोर करें।",
  "tree.detail.open": "पार करने के लिए {target} या उससे ज़्यादा स्कोर करें।",
  "tree.detail.none": "आपके मेंटर ने इस स्तर पर कोई केस तय नहीं किया है।",
  "tree.suggested": "अगला सुझाव",
  "tree.suggestedLegend": "किसी ट्रैक का सबसे आसान स्तर जो आपने अभी पार नहीं किया है",
  "tree.start": "शुरू करें",
  "tree.tryAgain": "फिर से आज़माएँ",
  "tree.practiseAgain": "फिर से अभ्यास करें",
  "tree.overall": "आपने {total} में से {done} स्तर पार किए हैं।",
  "tree.rule":
    "हर ट्रैक आधारभूत से उन्नत तक जाता है। किसी स्तर को पार करने के लिए उस पर {score} या उससे ज़्यादा स्कोर करें। आप अपने मेंटर का तय किया कोई भी केस, किसी भी क्रम में शुरू कर सकते हैं।",
  "tree.legend": "हर स्थिति का मतलब",
  "tree.trackProgress": "{total} में से {done} पार",
  "tree.emptyTitle": "आपके मेंटर ने अभी तक कोई केस तय नहीं किया है।",
  "tree.emptyBody": "आपके ग्रुप में केस प्रकाशित होते ही ट्रैक यहाँ दिखने लगेंगे।",
  "tree.dormant": "अभी आपके कार्यक्रम में नहीं: {tracks}।",
};
