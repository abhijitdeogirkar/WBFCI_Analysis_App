/**
 * ============================================================
 *  Code.gs — मुख्य फाइल : वेब ॲप राउटिंग व सामान्य कार्ये
 *  हवामान आधारित फळपिक विमा — ट्रिगर विश्लेषण ॲप
 * ============================================================
 */

var APP_NAME = 'फळपिक विमा ट्रिगर विश्लेषण';

/**
 * वेब ॲपचा प्रवेशबिंदू (entry point).
 *   URL: ...exec                    → Index  (लॉगिन तपासणी + डॅशबोर्ड)
 *   URL: ...exec?page=upload        → Upload (Excel अपलोड)
 *   URL: ...exec?page=report&id=XXX → Report (रिपोर्ट पहा)
 */
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) ? String(e.parameter.page) : 'index';

  var pageFile = 'Index';
  if (page === 'upload') pageFile = 'Upload';
  else if (page === 'report') pageFile = 'Report';

  var t = HtmlService.createTemplateFromFile(pageFile);
  t.pageName = page;
  t.reportId = (e && e.parameter && e.parameter.id) ? String(e.parameter.id) : '';

  return t.evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Styles.html / JS.html यांचा कोड पृष्ठात समाविष्ट करण्यासाठी */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ================= क्लायंट-कॉल फंक्शन्स ================= */
/* (फ्रंटएंडमधून google.script.run.फंक्शननाव() असे कॉल होतात) */

/** सध्याच्या वापरकर्त्याची माहिती (लॉगिन + भूमिका) */
function getUserInfo() {
  return Auth.getUserInfo();
}

/** Config_Crops मधून पिकांची यादी */
function getCropsList() {
  Auth.requireRole(['admin', 'officer', 'operator']);
  return Utils.getCropsList();
}

/**
 * Excel मधून वाचलेला डेटा सेव्ह करून ट्रिगर विश्लेषण चालवते.
 * payload = { cropId, cropName, startDate, endDate, district, taluka,
 *             source, fileName, rows: [{date, rainfall_mm, max_temp,
 *             min_temp, humidity_pct, wind_speed}, ...] }
 */
function analyzeWeatherData(payload) {
  var user = Auth.requireRole(['admin', 'operator']);
  try {
    var uploadId = Utils.saveWeatherData(payload, user.email);

    var report = TriggerEngine.evaluateAllTriggers(
      payload.cropId,
      payload.startDate,
      payload.endDate,
      payload.district,
      payload.taluka,
      uploadId
    );
    report.cropName = payload.cropName || '';
    report.reportId = ReportGen.saveReport(report, user.email);

    Utils.appendAuditLog(user.email, 'ANALYZE',
      'पीक=' + payload.cropId + ' | जिल्हा=' + payload.district +
      ' | upload=' + uploadId);

    return report;
  } catch (err) {
    Utils.appendAuditLog(user.email, 'ANALYZE_FAILED', String(err));
    throw err;
  }
}

/** आधी तयार केलेला रिपोर्ट परत मिळवते */
function getReportById(reportId) {
  Auth.requireRole(['admin', 'officer', 'operator']);
  return ReportGen.getReportById(reportId);
}
