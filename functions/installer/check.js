"use strict";
/*
 * --------------------------------------------------------------------------------
 * checks deployment of service in target Twilio account.
 *
 * NOTE: that this function can only be run on localhost
 *
 * --------------------------------------------------------------------------------
 */
const { assertLocalhost } = require(Runtime.getFunctions()["helpers"].path);
const THIS = "deployment/check:";
const path0 = Runtime.getFunctions()["helpers"].path;
const { getParam, setParam } = require(path0);
const path1 = Runtime.getFunctions()["auth"].path;
const { isValidAppToken } = require(path1);

async function checkApplication(context, event, callback) {
  const THIS = "check-application";
  console.time(THIS);
  assertLocalhost(context);

  const response = new Twilio.Response();
  response.setStatusCode(200);
  try {
    const application_name = await getParam(context, "APPLICATION_NAME");
    const service_sid = await getParam(context, "SERVICE_SID");
    const environment_domain = service_sid
      ? await getParam(context, "ENVIRONMENT_DOMAIN_NAME")
      : null;
    const application_url = service_sid ? `https://${environment_domain}` : ""; // relative url when on localhost and serice is not yet deployed

    console.log(
      THIS,
      `SERVICE_SID for APPLICATION_NAME (${application_name}): ${service_sid}) at ${application_url}`
    );

    const response = {
      status: service_sid ? "DEPLOYED" : "NOT-DEPLOYED",
      service_sid: service_sid ? service_sid : "",
      application_url: service_sid ? application_url : "",
    };
    return callback(null, response);
  } catch (err) {
    console.log(THIS, err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
}

async function checkStudioFlow(context, event, callback) {
  console.log(THIS, "Begin");
  console.time(THIS);
  const response = new Twilio.Response();
  const client = context.getTwilioClient();
  response.appendHeader("Content-Type", "application/json");
  response.appendHeader("Access-Control-Allow-Origin", "*");
  response.appendHeader("Access-Control-Allow-Methods", "OPTIONS, POST, GET");
  response.appendHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setStatusCode(200);


  const service_sid = await getParam(context, "SERVICE_SID");
  const environment_domain = service_sid
  ? await getParam(context, "ENVIRONMENT_DOMAIN_NAME")
  : null;

  const application_url = service_sid ? `https://${environment_domain}` : ""; // relative url when on localhost and serice is not yet deployed


  try {
    // FLOW_SID will be 'null' if associated flow is not found
    const FLOW_SID = await getParam(context, "FLOW_SID");
    const APPLICATION_NAME = await getParam(context, "APPLICATION_NAME");
    if (!FLOW_SID) {
      response.setBody({ status: "NOT-DEPLOYED" });
      return callback(null, response);
    }
    const flows = await client.studio.flows
      .list({ limit: 100 })
      .then((flows) => flows);
    const pamFlow = flows.find(
      (flow) => flow.friendlyName === APPLICATION_NAME && flow.sid === FLOW_SID
    );
    if (!pamFlow) {
      response.setBody({ status: "NOT-DEPLOYED" });
      return callback(null, response);
    }
    response.setBody({
      status: "DEPLOYED",
      service_sid: service_sid ? service_sid : "",
      application_url: service_sid ? application_url : "",
    });
    return callback(null, response);
  } catch (err) {
    console.error(THIS, err);
    response.setStatusCode(400);
    return callback(err, response);
  } finally {
    console.timeEnd(THIS);
  }
}

exports.handler = async function (context, event, callback) {
  if (event?.checkApplication && event?.checkApplication === "true") {
    console.log("check-application");
    return await checkApplication(context, event, callback);
  } else if (event?.checkStudioFlow && event?.checkStudioFlow === "true") {
    console.log("check-studio-flow");
    return await checkStudioFlow(context, event, callback);
  } else {
    console.log(err.message);
    throw new Error(`method not found. Error: ${err.message}`);
  }
};
