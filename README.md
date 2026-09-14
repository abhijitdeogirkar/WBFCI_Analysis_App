# हवामान आधारित फळपिक विमा — ट्रिगर विश्लेषण ॲप

शासन निर्णय क्र. पीएफआयओ-2024/प्र.क्र. 81/10-अ, दिनांक 12 जून 2024
(सुधारित हवामान आधारित फळपिक विमा योजना 2024-25, 2025-26 — महाराष्ट्र शासन) वर आधारित.

हे ॲप स्कायमेट/हवामान केंद्राकडून मिळालेला दैनंदिन हवामान डेटा (Excel/CSV) घेऊन,
निवडलेल्या फळपिकासाठी शासन निर्णयातील ट्रिगर प्रमाणके तपासते आणि सविस्तर
रिपोर्ट (कोणते ट्रिगर लागू झाले / न झाले, कारणे, भरपाई रक्कम) तयार करते.

## समर्थित डेटा स्वरूप (स्कायमेट CSV नुसार)

District, Tehsil, Location, Date, Max_Temp, Min_Temp,
Humidity_0830, Humidity_1730, Max_Wind, Cumulative_Rain

- Cumulative_Rain = दैनंदिन पाऊस (मिमी)
- आद्रता = Humidity_0830 व Humidity_1730 ची सरासरी
- Max_Wind = कमाल वाऱ्याचा वेग
- एका फाइलमध्ये अनेक हवामान केंद्रे (Location) असल्यास — अपलोड केल्यावर
  केंद्र निवडण्याची dropdown येते; फक्त निवडलेल्या केंद्राचाच विश्लेषण होतो.
- मराठी कॉलम नावेही (तारीख, पाऊस, कमाल तापमान, इ.) ओळखली जातात.

## फाइल रचना

```
gas/   → Google Apps Script (बॅकएंड)
  Code.gs           — मुख्य राउटिंग (doGet) व क्लायंट-कॉल फंक्शन्स
  Auth.gs           — प्रवेश नियंत्रण (admin / officer / operator)
  TriggerEngine.gs  — ट्रिगर मूल्यांकन इंजिन (मुख्य लॉजिक)
  ReportGen.gs      — रिपोर्ट Results शीटमध्ये सेव्ह करणे / परत मिळवणे
  Utils.gs          — Sheet helpers, तारीख रूपांतर, audit log
  appsscript.json   — Apps Script manifest (सेटिंग्ज)

html/  → फ्रंटएंड पृष्ठे
  Index.html   — पहिले पृष्ठ (लॉगिन तपासणी + डॅशबोर्ड)
  Upload.html  — Excel अपलोड + केंद्र निवड + विश्लेषण
  Report.html  — रिपोर्ट प्रदर्शन + प्रिंट/PDF
  Styles.html  — सर्व पृष्ठांची रचना/रंग (CSS)
  JS.html      — क्लायंट जावास्क्रिप्ट (SheetJS द्वारे Excel/CSV वाचतो)
```

## Apps Script मध्ये कोड कसा टाकावा

1. Google Sheet → **Extensions → Apps Script** उघडा.
2. तिथे आधीपासून असलेल्या `Code.gs` मध्ये `gas/Code.gs` चा कोड paste करा.
3. डावीकडील **+** बटण → **Script** → नाव `Auth` असे द्या → `gas/Auth.gs` चा कोड paste करा.
   तसेच `TriggerEngine`, `ReportGen`, `Utils` या नावांच्या फाइल्स तयार करा.
4. **+** बटण → **HTML** → नाव बरोबर `Index` (एक्स्टेंशन शिवाय) → `html/Index.html` चा कोड paste करा.
   तसेच `Upload`, `Report`, `Styles`, `JS` या नावांच्या HTML फाइल्स तयार करा.
5. **Project Settings** → "Show 'appsscript.json' manifest file in editor" सक्षम करा →
   उजवीकडे दिसणाऱ्या appsscript.json मध्ये `gas/appsscript.json` चा कोड paste करा.
6. **Deploy → New deployment → Web app** :
   - Execute as : **Me**
   - Who has access : **Anyone with Google account**
   - Deploy करून URL घ्या.
7. URL फक्त अधिकृत सहकाऱ्यांना द्या — **Users शीटमध्ये नोंद नसलेल्याला ॲप परवानगी देत नाही.**

## Google Sheet च्या शीट्स

| शीट | काम | कोण भरते |
|---|---|---|
| Config_Crops | पिकांची यादी, हंगाम, जिल्हे | ॲडमिन (हाताने) |
| Config_Triggers | प्रत्येक पिकाची ट्रिगर प्रमाणके | ॲडमिन (हाताने) |
| Weather_Data | अपलोड केलेला हवामान डेटा | ॲप आपोआप |
| Results | प्रत्येक विश्लेषणाचा निकाल | ॲप आपोआप |
| Users | वापरकर्ते व भूमिका | ॲडमिन (हाताने) |
| Audit_Log | सर्व क्रियांचा अभिलेख | ॲप आपोआप |

## सुरक्षा

- प्रवेश फक्त Users शीटमधील नोंदलेल्या ईमेलना (Google खाते लॉगिन सोबत).
- भूमिका : `admin` (सर्व अधिकार), `operator` (अपलोड + विश्लेषण),
  `officer` (रिपोर्ट पाहणे).
- प्रत्येक क्रियेचा (अपलोड / विश्लेषण / अयशस्वी प्रयत्न) Audit_Log मध्ये अभिलेख.
- हा GitHub रिपॉझिटरी **Private** ठेवा; कोणतेही बदल फक्त pull request द्वारे.
