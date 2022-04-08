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
const path0 = Runtime.getFunctions()['helpers'].path;
const { getParam, setParam } = require(path0);
const path1 = Runtime.getFunctions()['auth'].path;
const { isValidAppToken } = require(path1);

exports.handler = async function (context, event, callback) {
  console.log(THIS, 'Begin');
  console.time(THIS);
  const response = new Twilio.Response();
  const client = context.getTwilioClient();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setStatusCode(200);

  try {
    // TWILIO_FLOW_SID will be 'null' if associated flow is not found
    const TWILIO_FLOW_SID = await getParam(context, 'TWILIO_FLOW_SID');
    const APPLICATION_NAME = await getParam(context, 'APPLICATION_NAME');
    if (!TWILIO_FLOW_SID) {
      response.setBody({status: 'NOT-DEPLOYED'});
      return callback(null, response);
    }
    const flows = await client.studio.flows
      .list({ limit: 100 })
      .then(flows => flows);
    const pamFlow = flows.find(
      flow => flow.friendlyName === APPLICATION_NAME && flow.sid === TWILIO_FLOW_SID
    );
		if (!pamFlow) {
			response.setBody({status: 'NOT-DEPLOYED'});
      return callback(null, response);
		}
    response.setBody({status: 'DEPLOYED'});
    return callback(null, response);
  } catch (err) {
    console.error(THIS, err);    
    response.setStatusCode(400);
    return callback(err, response);
  } finally {
    console.timeEnd(THIS);
  }
};
