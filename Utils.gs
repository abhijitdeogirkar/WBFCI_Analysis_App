/**
 * ============================================================
 *  Utils.gs — सामान्य उपयुक्त फंक्शन्स
 *  (Sheet helpers, तारीख रूपांतर, हवामान डेटा सेव्ह, audit log)
 * ============================================================
 */
var Utils = (function () {

  function getSS() { return SpreadsheetApp.getActiveSpreadsheet(); }

  /** नावाने Sheet शोधते — न सापडल्यास स्पष्ट Error */
  function getSheet(name) {
    var sh = getSS().getSheetByName(name);
    if (!sh) throw new Error('Sheet सापडली नाही : "' + name + '"');
    return sh;
  }

  /** शीटच्या header ओळीचा नाव→index map तयार करते */
  function headerIndex(data) {
    var idx = {};
    data[0].forEach(function (h, i) { idx[String(h).trim()] = i; });
    return idx;
  }

  /* ---------- Config_Crops मधून वाचणे ---------- */

  function getCropsList() {
    var data = getSheet('Config_Crops').getDataRange().getValues();
    var idx = headerIndex(data);
    var list = [];
    for (var r = 1; r < data.length; r++) {
      if (!data[r][idx.crop_id]) continue;
      list.push({
        cropId: String(data[r][idx.crop_id]).trim(),
        cropName: String(data[r][idx.crop_name] || '').trim(),
        season: String(data[r][idx.season] || '').trim(),
        districts: String(data[r][idx.districts] || '')
          .split(',').map(function (d) { return d.trim(); }).filter(String)
      });
    }
    return list;
  }

  /* ---------- तारीख रूपांतर ---------- */

  /** '2024-06-15' किंवा '15/06/2024' → Date; अशक्य असल्यास null */
  function parseDate(v) {
    if (v instanceof Date && !isNaN(v)) return v;
    if (v === null || v === undefined || v === '') return null;
    var s = String(v).trim();
    var m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) {
      return new Date(+m[1], +m[2] - 1, +m[3]);
    }
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/))) {
      return new Date(+m[3], +m[2] - 1, +m[1]);
    }
    return null;
  }

  function fmtDate(d) {
    if (!d) return '';
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  /* ---------- हवामान डेटा सेव्ह ---------- */

  /**
   * क्लायंटकडून आलेला Excel डेटा Weather_Data शीटमध्ये लिहितो.
   * परत uploadId देतो (त्याच वेळेचा विशिष्ट batch ओळखक).
   */
  function saveWeatherData(payload, userEmail) {
    var uploadId = 'UP_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(),
        'yyyyMMdd_HHmmss') + '_' + Math.floor(Math.random() * 900 + 100);

    var sh = getSheet('Weather_Data');
    var rows = payload.rows.map(function (r) {
      return [
        r.date,
        payload.district || '',
        payload.taluka || '',
        Number(r.rainfall_mm) || 0,
        (r.max_temp === null || r.max_temp === undefined || r.max_temp === '') ? '' : Number(r.max_temp),
        (r.min_temp === null || r.min_temp === undefined || r.min_temp === '') ? '' : Number(r.min_temp),
        (r.humidity_pct === null || r.humidity_pct === undefined || r.humidity_pct === '') ? '' : Number(r.humidity_pct),
        (r.wind_speed === null || r.wind_speed === undefined || r.wind_speed === '') ? '' : Number(r.wind_speed),
        payload.source || 'Skymet',
        uploadId,
        new Date()
      ];
    });

    if (rows.length) {
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    appendAuditLog(userEmail, 'UPLOAD',
      'फाइल=' + (payload.fileName || '-') + ' | ओळी=' + rows.length +
      ' | जिल्हा=' + (payload.district || '-') + ' | upload=' + uploadId);

    return uploadId;
  }

  /* ---------- Audit log ---------- */

  /** प्रत्येक क्रियेची नोंद Audit_Log मध्ये जोडते */
  function appendAuditLog(userEmail, action, details) {
    try {
      var sh = getSheet('Audit_Log');
      sh.appendRow(['LOG_' + Date.now(), new Date(), userEmail, action, details, '', '']);
    } catch (e) {
      // audit log अपयशी झाला तरी मुख्य क्रिया थांबू नये
    }
  }

  return {
    getSheet: getSheet,
    headerIndex: headerIndex,
    getCropsList: getCropsList,
    parseDate: parseDate,
    fmtDate: fmtDate,
    saveWeatherData: saveWeatherData,
    appendAuditLog: appendAuditLog
  };
})();
