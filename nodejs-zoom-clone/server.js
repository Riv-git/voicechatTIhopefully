const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(server, { debug: true });
const { v4: uuidV4 } = require('uuid');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql');
const session = require('express-session');
const bcrypt = require('bcrypt');

// Set up MySQL connection
const db = mysql.createConnection({
  host: 'localhost', // or your specific host if different
  user: 'someone',
  password: 'shdofcON1236',
  database: 'myflights' // replace with your actual database name if different
});

app.use(session({
  secret: 'your secret key',
  resave: false,
  saveUninitialized: false
}));

function checkAuthenticated(req, res, next) {
  if (req.session.loggedIn) {
    return next();
  }
  // Save the original room URL to redirect after successful login
  req.session.redirectTo = req.originalUrl;
  res.redirect('/login');
}

function checkUserType(req, res, next) {
  const userTypeOfRoom = req.params.room.split('-')[0]; // Assuming room format is userType-roomId
  if (req.session.usertype === userTypeOfRoom) {
    return next();
  } else {
    res.status(403).send('Access denied: You do not have permission to join this room.');
  }
}

// Connect to MySQL
db.connect(err => {
  if (err) throw err;
  console.log('Connected to the MySQL server.');
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.use('/peerjs', peerServer);

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/login', (req, res) => {
  res.render('login'); // Make sure you have a 'login.ejs' file
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  db.query('SELECT * FROM users WHERE username = ?', [username], async (error, results) => {
    if (error) {
      res.status(500).send('Server error occurred!');
      return;
    }
    if (results.length > 0) {
      const comparison = await bcrypt.compare(password, results[0].password);
      if (comparison) {
        req.session.loggedIn = true;
        req.session.username = username;
        req.session.usertype = results[0].usertype;
        // Redirect to the original room URL if it exists
        const redirectTo = req.session.redirectTo ? req.session.redirectTo : '/';
        delete req.session.redirectTo;
        return res.redirect(redirectTo);
      }
    }
    res.status(401).send('Incorrect Username and/or Password!');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});


app.get('/', (req, res) => {
  if (req.session.loggedIn) {
    res.redirect(`/${uuidV4()}`);
  } else {
    // Save the redirectTo session variable to redirect after logging in
    req.session.redirectTo = req.originalUrl;
    res.redirect('/login');
  }
});



app.get('/home',checkAuthenticated, (req, res) => {
  // Render a home page or send a response that 'home' is not a meeting room
  res.send("This is the home page, not a meeting room."); // Or render a view if you have a home.ejs file
});



app.get('/:room', checkAuthenticated, (req, res) => {
  // Check if the room ID is 'home'
  if (req.params.room === 'home') {
    // If it is 'home', render a different page or handle differently
    res.render('home'); // Assuming you have a 'home.ejs' view or handle it as needed
  }
  else if (req.params.room.includes('updateFlightStatus')) {
    // If it is 'home', render a different page or handle differently
    res.render('updateFlightStatus'); // Assuming you have a 'home.ejs' view or handle it as needed
  }
  else if (req.params.room.includes('radar')) {
    // If it is 'home', render a different page or handle differently
    res.render('radar'); // Assuming you have a 'home.ejs' view or handle it as needed
  }
  else if (req.params.room === 'login') {
    // If it is 'home', render a different page or handle differently
    res.render('login'); // Assuming you have a 'home.ejs' view or handle it as needed
  }
  
  else {
    // If it's not 'home', proceed to render the room
    res.render('room', { roomId: req.params.room });
  }
})



// API endpoint to update flight status
app.post('/updateFlightStatus',checkAuthenticated, (req, res) => {
  const { flightCode, status } = req.body;

  const query = 'UPDATE flights SET status = ? WHERE code = ?';

  db.query(query, [status, flightCode], (error, results) => {
    if (error) {
      res.status(500).send({ message: "An error occurred", error: error });
    } else {
      if (results.affectedRows === 0) {
        res.status(404).send({ message: "Flight not found" });
      } else {
        res.status(200).send({ message: "Flight status updated successfully" });
      }
    }
  });
});

// Serve radar.html
app.get('/radar', checkAuthenticated, (req, res) => {
  res.render('radar');;
});

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId)
    socket.to(roomId).broadcast.emit('user-connected', userId);
    // messages
    socket.on('message', (message) => {
      //send message to the same room
      io.to(roomId).emit('createMessage', message)
  }); 

    socket.on('disconnect', () => {
      socket.to(roomId).broadcast.emit('user-disconnected', userId)
    })
  })
})



server.listen(process.env.PORT||3030)
