// VARIABLES
function privMessage (nick)
	{
		$('#myText').val('/msg '+nick+' ').focus();
	}
window.onload = function()
{
	var socket = io();
	
	
	var myNick;// = getRandomNick();
	
	var myChannels = [];
	var myPrivates = [];
	var myWindows = [];
	
	var roomList = new Map();
	
	var currentWindow = '';
	var previousWindow = '';
	
	var scrollOnlyIfAtBottom = false;
	var scorllToBottomTime = 300;
	
	var lastLines = [];
	var maxLines = 5;
	var currentLine = 0;

	var messageDivHeight = $('#messagecontainer').height();
	$('#myText').focus();

	// SOCKET EVENTS
	
	socket.on(
		'newmessage',
		function(room, from, message)
		{
			if (from == myNick)
			{
				addMessage('own', room, myNick+': '+message);
				lastLines.push(message);
				if (lastLines.length > maxLines)
					lastLines.pop();
			}
			else
			{
				addMessage('normal', room, from+': '+message);
				
			}
			//console.log('NEW MESSAGE:', '#'+room, from, message);
		}
	);
	socket.on(
		'connected',
		function(newNick)
		{
			socket.emit('register', newNick);
			//console.log('connected with nick', newNick);
			myNick = newNick;
		}
	);
	socket.on(
		'joinroom',
		function(room, nick)
		{
			//console.log('Joined room:',room);				
			if (nick == myNick)
			{
				myChannels.push(room);
				previousWindow = currentWindow;
				createWindow('channel', room, true);
				addMessage('join', room, 'You joined '+room);
				socket.emit('requestuserlist', room);					
				//updateActiveWindow('#'+room, true);
				//console.log('CURRENT JOINROOM', currentWindow, previousWindow);
			}
			else
			{
				addMessage('join', room, nick+' joined '+room);
				addNickToList(room, nick);
			}
			
		}
	);
	socket.on(
		'joinroomerror',
		function(window, room, error)
		{
			//console.log('FROM WINDOW', window);
			addMessage('part', window, error);
		}
	);
	socket.on(
		'getuserlist',
		function(room, userlist)
		{
			//console.log('userlist', room, userlist);
			roomList[room] = {
				users: []
			};
			userlist.forEach(
				function(nick)
				{
					addNickToList(room, nick);
				}
			);
			//console.log('GOT USERLIST FOR', room, roomList[room].users);
		}
	);
	socket.on(
		'userleft',
		function (room, nick)
		{
			addMessage('part', room, nick+' left '+room);
			var ind = roomList[room].users.indexOf(nick);
			//console.log(roomList[room].users);
			if (ind != -1)
			{
				roomList[room].users.splice(ind, 1);
				removeNickFromList(room, nick);				
			}
			else
			{
				//console.log('USER NOT ON LIST');
			}
		}
	);
	socket.on(
		'userdisconnected',
		function (room, nick)
		{
			//console.log('DC', room);
			addMessage('part', room, nick+' disconnected from the server.');
			var ind = roomList[room].users.indexOf(nick);
			if (ind != -1)
			{
				roomList[room].users.splice(ind, 1);
				removeNickFromList(room, nick);				
			}				
		}
	);
	socket.on(
		'leaveroom', // just to update channellist
		function(room)
		{
			//console.log('CURRENT LEAVE: ', currentWindow, 'PREVIOUS: ', previousWindow);
			console.log('LEAVE', room)
			removeWindowFromList('room', room);
			myChannels.splice(myChannels.indexOf(room),1);
			myWindows.splice(myWindows.indexOf(room),1);
		}
	);
	socket.on(
		'leaveroomerror', // user trying to leave channel he isn't in
		function(window, room, error)
		{
			addMessage('part', window, error);
		}
	);
	socket.on(
		'nickchange',
		function(room, oldnick, newnick)
		{
			
			updatePrivWindow(oldnick, newnick);
			updateNickFromList(room, oldnick, newnick);
			if (oldnick == myNick)
			{
				addMessage('action', room, 'You changed your nick to '+newnick);
			}
			else
			{
				addMessage('action', room, oldnick+' changed his nickname to '+newnick);
			}
			
		}
	);
	socket.on(
		'nickupdate',
		function(newnick)
		{
			myNick = newnick;
		}
	);
	socket.on(
		'nickchangeerror',
		function(window, newnick, error)
		{
			//console.log('NICKCHANGERROR: ', window, newnick, error);
			addMessage('part', window, error);
		}
	);
	socket.on(
		'action',
		function (window, nick, message)
		{
			addMessage('action', window, nick+' '+message);	
		}
	);
	socket.on(
		'privmsgsend',
		function (from, to, message)
		{
			console.log('FROM', from, 'TO', to, 'MESSAGE',message);
			if (myWindows.indexOf(to) == -1)
			{
				createWindow('private', to);
			}				
			addMessage('own', to, from+': '+message);
			
		}
	);
	socket.on(
		'privmsgreceive',
		function (from, to, message)
		{
			console.log('FROM', from, 'TO', to, 'MESSAGE',message);
			if (myWindows.indexOf(from) == -1)
			{
				createWindow('private', from);
			}				
			addMessage('normal', from, from+': '+message);
			scrollBottom(from);
		}
	);
	socket.on(
		'privmsgerror',
		function (window, nick, message)
		{
			addMessage('part', window, message);		
		}
	);
	// JQUERY EVENTS
	$('#usercontainer').on( // CLICK ON A NICKNAME ON THE USERLIST
		'click',
		'ul li',	
		function()
		{
			var nick = $(this).text().trim();
			privMessage(nick);
		}
	);
	$('#messagecontainer').on( // CLICK ON A NICKNAME ON THE MESSAGELIST
		'click',
		'a',
		function()
		{
			var nick = $(this).text();
			nick = nick.substr(0, nick.length - 1);
			privMessage(nick);
		}
	);
	$('#channellist').on( // CLICK ON A ROOM ON THE ROOMLIST
		'click',
		'li',
		function()
		{
			var room = $(this).text().trim();
			console.log('CURRENT CLICK', room, previousWindow);
			previousWindow = currentWindow;
			updateActiveWindow(room);
		}
	);
	$('#privlist').on( // CLICK O A PRIVMSG ON THE PRIVLIST
		'click',
		'li',
		function()
		{
			var priv = $(this).text();			
			previousWindow = currentWindow;
			updateActiveWindow(priv);
		}
	)
	$('#sendbutton').on(
		'click',
		function()
		{
			sendInput();
		}		
	);
	$('#myText').on( // KEY EVENTS
		'keydown',
		function(e)
		{
			if (e.which == 13 || e.keyCode == 13) // enter
			{			
				sendInput(currentWindow);			
			}
			if (e.which == 38 || e.keyCode == 38) // up arrow
			{
				if (lastLines.length > 0)
				{
					currentLine--;
					if (currentLine < 0)
					{			
						$('#myText').val('');
						currentLine = lastLines.length;
					}	
					else
					{
						$('#myText').val(lastLines[currentLine]);
					}			
				}
				else
				{
					clearInput();
				}
			}
			if (e.which == 40 || e.keyCode == 40) // down arrow
			{
				if (lastLines.length > 0)
				{
					currentLine++;
					if (currentLine > lastLines.length -1)
					{
						$('#myText').val('');
						currentLine = -1;
					}
					else
					{
						$('#myText').val(lastLines[currentLine]);
					}
				}
				else
				{
					clearInput();
				}
			}
		}
		
	);
	// MESSAGE FUNCTIONS
	function privMessage (nick)
	{
		$('#myText').val('/msg '+nick+' ').focus();
	}
	
	function addMessage(oftype, window, text) // ADDS A MESSAGE OF TYPE X TO THE SPECIFIED WINDOW
	{
		updateWindowColor(window);
		text = text.replace(/(<([^>]+)>)/ig,"");
		var nick = text.split(' ')[0];
		
		text = text.substr(nick.length +1);
		var newNick = '<a href="#">'+nick+'</a>';
		var newText = $.emoticons.replace(text);
		var room = window;
		if (window[0] == '#')
		{
			window = '#messages'+window.substr(1);
		}
		else
		{
			window = '#priv'+window;
		}
		
		switch (oftype)
		{
			case 'own':
				$(window).append($('<li class="list-group-item list-group-item-info">').html(getTime()+' '+newNick+' '+newText));
			 	break;
			case 'join':
				$(window).append($('<li class="list-group-item list-group-item-success">').text(getTime()+' '+nick+' '+text));
				break;
			case 'part': 
				$(window).append($('<li class="list-group-item list-group-item-danger">').text(getTime()+' '+nick+' '+newText));
				break;
			case 'action':
				$(window).append($('<li class="list-group-item list-group-item-warning">').text(getTime()+' '+nick+' '+text));
				break;
			case 'normal':
				$(window).append($('<li class="list-group-item">').html(getTime()+' '+newNick+' '+newText));
				break;
			case 'priv':
				$(window).append($('<li class="list-group-item list-group-item-priv">').html(getTime()+' '+newNick+' '+newText));
				break;
			default:
				//console.log('addMessage unknown type');
				break;
		
		}
		scrollBottom(room);
	}
	
	

	
	
	function getTime()
	{
		var date = new Date();
		var time = '';
		var hour = date.getHours(), hours = '';

		hours = (hour < 10) ? '0'+hour : hour.toString();
		var minute = date.getMinutes(), minutes = '';
		minutes = (minute < 10) ? '0'+minute : minute.toString();
		time = hours+':'+minutes;
		return time;
	}
	
	
	function updateLastLines(text)
	{
		lastLines.push(text);
	    currentLine = lastLines.length;
	    if (lastLines.length > maxLines)
 	 		lastLines.pop;
	}
	
	function sendInput()
	{
		var input = $('#myText').val();
		if (input != '')
		{
			//console.log('SEND WINDOW', currentWindow);
			var inputAr = input.split(' ');
			switch (inputAr[0]) // these are client-side commands
			{
				case '/close': // close current window
				{
					closeWindow(currentWindow);
					break;
				}
				default:
				{
					socket.emit('sendinput', currentWindow, input);
					break;
				}
			}
			clearInput();
		}
	}
	function clearInput()
	{
		$('#myText').val('');
	}
	
	// NICKLIST FUNCTIONS
	
	function removeNickFromList(room, nick)
	{
		//console.log('REMOVENICKFROMLIST: ', room, nick);
		$('#userlist'+room.substr(1)+' li').each(
			function(index)
			{
				
				var text = $(this).text();
				if (text == nick)
				{
					$(this).remove();
				}
				
			}
		);
	}
	function addNickToList(room, nick)
	{
		//console.log('nick', room);
		if (roomList[room].users.indexOf(nick) == -1)
		{
			//console.log('ADDNICKTOLIST', room, nick);
			roomList[room].users.push(nick);
			room = room.substr(1);
			if (myNick == nick)
				$('#userlist'+room).append($('<li class="list-group-item list-group-item-info">').text(nick));
			else
				$('#userlist'+room).append($('<li href="#" class="list-group-item">').text(nick));
		}
	}
	function updateNickFromList(room, oldnick, newnick)
	{
		$('#userlist'+room.substr(1)+' li').each(
			function(index)
			{
				var text = $(this).text();
				if (text == oldnick)
				{
					$(this).text(newnick);
				}
				
			}
		);
	}
	function fillNickList(room, userList)
	{
		userList.forEach(
			function(entry)
			{
				addNickToList(entry);
			}
		);
	}
	function updatePrivWindow(oldnick, newnick)
	{
		if ($('#priv'))
		$('#privlist li').each(
			function (index)
			{
				var text = $(this).text();
				if (text == oldnick)
				{
					currentWindow = newnick;
					var oldid = '#priv'+oldnick;
					var newid = 'priv'+newnick;
					//console.log('updating', oldnick, oldid, newid);
					myWindows.splice(myWindows.indexOf(oldnick), 1);
					myWindows.push(newnick);
					$(this).text(newnick);
					if ($(oldid).length > 0)
					{
						console.log('window exists');
					}
					$(oldid).attr('id', 'priv'+newnick);

					
					console.log('ID',$('#'+newid).attr('id'));
					
				}
			}
		);
	}
	function updateWindowColor(window) // update the color so the users know there's a new message
	{
		//console.log('WINDOW:', window, currentWindow);
		
		if (window[0] == '#') // if it's a room, we check which
		{
			$('#channellist li').each(
				function()
				{
					var entry = $(this).text();
					if (entry == window && entry != currentWindow)
					{
						$(this).addClass('list-group-item-warning');
					}
				}
			);
		}
		else // otherwise its a private message
		{
			$('#privlist li').each(
				function()
				{
					var entry = $(this).text();
					if (entry == window && entry != currentWindow)
					{
						$(this).addClass('list-group-item-warning');
					}
				}
			);
		}
		
	}
	// WINDOW FUNCTIONS
	
	function scrollBottom(window) // scroll automatically to the bottom
	{
		console.log(window);
		if (window[0] == '#') // channel
		{
			window = window.substr(1);
			var height = $('#messages'+window).height();
			var scrollTop =  $('#messagecontainer').scrollTop();
			if (height - scrollTop >= messageDivHeight && !scrollOnlyIfAtBottom)
			{
				$('#messagecontainer').animate(
					{ scrollTop: $('#messages'+window)[0].scrollHeight },
					scorllToBottomTime
				);
			}		
		}
		else
		{
			var height = $('#priv'+window).height();
			var scrollTop =  $('#messagecontainer').scrollTop();
			if (height - scrollTop >= messageDivHeight && !scrollOnlyIfAtBottom)
			{
				$('#messagecontainer').animate(
					{ scrollTop: $('#priv'+window)[0].scrollHeight },
					scorllToBottomTime
				);
			}		
		}
	}
	function createWindow(oftype, name, update) // create a new "window" (div) for the room (both message div and userlist div). or just a message div for the private message
	{
		
		switch (oftype)
		{
			case 'channel':
			{
				if (myWindows.indexOf(name) == -1) // channel doesn't exist yet (or shouldn't)
				{
					myWindows.push(name);
					if (currentWindow == undefined || currentWindow == '')
						currentWindow = previousWindow = '#'+name;
					var id = 'messages'+name.substr(1);
					//console.log(id);
					// e.g messageslobby
					$('#messagecontainer').append('<ul id="'+id+'" class="list-group">');						
					var userlistid = 'userlist'+name.substr(1);
					// eg userlistlobby
					$('#usercontainer').append('<ul id="'+userlistid+'" class="list-group" style="cursor:pointer">');

					addWindowToList('room', name);
					if (update)
						updateActiveWindow(name, true);	
							
				}
				break;
			}
			
			case 'private':
			{
				if (myPrivates.indexOf(name) == -1) // private window doesn't exist
				{
					myPrivates.push(name);
					var id = 'priv'+name;
					//console.log('created private message window ', id);
					addWindowToList('priv', name);
					$('#messagecontainer').append('<ul id="'+id+'" class="list-group" style="cursor:pointer">');	
					if (update)					
						updateActiveWindow(id, true);	
					if (update == undefined || update == false)
					{
						//console.log('hiding windows');
						$('#'+userlistid).hide();
						$('#'+id).hide();
					}				
				}
				else // window exists
				{
					
				}
				break;
			}
			default:
				break;
		}
	}
	function closeWindow(window)
	{
		console.log('closewindow', window);
		if (window[0] == '#') // doesn't do anything yet
		{
			
		}
		else // closing nickname
		{
			var ind = myPrivates.indexOf(window);
			if (ind != -1)
			{
				console.log('removed');
				var id = 'priv'+window;
				$('#'+id).remove();
				
				removeWindowFromList('priv', window);
			}
		}
	}
	function addWindowToList(oftype, name)
	{
		switch (oftype)
		{
			case 'room':
				$('#channellist').append($('<li class="list-group-item list-group-item-info">').text(name));
				break;
			case 'priv':
				$('#privlist').append($('<li class="list-group-item">').text(name));
				break;
		}
		
	}
	function removeWindowFromList(oftype, name)
	{			
		switch (oftype)
		{
			case 'room':
				if (name[0] == '#')
					name = name.substr(1);
				$('#messages'+name).remove();
				$('#userlist'+name).remove();
				$('#channellist li').each(
					function(index)
					{
						var text = $(this).text();
						if (text == '#'+name)
						{
							$(this).remove();
							myWindows.splice(myWindows.indexOf(text), 1);								
							updateActiveWindow(previousWindow);
						}
					}
				);
				break;
			case 'priv':
				$('#priv'+name).remove();
				$('#privlist li').each(
					function(index)
					{
						var text = $(this).text();
						if (text == name)
						{
							$(this).remove();
							myPrivates.splice(myPrivates.indexOf(text), 1);								
							updateActiveWindow(previousWindow);
						}
					}
				);
				break;
		}
		
	}
	function updateActiveWindow(newWindow, bool) // updates the color of the window we have clicked (light blue)
	{
		$('#currentWindow').text(newWindow);
		if (newWindow != currentWindow || bool == true)
		{
			hideWindow(currentWindow);
			showWindow(newWindow);
			if (currentWindow[0] == '#') // channels
			{
				$('#channellist li').each(
					function(index)
					{
						$('#privlist li').each( // removes any active window in the private message list
							function(index)
							{
								if ($(this).hasClass('list-group-item-info') == true)
								{
									$(this).removeClass('list-group-item-info');
									
								}
								$(this).html($(this).text());
							}
						);
						var text = $(this).text();
						if (newWindow != text)
						{
							if ($(this).hasClass('list-group-item-info') == true)
							{
								//console.log('REMOVING ACTIVE CLASS FROM CHANNEL');
								$(this).removeClass('list-group-item-info');
								
							}
							$(this).html(text);
						}
						if (newWindow == text)
						{
							if ($(this).hasClass('list-group-item-warning') == true)
								$(this).removeClass('list-group-item-warning');
							$(this).addClass('list-group-item-info');
							$(this).html('<strong>'+text+'</strong>');
							
						}
						scrollBottom(newWindow);
					}						
				);
			}
			else // nick
			{
				$('#privlist li').each(
					function(index)
					{							
						var text = $(this).text();
						$('#channellist li').each( // removes any active channel window in the channel list
							function(index)
							{
								if ($(this).hasClass('list-group-item-info') == true)
								{
									$(this).removeClass('list-group-item-info');
									$(this).html($(this).text());
								}
							}
						);
						if (newWindow != text)
						{
							if ($('#priv'+newWindow).hasClass('list-group-item-info') == true)
							{
								console.log('REMOVING ACTIVE CLASS FROM PRIV');
								$('#priv'+newWindow).removeClass('list-group-item-info');
								$(this).html($(this).text());
							}
						}
						else
						{
							if ($(this).hasClass('list-group-item-warning') == true)
								$(this).removeClass('list-group-item-warning');
							$(this).addClass('list-group-item-info');	
							$(this).html('<strong>'+text+'</strong>');						
						}
						scrollBottom(newWindow);
					}
				);			
			}
		}			
	}
	function hideWindow(window)
	{
		var userlist;
		if (window[0] == '#') // window is a room
		{
			window = window.substr(1);
			userlist = '#userlist'+window;
			window = '#messages'+window;	
						
		}
		else
		{
			window = '#priv'+window;
		}
		//console.log('HIDING', window);
		$(window).hide();
		if (userlist != undefined)
		{
			$(userlist).hide();
		}

	}
	function showWindow(window)
	{
		var userlist;
		previousWindow = currentWindow;
		currentWindow = window;
		//console.log('CURRENT SHOW', currentWindow, previousWindow);
		if (window[0] == '#') // window is a room
		{
			window = window.substr(1);
			userlist = '#userlist'+window;
			window = '#messages'+window;
								
		}
		else
		{
			window = '#priv'+window;
		}
		//console.log('SHOWING', window);
		
		$(window).show();
		if (userlist != undefined)
		{
			$(userlist).show();
		}
	}
	
	/* EMOTICONS */
	var definition = {
		smile:{title:"Smile",codes:[":)",":=)",":-)"]},
		"sad-smile":{title:"Sad Smile",codes:[":(",":=(",":-("]},
		"big-smile":{title:"Big Smile",codes:[":D",":=D",":-D",":d",":=d",":-d"]},
		cool:{title:"Cool",codes:["8)","8=)","8-)","B)","B=)","B-)","(cool)"]},
		wink:{title:"Wink",codes:[";)",";-)",";=)",":O",":=O",":-O"]},
		crying:{title:"Crying",codes:[";(",";-(",";=("]},
		sweating:{title:"Sweating",codes:["(sweat)","(:|"]},
		speechless:{title:"Speechless",codes:[":|",":=|",":-|"]},
		kiss:{title:"Kiss",codes:[":*",":=*",":-*"]},
		"tongue-out":{title:"Tongue Out",codes:[":P",":=P",":-P",":p",":=p",":-p"]},
		blush:{title:"Blush",codes:["(blush)",":$",":-$",":=$",':">']},
		wondering:{title:"Wondering",codes:[":^)"]},sleepy:{title:"Sleepy",codes:["|-)","I-)","I=)","(snooze)"]},
		dull:{title:"Dull",codes:["|(","|-(","|=("]},"in-love":{title:"In love",codes:["(inlove)"]},
		"evil-grin":{title:"Evil grin",codes:["]:)",">:)","(grin)"]},
		talking:{title:"Talking",codes:["(talk)"]},
		yawn:{title:"Yawn",codes:["(yawn)","|-()"]},
		puke:{title:"Puke",codes:["(puke)",":&",":-&",":=&"]},
		"doh!":{title:"Doh!",codes:["(doh)"]},
		angry:{title:"Angry",codes:[":@",":-@",":=@","x(","x-(","x=(","X(","X-(","X=("]},
		"it-wasnt-me":{title:"It wasn't me",codes:["(wasntme)"]},
		party:{title:"Party!!!",codes:["(party)"]},
		worried:{title:"Worried",codes:[":S",":-S",":=S",":s",":-s",":=s"]},
		mmm:{title:"Mmm...",codes:["(mm)"]},
		nerd:{title:"Nerd",codes:["8-|","B-|","8|","B|","8=|","B=|","(nerd)"]},
		"lips-sealed":{title:"Lips Sealed",codes:[":x",":-x",":X",":-X",":#",":-#",":=x",":=X",":=#"]},
		hi:{title:"Hi",codes:["(hi)"]},
		call:{title:"Call",codes:["(call)"]},
		devil:{title:"Devil",codes:["(devil)"]},
		angel:{title:"Angel",codes:["(angel)"]},
		envy:{title:"Envy",codes:["(envy)"]},
		wait:{title:"Wait",codes:["(wait)"]},
		bear:{title:"Bear",codes:["(bear)","(hug)"]},"make-up":{title:"Make-up",codes:["(makeup)","(kate)"]},
		"covered-laugh":{title:"Covered Laugh",codes:["(giggle)","(chuckle)"]},
		"clapping-hands":{title:"Clapping Hands",codes:["(clap)"]},
		thinking:{title:"Thinking",codes:["(think)",":?",":-?",":=?"]},
		bow:{title:"Bow",codes:["(bow)"]},
		rofl:{title:"Rolling on the floor laughing",codes:["(rofl)"]},
		whew:{title:"Whew",codes:["(whew)"]},
		happy:{title:"Happy",codes:["(happy)"]},smirking:{title:"Smirking",codes:["(smirk)"]},
		nodding:{title:"Nodding",codes:["(nod)"]},
		shaking:{title:"Shaking",codes:["(shake)"]},
		punch:{title:"Punch",codes:["(punch)"]},
		emo:{title:"Emo",codes:["(emo)"]},
		yes:{title:"Yes",codes:["(y)","(Y)","(ok)"]},
		no:{title:"No",codes:["(n)","(N)"]},
		handshake:{title:"Shaking Hands",codes:["(handshake)"]},
		skype:{title:"Skype",codes:["(skype)","(ss)"]},
		heart:{title:"Heart",codes:["(h)","<3","(H)","(l)","(L)"]},
		"broken-heart":{title:"Broken heart",codes:["(u)","(U)"]},
		mail:{title:"Mail",codes:["(e)","(m)"]},
		flower:{title:"Flower",codes:["(f)","(F)"]},
		rain:{title:"Rain",codes:["(rain)","(london)","(st)"]},
		sun:{title:"Sun",codes:["(sun)"]},
		time:{title:"Time",codes:["(o)","(O)","(time)"]},
		music:{title:"Music",codes:["(music)"]},
		movie:{title:"Movie",codes:["(~)","(film)","(movie)"]},
		phone:{title:"Phone",codes:["(mp)","(ph)"]},
		coffee:{title:"Coffee",codes:["(coffee)"]},pizza:{title:"Pizza",codes:["(pizza)","(pi)"]},
		cash:{title:"Cash",codes:["(cash)","(mo)","($)"]},
		muscle:{title:"Muscle",codes:["(muscle)","(flex)"]},
		cake:{title:"Cake",codes:["(^)","(cake)"]},
		beer:{title:"Beer",codes:["(beer)"]},
		drink:{title:"Drink",codes:["(d)","(D)"]},
		dance:{title:"Dance",codes:["(dance)","\\o/","\\:D/","\\:d/"]},
		ninja:{title:"Ninja",codes:["(ninja)"]},star:{title:"Star",codes:["(*)"]},
		mooning:{title:"Mooning",codes:["(mooning)"]},
		finger:{title:"Finger",codes:["(finger)"]},
		bandit:{title:"Bandit",codes:["(bandit)"]},
		drunk:{title:"Drunk",codes:["(drunk)"]},
		smoking:{title:"Smoking",codes:["(smoking)","(smoke)","(ci)"]},
		toivo:{title:"Toivo",codes:["(toivo)"]},rock:{title:"Rock",codes:["(rock)"]},
		headbang:{title:"Headbang",codes:["(headbang)","(banghead)"]},
		bug:{title:"Bug",codes:["(bug)"]},
		fubar:{title:"Fubar",codes:["(fubar)"]},
		poolparty:{title:"Poolparty",codes:["(poolparty)"]},
		swearing:{title:"Swearing",codes:["(swear)"]},
		tmi:{title:"TMI",codes:["(tmi)"]},
		heidy:{title:"Heidy",codes:["(heidy)"]},
		myspace:{title:"MySpace",codes:["(MySpace)"]},
		malthe:{title:"Malthe",codes:["(malthe)"]},
		tauri:{title:"Tauri",codes:["(tauri)"]},
		priidu:{title:"Priidu",codes:["(priidu)"]}};

	$.emoticons.define(definition);
}