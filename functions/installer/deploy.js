'use strict';
const THIS = 'deployment/deploy:';
/* --------------------------------------------------------------------------------
 * deploys application to target Twilio account.
 * - deploy services & makeEditable
 * - set environment variables
 * - seed data
 *
 * NOTE: that this function can only be run on localhost
 * --------------------------------------------------------------------------------
 */
const { getParam, setParam, assertLocalhost } = require(Runtime.getFunctions()['helpers'].path);
const { TwilioServerlessApiClient } = require('@twilio-labs/serverless-api');
const { getListOfFunctionsAndAssets } = require('@twilio-labs/serverless-api/dist/utils/fs');
const fs = require('fs');
const assert = require("assert");
const path1 = Runtime.getFunctions()['auth'].path;

async function deployApplication(context, event, callback) {
  const THIS = 'deploy-application';

  console.time(THIS);
  assertLocalhost(context);
  try {
    assert(event.configuration.APPLICATION_NAME, '.env file does not contain APPLICATION_NAME variable!!!');
    const application_name = event.configuration.APPLICATION_NAME;

    console.log(THIS, `Deploying Twilio service ... ${application_name}`);
    const environmentVariables = event.configuration;
    console.log(THIS, 'configuration:', environmentVariables);
    const service_sid = await deployService(context, environmentVariables);
    console.log(THIS, `Deployed: ${service_sid}`);

    console.log(THIS, 'Make Twilio service editable ...');
    const client = context.getTwilioClient();
    await client.serverless
      .services(service_sid)
      .update({ uiEditable: true });

    console.log(THIS, 'Provisioning dependent Twilio services');

    console.log(THIS, `Completed deployment of ${application_name}`);
    const environment_domain = service_sid ? await getParam(context, 'ENVIRONMENT_DOMAIN_NAME') : null;
    const application_url = service_sid ? `https://${environment_domain}` : "";


    return callback(null, {
      service_sid: service_sid,
      application_url,
      service_status: 'DEPLOYED',
    });

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
async function getAssets() {
  const { assets } = await getListOfFunctionsAndAssets(process.cwd(), {
    functionsFolderNames: [],
    assetsFolderNames: ["assets"],
  });
  //console.log('asset count:', assets.length);

  const indexHTMLs = assets.filter(asset => asset.name.includes('index.html'));
  // Set indext.html as a default document
  const allAssets = assets.concat(indexHTMLs.map(ih => ({
    ...ih,
    path: ih.name.replace("index.html", ""),
    name: ih.name.replace("index.html", ""),
  })));
  return allAssets;
}

async function deployService(context, envrionmentVariables = {}) {
  const client = context.getTwilioClient();

  const assets = await getAssets();
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

  context['APPLICATION_NAME'] = envrionmentVariables.APPLICATION_NAME;
  let service_sid = await getParam(context, 'SERVICE_SID');
  if (service_sid) {
    // update service
    console.log('Updating services ...');
    deployOptions.serviceSid = service_sid;
  } else {
    // create service
    console.log('Creating services ...');
    deployOptions.serviceName = await getParam(context, 'APPLICATION_NAME');
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
        console.log("Setting MESSAGING_SERVICE_SID", service.sid);
        await setParam(context, 'MESSAGING_SERVICE_SID', service.sid);
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
  
async function getPhoneNumberToAddSid(client) {
return await client.incomingPhoneNumbers
    .list()
    .then(incomingPhoneNumbers => incomingPhoneNumbers[0].sid);
}

async function deployStudioFlow(context, event, callback) {
    console.log(THIS, 'Starting');
    console.time(THIS);
    try {
        // ---------- parameters
        const CUSTOMER_NAME = await getParam(context, 'CUSTOMER_NAME') || event.configuration['CUSTOMER_NAME'];
        const APPLICATION_NAME = await getParam(context, 'APPLICATION_NAME');
        const TWILIO_PHONE_NUMBER = await getParam(context, 'TWILIO_PHONE_NUMBER') || event.configuration['TWILIO_PHONE_NUMBER'];;
        const SERVICE_SID = await getParam(context, 'SERVICE_SID');
        // Customise wait time for simulation
        const REPLY_WAIT_TIME = event.configuration['REPLY_WAIT_TIME'] ?? 120;
        const ENVIRONMENT_SID = await getParam(context,'ENVIRONMENT_SID');
        const ENVIRONMENT_DOMAIN_NAME = await getParam(context,'ENVIRONMENT_DOMAIN_NAME');
        const FLOW_SID = await getParam(context, 'FLOW_SID');

        // ---------- load & configure studio flow definition
        console.log(THIS,'Replacing YOUR_HEALTH_SYSTEM_NAME      ->',CUSTOMER_NAME);
        console.log(THIS,'Replacing YOUR_SERVICE_SID             ->',SERVICE_SID);
        console.log(THIS,'Replacing YOUR_ENVIRONMENT_SID         ->',ENVIRONMENT_SID);
        console.log(THIS,'Replacing YOUR_ENVIRONMENT_DOMAIN_NAME ->',ENVIRONMENT_DOMAIN_NAME);
        console.log(THIS,'Replacing YOUR_REPLY_WAIT_TIME         ->',REPLY_WAIT_TIME);
        const flow_definition_file =
        Runtime.getAssets()['/studio-flow-template.json'].path;
        let flow_definition = fs
            .readFileSync(flow_definition_file)
            .toString('utf-8')
            .replace('YOUR_HEALTH_SYSTEM_NAME', CUSTOMER_NAME)
            .replace(/YOUR_SERVICE_SID/g, SERVICE_SID)
            .replace(/YOUR_ENVIRONMENT_SID/g, ENVIRONMENT_SID)
            .replace(
                /YOUR_ENVIRONMENT_DOMAIN_NAME/g,
                ENVIRONMENT_DOMAIN_NAME
            )
            .replace(/YOUR_REPLY_WAIT_TIME/g, REPLY_WAIT_TIME);

        const client = context.getTwilioClient();
        const functions = await client.serverless
            .services(SERVICE_SID)
            .functions.list();
        functions.forEach(function (f) {
            const fname = `YOUR_FUNCTION_SID[${f.friendlyName.replace('/', '')}]`;
            console.log(THIS, 'Replacing function', fname, '->', f.sid);
            flow_definition = flow_definition.replace(fname, f.sid);
        });

        // ---------- update/create/delete studio flow
        let action = null;
        if (event.hasOwnProperty('action') && event.action === 'DELETE') {
            action = 'DELETE';
        } else if (FLOW_SID !== null && FLOW_SID.startsWith('FW')) {
            action = 'UPDATE';
        } else {
            action = 'CREATE';
        }

        function getPhoneNumberSid(phone_number) {
        return new Promise((resolve, reject) => {
            client.incomingPhoneNumbers
            .list({ phoneNumber: phone_number, limit: 20 })
            .then((incomingPhoneNumbers) => {
                const n = incomingPhoneNumbers[0];
                resolve(n.sid);
            })
            .catch((err) => reject(err));
        });
        }

        function updatePhoneNumberWebhook(studioWebhook, numberSid) {
        return new Promise((resolve, reject) => {
            client
            .incomingPhoneNumbers(numberSid)
            .update({
                smsUrl: studioWebhook,
            })
            .then(() => {
                resolve('success');
            })
            .catch((err) => reject(err));
        });
        }

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
  
exports.handler = async function (context, event, callback) {
    if (event?.deployApplication && event?.deployApplication === "true") {
        console.log("deployApplication");
        return await deployApplication(context, event, callback);
    } else if (event?.deployMessagingService && event?.deployMessagingService === "true"){
        console.log("deployMessagingService");
        return await deployMessagingService(context, event, callback);
    } else if (event?.deployStudioFlow && event?.deployStudioFlow === "true"){
        console.log("deployStudioFlow");
        return await deployStudioFlow(context, event, callback);
    } else {
        console.log(err.message);
        throw new Error(`method not found. Error: ${err.message}`);
    }
}