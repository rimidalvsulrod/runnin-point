import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Provide a password. Use at least 12 characters outside demo environments.');
  process.exit(1);
}

console.log(await bcrypt.hash(password, 12));

