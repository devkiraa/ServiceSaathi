const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');

router.get('/login', (req, res) => {
    res.render('login');
});

router.get('/signup', (req, res) => {
    res.render('signup');
});

router.post('/signup', (req, res) => {
    User.create(req.body)
        .then(user => {
            res.redirect('/login');
        })
        .catch(err => {
            res.status(400).render('signup', { error: err.message });
        });
});

router.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));

router.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/login');
});

module.exports = router;