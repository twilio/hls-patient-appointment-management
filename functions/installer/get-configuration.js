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
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);

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
      const phoneList = await retrieve_candidate_phones(context);
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


/*
 * --------------------------------------------------------------------------------
 * returns candidate Twilio phone numbers assignable to this application.
 *
 * TODO: please customize (e.g., sms capable) to reflect application-specific phone number requirement
 *
 * returns: array of { phondSID, phoneNumber, friendlyName }
 * --------------------------------------------------------------------------------
 */
async function retrieve_candidate_phones(context) {
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);

  const client = context.getTwilioClient();

  const phonesAll = await client.incomingPhoneNumbers.list();

  // TODO: filter for application-specific capabilities
  const phonesCandidate = phonesAll.filter(p => p.capabilities.sms);

  // TODO: sort in application-specific order
  const flow_sid = await getParam(context, 'FLOW_SID');
  phonesCandidate.sort(function compareFn(a, b) {
    const phoneNaturalOrder = a.phoneNumber === b.phoneNumber
      ? 0
      : (a.phoneNumber > b.phoneNumber ? -1 : 1);

    if (a.smsUrl && b.smsUrl) {
      if (a.smsUrl.includes(flow_sid) && b.smsUrl.includes(flow_sid)) return phoneNaturalOrder;
      else if (a.smsUrl.includes(flow_sid) && ! b.smsUrl.includes(flow_sid)) return -1;
      else if (! a.smsUrl.includes(flow_sid) && b.smsUrl.includes(flow_sid)) return 1;
    } else if (a.smsUrl && ! b.smsUrl) {
      return 1;
    } else if (! a.smsUrl && b.smsUrl) {
      return -1;
    } else {
      return phoneNaturalOrder;
    }
  });

  const response = phonesCandidate.map(p => {
    return {
      phoneNumber: p.phoneNumber,
      friendlyName: p.friendlyName,
    }
  });
  return response;
}
