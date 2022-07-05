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
 * --------------------------------------------------------------------------------
 */

/* --------------------------------------------------------------------------------
 * retrieve environment variable value
 * --------------------------------------------------------------------------------
 */
const assert = require("assert");

async function getParam(context, key) {
  const assert = require('assert');

  assert(context.APPLICATION_NAME, 'undefined .env environment variable APPLICATION_NAME!!!');

  if (key !== 'SERVICE_SID' // avoid warning
    && key !== 'ENVIRONMENT_SID' // avoid warning
    && context[key]) {
    return context[key]; // first return context non-null context value
  }

  const client = context.getTwilioClient();
  // ----------------------------------------------------------------------
  switch (key) {
    case 'SERVICE_SID':
    {
      // return sid only if deployed; otherwise null
      const services = await client.serverless.services.list();
      const service = services.find(s => s.uniqueName === context.APPLICATION_NAME);

      return service ? service.sid : null;
    }

    case 'ENVIRONMENT_SID':
    {
      // return sid only if deployed; otherwise null
      const service_sid = await getParam(context, 'SERVICE_SID');
      if (service_sid === null) return null; // service not yet deployed

      const environments = await client.serverless
        .services(service_sid)
        .environments.list({limit : 1});
      assert(environments && environments.length > 0, `error fetching environment for service_sid=${service_sid}!!!`);

      return environments[0].sid;
    }

    case 'ENVIRONMENT_DOMAIN_NAME': {
      // return domain_name only if deployed; otherwise null
      const service_sid = await getParam(context, 'SERVICE_SID');
      if (service_sid === null) return null; // service not yet deployed

      const environments = await client.serverless
        .services(service_sid)
        .environments.list({limit : 1});
      assert(environments && environments.length > 0, `error fetching environment for service_sid=${service_sid}!!!`);

      return environments[0].domainName;
    }

    case 'VERIFY_SID':
    {
      const services = await client.verify.services.list();
      let service = services.find(s => s.friendlyName === context.APPLICATION_NAME);
      if (! service) {
        console.log(`No verify service friendlyName=${context.APPLICATION_NAME}, creating one...`);
        service = await client.verify.services.create({ friendlyName: context.APPLICATION_NAME });
      }
      assert(service, `Unable to create verify service friendlyName=${context.APPLICATION_NAME}`);

      await setParam(context, key, service.sid);
      return service.sid;
    }

    case 'MESSAGING_SID':
    {
      const services = await client.messaging.services.list();
      let service = services.find(s => s.friendlyName === context.APPLICATION_NAME);
      if (! service) {
        console.log(`No messaging service friendlyName=${context.APPLICATION_NAME}, creating one...`);
        service = await client.messaging.services.create({ friendlyName: context.APPLICATION_NAME });
        assert(service, `Unable to create messaging service friendlyName=${context.APPLICATION_NAME}`);
      }

      if (context.TWILIO_PHONE_NUMBER) {
        const twilio_phones = await client.incomingPhoneNumbers.list();
        const twilio_phone = twilio_phones.find(p => p.phoneNumber === context.TWILIO_PHONE_NUMBER);
        assert(twilio_phone, `no matching incomingPhoneNumber=${context.TWILIO_PHONE_NUMBER}!!!`);

        const phones = await client.messaging.services(service.sid).phoneNumbers.list();
        let phone = phones.find(p => p.phoneNumber === context.TWILIO_PHONE_NUMBER);
        if (phones.length === 0 || !phone) {
          phone = await client.messaging.services(service.sid).phoneNumbers.create({
            phoneNumberSid: twilio_phone.sid,
          });
        }
        // only save environment variable on service, when phone number is assigned
        await setParam(context, key, service.sid);
      }

      return service.sid;
    }

    case 'FLOW_SID':
    {
      const flows = await client.studio.flows.list();
      const flow = flows ? flows.find(f => f.friendlyName === context.APPLICATION_NAME) : null;

      return flow ? flow.sid : null;
    }

    default:
      throw new Error(`Undefined context variable ${key} !!!`);
  }
}

/* --------------------------------------------------------------------------------
 * sets environment variable, only if service is deployed
 * --------------------------------------------------------------------------------
 */
async function setParam(context, key, value) {
  const service_sid = await getParam(context, 'SERVICE_SID');
  if (! service_sid) return null; // do nothing is service is not deployed

  const client = context.getTwilioClient();

  const environment_sid = await getParam(context, 'ENVIRONMENT_SID');
  const variables = await client.serverless
    .services(service_sid)
    .environments(environment_sid)
    .variables.list();
  let variable = variables.find(v => v.key === key);

  if (variable) {
    // update existing variable
    if (variable.value !== value) {
      await client.serverless
        .services(service_sid)
        .environments(environment_sid)
        .variables(variable.sid)
        .update({value})
        .then((v) => console.log('setParam: updated variable', v.key));
    }
  } else {
    // create new variable
    await client.serverless
      .services(service_sid)
      .environments(environment_sid)
      .variables.create({ key, value })
      .then((v) => console.log('setParam: created variable', v.key));
  }

  return {
    key: key,
    value: value
  };
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
async function retrieveCandidateTwilioPhones(context) {
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
  retrieveCandidateTwilioPhones,
  validateAppointment,
};
