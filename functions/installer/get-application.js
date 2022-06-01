const { getParam } = require(Runtime.getFunctions()['helpers'].path);
const configure_env = require("configure-env");
const path = require('path');
const fs = require('fs');

exports.handler = async function (context, event, callback) {
  const THIS = 'get-account:';
  console.time(THIS);
  const client = context.getTwilioClient();
  const response = new Twilio.Response();
  response.setStatusCode(200);

  try {
    const account = await client.api.accounts(context.ACCOUNT_SID).fetch();
    const accountInfo = {
      friendlyName: account.friendlyName,
      accountSid: account.sid,
      status: account.status
    }

    const phoneList = await client.api.accounts(context.ACCOUNT_SID).incomingPhoneNumbers.list();
    const twilioFlowId = await getParam(context, 'FLOW_SID');


    // Check in sms url whether deployed studio flow id is present or not. Then take that phone number else check for numbers where phone.capabilites.sms === true and phone.smsUrl is empty.
    let phoneNumbers = phoneList.filter((phone) => phone.smsUrl.includes(twilioFlowId));

    if(!phoneNumbers.length) {
      phoneNumbers = phoneList.filter((phone) => phone.capabilities.sms && !phone.smsUrl);
    }

    // If there is no phone numbers with sms capabilities, create a new one with sms capability.
    if(!phoneNumbers.length) {
      phoneNumbers = await createTwilioPhoneNumber(context)
    }

    if(!phoneNumbers.length) {
      throw new Error("Unable to get phone number");
    }

    const phones = phoneNumbers.map(phone => {
      return {
        friendlyName: phone.friendlyName,
        phoneNumber: phone.phoneNumber,
        phoneSid: phone.sid
      }
    });

    const messagingService = await client.messaging.services.list().then(services => services.find(
      service => service.friendlyName === await getParam(context, 'APPLICATION_NAME');
    ));
  
    const variables = await readConfigurationVariables();

    response.setBody({
      account: accountInfo,
      phoneList: phones,
      messagingServiceSid: (messagingService && messagingService.sid) ? messagingService.sid : 'NOT-DEPLOYED', 
      configuration: variables,
    });
    return callback(null, response);
  } catch (err) {
    console.log(THIS, err);
    response.setStatusCode(400);
    response.setBody({message: THIS + " There was an error getting your account information."});
    return callback(err, response);
  } finally {
    console.timeEnd(THIS);
  }
}

async function readConfigurationVariables() {
  const path_env = path.join(process.cwd(), '.env');
  const payload = fs.readFileSync(path_env, 'utf8');
  const configuration = configure_env.parser.parse(payload)
  return configuration.variables;
}


/**
 * Create a new phone number and returns it
 * @param {*} context
 * @returns
 */

 async function createTwilioPhoneNumber (context) {
  const client = context.getTwilioClient();

  // If country code not present default to US
  const countryCode = await getParam(context, 'COUNTRY_CODE') || 'US';
  console.log("Buying a new number....", countryCode);

  try {
    const phoneNumbers = await client
      .availablePhoneNumbers(countryCode)
      .local.list({ limit: 1 });

    console.log("Available numbers....", phoneNumbers);

    if (!phoneNumbers.length) {
      return [];
    }

    const { phoneNumber } = phoneNumbers[0];

    console.log("Selected number...", phoneNumber);

    const createdPhoneNumber = await client.incomingPhoneNumbers.create({
      phoneNumber,
      capabilities: {
        sms: true,
      },
    });
    return [createdPhoneNumber];
  } catch {
    return [];
  }
};
