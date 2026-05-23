fetch('http://localhost:3000/api/admin/sources')
  .then(res => res.text())
  .then(text => console.log('RESPONSE:', text))
  .catch(err => console.error('ERROR:', err));
