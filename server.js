const express = require("express");
const app = express();
const server = require("http").createServer(app);
const WebSocket = require("ws");
const wss = new WebSocket.Server({ server });


app.use(express.urlencoded({
    extended: true
}));
app.use(express.static("public"));
console.log("Listening on port 8080");
server.listen(8080);

console.log("Open the url with /level to control the game!");

require("dotenv").config();

// Initialize Google Speech to Text
const speech = require("@google-cloud/speech");
const client = new speech.SpeechClient();

// Setup Transcription Request
const request = {
  config: {
    encoding: "MULAW",
    sampleRateHertz: 8000,
    languageCode: "pt-BR"
  },
  interimResults: true
};


// Initialize Twilio
const twilio = require('twilio');
const twilioClient = twilio( 
    process.env.TWILIO_ACCOUNT_ID, 
    process.env.TWILIO_AUTH_TOKEN
);


// Initialize Firebase
var admin = require("firebase-admin");
const serviceAccount = require("./br-events-firebase.json");
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else {
        admin.app(); // if already initialized, use that one
}

const firestore = admin.firestore();
const md5 = require('md5');






const kick_not_winners = () => {
    let winners = Object.keys(players).filter(id => players[id].points > level)
    console.log('KICK!!!!');
    console.log(winners);

    twilioClient.calls.each(call => {
        if (call.status === 'in-progress') {
            // TODO: verificar se esta na lista de winners
            if (!winners.includes(call.sid)) {
                const twiml = new twilio.twiml.VoiceResponse();
                twiml.stop().stream({ name: call.sid });
                twiml.say({ voice: 'Polly.Camila-Neural', language: 'pt-BR' }, 
                    `Você não consegui identificar as palavras-chave desta fase.`
                );
                twiml.pause({ length: 1 });
                twiml.say({ voice: 'Polly.Camila-Neural', language: 'pt-BR' }, 
                    `Obrigado por ter participado do nosso jogo interativo!`
                );
    
                twilioClient.calls(call.sid)
                    .update({ twiml: twiml.toString() })
                    .then(call => console.log('encerrada: ', call.from));

            } else {
                console.log('ganhador: ', call.sid, call.from);
            }
    
        }
    });    
}


// Tratar Conexão do Web Socket
wss.on("connection", function connection(ws, req) {
    console.log("Nova conexão iniciada", req.url);

    const recognizeStream = client
        .streamingRecognize(request)
        .on("error", console.error)
        .on("data", async data => {

            // prevenir condição de corrida
            if (game[level].used.length >= game[level].winners_max) {
                return 
            }
            let callSid = req.url.replace('/', '');
            // console.log(callSid, data.results[0].alternatives[0].transcript);

            // verificar conteudo recebido e redirecionar quando for o caso
            let foundKeyword = checkContent(callSid, data.results[0].alternatives[0].transcript);
            if (foundKeyword) {
                console.log(callSid, ' FOUND >', foundKeyword);
                game[level].used.push(foundKeyword);
                game[level].keywords = game[level].keywords.filter(function(e) { return e !== foundKeyword })

                recognizeStream.destroy();

                // Congratulations, you've found a keyword message
                const twiml = new twilio.twiml.VoiceResponse();
                twiml.play('https://br-events-9512.twil.io/ka-ching.mp3');
                twiml.pause({ length: 1 });
                twiml.say({ voice: 'Polly.Camila-Neural', language: 'pt-BR' }, `Parabéns! Você acertou uma palavra e vai para a próxima fase!`);
                twiml.pause({ length: 1 });
                twiml.redirect(`https://${req.headers.host}/loop_waiting`);

                // adicionar ponto
                if (!players[callSid].points) {
                    players[callSid].points = 0
                }
                players[callSid].points++;

                // TODO: ver se alcançou limite ganhadores
                console.log('STATUS WINNERS')
                console.log('usados: ', game[level].used.length),
                console.log('max: ', game[level].winners_max)
                console.log();
                console.log();
                console.log();
                console.log();
                // Check if reached the maximum number of winners and end the call for those who aren't
                if (game[level].used.length >= game[level].winners_max) {
                    kick_not_winners();
                }


                await twilioClient.calls(callSid)
                    .update({ twiml: twiml.toString() })
                    .then(async call => {
                        console.log('> > > > > > > > > > ', escondeNumero(call.from), ' < < < < < < < < < <');

                        // add points
                        const player = md5(limpaNumero(call.from));
                        await firestore.collection('game_players').doc(player).set({
                            hidden_phone: escondeNumero(call.from),
                            points: admin.firestore.FieldValue.increment(1),
                            last_point: admin.firestore.FieldValue.serverTimestamp(),
                            call_sid: callSid
                        }, { merge: true });


                        await firestore.collection('game_players').doc(player).collection('phone_number').doc('phone').set({
                            phone: call.from,
                        }, { merge: true })

                        await firestore.collection('game_players').doc(player).collection('keywords').add({
                            keyword: foundKeyword,
                            created_at:  admin.firestore.FieldValue.serverTimestamp()
                        });
                        
                        // TODO: send through WhatsApp the current score
                        // const player_data = await (await firestore.collection('game_players').doc(player).get()).data();
                        // twilioClient.messages.create({
                        //     from: 'whatsapp:+5511933058313',
                        //     to: `whatsapp:${call.from}`,
                        //     body: `Obrigado por participar com a palavra-chave *${foundKeyword}*!\n\n\nSeu total de pontos agora é *${player_data.points}*`
                        // })
                    });

            }
        });

    
    ws.on("message", function incoming(message) {
        const msg = JSON.parse(message);
        switch (msg.event) {
            case "connected":
                console.log(`Uma nova chamada foi conectada.`);
                break;
            case "start":
                console.log(`Começando Media Stream ${msg.streamSid}`);
                break;
            case "media":
                // console.log('Recebendo áudio...');
                if (recognizeStream.destroyed) return;
                recognizeStream.write(msg.media.payload);
                break;
            case "stop":
                console.log(`Chamada finalizada!`);
                recognizeStream.destroy();
                break;
        }
    });
});

  


let level = 0;
let game_started = false;
let game = require('./game');

let players = {};




// Home da página
app.get("/", (req, res) => res.send("Olá mundo!"));

app.get("/level", (req, res) => {
    let winners = Object.keys(players).filter(id => players[id].points > level)

    res.send(`Fase atual: ${level}<br/>
        <br/><a href="/level/next">Next Legel</a>
        <br/><a href="/level/reset">Reset Game</a>
        <br/><a href="/toggle_start">${game_started ? "Stop Game" : "Start Game"}</a><br/><br/>

        <strong>Winners</strong><br/>
        <pre>${JSON.stringify(winners, null, '\t')}</pre>
        <pre>${JSON.stringify(game[level], null, '\t')}</pre>
        <br/><br/><br/>
        <strong>Players [${Object.keys(players).length}]</strong>
        <pre>${JSON.stringify(players, null, '\t')}</pre>
        
        `);
});

app.get("/level/next", (req, res) => {

    // end call for players without the minimal score
    kick_not_winners();
    let winners = Object.keys(players).filter(id => players[id].points > level)

    level++;
    // check min points
    twilioClient.calls.each(call => {
        if (call.status === 'in-progress') {
            const twiml = new twilio.twiml.VoiceResponse();
            if (!winners.includes(call.sid)) {
                twiml.stop().stream({ name: call.sid });

                // You didn't reach the minimal score message
                twiml.say({ voice: 'Polly.Camila-Neural', language: 'pt-BR' }, 
                    `Você não consegui identificar as palavras-chave desta fase.`
                );
                twiml.pause({ length: 1 });

                // Thank you message
                twiml.say({ voice: 'Polly.Camila-Neural', language: 'pt-BR' }, 
                    `Obrigado por ter participado do nosso jogo interativo!`
                );

            } else {

                twiml.stop().stream({ name: call.sid });
                // The next category message
                twiml.say({ voice: 'Polly.Camila-Neural', language: 'pt-BR' }, 
                    `Nesta fase a categoria é ${game[level].category}`
                );
                twiml.pause({ length: 1 });
                // Start message
                twiml.say({ voice: 'Polly.Camila-Neural', language: 'pt-BR' }, 
                    `Valendo!`
                );
                twiml.redirect(`https://${req.headers.host}/loop`);
    
            }

            twilioClient.calls(call.sid)
                .update({ twiml: twiml.toString() })
                .then(call => console.log('next: ', escondeNumero(call.from)));    
        }
    });
    res.redirect("/level");
});


// Restart game to level 0
app.get("/level/reset", (req, res) => {
    level = 0;
    winners = [];
    res.redirect("/level");
});

app.get("/toggle_start", (req, res) => {
    game_started = !game_started;
    if (game_started) {
        twilioClient.calls.each(call => {
            if (call.status === 'in-progress') {
                const twiml = new twilio.twiml.VoiceResponse();
                twiml.stop().stream({ name: call.sid });

                // Game is starting message
                twiml.say({ voice: 'Polly.Camila-Neural', language: 'pt-BR' }, 
                    `O jogo vai começar!`
                );
                twiml.pause({ length: 1 });
                // Category announcement
                twiml.say({ voice: 'Polly.Camila-Neural', language: 'pt-BR' }, 
                    `Nesta fase a categoria é ${game[level].category}`
                );
                twiml.pause({ length: 1 });
                // Start message
                twiml.say({ voice: 'Polly.Camila-Neural', language: 'pt-BR' }, 
                    `Valendo!`
                );
                twiml.redirect(`https://${req.headers.host}/loop`);

                twilioClient.calls(call.sid)
                    .update({ twiml: twiml.toString() })
                    .then(call => console.log('iniciou jogo: ', escondeNumero(call.from)));
        
            }
        });
    }
    res.redirect("/level");
});



// encerrar chamadas em aberto
app.get("/encerrar", (req, res) => {
    twilioClient.calls.each(call => {
        if (call.status === 'in-progress') {
            const twiml = new twilio.twiml.VoiceResponse();
            twiml.stop().stream({ name: call.sid });
            // Thank you and final message
            twiml.say({ voice: 'Polly.Camila-Neural', language: 'pt-BR' }, 'Então é isso pessoal! Obrigado por participar do nosso jogo interativo.');
            
            twilioClient.calls(call.sid)
                .update({ twiml: twiml.toString() })
                .then(call => console.log('encerrada: ', escondeNumero(call.from)));
    
        }
    });
    res.send('Obrigado!');
});








// loop used when people are waiting the game begin or the next level
app.post("/loop_waiting", (req, res) => {
    res.set("Content-Type", "text/xml");

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.stop().stream({ name: req.body.CallSid });
    twiml.play('http://demo.twilio.com/docs/classic.mp3');
    twiml.redirect(`https://${req.headers.host}/loop_waiting`);
    res.send(twiml.toString());
});

// mediastream loop. It closes a current stream and opens a new every 30 seconds
app.post("/loop", (req, res) => {
    res.set("Content-Type", "text/xml");

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.stop().stream({ name: req.body.CallSid });
    twiml.start().stream({
        name: req.body.CallSid,
        url: `wss://${req.headers.host}/${req.body.CallSid}`
    });
    twiml.pause({ length: 30 });
    twiml.redirect(`https://${req.headers.host}/loop`);

    res.send(twiml.toString());
});

// Twilio Voice Default Webhook
app.post("/", async (req, res) => {
    res.set("Content-Type", "text/xml");
    const twiml = new twilio.twiml.VoiceResponse();

    // check if the game started and block new calls
    if (!game_started) {

        console.log(`Nova chamada de ${req.body.FromCity}/${req.body.FromState} do número ${escondeNumero(req.body.From)}`);
        const player = md5(limpaNumero(req.body.From));

        let playerData = {
            hidden_phone: escondeNumero(req.body.From),
            city: req.body.FromCity,
            state: req.body.FromState,
            points: 0,
            call_sid: req.body.CallSid
        };
        players[req.body.CallSid] = playerData;

        player.created_at = admin.firestore.FieldValue.serverTimestamp();
        await firestore.collection('game_players').doc(player).set(playerData);
        await firestore.collection('game_players').doc(player).collection('phone_number').doc('phone').set({
            phone: req.body.From,
        }, { merge: true })

        // Welcome message
        twiml.say({
            voice: 'Polly.Camila-Neural',
            language: 'pt-BR'
        }, 'Boas vindas para o jogo interativo!');

        // Congratulations, you are in the game message
        twiml.say({
            voice: 'Polly.Camila-Neural',
            language: 'pt-BR'
        }, 'Parabéns, você está no jogo!');

        twiml.redirect(`https://${req.headers.host}/loop_waiting`);

    } else {
        console.log(`Entrou fora do horário de ${req.body.FromCity}/${req.body.FromState} do número ${escondeNumero(req.body.From)}`);

        // You can't join because the game started message
        twiml.say({
            voice: 'Polly.Camila-Neural',
            language: 'pt-BR'
        }, 'Olá! Infelizmente o jogo já começou e você não poderá participar desta vez.');

    }

    res.send(twiml.toString());
});

// Get the list of all attendants in the game from Firebase Firestore
app.get("/attendants", async (req, res) => {
    res.set("Content-Type", "text/json");

    const participantes = await firestore.collection('game_players').get();
    let lista = {};
    await participantes.forEach(p => lista[p.id] = p.data());

    res.send(JSON.stringify(lista, null, '\t'));
});

// Utility function to hide phone numbers
function escondeNumero(number) {
    // +5511999991234 => +55119****-1234
    if (number) number = number.replace('whatsapp:', '');
    if (!number || number.length < 12) return '+-----****-----';
    return number.substr(0, number.length - 8) + '****-' + number.substr(number.length - 4 )
}

// Utility function to remote whatsapp prefix
limpaNumero = function(number) {
    return number.replace('whatsapp:', '');
}

// Utility function to check if the attendat spoke a keyword
function checkContent(callSid, content) {
    for (keyword of game[level].keywords) {
        if (content.toLowerCase().includes(keyword.toLowerCase())) {
            return keyword
        }
    }
    return false;
}


