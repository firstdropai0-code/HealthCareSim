/**
 * Sign in, sign up, onboarding, and the Firebase error codes behind them.
 *
 * The auth pages render outside AppShell, so they carry no language toggle of
 * their own -- they follow whatever was chosen elsewhere in the app.
 */
export const en = {
  "auth.logoAlt": "First Drop AI — Healthcare Simulation",
  "auth.homeAria": "First Drop AI home",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.fullName": "Full name",

  "login.eyebrow": "Sign in",
  "login.title": "Welcome back.",
  "login.intro": "Trainees pick up where they left off. Mentors go straight to their group.",
  "login.noAccount": "No account yet?",
  "login.createOne": "Create one",
  "login.submit": "Sign in",

  "signup.eyebrow": "Create account",
  "signup.title": "Set up your account.",
  "signup.haveOne": "Already have one?",
  "signup.signIn": "Sign in",
  "signup.nameHint": "Your mentor sees this next to your results.",
  "signup.passwordHint": "At least 6 characters.",
  "signup.submit": "Create account",

  "onboarding.waitEyebrow": "One moment",
  "onboarding.waitTitle": "Loading your account...",
  "onboarding.eyebrow": "Finish setup",
  "onboarding.title": "Your account needs a profile.",
  "onboarding.intro":
    "Signed in as {email}. This step did not complete last time — it only takes a moment.",
  "onboarding.yourAccount": "your account",
  "onboarding.signOut": "Sign out instead",
  "onboarding.submit": "Finish setup",

  "roleChoice.legend": "I am a",
  "roleChoice.trainee": "Trainee",
  "roleChoice.traineeBlurb": "Run scenarios, get feedback, and track your progress.",
  "roleChoice.mentor": "Mentor",
  "roleChoice.mentorBlurb": "Write scenarios, invite trainees, and review their performance.",
  "roleChoice.permanent": "This cannot be changed later.",

  "authUnconfigured.eyebrow": "Backend not connected",
  "authUnconfigured.title": "Accounts are not set up yet.",
  "authUnconfigured.intro":
    "Add the NEXT_PUBLIC_FIREBASE_* values to .env.local and restart the dev server. Scenarios, simulations, and feedback keep working without them.",
  "authUnconfigured.cta": "Go to the scenario creator",

  "authError.invalidEmail": "That email address does not look right.",
  "authError.missingPassword": "Enter your password.",
  "authError.weakPassword": "Pick a password with at least 6 characters.",
  "authError.emailInUse": "An account already uses that email. Try signing in instead.",
  "authError.badCredentials": "Email or password is incorrect.",
  "authError.tooMany": "Too many attempts. Wait a minute and try again.",
  "authError.network": "Could not reach the server. Check your connection.",
  "authError.disabled":
    "Email and password sign-in is disabled for this Firebase project. Enable it in Authentication → Sign-in method.",
} as const;

export const hi: Record<keyof typeof en, string> = {
  "auth.logoAlt": "First Drop AI — हेल्थकेयर सिमुलेशन",
  "auth.homeAria": "First Drop AI होम",
  "auth.email": "ईमेल",
  "auth.password": "पासवर्ड",
  "auth.fullName": "पूरा नाम",

  "login.eyebrow": "साइन इन",
  "login.title": "फिर से स्वागत है।",
  "login.intro": "ट्रेनी वहीं से शुरू करते हैं जहाँ छोड़ा था। मेंटर सीधे अपने ग्रुप पर पहुँचते हैं।",
  "login.noAccount": "अभी तक अकाउंट नहीं है?",
  "login.createOne": "नया बनाएँ",
  "login.submit": "साइन इन करें",

  "signup.eyebrow": "अकाउंट बनाएँ",
  "signup.title": "अपना अकाउंट सेट करें।",
  "signup.haveOne": "पहले से अकाउंट है?",
  "signup.signIn": "साइन इन करें",
  "signup.nameHint": "आपके मेंटर आपके नतीजों के साथ यही नाम देखते हैं।",
  "signup.passwordHint": "कम से कम 6 अक्षर।",
  "signup.submit": "अकाउंट बनाएँ",

  "onboarding.waitEyebrow": "एक पल",
  "onboarding.waitTitle": "आपका अकाउंट लोड हो रहा है...",
  "onboarding.eyebrow": "सेटअप पूरा करें",
  "onboarding.title": "आपके अकाउंट को एक प्रोफ़ाइल चाहिए।",
  "onboarding.intro":
    "{email} के रूप में साइन इन हैं। पिछली बार यह कदम पूरा नहीं हुआ था — इसमें बस एक पल लगेगा।",
  "onboarding.yourAccount": "आपके अकाउंट",
  "onboarding.signOut": "इसके बजाय साइन आउट करें",
  "onboarding.submit": "सेटअप पूरा करें",

  "roleChoice.legend": "मैं हूँ",
  "roleChoice.trainee": "ट्रेनी",
  "roleChoice.traineeBlurb": "परिदृश्य चलाएँ, फ़ीडबैक पाएँ और अपनी प्रगति देखें।",
  "roleChoice.mentor": "मेंटर",
  "roleChoice.mentorBlurb": "परिदृश्य लिखें, ट्रेनी को बुलाएँ और उनके प्रदर्शन की समीक्षा करें।",
  "roleChoice.permanent": "इसे बाद में बदला नहीं जा सकता।",

  "authUnconfigured.eyebrow": "बैकएंड जुड़ा नहीं है",
  "authUnconfigured.title": "अकाउंट अभी सेट नहीं हुए हैं।",
  "authUnconfigured.intro":
    ".env.local में NEXT_PUBLIC_FIREBASE_* मान जोड़ें और dev सर्वर फिर से शुरू करें। परिदृश्य, सिमुलेशन और फ़ीडबैक इनके बिना भी चलते रहते हैं।",
  "authUnconfigured.cta": "परिदृश्य निर्माता पर जाएँ",

  "authError.invalidEmail": "यह ईमेल पता सही नहीं लगता।",
  "authError.missingPassword": "अपना पासवर्ड डालें।",
  "authError.weakPassword": "कम से कम 6 अक्षरों वाला पासवर्ड चुनें।",
  "authError.emailInUse": "इस ईमेल से पहले से एक अकाउंट है। इसके बजाय साइन इन करके देखें।",
  "authError.badCredentials": "ईमेल या पासवर्ड गलत है।",
  "authError.tooMany": "बहुत ज़्यादा कोशिशें हो गईं। एक मिनट रुककर फिर से कोशिश करें।",
  "authError.network": "सर्वर तक नहीं पहुँच सके। अपना इंटरनेट कनेक्शन जाँचें।",
  "authError.disabled":
    "इस Firebase प्रोजेक्ट में ईमेल और पासवर्ड से साइन इन बंद है। इसे Authentication → Sign-in method में चालू करें।",
};
