/**
 * TODO:
 * - Call the client to get the account info
 * - deploy server-less functions and assets
 * - deploy the studio flow
 */
const CONFIGURATION_VARIABLES = [];

window.addEventListener('load', async () => {
  // Steps 1 and 2: Populate the field entries
  const appContext = await getAppContext();
  console.log("app context", appContext);
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

  const {
    isDeployed,
    applicationUrl,
    serviceSid
  } = await checkServiceDeployment();
  
  if (messagingServiceSid && messagingServiceSid !== 'NOT-DEPLOYED' && isDeployed) {
    $('#messaging_service_sid').val(messagingServiceSid);
    $('#messaging_service_sid').prop("disabled", true);
    $('#service-deployed').show();
    $('#application-open').attr('href', applicationUrl);
    $('#service-open').attr('href', `https://www.twilio.com/console/functions/api/start/${serviceSid}`);
  } else if (messagingServiceSid && messagingServiceSid === 'NOT-DEPLOYED') {
    $('#service-deploy').show();
    $('service-deployed').hide();
    console.log(CONFIGURATION_VARIABLES);
    const idxToRemove = CONFIGURATION_VARIABLES.findIndex(variable => {
      return variable.key === 'MESSAGING_SERVICE_SID';
    });
    if(idxToRemove !== -1) {
      CONFIGURATION_VARIABLES.splice(idxToRemove, 1);
    }
    $('.clone-for-MESSAGING_SERVICE_SID').hide();
  }
});

async function getAppContext() {
  const appResp = await fetch('/installer/get-application', {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })
  .then(res => res.json())
  .catch(err => console.error(err));
  return appResp;
}

// deployApplication() is attached to the deploy buttons 
async function deployApplication(event) {
  console.log("CLICKED");
  event.preventDefault();

  const input = validateInput();
  const validated = input.every(i => i.isValid);
  console.log(validated);
  if (!validated) return;
  $('#service-deployed').hide();
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
  const { isDeployed } = await checkServiceDeployment();
  if (isDeployed) {
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

  try {
    const serviceResponse =  await fetch('/installer/deploy-application', {
      method: 'POST',
      headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({ configuration: configuration }),
    });
    const {service_sid: serviceSid, application_url: applicationUrl} = await serviceResponse.json(); 
    await deployMessagingService('CREATE');
    await deployStudioFlow(configuration);
    $('#service-deploying').hide();
    $('#service-deploy-button').prop('disabled', false);
    $('#service-deployed').show();
    $('#service-deploy').hide();
    $('#service-open').attr('href', `https://www.twilio.com/console/functions/api/start/${serviceSid}`);
    $('#application-open').attr('href', applicationUrl);
  }
  catch(err) {
    console.log("Error (deployApplication()): ", err);
    $('#service-deploying').hide();
    $('#service-deploy-button').prop('disabled', false);
  }

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

async function isStudioFlowDeployed() {
  const studioFlowResp = await fetch('/installer/check-studio-flow', {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": 'application/json',
    },
  })
  .then(resp => resp.json())
  .catch(err => console.error(err));
  return studioFlowResp.status === 'DEPLOYED' ? true : false;
}

async function checkServiceDeployment() {
  const serviceResp = await fetch('/installer/check-application', {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": 'application/json',
    },
  })
  .then(resp => resp.json())
  .catch(err => console.error(err));
  return {
    isDeployed: serviceResp.deploy_state === "DEPLOYED",
    applicationUrl: serviceResp.application_url,
    serviceSid: serviceResp.service_sid
  };
}

async function deployStudioFlow(configuration) {
  return await fetch('/installer/deploy-studio-flow', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": 'application/json',
    },
    body: JSON.stringify({ configuration: configuration }),
  })
  .then(resp => resp.json())
  .catch(err => console.log(err));
}

async function deployMessagingService(action) {
  const messagingServiceResp = await fetch('/installer/deploy-messaging-service', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": 'application/json',
    },
    body: JSON.stringify({action}),
  })
  .then(resp => resp.json())
  .then(resp => {
    console.log("RESP", resp);
    return resp;
  })
  .catch(err => console.log(err));
  console.log("messaging", messagingServiceResp);
}
