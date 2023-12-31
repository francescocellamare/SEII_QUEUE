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
    origin: ['http://localhost:5173','http://localhost:5174'],
    credentials: true,
};
app.use(cors(corsOptions));

const isLoggedIn = (req, res, next) => {
    if(req.isAuthenticated())
        return next();

    return res.status(401).json({ error: 'Not authenticated'});
}
const answerDelay = 300;
//Number of total counter, usable for checking
const nCounter = 3;

app.use(session({
    secret:'anjndaljjahuiq8989',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// GET /api/servicesbycounter/:id
app.get('/api/servicesbycounter/:id', async (req, res) => {
    try {
      const services = await dao.listServicesByCounter(req.params.id);
      res.json(services);
    } catch(err) {
      console.log(err);
      res.status(500).end();
    }
  });

app.put('/api/nextCustomer/:id', [
    check('id').isInt({min: 0})
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({errors: errors.array()});
    }
    try {
        const services = await dao.listServicesByCounter(req.params.id);
        const queueState = await dao.queuesState(services);

        let max = -1;
        let averageTime = -1;
        let next = -1;
        let name = '';
        let code = '';
        for(let i of queueState){
            if(i.last - i.current >0 && i.last - i.current >= max) {
                max = i.last - i.current;
                averageTime = i.averageTime;
                next = i.current +1;
                name = i.name;
                code = i.code;
            }
        }
        for(let i of queueState){
            if(i.last - i.current >0 && i.last - i.current == max && i.averageTime < averageTime) {
                averageTime = i.averageTime;
                max = i.last - i.current;
                next = i.current +1;
                name = i.name;
                code = i.code;
            }
        }
        const nextCustomer = max==-1 ? "No one available":(code+next);
        await dao.updateQueue(code);
        res.status(200).json({service: name, nextCustomer: nextCustomer});
    } catch(err) {
        console.log(err);
        res.status(500).json({errors: ["Database error"]});
    }
});

// GET /api/services/
app.get('/api/services', async (req, res) => {
    try {
      const services = await dao.listServices();
      res.json(services);
    } catch(err) {
      console.log(err);
      res.status(500).end();
    }
  });

// GET /api/services/<id>
app.get('/api/services/:id', async (req, res) => {
    try {
      const result = await dao.getService(req.params.id);
      if(result.error)
        res.status(404).json(result);
      else
        res.json(result);
    } catch(err) {
      console.log(err);
      res.status(500).end();
    }
  });


// POST /api/services/<id>
app.post('/api/services/:id', [
    check('id').isInt(),
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({errors: errors.array()});
    }
  
    try {
      const numRowChanges = await dao.incrLast(req.params.id);
      // number of changed rows is sent to client as an indicator of success
      setTimeout(()=>res.json(numRowChanges), answerDelay);
    } catch (err) {
      console.log(err);
      res.status(503).json({ error: `Database error during the increment ${req.params.id}.` });
    }
  
  });

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
app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}/`));