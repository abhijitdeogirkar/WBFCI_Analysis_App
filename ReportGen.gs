/**
 * ============================================================
 *  ReportGen.gs — रिपोर्ट सेव्ह करणे व परत मिळवणे
 *  (Results शीटशी संवाद)
 * ============================================================
 */
var ReportGen = (function () {

  /** विश्लेषण निकाल Results शीटमध्ये लिहितो; reportId परत देतो */
  function saveReport(report, userEmail) {
    var reportId = 'RPT_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(),
        'yyyyMMdd_HHmmss') + '_' + Math.floor(Math.random() * 900 + 100);

    var sh = Utils.getSheet('Results');
    var rows = report.results.map(function (r) {
      return [
        reportId,
        report.uploadId,
        report.cropId,
        report.cropName || '',
        report.district,
        report.taluka || '',
        report.startDate,
        report.endDate,
        r.riskName,
        r.triggered ? 'TRUE' : 'FALSE',
        r.actualText,
        r.analysis,
        r.payout,
        new Date(),
        userEmail
      ];
    });

    if (rows.length) {
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    return reportId;
  }

  /** Results मधून रिपोर्ट परत बांधते */
  function getReportById(reportId) {
    var data = Utils.getSheet('Results').getDataRange().getValues();
    var idx = Utils.headerIndex(data);
    var rows = [];
    var meta = null;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idx.result_id] || '').trim() !== String(reportId).trim()) continue;

      if (!meta) {
        meta = {
          reportId: reportId,
          uploadId: String(data[r][idx.upload_id] || ''),
          cropId: String(data[r][idx.crop_id] || ''),
          cropName: String(data[r][idx.crop_name] || ''),
          district: String(data[r][idx.district] || ''),
          taluka: String(data[r][idx.taluka] || ''),
          startDate: Utils.fmtDate(Utils.parseDate(data[r][idx.period_start])),
          endDate: Utils.fmtDate(Utils.parseDate(data[r][idx.period_end])),
          generatedBy: String(data[r][idx.generated_by] || '')
        };
      }
      rows.push({
        riskName: String(data[r][idx.risk_name] || ''),
        triggered: String(data[r][idx.triggered] || '').toUpperCase() === 'TRUE',
        actualText: String(data[r][idx.actual_value] || ''),
        analysis: String(data[r][idx.analysis] || ''),
        payout: Number(data[r][idx.payout]) || 0
      });
    }

    if (!meta) throw new Error('रिपोर्ट सापडला नाही : ' + reportId);

    meta.results = rows;
    meta.totalPayout = rows.reduce(function (s, r) { return s + r.payout; }, 0);
    return meta;
  }

  return {
    saveReport: saveReport,
    getReportById: getReportById
  };
})();
