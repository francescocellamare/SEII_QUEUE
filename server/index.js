'use strict';
const express = require('express');
const morgan = require('morgan');                                  // logging middleware
const {check, validationResult} = require('express-validator'); // validation middleware
const dao = require('./dao'); // module for accessing the DB
const passport = require('passport'); // auth middleware
const LocalStrategy = require('passport-local').Strategy; // username and password for login
const session = require('express-session'); // enable sessions
const userDao = require('./user-dao'); // module for accessing the user info in the DB
const cors = require('cors');
const dayjs = require("dayjs");
const app = express();

passport.use(new LocalStrategy(
    function(username, password, done) {
        userDao.getUser(username, password).then((user) => {
            if (!user)
                return done(null, false, { message: 'Incorrect username and/or password.' });
            return done(null, user);
        })
    }
));

passport.serializeUser((user, done) => {
    done(null, {id: user.id});
});

passport.deserializeUser((id, done) => {
    userDao.getUserById(id)
        .then(user => {
            done(null, user);
        }).catch(err => {
        done(err, null);
    });
});

app.use(morgan('dev'));
app.use(express.json());
app.use(express.static('public'))

const corsOptions = {
    origin: 'http://localhost:5173',
    credentials: true,
};
app.use(cors(corsOptions));

const isLoggedIn = (req, res, next) => {
    if(req.isAuthenticated())
        return next();

    return res.status(401).json({ error: 'Not authenticated'});
}
const answerDelay = 300;

app.use(session({
    secret:'anjndaljjahuiq8989',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


/** ******************************************************************************************************************************************* **/

app.post('/api/sessions', function(req, res, next) {
    passport.authenticate('local', (err, user, info) => {
        if (err)
            return next(err);
        if (!user) {
            return res.status(401).json(info);
        }
        req.login(user, (err) => {
            if (err)
                return next(err);
            return res.json(req.user);
        });
    })(req, res, next);
});

app.get('/api/sessions/current', (req, res) => {  if(req.isAuthenticated()) {
    res.status(200).json(req.user);}
else
    res.status(401).json({error: 'Unauthenticated user!'});;
});

app.delete('/api/sessions/current', (req, res) => {
    req.logout( ()=> { res.end(); } );
});


const PORT = 3001;
app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}`));