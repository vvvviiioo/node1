async function loadUserData() {
  try {
    const checkResponse = await fetch("/api/auth/check");
    const checkResult = await checkResponse.json();

    if (!checkResult.authenticated) {
      window.location.href = "/login";
      return;
    }

    document.getElementById(
      "userGreeting"
    ).textContent = `Добро пожаловать, ${checkResult.user.username}!`;
    document.getElementById("userEmail").textContent = checkResult.user.email;
    document.getElementById("userAvatar").src = checkResult.user.image;

    const historyResponse = await fetch("/api/auth/login-history?limit=20");
    const historyData = await historyResponse.json();

    const tableBody = document.getElementById("historyTableBody");
    tableBody.innerHTML = "";

    if (historyData.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="3" style="text-align: center;">История входов отсутствует</td></tr>';
    } else {
      historyData.forEach((login) => {
        const row = document.createElement("tr");
        row.innerHTML = `
                            <td>${new Date(
                              login.login_time
                            ).toLocaleString()}</td>
                            <td>${login.ip_address}</td>
                            <td title="${login.user_agent}">${truncateUserAgent(
          login.user_agent
        )}</td>
                        `;
        tableBody.appendChild(row);
      });
    }
  } catch (error) {
    console.error("Ошибка при загрузке данных:", error);
  }
}

function truncateUserAgent(userAgent) {
  if (userAgent.length > 50) {
    return userAgent.substring(0, 50) + "...";
  }
  return userAgent;
}

async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  } catch (error) {
    console.error("Ошибка при выходе:", error);
  }
}


document.addEventListener("DOMContentLoaded", loadUserData);
