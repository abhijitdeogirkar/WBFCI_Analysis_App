/**
 * ============================================================
 *  TriggerEngine.gs — ट्रिगर मूल्यांकन इंजिन (ॲपचा केंद्रबिंदू)
 *
 *  Config_Triggers शीटमधील प्रत्येक ओळ = एक ट्रिगर प्रमाणक.
 *  param_type नुसार योग्य तपासणी फंक्शन कॉल होते :
 *
 *   consecutive_rainfall : सलग N दिवस प्रतिदिन X मिमी'पेक्षा जास्त पाऊस
 *   rainfall_total       : कालावधीत एकूण पाऊस मर्यादेशी तुलना (जास्त/कमी)
 *   temp_low             : कमीत कमी तापमान X°C पेक्षा कमी (कमीत कमी M दिवस)
 *   temp_high            : कमाल तापमान X°C पेक्षा जास्त (कमीत कमी M दिवस)
 *   humidity             : आद्रता X% पेक्षा जास्त (कमीत कमी M दिवस)
 *   wind                 : वाऱ्याचा वेग X पेक्षा जास्त (कमीत कमी M दिवस)
 * ============================================================
 */
var TriggerEngine = (function () {

  /* ---- Config_Triggers मधून या पिकाचे सर्व ट्रिगर्स ---- */
  function getTriggerConfig(cropId) {
    var data = Utils.getSheet('Config_Triggers').getDataRange().getValues();
    var idx = Utils.headerIndex(data);
    var list = [];
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idx.crop_id] || '').trim() !== String(cropId).trim()) continue;
      list.push({
        triggerId: String(data[r][idx.trigger_id] || '').trim(),
        riskName: String(data[r][idx.risk_name] || '').trim(),
        periodStart: Utils.parseDate(data[r][idx.period_start]),
        periodEnd: Utils.parseDate(data[r][idx.period_end]),
        paramType: String(data[r][idx.param_type] || '').trim().toLowerCase(),
        threshold: Number(data[r][idx.threshold_value]) || 0,
        operator: String(data[r][idx.operator] || '>=').trim(),
        consecutiveDays: Number(data[r][idx.consecutive_days]) || 0,
        minDays: Number(data[r][idx.min_days]) || 0,
        payoutAmount: Number(data[r][idx.payout_amount]) || 0,
        maxPayout: Number(data[r][idx.max_payout]) || 0
      });
    }
    return list;
  }

  /* ---- Weather_Data मधून या upload च्या ओळी (कालावधी निहाय) ---- */
  function getWeatherRows(uploadId, startDate, endDate) {
    var data = Utils.getSheet('Weather_Data').getDataRange().getValues();
    var idx = Utils.headerIndex(data);
    var start = Utils.parseDate(startDate);
    var end = Utils.parseDate(endDate);
    var rows = [];

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idx.upload_id] || '').trim() !== String(uploadId).trim()) continue;
      var d = Utils.parseDate(data[r][idx.date]);
      if (!d) continue;
      if (start && d < start) continue;
      if (end && d > end) continue;
      rows.push({
        date: d,
        dateStr: Utils.fmtDate(d),
        rainfall: Number(data[r][idx.rainfall_mm]) || 0,
        maxTemp: data[r][idx.max_temp] === '' ? null : Number(data[r][idx.max_temp]),
        minTemp: data[r][idx.min_temp] === '' ? null : Number(data[r][idx.min_temp]),
        humidity: data[r][idx.humidity_pct] === '' ? null : Number(data[r][idx.humidity_pct]),
        wind: data[r][idx.wind_speed] === '' ? null : Number(data[r][idx.wind_speed])
      });
    }
    rows.sort(function (a, b) { return a.date - b.date; });
    return rows;
  }

  /* ---- मुख्य फंक्शन : सर्व ट्रिगर्सचे मूल्यांकन ---- */
  function evaluateAllTriggers(cropId, startDate, endDate, district, taluka, uploadId) {
    var triggers = getTriggerConfig(cropId);
    if (!triggers.length) {
      throw new Error('या पिकासाठी Config_Triggers मध्ये प्रमाणके नोंदलेली नाहीत (पीक : ' + cropId + ').');
    }

    var weather = getWeatherRows(uploadId, startDate, endDate);
    if (!weather.length) {
      throw new Error('निवडलेल्या कालावधीत हवामान डेटा सापडला नाही.');
    }

    var results = triggers.map(function (t) {
      var periodData = weather.filter(function (w) {
        if (t.periodStart && w.date < t.periodStart) return false;
        if (t.periodEnd && w.date > t.periodEnd) return false;
        return true;
      });
      var res = evaluateSingle(t, periodData);
      if (t.maxPayout > 0 && res.payout > t.maxPayout) res.payout = t.maxPayout;
      return res;
    });

    var totalPayout = 0, triggeredCount = 0;
    results.forEach(function (r) {
      totalPayout += (r.payout || 0);
      if (r.triggered) triggeredCount++;
    });

    return {
      cropId: cropId,
      district: district,
      taluka: taluka || '',
      startDate: Utils.fmtDate(Utils.parseDate(startDate)),
      endDate: Utils.fmtDate(Utils.parseDate(endDate)),
      uploadId: uploadId,
      dataDays: weather.length,
      totalPayout: totalPayout,
      triggeredCount: triggeredCount,
      notTriggeredCount: results.length - triggeredCount,
      results: results
    };
  }

  /* ---- एका ट्रिगरचे मूल्यांकन ---- */
  function evaluateSingle(t, data) {
    var fn = {
      'consecutive_rainfall': checkConsecutiveRainfall,
      'rainfall_total': checkTotalRainfall,
      'temp_low': checkTempLow,
      'temp_high': checkTempHigh,
      'humidity': checkHumidity,
      'wind': checkWindSpeed
    }[t.paramType];

    if (!fn) {
      return mkResult(t, false, 0, 'अज्ञात param_type : ' + t.paramType, '');
    }
    if (!data.length) {
      return mkResult(t, false, 0, 'या ट्रिगरच्या कालावधीत हवामान डेटा नाही.', '');
    }
    return fn(t, data);
  }

  function mkResult(t, triggered, payout, analysis, actualText) {
    return {
      triggerId: t.triggerId,
      riskName: t.riskName,
      paramType: t.paramType,
      period: Utils.fmtDate(t.periodStart) + ' ते ' + Utils.fmtDate(t.periodEnd),
      thresholdText: thresholdText(t),
      triggered: triggered,
      payout: payout || 0,
      actualText: actualText || '',
      analysis: analysis || ''
    };
  }

  function thresholdText(t) {
    switch (t.paramType) {
      case 'consecutive_rainfall':
        return 'सलग ' + t.consecutiveDays + ' दिवस, प्रतिदिन ' + t.threshold + ' मिमी' + t.operator + ' पाऊस';
      case 'rainfall_total':
        return 'एकूण पाऊस ' + t.operator + ' ' + t.threshold + ' मिमी';
      case 'temp_low':
        return 'कमीत कमी तापमान ' + t.operator + ' ' + t.threshold + '\u00B0C, कमीत कमी ' + (t.minDays || 1) + ' दिवस';
      case 'temp_high':
        return 'कमाल तापमान ' + t.operator + ' ' + t.threshold + '\u00B0C, कमीत कमी ' + (t.minDays || 1) + ' दिवस';
      case 'humidity':
        return 'आद्रता ' + t.operator + ' ' + t.threshold + '%, कमीत कमी ' + (t.minDays || 1) + ' दिवस';
      case 'wind':
        return 'वाऱ्याचा वेग ' + t.operator + ' ' + t.threshold + ', कमीत कमी ' + (t.minDays || 1) + ' दिवस';
      default:
        return '';
    }
  }

  /* ================= तपासणी फंक्शन्स ================= */

  /** 1. सलग पाऊस : सलग N दिवस प्रतिदिन X मिमी पेक्षा जास्त */
  function checkConsecutiveRainfall(t, data) {
    var best = 0, bestStart = '', bestEnd = '';
    var cur = 0, curStart = '';

    data.forEach(function (w) {
      if (compare(w.rainfall, t.operator, t.threshold)) {
        if (cur === 0) curStart = w.dateStr;
        cur++;
        if (cur > best) { best = cur; bestStart = curStart; bestEnd = w.dateStr; }
      } else {
        cur = 0;
      }
    });

    var triggered = best >= t.consecutiveDays;
    return mkResult(t, triggered, triggered ? t.payoutAmount : 0,
      triggered
        ? 'लागू — ' + bestStart + ' ते ' + bestEnd + ' दरम्यान सलग ' + best +
          ' दिवस प्रतिदिन ' + t.threshold + ' मिमी' + t.operator + ' पाऊस झाला. (आवश्यक : सलग ' + t.consecutiveDays + ' दिवस)'
        : 'लागू नाही — कमाल सलग ' + best + ' दिवस अट पूर्ण झाली. (आवश्यक : सलग ' + t.consecutiveDays + ' दिवस)',
      'कमाल सलग दिवस : ' + best + (best ? ' (' + bestStart + ' ते ' + bestEnd + ')' : ''));
  }

  /** 2. एकूण पाऊस : कालावधीतील बेरीज मर्यादेशी तुलना */
  function checkTotalRainfall(t, data) {
    var total = 0;
    data.forEach(function (w) { total += (w.rainfall || 0); });
    var totalStr = Math.round(total * 10) / 10;
    var triggered = compare(total, t.operator, t.threshold);
    return mkResult(t, triggered, triggered ? t.payoutAmount : 0,
      triggered
        ? 'लागू — कालावधीत एकूण पाऊस ' + totalStr + ' मिमी झाला. (मर्यादा : ' + t.operator + ' ' + t.threshold + ' मिमी)'
        : 'लागू नाही — कालावधीत एकूण पाऊस ' + totalStr + ' मिमी झाला. (मर्यादा : ' + t.operator + ' ' + t.threshold + ' मिमी)',
      'एकूण पाऊस : ' + totalStr + ' मिमी');
  }

  /** 3. कमी तापमान */
  function checkTempLow(t, data) {
    return checkGeneric(t, data, 'minTemp', 'कमीत कमी तापमान', '\u00B0C');
  }

  /** 4. जास्त तापमान */
  function checkTempHigh(t, data) {
    return checkGeneric(t, data, 'maxTemp', 'कमाल तापमान', '\u00B0C');
  }

  /** 5. आद्रता */
  function checkHumidity(t, data) {
    return checkGeneric(t, data, 'humidity', 'आद्रता', '%');
  }

  /** 6. वाऱ्याचा वेग */
  function checkWindSpeed(t, data) {
    return checkGeneric(t, data, 'wind', 'वाऱ्याचा वेग', '');
  }

  /** तापमान / आद्रता / वारा यांसाठी सामान्य तपासणी */
  function checkGeneric(t, data, field, label, unit) {
    var count = 0, dates = [], extreme = null;

    data.forEach(function (w) {
      var v = w[field];
      if (v === null || v === undefined) return;
      if (extreme === null) extreme = v;
      if (t.paramType === 'temp_low') extreme = Math.min(extreme, v);
      else extreme = Math.max(extreme, v);
      if (compare(v, t.operator, t.threshold)) { count++; dates.push(w.dateStr); }
    });

    var need = t.minDays || 1;
    var triggered = count >= need;
    return mkResult(t, triggered, triggered ? t.payoutAmount : 0,
      triggered
        ? 'लागू — ' + count + ' दिवस ' + label + ' ' + t.operator + ' ' + t.threshold + unit + ' होता. दिनांक : ' + dates.slice(0, 10).join(', ')
        : 'लागू नाही — फक्त ' + count + ' दिवस अट पूर्ण झाली. (आवश्यक : कमीत कमी ' + need + ' दिवस)',
      'कालावधीत ' + label + ' : ' + (extreme === null ? 'डेटा नाही' : extreme + unit));
  }

  /** operator नुसार तुलना : >= > <= < == */
  function compare(a, op, b) {
    switch (op) {
      case '>':  return a > b;
      case '<':  return a < b;
      case '<=': return a <= b;
      case '==': return a === b;
      default:   return a >= b;  // '>='
    }
  }

  return {
    evaluateAllTriggers: evaluateAllTriggers,
    getTriggerConfig: getTriggerConfig
  };
})();
