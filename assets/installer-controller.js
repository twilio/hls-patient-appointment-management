/**
 * TODO:
 * - Call the client to get the account info
 * - deploy server-less functions and assets
 * - deploy the studio flow
 */

window.addEventListener('load', async () => {
  const accountName = document.getElementById('account_name');
  const phoneNumberSelection = document.getElementById('twilio_phone_number');
  const appPassword = document.getElementById('app-password');
  const customerName = document.getElementById('customer-name');
  const adminPhone = document.getElementById('admin-phone');
  const serviceLoader = document.getElementById('service-loader');
  const serviceDeployed = document.getElementById('service-deployed');

  // Steps 1 and 2: Populate the field entries
  const appResp = await fetch('/installer/get-application', {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": 'application/json',
    },
  });
  
  const appContext = await appResp.json();
  accountName.value = appContext.account.friendlyName;
  appContext.phoneList.forEach(p => {
    const optionElement = document.createElement('option');
    optionElement.innerHTML = p.friendlyName;
    optionElement.value = p.phoneNumber;
    phoneNumberSelection.append(optionElement);
  });
  appPassword.value = appContext.configuration["Application Password"];
  customerName.value = appContext.configuration["Customer Name"];
  adminPhone.value = appContext.configuration["Administrator Phone"];
  appPassword.disabled = true;
  customerName.disabled = true;
  adminPhone.disabled = true;

  // Step 3: Check application and show deploy button.
  if (isServiceDeployed()) {
    serviceLoader.style.display = "none";
    serviceDeployed.style.display = "block";
  }



}); 

async function isServiceDeployed() {
  const serviceResp = await fetch('/installer/check-application', {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": 'application/json',
    },
  });
  const resp = serviceResp.json();
  console.log(resp);
  return resp.deploy_state === "DEPLOYED" ? true : false;
}

