# MultiUserChat

This chat was created as a little project for university.

It's a [NodeJS](https://nodejs.org/)/[ExpressJS](http://expressjs.com/) app that uses [socket.io](http://socket.io/) for socket connections. Therefore it has support for rooms.

[Bootstrap](http://getbootstrap.com/) is used as a HTML5/js framework.

## Installation

Once downloaded, open a terminal in the root folder and type <code>npm install</code>, this will install all the dependencies specified in the package.json file.
After installing all the necessary packages, you can start it by typing <code>npm start</code>. 
If you're starting the app on your own machine, access it by going to <code>localhost:3000</code>

## But how does it work? 

###Interface and more

The interface is really easy to understand.

On the left side, there are two lists, one of them not visibile from the start. One of them is the room list, where all the rooms you're connected to will be listed.
The other one is the private message list. If you opened a private message with anyone (or if they did), it will show just below the room list.

In the center is where all the messages will show. If you're active window is a room, all the messages to that room will show there. If it's a private message, your conversation with that person will show instead.

On the right side is the userlist. It will only show if your active window is a room. You can click users on that list to engage in a private conversation.

### Events

If you're in a room, there are several different events that can happen: 
+ A user joins the room
+ A user leaves the room
+ A user disconnects
+ A user changes his nickname
+ A user sends a message

Each of those events are clearly differentiated by colors. Also, when an event occurs, it highlights the window where it happened, so that if you have several open rooms (or private messages), you know that something happened elsewhere.

### What else?
The chat also supports [emoticons](https://github.com/kof/emoticons). You can check [this website](http://factoryjoe.com/projects/emoticons/) for an extensive list.

There are several commands a user needs to know:
+ /join (#room)     - The # is necessary.
+ /leave [#room]    - Room is optional. If none provided, it will leave the current room.
+ /close            - Closes a private message window. The other user can still message you, though.
+ /nick <newNick>   - Changes your nick into something else.
+ /me <action>      - Just for playing. e.g /me is happy would show <code>\<user\> is happy</code>

There is also a help window that you can open by clicking on the Help button on the lower left, which basically explains the same as this readme.


## License

[MIT](http://opensource.org/licenses/MIT)
