/* eslint-disable camelcase, complexity, sonarjs/cognitive-complexity, prefer-template */
/*
 * --------------------------------------------------------------------------------
 * common helper function used by functions & client-side javascript
 *
 * getParam(context, key)
 * getParam(context, key)
 * setParam(context, key, value)
 *
 * include via:
 *   const path = Runtime.getFunctions()['helper'].path;
 *   const { getParam, setParam } = require(path);
 * and call functions directly
 *
 *
 * --------------------------------------------------------------------------------
 */

/*
 * --------------------------------------------------------------------------------
 * sets environment variable
 * --------------------------------------------------------------------------------
 */
const assert = require('assert');
async function setParam(context, key, value) {

  const onLocalhost = Boolean(
    context.DOMAIN_NAME && context.DOMAIN_NAME.startsWith('localhost')
  );
  console.debug('Runtime environment is localhost:', onLocalhost);

  const client = context.getTwilioClient();
  // eslint-disable-next-line no-use-before-define
  const service_sid = await getParam(context, 'TWILIO_SERVICE_SID');
  // eslint-disable-next-line no-use-before-define
  const environment_sid = await getParam(context, 'TWILIO_ENVIRONMENT_SID');

  let variable_sid = null;
  await client.serverless
    .services(service_sid)
    .environments(environment_sid)
    .variables.list()
    .then((variables) =>
      variables.forEach((v) => {
        if (v.key === key) variable_sid = v.sid;
      })
    );

  if (variable_sid === null) {
    await client.serverless
      .services(service_sid)
      .environments(environment_sid)
      .variables.create({ key, value })
      .then((v) => console.log('Created variable', v.key));
  } else {
    await client.serverless
      .services(service_sid)
      .environments(environment_sid)
      .variables(variable_sid)
      .update({ value })
      .then((v) => console.log('Updated variable', v.key));
  }
  console.log('Assigned', key, '=', value);
}

function assertLocalhost(context) {
  assert(context.DOMAIN_NAME.startsWith('localhost:'), `Can only run on localhost!!!`);
  assert(process.env.ACCOUNT_SID, 'ACCOUNT_SID not set in localhost environment!!!');
  assert(process.env.AUTH_TOKEN, 'AUTH_TOKEN not set in localhost environment!!!');
}

/*
 * --------------------------------------------------------------------------------
 * retrieve environment variable from
 * - service environment (aka context)
 * - os for local development (via os.process)
 * - per resource-specific logic
 *   . TWILIO_SERVICE_SID from context, otherwise matching application name
 *   . TWILIO_ENVIRONMENT_SID from TWILIO_SERVICE_SID
 *   . TWILIO_ENVIRONMENT_DOMAIN_NAME from TWILIO_SERVICE_SID
 * --------------------------------------------------------------------------------
 */
async function getParam(context, key) {
  const THIS_APPLICATION_NAME = 'patient-appointment-management';
  const CONSTANTS = {
    APPLICATION_NAME: THIS_APPLICATION_NAME,
    FILENAME_APPOINTMENT:
      'appointment{appointment_id}-patient{patient_id}.json',
    _S3_BUCKET_BASE: `twilio-${THIS_APPLICATION_NAME}`,
    _CF_STACK_DEPLOYER_BASE: `twilio-${THIS_APPLICATION_NAME}-deployer`,
    _CF_STACK_BUCKET_BASE: `twilio-${THIS_APPLICATION_NAME}-bucket`,
    _CF_STACK_APPLICATION_BASE: `twilio-${THIS_APPLICATION_NAME}-application`,
    _GLUE_DATABASE_BASE: 'patient_appointments',
  };

  // first return context non-null context value
  if (context[key]) return context[key];

  // second return CONSTANTS value
  if (CONSTANTS[key]) {
    context[key] = CONSTANTS[key];
    return context[key];
  }

  const account_sid = context.ACCOUNT_SID
    ? context.ACCOUNT_SID
    : process.env.ACCOUNT_SID;
  const auth_token = context.AUTH_TOKEN
    ? context.AUTH_TOKEN
    : process.env.AUTH_TOKEN;
  const client = context.getTwilioClient();

  // ----------------------------------------------------------------------
  try {
    switch (key) {
      case 'TWILIO_ACCOUNT_SID': {
        return getParam(context, 'ACCOUNT_SID');
      }
      case 'TWILIO_AUTH_TOKEN': {
        return getParam(context, 'AUTH_TOKEN');
      }
      case 'TWILIO_ENVIRONMENT_SID': {
        const service_sid = await getParam(context, 'TWILIO_SERVICE_SID');
        if (service_sid === null) {
          return null; // service not yet deployed
        }
        const environments = await client.serverless
          .services(service_sid)
          .environments.list();
        return environments[0].sid;
      }
      case 'TWILIO_MESSAGING_SID': {
        const messagingServiceSid = await getParam(context, 'MESSAGING_SERVICE_SID');
        if (!messagingServiceSid) {
          return null; // messaging service is not up
        }
        const messagingService = await client.messages.services
          .list()
          .then(services => services.find(service => service.friendlyName === THIS_APPLICATION_NAME));
        return messagingService.sid;
      }
      case 'TWILIO_SERVICE_SID': {
        const services = await client.serverless.services.list();
        const service = services.find(async s => s.uniqueName === await getParam(context, 'APPLICATION_NAME'));
        return (service && service.sid) ? service.sid : null;
      }
      case 'TWILIO_ENVIRONMENT_DOMAIN_NAME': {
        const service_sid = await getParam(context, 'TWILIO_SERVICE_SID');
        if (service_sid === null) {
          return null; // service not yet deployed
        }
        const environments = await client.serverless
          .services(service_sid)
          .environments.list();
        return environments[0].domainName;
      }
      case 'TWILIO_FLOW_SID': {
        let flow_sid = null;
        await client.studio.flows.list({ limit: 100 }).then((flows) =>
          flows.forEach((f) => {
            if (f.friendlyName === THIS_APPLICATION_NAME) {
              flow_sid = f.sid;
            }
          })
        );
        return flow_sid;
      }
      case 'TWILIO_SERVICE_SID': {
        let service_sid = null;
        await client.serverless.services.list({ limit: 100 }).then((services) =>
          services.forEach((s) => {
            if (s.friendlyName === THIS_APPLICATION_NAME) {
              service_sid = s.sid;
            }
          })
        );
        if (service_sid !== null) {
          return service_sid;
        }
        console.log(
          'Developer note: YOU MUST DEPLOY THE SERVICE FIRST!!! ABORTING!!!'
        );
        return null;
      }
      case 'TWILIO_VERIFY_SID': {
        let verify_sid = null;
        await client.verify.services.list().then((services) => {
          services.forEach((s) => {
            if (s.friendlyName === context.CUSTOMER_NAME) {
              verify_sid = s.sid;
            }
          });
        });
        if (verify_sid !== null) {
          return verify_sid;
        }
        console.log(
          'Verify service not found so creating a new verify service...'
        );
        await client.verify.services
          .create({ friendlyName: context.CUSTOMER_NAME })
          .then((result) => {
            console.log(result);
            console.log(result.sid);
            verify_sid = result.sid;
          });
        if (verify_sid !== null) {
          return verify_sid;
        }
        console.log('Unable to create a Twilio Verify Service!!! ABORTING!!! ');
        return null;
      }

      default:
        throw new Error(`Undefined variable ${key} !!!`);
    }
  } catch (err) {
    console.log(`Unexpected error in getParam for ${key} ... returning null`);
    return null;
  }
}

async function getAllParams(context) {

  const keys_context = Object.keys(context);
  // keys defined in getParam function above
  const keys_derived = [
    'IS_LOCALHOST',
  ];

  // to force saving of 'secret'
  await getParam(context, 'TWILIO_API_KEY_SID');

  const keys_all = keys_context.concat(keys_derived).sort();
  try {

    const result = {};
    for (k of keys_all) {
      if (k === 'getTwilioClient') continue; // exclude getTwilioClient function
      result[k] = await getParam(context, k);
    }
    return result;

  } catch (err) {
    console.log(err);
    throw err;
  }
}

/*
 * --------------------------------------------------------------------------------
 * validates appoointment data to guard against json injection
 *
 * validation rules not intended to be restrictive,
 * hence only implements rudiment basic check of the string value
 * - for names and location, alphanumeric & alphabet variations plus some punctuation
 *   characters are allowed. Full unicode character set is not supported
 *   as this application can ONLY be used in US subject to HIPAA regulations on PHI
 * - phone number validation is also permissive (i.e., not strict to E.164)
 * - datetime validates ISO8601 format
 *
 * param:
 * - appointment: json of appointment data
 *     event_type: 'BOOKED',
 *     event_datetime_utc: null,
 *     patient_id: '1000',
 *     patient_first_name: 'Jane',
 *     patient_last_name: 'Doe',
 *     patient_phone: test_phone_number,
 *     provider_id: 'afauci',
 *     provider_first_name: 'Anthony',
 *     provider_last_name: 'Fauci',
 *     provider_callback_phone: '(800) 111-2222',
 *     appointment_location: 'Owl Health Clinic',
 *     appointment_id: '20000',
 *     appointment_timezone: '-0700',
 *     appointment_datetime: appt_datetime.toISOString(),
 * --------------------------------------------------------------------------------
 */
function validateAppointment(context, appointment) {
  const validator = require('validator');

  // ---------- required
  {
    const v = appointment.event_type;
    assert(v, 'Missing appointment.event_type!');
    const validEventTypes = [
      'BOOKED',
      'MODIFIED',
      'RESCHEDULED',
      'NOSHOWED',
      'CANCEL',
      'CANCELED',
      'CONFIRM',
      'CONFIRMED',
      'REMIND',
      'OPTED-IN',
      'OPTED-OUT',
    ];
    assert(validator.isIn(v, validEventTypes), `Invalid event_type=${v}!`);
  }

  if (appointment.event_datetime_utc) {
    assert(
      validator.isISO8601(appointment.event_datetime_utc),
      `event_datetime_utc not ISO8601 format: ${appointment.event_datetime_utc}`
    );
  }

  // ---------- required
  assert(appointment.patient_id, 'Missing patient_id!');
  {
    const v = appointment.patient_id;
    const format = /^[a-zA-Z0-9 !@#$%^&*()_+\-=\[\]{};:\\|,.<>\/?]+$/i;
    assert(
      validator.matches(appointment.patient_id, format),
      `Invalid patient_id: ${appointment.patient_id}`
    );
  }

  if (appointment.patient_first_name) {
    const format =
      /^[a-zA-Z0-9àáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð ,\.'-]+$/u;
    assert(
      validator.matches(appointment.patient_first_name, format),
      `Invalid patient_first_name: ${appointment.patient_first_name}`
    );
  }

  if (appointment.patient_last_name) {
    const format =
      /^[a-zA-Z0-9àáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð ,\.'-]+$/u;
    assert(
      validator.matches(appointment.patient_last_name, format),
      `Invalid patient_last_name: ${appointment.patient_last_name}`
    );
  }

  if (appointment.patient_phone) {
    const format = /^[0-9+\-() ]+$/;
    assert(
      validator.matches(appointment.patient_phone, format),
      `Invalid patient_phone: ${appointment.patient_phone}`
    );
  }

  if (appointment.provider_id) {
    const format = /[a-zA-Z0-9 !@#$%^&*()_+\-=\[\]{};:\\|,.<>\/?]+/i;
    assert(
      validator.matches(appointment.provider_id, format),
      `Invalid provider_id: ${appointment.provider_id}`
    );
  }

  if (appointment.provider_first_name) {
    const format =
      /^[a-zA-Z0-9àáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð ,\.'-]+$/u;
    assert(
      validator.matches(appointment.provider_first_name, format),
      `Invalid provider_first_name: ${appointment.provider_first_name}`
    );
  }

  if (appointment.provider_last_name) {
    const format =
      /^[a-zA-Z0-9àáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð ,\.'-]+$/u;
    assert(
      validator.matches(appointment.provider_last_name, format),
      `Invalid provider_last_name: ${appointment.provider_last_name}`
    );
  }

  if (appointment.provider_callback_phone) {
    const format = /^[0-9+\-() ]+$/;
    assert(
      validator.matches(appointment.provider_callback_phone, format),
      `Invalid provider_callback_phone: ${appointment.provider_callback_phone}`
    );
  }

  if (appointment.appointment_location) {
    const format =
      /^[a-zA-Z0-9àáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð ,\.'-]+$/u;
    assert(
      validator.matches(appointment.appointment_location, format),
      `Invalid provider_last_name: ${appointment.appointment_location}`
    );
  }

  if (appointment.appointment_id) {
    const format = /[a-zA-Z0-9 !@#$%^&*()_+\-=\[\]{};:\\|,.<>\/?]+/i;
    assert(
      validator.matches(appointment.appointment_id, format),
      `Invalid appointment_id: ${appointment.appointment_id}`
    );
  }

  if (appointment.appointment_timezone) {
    const format = /^[+\-][0-9]{4}$/;
    assert(
      validator.matches(appointment.appointment_timezone, format),
      `Invalid appointment_timezone: ${appointment.appointment_timezone}`
    );
  }

  if (appointment.appointment_datetime) {
    assert(
      validator.isISO8601(appointment.appointment_datetime),
      `appointment_datetime not ISO8601 format: ${appointment.appointment_datetime}`
    );
  }

  return true; // validated
}

module.exports = {
  getParam,
  setParam,
  validateAppointment,
  assertLocalhost,
  getAllParams,
};
