var express = require('express'),
  session = require('express-session'),
  passport = require('passport'),
  SpotifyStrategy = require('passport-spotify').Strategy,
  consolidate = require('consolidate');
require('dotenv').config();
var request = require('request');
var mysql = require('mysql');

// Connect to local database
var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "groupify"
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});

var port = 8888;
var authCallbackPath = '/auth/spotify/callback';



// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session. Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing. However, since this example does not
//   have a database of user records, the complete spotify profile is serialized
//   and deserialized.

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

// Use the SpotifyStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, expires_in
//   and spotify profile), and invoke a callback with a user object.

//Stores necessary information in database
passport.use(
  new SpotifyStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: 'http://localhost:' + port + authCallbackPath,
    },
    function (accessToken, refreshToken, expires_in, profile, done) {
      // asynchronous verification, for effect...
      process.nextTick(function () {
        console.log('Profile: ', profile)
        var options = {
          url: 'https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=10',
          headers: {
            'Authorization': 'Bearer ' + accessToken
          },
          json: true
        };
        request.get(options, function(error, response, body) {
          console.log(body);
          let listening_data = body;
            var genres_array = [];
            var i;
            for (i = 0; i < listening_data.items.length; i++) {
              listening_data.items[i].genres.forEach(a => genres_array.push(a));
            }      

            var j;
            var pop_genre=0;
            var rock_genre=0;
            var house_genre=0;
            var edm_genre=0;
            var rap_genre=0;

            for (j = 0; j < genres_array.length; j++) {
                if (genres_array[j].includes('pop')) {
                    pop_genre+=1;
                }
                if (genres_array[j].includes('rock')) {
                    rock_genre+=1;
                }
                if (genres_array[j].includes('house')) {
                    house_genre+=1;
                }
                if (genres_array[j].includes('edm')) {
                    edm_genre+=1;
                }
                if (genres_array[j].includes('rap')) {
                    rap_genre+=1;
                }
            }  
            var obj = {
              pop: pop_genre, rock: rock_genre, house: house_genre, edm:edm_genre, rap:rap_genre
          };
            function findMax(obj) {
              var keys = Object.keys(obj);
              var max = keys[0];
              for (var i = 1, n = keys.length; i < n; ++i) {
                 var k = keys[i];
                 if (obj[k] > obj[max]) {
                    max = k;
                 }
              }
              return max;
          }
          
          var top_genre = findMax(obj)
        con.query("REPLACE INTO user (user_id, username, email, accessToken, refreshToken, top_genre) VALUES ('"+profile.id+"', '"+profile.displayName+"', '"+profile.emails[0].value+"', '"+accessToken+"', '"+refreshToken+"', '"+top_genre+"')", function (err, result) {
            if (err) throw err;
            console.log("1 record inserted");
        });

        return done(null, profile);
      });
    });
    }
  )
);

var app = express();
// configure Express
app.set('views', __dirname + '/views');
app.set('view engine', 'html');

app.use(
  session({secret: 'keyboard cat', resave: true, saveUninitialized: true})
);
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(__dirname + '/public'));

app.engine('html', consolidate.nunjucks);

app.get('/', function (req, res) {
  res.render('index.html', {user: req.user});
});

app.get('/group', ensureAuthenticated, function (req, res) {
  res.render('group.html', {user: req.user, top_pick: con.query("SELECT top_genre FROM user WHERE username='"+req.user.username+"'", function (err, result) {
    if (err){throw err;}
    return result})});
    console.log(top_pick)
});

// GET /auth/spotify
//   Use passport.authenticate() as route middleware to authenticate the
//   request. The first step in spotify authentication will involve redirecting
//   the user to spotify.com. After authorization, spotify will redirect the user
//   back to this application at /auth/spotify/callback
app.get(
  '/auth/spotify',
  passport.authenticate('spotify', {
    scope: ['user-read-email', 'user-read-private','user-top-read'],
    showDialog: true,
  })
);

// GET /auth/spotify/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request. If authentication fails, the user will be redirected back to the
//   login page. Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get(
  authCallbackPath,
  passport.authenticate('spotify', {failureRedirect: '/'}),
  function (req, res) {
    res.redirect('/');
  }
);

app.get('/logout', function (req, res) {
  req.logout();
  res.redirect('/');
});

app.listen(port, function () {
  console.log('App is listening on port ' + port);
});

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed. Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}