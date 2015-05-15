#!/usr/bin/env node

/**
 * Module dependencies.
 */
var app = require('../app')
//var app = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

var userList = [];
var channelList = [];

// maps
var channelMap = new Map();
var userMap = new Map();
var userChannels = new Map();

// EVENTS
io.on(
   'connection',
   function(client)
   {

      var clientid = client.id;
      
      console.log('SERVER ->', clientid, 'connected to the server. Waiting for registering. ');
      var clientNick = getRandomNick();
      client.emit('connected', clientNick);
      userMap[clientid] = {
               nick: clientNick,
               rooms: [],
               registered: false,
               socket: client
            };
      // CONNECTION
      client.on(
         'register',
         function(nick)
         {
            userMap[clientid].registered = true;
            userList.push(nick);
            JoinRoom('lobby');
            console.log('SERVER ->', nick, '['+clientid+'] registered to the server.');
         }
      );
      client.on(
         'disconnect',
         function()
         {
            userMap[clientid].rooms.forEach(
              function(room)
              {
                 io.to(room).emit('userdisconnected', '#'+room, userMap[clientid].nick);
              }
            );
            
            console.log('SERVER ->', userMap[clientid].nick, ' disconnected from the server.');
            removeUserFromMap(clientid);
         }
      );
      // MESSAGES
      
      client.on(
         'chatmessage',
         function(to, message)
         {  
            if (userMap[clientid].registered)
            {       
               io.to(to).emit('newmessage', userMap[clientid].nick, to, message);
               console.log('SERVER ->'+to, userMap[clientid].nick, ':', message);
            }
         }
      );
      client.on(
         'sendinput',
         function(window, input)
         {
            evaluateInput(window, input);
         }
      );
      client.on(
         'privmessage',
         function(to, message)
         {
            var id = getIdByNick(to);
            if (id)
            {
               io.sockets.connected[id].emit('privmessage', userMap[clientid], message);
               // for testing purposes. private messages shouldn't be logged
               //console.log('SERVER -> PRIVMSG ', userMap[clientid], 'to ', to, ':', message); 
            }
         }
      );
      client.on(
         'error',
         function (err)
         {
            console.log('SERVER ERROR ->', err);
         }
      );
      
      // ROOMS
      client.on(
         'joinroom',
         function(room)
         {
            JoinRoom(room);
         }
      );  
      client.on(
         'requestuserlist',
         function(room)
         {
            var userlist = [];
            console.log('SERVER ->', clientNick, 'is requesting the userlist for', room);
            for (var id in io.sockets.adapter.rooms[room.substr(1)])
            {
               userlist.push(userMap[id].nick);
            }
            client.emit('getuserlist', room, userlist);
            console.log('SERVER -> Sending', room, 'userlist to', clientNick);
         }
      );
      // ROOM FUNCTIONS
      function JoinRoom(room) // client joins room
      {        
         var ind = client.rooms.indexOf(room);
         if (ind == -1) // not on channel
         {
           
            client.join(room,function()
            {
               console.log('SERVER ->',userMap[clientid].nick, 'joined room', '#'+room);
               userMap[clientid].rooms.push(room);
               io.to(room).emit('joinroom', '#'+room, clientNick);               
            });
         }
         else
         {
            console.log(userMap[clientid].nick, 'already is on', '#'+room);
         }        
      }
      function LeaveRoom(room) // client leaves room
      {
         console.log('trying to leave', room);
         var ind = client.rooms.indexOf(room);
         if (ind != -1) // on channel
         {
            client.leave(room,function()
            {  
               ind = userMap[clientid].rooms.indexOf(room);
               userMap[clientid].rooms.splice(ind,1);             
               console.log('SERVER ->',userMap[clientid].nick, 'left room', room);
               io.to(room).emit('userleft', '#'+room, userMap[clientid].nick);
               client.emit('leaveroom', '#'+room); // user left the channel so he doesn't get the previous .emit()
            });
         }
         else
         {
            
         }    
      }
    
      // INPUT FUNCTIONS
      function evaluateInput(window, input)
      {
         var inputAr = input.split(' ');
         var firstAr = inputAr[0];
         var firstChar = firstAr[0];
         if (firstChar == '/') // command
         {
            
            switch (firstAr) // different available commands
            {
               case '/msg': //privmsg
                  if (inputAr.length >= 3)
                  {
                     var nick = inputAr[1];
                     if (nick != clientNick)
                     {
                         var message = input.substr(6 + inputAr[1].length);
                         var id = getIdByNick(nick);
                         if (id)
                         {
                             PrivMessage(clientNick, id, message);
                         }
                         else
                         {
                             client.emit('privmsgerror', window, nick, "User "+nick+" doesn't exist.");
                         }
                     }
                     else
                     {
                         client.emit('privmsgerror', window, nick, "You can't send private messages to yourself.");
                     }
                  }
                  else
                  {
                     client.emit('privmsgerror', window, 'Correct format: /msg <nick> <message>');
                  }
                  break;
               case '/me': //action
                  if (inputAr.length > 2)
                  {
                      io.to(window.substr(1)).emit('action', window, clientNick, input.substr(4));
                  }
                  break;
               case '/join':
               {
                  var room = inputAr[1];
                  if (room[0] == '#')
                  {
                     JoinRoom(room.substr(1));
                  }
                  else
                  {
                     client.emit('joinroomerror', window, '#'+room, 'Channel name must begin with # ('+room+')');
                  }
                  break;
               }
               case '/leave':
               {
                  var room;
                  if (!inputAr[1])
                     room = window;
                  else
                     room = inputAr[1];
                  if (room[0] == '#')
                  {
                     if (client.rooms.indexOf(room.substr(1)) == -1)
                     {
                        client.emit('leaveroomerror', window, '#'+room, 'You are not in room '+room);
                        return;
                     }
                     LeaveRoom(room.substr(1));
                  }
                  else
                  {
                     client.emit('leaveroomerror', window, '#'+room, 'Channel name must begin with # ('+room+')');
                  }
                  break;
               }
               case '/nick': // nick change
                  ChangeNick(window, inputAr[1]);
                  break;
               default:
                  break;
            }
         }
         else //normal message
         {
             if (window[0] == '#')
             {
                 var room = window.substr(1);
                 if (client.rooms.indexOf(room) != -1) // client is in channel
                 {
                    room = room;
                    io.to(room).emit('newmessage', '#'+room, clientNick, input);
                    console.log('SERVER ->', '#'+room, clientNick, ':', input);
                 }
                 else   // client is not in channel         
                 {
                    client.emit('notonchannel', '#'+room);
                 }
             }
             else
             {
                 var id = getIdByNick(window);
                 if (id)
                 {
                     PrivMessage(clientNick, getIdByNick(window), input);     
                 }
                 else
                 {
                     // in this case, WINDOW is both the window name and the nickname of the user the private message was sent to
                     client.emit('privmsgerror', window, window, window+' is not connected to the server.');
                 }            
             }        
         }
      }
      
      function getRandomNick()
		{
			var nick = 'User';
			var num = Math.random() * 1000;
			num = Math.floor(num);
			nick = nick + num.toString();
			return nick;			
		}
      function ChangeNick(window, newnick)
      {
         if (userList.indexOf(newnick) == -1) // nick doesn't exist
         {
            var oldnick = clientNick;
            var ind = userList.indexOf(oldnick);
            userList.splice(ind, 1);
            userList.push(newnick);
            clientNick = userMap[clientid].nick = newnick;
            userMap[clientid].rooms.forEach(
               function(room)
               {
                  io.to(room).emit('nickchange', '#'+room, oldnick, newnick);
                  client.emit('nickupdate', newnick);
               }
            );
         }
         else // nick exists
         {
            client.emit('nickchangeerror', window, newnick, 'Nickname is already taken.');
         }
      }    
      function PrivMessage(from, id, message) // send private message
      {
         if (userMap[id] != undefined)
         {
            var to = userMap[id].nick;
            client.emit('privmsgsend', from, to, message);
            userMap[id].socket.emit('privmsgreceive', from, to, message);
         }         
      }
   }
);
// FUNCTIONS

function removeUserFromMap(id)
{
   if (userMap[id])
   {
      var nick = userMap[id];
      delete userMap[id];
      userList.splice(nick, 1);
   }
}
function getIdByNick(nick)
{
   for (var id in userMap)
   {
      if (userMap[id].nick == nick)
         return id;
   }
   return null;
}

http.listen(
   port,
   function()
   {
      console.log('SERVER -> Started listening on port:', port);
   }
);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}
