const fetch = require('node-fetch');

async function main(){
  const loginRes = await fetch('http://localhost:3002/auth/login', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ email: 'cashier@test.local', password: 'CashierPass123!' })
  });
  const loginJson = await loginRes.json();
  console.log('LOGIN_STATUS:', loginRes.status);
  console.log(JSON.stringify(loginJson, null, 2));

  if (loginJson.access_token) {
    const profilRes = await fetch('http://localhost:3002/auth/profil', {
      method: 'GET', headers: { 'Authorization': `Bearer ${loginJson.access_token}` }
    });
    const profilJson = await profilRes.json();
    console.log('PROFIL_STATUS:', profilRes.status);
    console.log(JSON.stringify(profilJson, null, 2));
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
