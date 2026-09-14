/**
 * ============================================================
 *  Auth.gs — प्रवेश नियंत्रण (Authentication & Authorization)
 *  भूमिका : admin | officer | operator
 *
 *  नियम :
 *   - वापरकर्ता Google खात्याने लॉगिन असणे आवश्यक
 *   - Users शीटमध्ये त्याचा email नोंदलेला असावा (active = TRUE)
 *   - प्रत्येक क्रियेसाठी requireRole() द्वारे भूमिका तपासली जाते
 * ============================================================
 */
var Auth = (function () {

  var USERS_SHEET = 'Users';

  /** Users शीटमधून email ने वापरकर्ता शोधते */
  function findUserByEmail(email) {
    var sh = Utils.getSheet(USERS_SHEET);
    var data = sh.getDataRange().getValues();
    var idx = Utils.headerIndex(data);

    for (var r = 1; r < data.length; r++) {
      var rowEmail = String(data[r][idx.email] || '').trim().toLowerCase();
      if (rowEmail === String(email || '').trim().toLowerCase()) {
        return {
          email: String(data[r][idx.email] || '').trim(),
          name: String(data[r][idx.name] || '').trim(),
          role: String(data[r][idx.role] || '').trim().toLowerCase(),
          active: (
            String(data[r][idx.active]).trim().toUpperCase() === 'TRUE' ||
            data[r][idx.active] === true ||
            Number(data[r][idx.active]) === 1
          )
        };
      }
    }
    return null;
  }

  /** सध्याच्या वापरकर्त्याची माहिती (लॉगिन आहे का?) */
  function getUserInfo() {
    var email = '';
    try { email = Session.getActiveUser().getEmail(); } catch (e) { email = ''; }

    if (!email) {
      return { loggedIn: false, message: 'Google खात्याने लॉगिन केलेले नाही.' };
    }
    var user = findUserByEmail(email);
    if (!user) {
      return { loggedIn: false, email: email, message: 'तुमची नोंद Users शीटमध्ये नाही. ॲडमिनशी संपर्क करा.' };
    }
    if (!user.active) {
      return { loggedIn: false, email: email, message: 'तुमची नोंद बंद (inactive) केली आहे. ॲडमिनशी संपर्क करा.' };
    }
    return { loggedIn: true, email: user.email, name: user.name, role: user.role };
  }

  /**
   * भूमिका तपासते — नसेल तर Error टाकते.
   * allowedRoles = ['admin'] किंवा ['admin', 'operator'] इ.
   */
  function requireRole(allowedRoles) {
    var info = getUserInfo();
    if (!info.loggedIn) {
      throw new Error('अनधिकृत : लॉगिन आवश्यक आहे.');
    }
    if (allowedRoles.indexOf(info.role) === -1) {
      throw new Error('अनधिकृत : ही क्रिया फक्त ' + allowedRoles.join(' / ') + ' साठी आहे.');
    }
    return info;
  }

  return {
    getUserInfo: getUserInfo,
    requireRole: requireRole
  };
})();
