const app = require('./src/app');
const connectDB = require('./src/config/db');
const http = require('http');
const { Server } = require('socket.io');

require("dotenv").config();
connectDB();

const server = http.createServer(app);

//Socket Setup
const io = new Server(server, {
  cors : {
    origin : '*',
  },
});

//store globally
global.io = io;

io.on('connection', (socket)=>{
  console.log('user connected : ',socket.id);
  socket.io('disconnected', (socket) =>{
    console.log('user disconnected : ', socket.id);
  });
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});