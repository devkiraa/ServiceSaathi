const bcrypt = require('bcryptjs');

const password = 'admin';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
  if (err) throw err;
  console.log('Hashed password:', hash);
});
