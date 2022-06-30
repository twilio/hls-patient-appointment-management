'use strict';
/* --------------------------------------------------------------------------------
 * deploys application to target Twilio account.
 *
 * NOTE: that this function can only be run on localhost
 *
 * input:
 * event.action: CREATE|UPDATE|DELETE, defaults to CREATE|UPDATE depending on deployed state
 * --------------------------------------------------------------------------------
 */
const assert = require("assert");
exports.handler = async function(context, event, callback) {
  const THIS = 'deploy:';

  const assert = require("assert");
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);

  assert(context.DOMAIN_NAME.startsWith('localhost:'), `Can only run on localhost!!!`);
  console.time(THIS);
  try {
    assert(event.configuration.APPLICATION_NAME, 'missing APPLICATION_NAME variable!!!');
    const application_name = event.configuration.APPLICATION_NAME;
    assert(event.action, 'missing event.action variable!!!');
    const env = event.configuration;
    console.log(THIS, 'configuration submitted:\n', env);

    console.log(THIS, `Deploying (${event.action}) ... ${application_name} ...`);

    switch (event.action) {

      case 'DEPLOY':
      case 'REDEPLOY': {
        const service_sid = await deploy_service(context, env);
        console.log(THIS, `Deployed function service: ${service_sid}`);

        const client = context.getTwilioClient();
        await client.serverless.services(service_sid).update({uiEditable: true});
        console.log(THIS, 'Make function service editable ...');

        console.log(THIS, 'Provisioning dependent Twilio services');
        const verify_sid = await getParam(context, 'VERIFY_SID');
        const messaging_sid = await getParam(context, 'MESSAGING_SID');

        const flow_sid = await deploy_studio_flow(context, env);
        console.log(THIS, `deployed studio flow: ${flow_sid}`);

        console.log(THIS, `Completed deployment of ${application_name}`);

        const response = {
          status: event.action,
          deployables: [
            { service_sid: service_sid },
            { flow_sid: flow_sid },
            { verify_sid: verify_sid },
            { messaging_sid: messaging_sid },
          ],
        };
        console.log(THIS, response);
        return callback(null, response);
      }
        break;

      case 'UNDEPLOY': {
        const flow_sid = await undeploy_studio_flow(context);

        // unassign flow to twilio phone number

        const service_sid = await undeploy_service(context);

        const verify_sid = await getParam(context, 'VERIFY_SID');
        if (verify_sid) {

        }

        const messaging_sid = await getParam(context, 'MESSAGING_SID');
        if (messaging_sid) {

        }

        const response = {
          status: 'UNDEPLOYED',
          deployables: [
            { service_sid: service_sid, },
            { flow_sid: flow_sid },
            { verify_sid: verify_sid },
            { messaging_sid: messaging_sid },
          ],
        };
        return callback(null, response);
      }
        break;

      default: throw new Error(`unknown event.action=${action}`);
    }

  } catch(err) {
    console.log(err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
}


/* --------------------------------------------------------------------------------
 * deploys (creates new/updates existing) service to target Twilio account.
 *
 * - service identified via unique_name = APPLICATION_NAME in helpers.private.js
 *
 * returns: service SID, if successful
 * --------------------------------------------------------------------------------
 */
async function deploy_service(context, envrionmentVariables = {}) {
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);
  const { getListOfFunctionsAndAssets } = require('@twilio-labs/serverless-api/dist/utils/fs');
  const { TwilioServerlessApiClient } = require('@twilio-labs/serverless-api');
  const fs = require('fs');

  const client = context.getTwilioClient();

  const { assets } = await getListOfFunctionsAndAssets(process.cwd(), {
    functionsFolderNames: [],
    assetsFolderNames: ["assets"],
  });
  console.log('asset count:' , assets.length);

  const { functions } = await getListOfFunctionsAndAssets(process.cwd(),{
    functionsFolderNames: ["functions"],
    assetsFolderNames: []
  });
  console.log('function count:' , functions.length);

  const pkgJsonRaw = fs.readFileSync(`${process.cwd()}/package.json`);
  const pkgJsonInfo = JSON.parse(pkgJsonRaw);
  const dependencies = pkgJsonInfo.dependencies;
  console.log('package.json loaded');

  const deployOptions = {
    env: {
      ...envrionmentVariables
    },
    pkgJson: {
      dependencies,
    },
    functionsEnv: 'dev',
    functions,
    assets,
  };
  console.log('deployOptions.env:', deployOptions.env);

  let service_sid = await getParam(context, 'SERVICE_SID');
  if (service_sid) {
    // update service
    console.log('Updating services ...');
    deployOptions.serviceSid = service_sid;
  } else {
    // create service
    console.log('Creating services ...');
    deployOptions.serviceName = envrionmentVariables.APPLICATION_NAME;
  }

  const serverlessClient = new TwilioServerlessApiClient({
    username: client.username, // ACCOUNT_SID
    password: client.password, // AUTH_TOKEN
  });

  serverlessClient.on("status-update", evt => {
    console.log(evt.message);
  });

  await serverlessClient.deployProject(deployOptions);
  service_sid = await getParam(context, 'SERVICE_SID');

  return service_sid;
}


/* --------------------------------------------------------------------------------
 * undeploys sererless service
 * --------------------------------------------------------------------------------
 */
async function undeploy_service(context) {
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);

  const client = context.getTwilioClient();
  // ---------- remove studio flow, if exists
  const service_sid = await getParam(context, 'SERVICE_SID'); // will be null if not deployed
  if (service_sid) {
    const response = await client.serverless.services(service_sid).remove();
  }

  return service_sid;
}


/* --------------------------------------------------------------------------------
 * deploys studio flow & set smsURL webhook for twilio phone number
 * --------------------------------------------------------------------------------
 */
async function deploy_studio_flow(context, envrionmentVariables) {
  const fs = require('fs');
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);

  const client = context.getTwilioClient();

  // ---------- parameters
  const customer_name           = envrionmentVariables.CUSTOMER_NAME;
  const application_name        = envrionmentVariables.APPLICATION_NAME;
  const service_sid             = await getParam(context, 'SERVICE_SID');
  const environment_sid         = await getParam(context, 'ENVIRONMENT_SID');
  const environment_domain_name = await getParam(context, 'ENVIRONMENT_DOMAIN_NAME');
  const v = parseInt(envrionmentVariables.REPLY_WAIT_TIME);
  const reply_wait_time         = isNaN(v) ? 120 :(v >= 0 ? v : 120);
  const ie_endpoint             = envrionmentVariables.IE_ENDPOINT;

  // ---------- load & configure studio flow definition
  console.log('Replacing YOUR_HEALTH_SYSTEM_NAME      ->',customer_name);
  console.log('Replacing YOUR_SERVICE_SID             ->',service_sid);
  console.log('Replacing YOUR_ENVIRONMENT_SID         ->',environment_sid);
  console.log('Replacing YOUR_ENVIRONMENT_DOMAIN_NAME ->',environment_domain_name);
  console.log('Replacing YOUR_REPLY_WAIT_TIME         ->',reply_wait_time);
  console.log('Replacing YOUR_IE_ENDPOINT             ->',ie_endpoint);
  const flow_definition_file = Runtime.getAssets()['/studio-flow-template.json'].path;
  let flow_definition = fs
    .readFileSync(flow_definition_file)
    .toString('utf-8')
    .replace(/YOUR_HEALTH_SYSTEM_NAME/g, customer_name)
    .replace(/YOUR_SERVICE_SID/g, service_sid)
    .replace(/YOUR_ENVIRONMENT_SID/g, environment_sid)
    .replace(/YOUR_ENVIRONMENT_DOMAIN_NAME/g, environment_domain_name)
    .replace(/YOUR_REPLY_WAIT_TIME/g, reply_wait_time)
    .replace(/YOUR_IE_ENDPOINT/g, ie_endpoint);
  const functions = await client.serverless
    .services(service_sid)
    .functions.list();
  functions.forEach(function (f) {
    const fname = `YOUR_FUNCTION_SID[${f.friendlyName.replace('/', '')}]`;
    console.log( 'Replacing function', fname, '->', f.sid);
    flow_definition = flow_definition.replace(fname, f.sid);
  });

  // ---------- validate studio flow definition
  const flow_valid = await client.studio.flowValidate.update({
    friendlyName: application_name,
    status: 'published',
    definition: `${flow_definition}`,
  });
  assert(flow_valid.valid, `invalid flow definition for flow=${application_name}!!!`);

  // ---------- deploy studio flow
  const flow_sid = await getParam(context, 'FLOW_SID');
  const flow = flow_sid
    ? await client.studio.flows(flow_sid).update({
      status: 'published',
      commitMessage: 'installer deployed',
      definition: `${flow_definition}`,
    })
    : await client.studio.flows.create({
      friendlyName: application_name,
      status: 'published',
      commitMessage: 'installer deployed',
      definition: `${flow_definition}`,
    });

  // ---------- set smsUrl to this studio flow
  const twilio_phones = await client.incomingPhoneNumbers.list();
  const twilio_phone = twilio_phones.find(p => p.phoneNumber === envrionmentVariables.TWILIO_PHONE_NUMBER);
  assert(twilio_phone, `no matching incomingPhoneNumber=${envrionmentVariables.TWILIO_PHONE_NUMBER}!!!`);
  await client.incomingPhoneNumbers(twilio_phone.sid)
    .update({
      smsUrl: `https://webhooks.twilio.com/v1/Accounts/${context.ACCOUNT_SID}/Flows/${flow.sid}`,
    });

  return flow.sid;
}



/* --------------------------------------------------------------------------------
 * undeploys studio flow & unset smsURL webhook for twilio phone number
 * --------------------------------------------------------------------------------
 */
async function undeploy_studio_flow(context) {
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);

  const client = context.getTwilioClient();
  // ---------- remove studio flow, if exists
  const flow_sid = await getParam(context, 'FLOW_SID'); // will be null if not deployed
  if (flow_sid) {
    await client.studio.flows(flow_sid).remove();
  }

  return flow_sid;
}








async function getPhoneNumberToAddSid(client) {
return await client.incomingPhoneNumbers
    .list()
    .then(incomingPhoneNumbers => incomingPhoneNumbers[0].sid);
}

async function deployStudioFlow(context, event, callback) {
    console.log(THIS, 'Starting');
    console.time(THIS);
    try {

       let flow = null;

        switch (action) {
        case 'UPDATE':
            {
            console.log(THIS, 'Updating flow FLOW_SID=', FLOW_SID);
            flow = await client.studio.flows(FLOW_SID).update({
                friendlyName: APPLICATION_NAME,
                status: 'published',
                commitMessage: 'Manually triggered update',
                definition: `${flow_definition}`,
            });

            console.log(THIS, 'TWILIO_PHONE_NUMBER=', TWILIO_PHONE_NUMBER);
            const phoneNumberSid = await getPhoneNumberSid(TWILIO_PHONE_NUMBER);
            console.log(THIS, 'TWILIO_PHONE_NUMBER_SID=', phoneNumberSid);
            await updatePhoneNumberWebhook(flow.webhookUrl, phoneNumberSid);
            console.log(THIS, 'TWILIO_PHONE_NUMBER assigned to flow');
            }
            break;

        case 'CREATE':
            {
            console.log(THIS, 'Creating flow');
            flow = await client.studio.flows.create({
                friendlyName: APPLICATION_NAME,
                status: 'published',
                commitMessage: 'Code Exchange automatic deploy',
                definition: `${flow_definition}`,
            });
            setParam(context, 'FLOW_SID', flow.sid);

            console.log(THIS, 'TWILIO_PHONE_NUMBER=', TWILIO_PHONE_NUMBER);
            const phoneNumberSid = await getPhoneNumberSid(TWILIO_PHONE_NUMBER);
            console.log(THIS, 'TWILIO_PHONE_NUMBER_SID=', phoneNumberSid);
            await updatePhoneNumberWebhook(flow.webhookUrl, phoneNumberSid);
            console.log(THIS, 'TWILIO_PHONE_NUMBER assigned to flow');
            }
            break;

        case 'DELETE':
            console.log(THIS, 'Deleting FLOW_SID=', FLOW_SID);
            await client.studio.flows(FLOW_SID).remove();
            break;

        default:
            return callback('undefined action!');
        }
        return callback(null, {
            status: `${action} success`,
            flowId: flow.sid,
            flowUrl: flow.url
        });
    } catch (err) {
        console.log(err);
        return callback(err);
    } finally {
        console.timeEnd(THIS);
    }
};

async function deployMessagingService(context, event, callback) {
  const response = new Twilio.Response();
  const client = context.getTwilioClient();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setStatusCode(200);

  try {
    const appName = await getParam(context, 'APPLICATION_NAME');
    const pamMessageService = await client.messaging.services
      .list()
      .then(services => services.find(service => service.friendlyName === appName));
    if (event.action === 'CREATE') {
      if (pamMessageService) {
        await client.messaging.services(pamMessageService.sid).remove();
      }
      const service = await client.messaging.services.create({friendlyName: (await getParam(context, 'APPLICATION_NAME'))});
      const phoneSid = await getPhoneNumberToAddSid(client);
      await client.messaging.services(service.sid).phoneNumbers
        .create({phoneNumberSid: phoneSid})
        .then(phoneNumber => console.log("Added phoneSid, " + phoneNumber.sid +  ", to messaging service " + service.sid));
      console.log("Setting MESSAGING_SID", service.sid);
      await setParam(context, 'MESSAGING_SID', service.sid);
      response.setBody({message: service});
    } else if (event.action === 'DELETE') {
      if (!pamMessageService) {
        response.setStatusCode(400);
        return callback("Error: Could not find messaging service with the name, " + await getParam(context, 'APPLICATION_NAME'));
      }
      await client.messaging.services(pamMessageService.sid).remove();
    } else {
      response.setStatusCode(400);
      return callback("Error: action was not provided");
    }

    response.setStatusCode(200);
    return callback(null, response);
  } catch (err) {
    response.setStatusCode(400);
    return callback(err, response);
  }
};

