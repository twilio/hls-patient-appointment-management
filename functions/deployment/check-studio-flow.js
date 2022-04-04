/* eslint-disable camelcase, dot-notation, consistent-return, callback-return */
const THIS = 'deployment/check-studio-flow:';
/*
 * --------------------------------------------------------------------------------
 * function description
 *
 * event:
 * . action = DELETE, optional
 *
 * returns:
 * - NOT-DEPLOYED, if not deployed
 * --------------------------------------------------------------------------------
 */
const assert = require('assert');

const path0 = Runtime.getFunctions()['helpers'].path;
const { getParam, setParam } = require(path0);
const path1 = Runtime.getFunctions()['auth'].path;
const { isValidAppToken } = require(path1);

exports.handler = async function (context, event, callback) {
  console.log(THIS, 'Begin');
  console.time(THIS);
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    assert(event.token, 'missing event.token');
    if (!isValidAppToken(event.token, context)) {
      response.setStatusCode(401);
      response.setBody({ message: 'Unauthorized' });
      return callback(null, response);
    }

    // TWILIO_FLOW_SID will be 'null' if associated flow is not found
    const TWILIO_FLOW_SID = await getParam(context, 'TWILIO_FLOW_SID');

    const client = context.getTwilioClient();
    client.studio.flows
      .list({ limit: 100 })
      .then((flows) => {
        if (flows.length === 0) {
          response.setBody({data: 'NOT-DEPLOYED'});
          return callback(null, response);
        }
        flows.forEach((f) => {
          if (f.sid === TWILIO_FLOW_SID) {
            console.log(THIS, 'Found', TWILIO_FLOW_SID);
            response.setBody({data: TWILIO_FLOW_SID})
            return callback(null, response);
          }
        });
        response.setBody({data: 'NOT-DEPLOYED'})
        return callback(null, response);
      })
      .catch(err => {
        return callback(err)
      });
  } finally {
    console.timeEnd(THIS);
  }
};
