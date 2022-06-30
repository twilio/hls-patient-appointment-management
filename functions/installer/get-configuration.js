'use strict';
/* --------------------------------------------------------------------------------
 * retrieves information about application:
 * - Twilio account
 * - purchased Twilio phone numbers
 * - environment variables defined in .env file
 * - current environment variable values, if service already deployed
 *
 * NOTE: that this function can only be run on localhost
 *
 * event:
 * . n/a
 *
 * returns:
 * - twilioAccountName:
 * - twilioPhoneNumbers: [ { phoneNumber, friendlyName } ]
 * - configurationVariables: [ { key, required, format, description, link, default, configurable, contentKey } ]
 *   see https://github.com/twilio-labs/configure-env/blob/main/docs/SCHEMA.md
 * - configurationValues : { key: value, ... }
 * --------------------------------------------------------------------------------
 */
exports.handler = async function (context, event, callback) {
  const THIS = 'get-configuration:';

  const assert = require("assert");
  const { getParam, retrieveCandidateTwilioPhones } = require(Runtime.getFunctions()['helpers'].path);

  assert(context.DOMAIN_NAME.startsWith('localhost:'), `Can only run on localhost!!!`);
  assert(context.ACCOUNT_SID, 'ACCOUNT_SID not set!!!');

  console.time(THIS);
  try {
    const client = context.getTwilioClient();

    const response = {}

    // ---------- account information
    {
      const account = await client.api.accounts(context.ACCOUNT_SID).fetch();
      console.log(THIS, `retrieved twilio account friendlyName=${account.friendlyName}`);
      response.twilioAccountName = account.friendlyName;
    }

    // ---------- available twilio phone numbers
    {
      const phoneList = await retrieveCandidateTwilioPhones(context);
      console.log(THIS, `retrieved ${phoneList.length} twilio phone numbers`);
      response.twilioPhoneNumbers = phoneList;
    }

    // ---------- configuration variables
    {
      const variables = await read_configuration_variables();
      console.log(THIS, `read ${variables.length} variables from .env`);
      response.configurationVariables = variables;
    }

    // ---------- configuration values
    {
      if (context.DOMAIN_NAME.startsWith('localhost:')) {
        // running localhost, read values from context & default
        for (const v of response.configurationVariables) {
          if (context[v.key]) {
            v['value'] = context[v.key];
            console.log(THIS, `${v.key} value = ${v['value']} (local)`);
          }
        }
      }

      const service_sid = await getParam(context, 'SERVICE_SID');
      if (service_sid) {
        // sevice deployed, read values from service environment variables
        const environment_sid = await getParam(context, 'ENVIRONMENT_SID');
        const variables = await client.serverless
          .services(service_sid)
          .environments(environment_sid)
          .variables.list();
        console.log(THIS, `retrieved ${variables.length} variables from deployed service`);

        for (const v of response.configurationVariables) {
          if (v.value) continue; // skip variable value set from localhost context
          const variable = variables.find(e => e.key === v.key);
          if (variable) {
            v['value'] = variable.value;
            console.log(THIS, `${v.key} value = ${v['value']} (service)`);
          }
        }
      }

      // use default values for missing valeus
      for (const v of response.configurationVariables) {
        if (! v.value && v.default) {
          v['value'] = v.default;
          console.log(THIS, `${v.key} value = ${v['value']} (default)`);
        }
      }
    }

    return callback(null, response);

  } catch (err) {
    console.log(THIS, err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
}


/* --------------------------------------------------------------------------------
 * read .env file content
 *
 * uses configure-env to parse .env file (https://www.npmjs.com/package/configure-env)
 * --------------------------------------------------------------------------------
 */
async function read_configuration_variables() {
  const path = require('path');
  const fs = require('fs');
  const configure_env = require('configure-env');

  const fpath = path.join(process.cwd(), '.env');
  const payload = fs.readFileSync(fpath, 'utf8');
  const configuration = configure_env.parser.parse(payload);

  return configuration.variables;
}




// const { getParam } = require(Runtime.getFunctions()['helpers'].path);
// const configure_env = require("configure-env");
// const path = require('path');
// const fs = require('fs');
// const assert = require("assert");
//
// exports.handler = async function (context, event, callback) {
//   const THIS = 'get-account:';
//   console.time(THIS);
//   const client = context.getTwilioClient();
//   const response = new Twilio.Response();
//   response.setStatusCode(200);
//
//   try {
//     const variables = await readConfigurationVariables();
//     const account = await client.api.accounts(context.ACCOUNT_SID).fetch();
//     const accountInfo = {
//       friendlyName: account.friendlyName,
//       accountSid: account.sid,
//       status: account.status
//     }
//
//     const phoneList = await client.api.accounts(context.ACCOUNT_SID).incomingPhoneNumbers.list();
//     const twilioFlowId = await getParam(context, 'FLOW_SID');
//
//
//     // Check in sms url whether deployed studio flow id is present or not. Then take that phone number else check for numbers where phone.capabilites.sms === true and phone.smsUrl is empty.
//     let phoneNumbers = phoneList.filter((phone) => phone.smsUrl.includes(twilioFlowId));
//
//     if(!phoneNumbers.length) {
//       phoneNumbers = phoneList.filter((phone) => phone.capabilities.sms && !phone.smsUrl);
//     }
//
//     // If there is no phone numbers with sms capabilities, create a new one with sms capability.
//     if(!phoneNumbers.length) {
//       phoneNumbers = await createTwilioPhoneNumber(context, variables)
//     }
//
//     if(!phoneNumbers.length) {
//       throw new Error("Unable to get phone number");
//     }
//
//     const phones = phoneNumbers.map(phone => {
//       return {
//         friendlyName: phone.friendlyName,
//         phoneNumber: phone.phoneNumber,
//         phoneSid: phone.sid
//       }
//     });
//
//     const applicationName = await getParam(context, 'APPLICATION_NAME');
//     const messagingService = await client.messaging.services.list().then(services => services.find(
//       service => service.friendlyName === applicationName
//     ));
//
//     response.setBody({
//       account: accountInfo,
//       phoneList: phones,
//       messagingServiceSid: (messagingService && messagingService.sid) ? messagingService.sid : 'NOT-DEPLOYED',
//       configuration: variables,
//     });
//     return callback(null, response);
//   } catch (err) {
//     console.log(THIS, err);
//     response.setStatusCode(400);
//     response.setBody({message: THIS + " There was an error getting your account information."});
//     return callback(err, response);
//   } finally {
//     console.timeEnd(THIS);
//   }
// }
//
// async function readConfigurationVariables() {
//   const path_env = path.join(process.cwd(), '.env');
//   const payload = fs.readFileSync(path_env, 'utf8');
//   const configuration = configure_env.parser.parse(payload)
//   return configuration.variables;
// }
//
//
// /**
//  * Create a new phone number and returns it
//  * @param {*} context
//  * @returns
//  */
//
//  async function createTwilioPhoneNumber (context, configuration) {
//   const client = context.getTwilioClient();
//
//   // If country code not present default to US
//   const countryCode = configuration.find(o => o.key === 'COUNTRY_CODE')?.default || 'US';
//   console.log("Buying a new number....", countryCode);
//
//   try {
//     const phoneNumbers = await client
//       .availablePhoneNumbers(countryCode)
//       .local.list({ limit: 1 });
//
//     console.log("Available numbers....", phoneNumbers);
//
//     if (!phoneNumbers.length) {
//       return [];
//     }
//
//     const { phoneNumber } = phoneNumbers[0];
//
//     console.log("Selected number...", phoneNumber);
//
//     const createdPhoneNumber = await client.incomingPhoneNumbers.create({
//       phoneNumber,
//       capabilities: {
//         sms: true,
//       },
//     });
//     return [createdPhoneNumber];
//   } catch {
//     return [];
//   }
// };
