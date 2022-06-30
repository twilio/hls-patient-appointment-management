/**
 * TODO:
 * - Call the client to get the account info
 * - deploy server-less functions and assets
 * - deploy the studio flow
 */
const CONFIGURATION_VARIABLES = [];
// ---------- UI element css id list used by functions
const UI = {
  configure_error_login: '..configure-error-login',
  deployable_loader: '.deployable-loader',
  account_name: '#account_name',
  app_deployer: '#app-deployer',
  app_deployed: '#app-deployed',
  app_deploy: '#app-deploy',
  app_redeploy: '#app-redeploy',
  app_undeploy: '#app-undeploy',
  app_deploying: '#app-deploying',
  app_info: '#app-info',
  open_application: '#open-application',
  open_service: '#open-service',
  open_flow: '#open-flow',
}


/* -----------------------------------------------------------------------------
 * page loading function
 * -----------------------------------------------------------------------------
 */
$(document).ready(async function () {
  await populate();
  check();
});


async function addVariable(variable, currentValue = null) {
  /* -----------------------------------------------------------------------------
   * add configuration variable entry
   *
   * input:
   * - variable: see https://www.npmjs.com/package/configure-env
   * --------------------------------------------------------------------------------
   */
  console.log(variable.key, currentValue);

  if (variable.key === 'TWILIO_PHONE_NUMBER') {
    // twilio phone number dropdown is handled outside, TODO: move inside
    CONFIGURATION_VARIABLES.push({
      key: 'TWILIO_PHONE_NUMBER',
      required: variable.required,
      configurable: variable.configurable,
      css_id: '#twilio_phone_number',
      value: variable.value ? variable.default : variable.value,
      isValid: true,
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
  // clonedElement.find('input').attr("placeholder", (variable.default == null ? ' ' : variable.default));
  clonedElement.find('.tooltip').text(variable.description);
  const formats = {
      "secret": "password",
      "phone_number": "text",
      "email": "text",
      "text": "text",
      "number": "number"
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
  /* --------------------------------------------------------------------------------
   * validates variable input values
   *
   * input:
   * global variableInput set in populate()
   *
   * returns:
   * variableInput adding 2 attributes
   * - value
   * - isValid
   * --------------------------------------------------------------------------------
   */
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


async function populate() {
  /* --------------------------------------------------------------------------------
   * populate installer page
   * --------------------------------------------------------------------------------
   */
  const THIS = populate.name;
  try {
    const response = await fetch('/installer/get-configuration', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    const configuration = await response.json();
    // console.log(THIS, configuration);

    $(UI.account_name).val(configuration.twilioAccountName);

    for (v of configuration.configurationVariables) {
      if (v.key === 'TWILIO_PHONE_NUMBER') {
        const phoneConfigured = v.value;
        const phoneList = configuration.twilioPhoneNumbers;
        if (phoneList.length === 0) {
          $(".configure-error-twilio-phone-number").show();
        } else {
          phoneList.forEach(phone => {
            const html = phone === phoneConfigured
              ? `<option value="${phone.phoneNumber}" selected>${phone.friendlyName}</option>`
              : `<option value="${phone.phoneNumber}">${phone.friendlyName}</option>`;
            $('#twilio_phone_number').append(html);
          });
        }
      }

      await addVariable(v, v.value);
    }

  } catch (err) {
    console.log(err);
    $(UI.configure_error_login).text("Your Twilio authentication failed. Please try again with correct credentials");
    $(UI.configure_error_login).show();
  }
}


function check() {
  /* --------------------------------------------------------------------------------
   * check deployment of all deployables
   * --------------------------------------------------------------------------------
   */
  const THIS = check.name;

  try {
    fetch('/installer/check', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
      .then((raw) => raw.json())
      .then((response) => {
        if (! response.deploy_state) throw new Error('Missing deployable.deploy_state');

        $(`${UI.app_deployer} .button`).removeClass('loading');
        $(UI.app_deployer).show();
        if (response.deploy_state === 'NOT-DEPLOYED') {
          $(UI.app_deployed).hide();
          $(UI.open_application).hide();
          $(UI.open_service).hide();
          $(UI.open_flow).hide();
          $(UI.app_deploy).show();
          $(UI.app_deploy).css('pointer-events', '');
          $(UI.app_redeploy).hide();
          $(UI.app_undeploy).hide();
        } else if (response.deploy_state === 'DEPLOYED') {
          $(UI.app_deployed).show();
          $(UI.open_application).show();
          $(UI.open_application).attr('href', response.application_url);
          $(UI.open_service).show();
          $(UI.open_service).attr('href', response.service_url);
          $(UI.open_flow).show();
          $(UI.open_flow).attr('href', response.flow_url);
          $(UI.app_deploy).hide();
          $(UI.app_redeploy).show();
          $(UI.app_redeploy).css('pointer-events', '');
          $(UI.app_undeploy).show();
          $(UI.app_undeploy).css('pointer-events', '');
        }
        $(UI.app_deploying).hide();
        $(UI.app_info).text(JSON.stringify(response, undefined, 2));
        $(UI.deployable_loader).hide();
      });
  } catch (err) {
    console.log(THIS, err);
    window.alert(err);
  }
}


async function deploy(event, action) {
  /* --------------------------------------------------------------------------------
   * deploy
   *
   * action: DEPLOY|REDEPLOY|UNDEPLOY
   * --------------------------------------------------------------------------------
   */
  const THIS = deploy.name;

  event.preventDefault();

  const input = validateInput();
  const validated = input.every(i => i.isValid);
  if (!validated) return;
  console.log(THIS, 'variable values validated');

  const configuration = {};
  for (i of input) {
    if (!i.value) continue;
    configuration[i.key] = i.value;
  }
  console.log(configuration);
  console.log(JSON.stringify(configuration));

//  $(UI.app_deploy).prop('disabled', true);
//  $(UI.app_deploy).css('pointer-events', 'none');
  $(UI.app_deploy).hide();
  $(UI.app_redeploy).hide();
  $(UI.app_undeploy).hide();
  $(UI.app_deployed).hide();
  $(UI.app_deploying).show();

  $(`${UI.app_deployer} .button`).addClass('loading');

  fetch('/installer/deploy', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: action,
      configuration: configuration,
    }),
  })
    .then(() => {
      console.log(THIS, 'completed');
      check();
    })
    .catch ((err) => {
      console.log(THIS, err);
      window.alert(err);
      check();
    })
    .finally(() => {
      $(`${UI.app_deployer} .button`).removeClass('loading');
    });
}





window.addEventListener('xload', async () => {
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

  $('#initializing-deployment').show();

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
      return variable.key === 'MESSAGING_SID';
    });
    if(idxToRemove !== -1) {
      CONFIGURATION_VARIABLES.splice(idxToRemove, 1);
    }
    $('.clone-for-MESSAGING_SID').hide();
  } else if(!isDeployed) {
    $('#service-deploy').show();
  }

  $('#initializing-deployment').hide();

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

async function checkServiceDeployment() {
  const serviceResp = await fetch('/installer/check?checkStudioFlow=true', {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": 'application/json',
    },
  })
    .then(resp => resp.json())
    .catch(err => console.error(err));
  return {
    isDeployed: serviceResp.status === "DEPLOYED",
    applicationUrl: serviceResp.application_url,
    serviceSid: serviceResp.service_sid
  };
}
