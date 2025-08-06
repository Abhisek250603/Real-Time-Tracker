const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
const server = http.createServer(app);
const io = socketio(server);

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/track/:id', (req, res) => {
  const trackId = req.params.id;
  const username = req.query.name || null;
  res.render('index', { trackId, username });
});

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('send-location', (data) => {
    io.emit('receive-location', { id: socket.id, username: data.username || null, ...data });
  });

  socket.on('disconnect', () => {
    io.emit('user-disconnected', socket.id);
    console.log(`Disconnected: ${socket.id}`);
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
