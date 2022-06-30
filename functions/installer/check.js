"use strict";
/*
 * --------------------------------------------------------------------------------
 * checks deployment status of deployables of this application in the target Twilio account
 *
 * NOTE: that this function can only be run on localhost
 *
 * return json object that at least has the following:
 * {
 *   deploy_state: DEPLOYED|NOT-DEPLOYED
 * }
 * --------------------------------------------------------------------------------
 */
const assert = require("assert");
exports.handler = async function (context, event, callback) {
  const THIS = 'check:';

  const assert = require("assert");
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);

  assert(context.DOMAIN_NAME.startsWith('localhost:'), `Can only run on localhost!!!`);
  console.time(THIS);
  try {

    // ---------- check service ----------------------------------------
    const service_sid        = await getParam(context, 'SERVICE_SID');
    const flow_sid           = await getParam(context, 'FLOW_SID');
    const environment_domain = service_sid ? await getParam(context, 'ENVIRONMENT_DOMAIN_NAME') : null;

    const response = {
      deploy_state: (service_sid && flow_sid) ? 'DEPLOYED' : 'NOT-DEPLOYED',
      service_sid: service_sid,
      flow_sid: flow_sid,
      application_url: service_sid ? `https:/${environment_domain}/index.html` : null,
      service_url: service_sid ? `https://www.twilio.com/console/functions/api/start/${service_sid}` : null,
      flow_url: flow_sid ? `https://www.twilio.com/console/studio/flows/${flow_sid}` : null,
    };
    console.log(THIS, response);
    return callback(null, response);

  } catch (err) {
    console.log(THIS, err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
}
