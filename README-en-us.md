# Interactive phone game using Twilio Programmable Voice API

This game game was developed to make use of Text Speech technologies connected to Twilio's streaming media service and receiving data through a phone call.

The game is configured from the game.js file that has the phases and respective keywords. The person participating in the game can call a Twilio number that has its webhook set to the root of that application and will have music on hold until the game controller starts the game.

Once the game starts, new players will not be accepted and they will hear a message stating that the game has started.

Use the /level url to start, stop and skip a level. When doing this control, participants will hear the audio instructions on their phones.



## Do you want to run this application?

Before starting the program you need to perform some procedures:
* Create a Twilio account
* Create a Google Cloud account
* Enable Google Speech to Text API in Google Cloud console
* Create the access credential (service account) from Google and save the json file in the folder
* Fill variables from `.env.sample` file
* Change the filename from `.env.sample` to `.env`


To run this application run the following commands on your terminal:
```
npm install
npm start
```


Keep in mind that this service needs to have an accessible public URL to configure Twilio's webhook. Use tools like Ngrok to make your link available if it's running in a local environment.