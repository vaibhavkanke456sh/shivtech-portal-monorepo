const res = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    identifier: 'Shivowner_4567',
    password: 'LifeQWER#$123',
    expectedRole: 'web_developer'
  })
});
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
