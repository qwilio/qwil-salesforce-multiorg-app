public with sharing class QwilSdk {
  static final Map<String, String> knownErrors = new Map<String, String>{
    'RB035' => 'Could not locate your Qwil account', // matches profile that cannot log in
    'RN006' => 'Could not locate your Qwil account', // not found
    'RF024' => 'Your Qwil account is currently inactive', // Qwil user is not currently active
    'RN900' => 'Qwil is currently disabled for this organisation', // Org is inactive in Qwil
    'RN902' => 'Qwil is currently disabled for this organisation', // Org is frozen in Qwil
    'RB785' => 'Configuration error. Please contact your system admin.', // identifier or entity_user_xref_uuid not included in the API call
    'RF731' => 'Configuration error. Please contact your system admin.', // System API Key does not have permission to create SDK sessions
    'RF736' => 'Configuration error. Please contact your system admin.', // Super API Key requires on-behalf-of-entity-uuid header
    'RF841' => 'Configuration error. Please contact your system admin.', // Cannot set on-behalf-of-entity-uuid. Not Super API key
    'RU001' => 'Configuration error. Please contact your system admin.', // System API Key or Secret invalid
    'RU002' => 'Configuration error. Please contact your system admin.', // System API Key has been deactivated
    'RF888' => 'Qwil SDK is not enabled for this organisation.' // SDK feature not enabled
  };

  @AuraEnabled(cacheable=false)
  public static String authenticate(
    String entityUuid,
    String entityUserXrefUuid
  ) {
    String jsonBody = '{"entity_user_xref_uuid": "' + entityUserXrefUuid + '"}';

    HttpRequest req = new HttpRequest();
    req.setEndpoint('callout:QwilSysApiSDK/sessions/create');
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');
    req.setHeader('on-behalf-of-entity-uuid', entityUuid);
    req.setBody(jsonBody);

    Http http = new Http();
    HTTPResponse res = http.send(req);
    String genericErrorResponse = 'Failed to retrieve Qwil credentials';
    return QwilSdk.handleResponse(res, genericErrorResponse);
  }

  @AuraEnabled(cacheable=false)
  public static String getEntityMemberships() {
    String primaryEmail = UserInfo.getUserName(); // user SF login email for Qwil account lookup

    HttpRequest req = new HttpRequest();
    req.setEndpoint(
      'callout:QwilSysApiSDK/entity-memberships?primary_email=' + primaryEmail
    );
    req.setMethod('GET');

    Http http = new Http();
    HTTPResponse res = http.send(req);
    String genericErrorResponse = 'Failed to retrieve Qwil accounts';
    return QwilSdk.handleResponse(res, genericErrorResponse);
  }

  private static String handleResponse(
    HTTPResponse res,
    String genericErrorResponse
  ) {
    if (res.getStatusCode() == 200) {
      // JSON parsing in JS is simpler and more efficient, so we just return as String if we expect successful call
      return res.getBody();
    }

    // if error, we parse JSON response and see if we can map to a known error
    Map<String, Object> resultMap = (Map<String, Object>) JSON.deserializeUntyped(
      res.getBody()
    );
    String errorCode = (String) resultMap.get('error_code');
    System.debug(
      'API call failed with status ' +
        res.getStatusCode() +
        ' and error code ' +
        errorCode
    );

    if (knownErrors.containsKey(errorCode)) {
      throw new AuraHandledException((String) knownErrors.get(errorCode));
    } else {
      throw new AuraHandledException(genericErrorResponse);
    }
  }
}
