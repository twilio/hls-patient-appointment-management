
async function checkAuthToken() {
    if (!token) {
      window.location = '/index.html?from=internal.html'
    }
    try {
      await refreshToken();
    } catch {
      window.location = '/index.html?from=internal.html'
    }
  }

window.addEventListener("load", async () => {
  checkAuthToken();
});

async function sendReminders() {
    
}