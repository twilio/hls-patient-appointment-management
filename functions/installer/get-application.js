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
    const phones = phoneList.map(phone => {
      return {
        friendlyName: phone.friendlyName,
        phoneNumber: phone.phoneNumber,
        phoneSid: phone.sid
      }
    });

    const messagingService = await client.messaging.services.list().then(services => services.find(
      service => service.friendlyName === process.env.APPLICATION_NAME
    ));

    console.log("STUFF: ", account, phoneList, messagingService)
    console.log("MORE STUFF: ", process.env.APPLICATION_NAME, context.APPLICATION_NAME);
  
    const variables = await readConfigurationVariables();

    response.setBody({
      account: accountInfo,
      phoneList: phones,
      messagingServiceSid: messagingService.sid,
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
  const path_env = path.join(process.cwd(), '.env.example');
  const payload = fs.readFileSync(path_env, 'utf8');
  const configuration = configure_env.parser.parse(payload)
  return configuration.variables;
}

// Get the process.env and parse the appropriate info to give to client
// function getParsedEnv(env) {
//   const excludeWords = [
//     "CODE",
//     "SALT",
//     "REMINDER",
//     "TOKEN",
//     "SID",
//     "__",
//     "APPLICATION_NAME",
//   ]
//   const parsedEnv = {};
//   for (const [key, value] of Object.entries(env)) {
//     //console.log(key, value);
//     if (excludeWords.some(val => key.indexOf(val) >= 0)) continue;
//     const envKey = key.split("_");
//     const formattedKey = envKey.map(word => {
//       return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
//     }).join(" ");
//     console.log(formattedKey);
//     parsedEnv[formattedKey] = value;
//   }
//   return parsedEnv;
// }
