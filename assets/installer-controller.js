/**
 * TODO:
 * - Call the client to get the account info
 * - deploy server-less functions and assets
 * - deploy the studio flow
 */
const CONFIGURATION_VARIABLES = [];

window.addEventListener('load', async () => {
  const serviceLoader = document.getElementById('service-loader');
  const serviceDeploy = document.getElementById('service-deploy');
  const serviceDeployed = document.getElementById('service-deployed');

  // Steps 1 and 2: Populate the field entries
  const appContext = await getAppContext();
  const account = appContext.account;
  const configurationVariables = appContext.configuration;
  const phoneList = appContext.phoneList;
  const messagingServiceSid = appContext.messagingServiceSid;

  // Populate Account Name and Twilio Phone Number Options
  $('#account_name').val(account.friendlyName);
  if (phoneList.length === 0) {
    $(".configure-error-twilio-phone-number").show();
  } else {
    phoneList.forEach(phone => {
      const html = `<option value="${phone.phoneNumber}">${phone.friendlyName}</option>`;
      $('#twilio_phone_number').append(html);
    });
  }

  for (v of configurationVariables) {
    await addVariable(v, v.value);
  }

  if (messagingServiceSid) {
    $('#messaging_service_sid').val(messagingServiceSid);
    $('#messaging_service_sid').prop("disabled", true);
  }

  // Step 3: Check application and show deploy button.
  if (isServiceDeployed()) {
    $('#service-deployed').show();
  } else {
    $('#service-deploy').show();
  }

});

async function getAppContext() {
  const appResp = await fetch('/installer/get-application', {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": 'application/json',
    },
  });
  return await appResp.json();
}

async function deployApplication(event) {
  event.preventDefault();
  // deploy functions
  // deploy Studio flow
  $('#service-deployed').hide();

  const input = validateInput();
  const validated = input.every(i => i.isValid);
  if (!validated) return;
  console.log('variable values validated');

  const configuration = {};
  for (i of input) {
      if (!i.value) continue;
      configuration[i.key] = i.value;
  }
  console.log(configuration);
  console.log(JSON.stringify(configuration));
  $('#service-deploy-button').prop('disabled', true);
  $('#service-deploying').show();
  

  // if service exists, delete first before deploying again
  if (isServiceDeployed()) {
    await fetch('/installer/delete-service', {
      method: 'GET',
      headers: {
          'Content-Type': 'application/json',
      }
    })
    .then(resp => resp.json())
    .then(resp => console.log("Service Deleted: ", resp.serviceSid))
    .catch(err => { console.error(err) });
  }

  // First Deploy the Functions
  const serviceResp = await fetch('/installer/deploy-application', {
    method: 'POST',
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ configuration: configuration }),
  })
  .then((resp) => {
      $('#service-deploying').hide();
      $('#service-deploy-button').prop('disabled', false);
      $('#service-deployed').show();
      console.log('Service successfully deployed');
      return resp.json();
  })
  .catch ((err) => {
      console.log("Error (deployApplication()): ", err);
      $('#service-deploying').hide();
      $('#service-deploy-button').prop('disabled', false);
  });
  console.log(serviceResp);


}

async function isServiceDeployed() {
  const serviceResp = await fetch('/installer/check-application', {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": 'application/json',
    },
  });
  const resp = serviceResp.json();
  return resp.deploy_state === "DEPLOYED" ? true : false;
}

async function addVariable(variable, currentValue = null) {
  if (variable.key === 'TWILIO_PHONE_NUMBER') {
      // twilio phone number dropdown is handled outside, TODO: move inside
      CONFIGURATION_VARIABLES.push({
          key: 'TWILIO_PHONE_NUMBER',
          required: variable.required,
          configurable: variable.configurable,
          css_id: '#twilio_phone_number',
      });
      return;
  }

  const originalElement = $('div.clone-original');

  const clonedElement = originalElement.clone().insertBefore(originalElement);
  clonedElement.removeClass("clone-original");
  clonedElement.addClass("clone-for-" + variable.key);

  const label = variable.key.toLowerCase().split('_').map(word => word[0].toUpperCase() + word.substr(1)).join(' ');
  (variable.required === true) ? clonedElement.find('.star').show() : clonedElement.find('.star').hide();
  clonedElement.find(".configure-label").text(label);

  css_id = `${variable.key.toLowerCase()}`;
  clonedElement.find('input').attr("id", css_id);
  clonedElement.find('input').attr("name", css_id);

  const value = currentValue ? currentValue : (variable.default ? variable.default: '');
  clonedElement.find('input').val(value);
  if (value) {
    clonedElement.find('input').prop("disabled", true);
  }
  // clonedElement.find('input').attr("placeholder", (variable.default == null ? ' ' : variable.default));
  clonedElement.find('.tooltip').text(variable.description);
  const formats = {
      "secret": "password",
      "phone_number": "text",
      "email": "text",
      "text": "text"
  };
  clonedElement.find('input').attr("type", (formats.hasOwnProperty(variable.format) ? formats[variable.format] : "text"));

  CONFIGURATION_VARIABLES.push({
      key: variable.key,
      required: variable.required,
      configurable: variable.configurable,
      css_id: `#${css_id}`,
      value: v.default ? v.default : v.value,
      isValid: true,
  });
  if (variable.configurable) {
      clonedElement.show();
  }
}

function validateInput() {
  $('.configure-error').text("");
  $('.configure-error').hide("");

  let hasValidationError = false;
  for (v of CONFIGURATION_VARIABLES) {
      if (! v.configurable) continue; // skip non-configurable variables
      console.log(v);
      const inputValue = $(v.css_id).val();
      console.log('input is', inputValue);
      if (v.required && !inputValue) {
          $('.clone-for-' + v.key).find(".configure-error").text("This field is required");
          $('.clone-for-' + v.key).find(".configure-error").show();
          hasValidationError = true;
      }
      v['value'] = inputValue;
      v['isValid'] = ! hasValidationError;
  }

  return CONFIGURATION_VARIABLES;
}
