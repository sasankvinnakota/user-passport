const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// Serialize and deserialize user
passport.serializeUser((user, cb) => {
  process.nextTick(() => {
    cb(null, { id: user.id, username: user.username });
  });
});

passport.deserializeUser((user, cb) => {
  process.nextTick(() => {
    cb(null, user);
  });
});

// Configure Passport Local Strategy
passport.use(new LocalStrategy((username, password, cb) => {
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return cb(err);
    if (!row) return cb(null, false, { message: 'Incorrect username or password.' });

    crypto.pbkdf2(password, row.salt, 310000, 32, 'sha256', (err, hashedPassword) => {
      if (err) return cb(err);
      if (!crypto.timingSafeEqual(Buffer.from(row.hashed_password, 'hex'), hashedPassword)) {
        return cb(null, false, { message: 'Incorrect username or password.' });
      }
      return cb(null, row);
    });
  });
}));

// Routes
router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login/password', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
}));

router.post('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/');
  });
});

router.get('/signup', (req, res) => {
  res.render('signup');
});

router.post('/signup', (req, res, next) => {
  const salt = crypto.randomBytes(16);
  crypto.pbkdf2(req.body.password, salt, 310000, 32, 'sha256', (err, hashedPassword) => {
    if (err) return next(err);

    db.run('INSERT INTO users (username, hashed_password, salt) VALUES (?, ?, ?)', [
      req.body.username,
      hashedPassword.toString('hex'),
      salt.toString('hex'),
    ], function (err) {
      if (err) return next(err);

      const user = { id: this.lastID, username: req.body.username };
      req.login(user, err => {
        if (err) return next(err);
        res.redirect('/');
      });
    });
  });
});

module.exports = router;